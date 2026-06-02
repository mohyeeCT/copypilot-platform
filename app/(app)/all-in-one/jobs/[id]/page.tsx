'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Download, RefreshCw, ChevronDown, ChevronUp, Square } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import Badge from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase'
import { aioApi } from '@/lib/api/all-in-one'

interface PageCopyResult {
  url: string
  primary_keyword?: string
  keyword_source?: string
  kw_volume?: number
  template_name?: string
  word_count?: number
  competitor_urls?: string[]
  docx_b64?: string
  full_page?: string
  section_results?: Record<string, string>
  // Meta fields
  generated_title?: string
  generated_description?: string
  optimised_h1?: string
  title_length?: number
  description_length?: number
  // FAQ fields
  faq_items?: {question: string; answer: string}[]
  faq_count?: number
  faq_schema?: string
  status?: string
  error?: string
}

interface Job {
  id: string
  name: string
  status: string
  total_rows: number
  completed_rows: number
  failed_rows: number
  current_step?: string
  error?: string
  results?: PageCopyResult[]
  rows?: unknown[]
  settings?: Record<string, unknown>
  logs?: {ts: string; msg: string}[]
}

export default function PageCopyJobPage() {
  const { id }  = useParams()
  const router  = useRouter()
  const [job, setJob]                   = useState<Job | null>(null)
  const [cancelling, setCancelling]     = useState(false)
  const [rerunning, setRerunning]       = useState<number | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [rerunningMulti, setRerunningMulti] = useState(false)
  const [newlyUpdated, setNewlyUpdated] = useState<Set<number>>(new Set())
  const [expanded, setExpanded]         = useState<number | null>(null)
  const [logsCollapsed, setLogsCollapsed] = useState(false)

  const load = useCallback(async () => {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { router.push('/login'); return }
    try {
      const data = await aioApi.getJob(session.access_token, id as string)
      setJob(data)
    } catch {}
  }, [id, router])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!job || job.status !== 'running') return
    const t = setInterval(load, 3000) // 3s poll — page copy is slow
    return () => clearInterval(t)
  }, [job, load])

  const progress = job ? (job.completed_rows / Math.max(job.total_rows, 1)) * 100 : 0

  function markUpdated(indices: number[], results: PageCopyResult[]) {
    const successful = indices.filter(i => {
      const r = results[i]
      return r && !r.error && r.word_count && r.word_count > 0
    })
    if (!successful.length) return
    setNewlyUpdated(prev => new Set([...Array.from(prev), ...successful]))
    setTimeout(() => {
      setNewlyUpdated(prev => {
        const next = new Set(prev)
        successful.forEach(i => next.delete(i))
        return next
      })
    }, 8000)
  }

  async function handleCancel() {
    if (!job) return
    setCancelling(true)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (session) await aioApi.cancelJob(session.access_token, job.id)
    } catch {}
    setCancelling(false)
  }

  function downloadDocx(row: PageCopyResult, index: number) {
    if (!row.docx_b64) return
    const bytes = Uint8Array.from(atob(row.docx_b64), c => c.charCodeAt(0))
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    const slug = (row.url || `row-${index + 1}`).replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '_').slice(0, 50)
    a.download = `${slug}.docx`
    a.click()
  }

  function downloadAllDocx() {
    if (!job?.results) return
    job.results.forEach((r, i) => {
      if (r.docx_b64 && r.status === 'ok') {
        setTimeout(() => downloadDocx(r, i), i * 300)
      }
    })
  }

  function downloadCsv() {
    if (!job?.results?.length) return
    const headers = ['URL', 'Primary Keyword', 'Word Count', 'Template', 'Keyword Source', 'Volume', 'Status', 'Competitor URLs']
    const rows = job.results.map(r => [
      r.url, r.primary_keyword || '', r.word_count || '',
      r.template_name || '', r.keyword_source || '', r.kw_volume || '',
      r.status || '', (r.competitor_urls || []).join('; '),
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `page_copy_${(job.name || 'job').replace(/\s+/g, '_')}.csv`
    a.click()
  }

  if (!job) return (
    <AppLayout title="All in One">
      <div className="flex items-center justify-center h-48">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  )

  return (
    <AppLayout title="All in One">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/all-in-one/jobs" className="text-muted hover:text-text transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{job.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge label={job.status} />
              <span className="text-xs text-muted font-mono">{job.completed_rows}/{job.total_rows} rows</span>
              {job.failed_rows > 0 && <span className="text-xs text-error font-mono">{job.failed_rows} failed</span>}
            </div>
          </div>
        </div>

        {/* Progress + log */}
        {(job.status === 'running' || job.status === 'cancelling') && (
          <div className="mb-6 flex flex-col md:grid md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-accent font-mono animate-pulse">{job.current_step || 'Processing...'}</p>
                <p className="text-xs text-muted font-mono">{Math.round(progress)}%</p>
              </div>
              <p className="text-xs text-muted mt-1">Page copy jobs are slow — each URL requires multiple AI calls and competitor scraping.</p>
            </div>
            <div className="md:col-span-3 card p-3 font-mono text-xs overflow-y-auto" style={{ maxHeight: 200 }}>
              {!(job.logs || []).length ? (
                <p className="text-muted">Waiting for first update...</p>
              ) : (job.logs || []).map((entry, i) => {
                const logs = job.logs!
                const chapterStart = [...logs].slice(0, i + 1).reverse().find(l => l.msg.includes('starting —') || l.msg.startsWith('==='))
                const baseTs = chapterStart ? new Date(chapterStart.ts).getTime() : new Date(logs[0]?.ts || entry.ts).getTime()
                const elapsed = Math.round((new Date(entry.ts).getTime() - baseTs) / 1000)
                return (
                  <div key={i} className="flex gap-2 py-0.5 border-b border-border/30 last:border-0">
                    <span className="text-muted shrink-0" style={{ minWidth: 36 }}>+{elapsed}s</span>
                    <span className="text-text">{entry.msg}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Stop job */}
        {(job.status === 'running' || job.status === 'cancelling') && (
          <div className="mb-4">
            <button onClick={handleCancel} disabled={cancelling || job.status === 'cancelling'}
              className="flex items-center gap-2 text-xs border border-error/30 text-error bg-error/8 hover:bg-error/15 transition-colors rounded-lg px-3 py-2 disabled:opacity-50">
              <Square size={12} fill="currentColor" />
              {job.status === 'cancelling' ? 'Stopping...' : 'Stop job'}
            </button>
          </div>
        )}

        {/* Collapsible log after completion */}
        {job.status === 'complete' && job.logs?.length ? (
          <div className="mb-6">
            <button onClick={() => setLogsCollapsed(!logsCollapsed)}
              className="flex items-center gap-2 text-xs text-muted hover:text-text transition-colors mb-2">
              {logsCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
              {logsCollapsed ? 'Show run log' : 'Hide run log'}
              <span className="text-muted/50">({(job.logs || []).length} steps)</span>
            </button>
            {!logsCollapsed && (
              <div className="card p-3 font-mono text-xs overflow-y-auto" style={{ maxHeight: 200 }}>
                {(job.logs || []).map((entry, i) => {
                  const logs = job.logs!
                  const chapterStart = [...logs].slice(0, i + 1).reverse().find(l => l.msg.includes('starting —') || l.msg.startsWith('==='))
                  const baseTs = chapterStart ? new Date(chapterStart.ts).getTime() : new Date(logs[0]?.ts || entry.ts).getTime()
                  const elapsed = Math.round((new Date(entry.ts).getTime() - baseTs) / 1000)
                  return (
                    <div key={i} className="flex gap-2 py-0.5 border-b border-border/30 last:border-0">
                      <span className="text-muted shrink-0" style={{ minWidth: 36 }}>+{elapsed}s</span>
                      <span className="text-muted">{entry.msg}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : null}

        {job.error && <div className="text-error text-sm bg-error/10 border border-error/20 rounded-lg px-4 py-3 mb-4">{job.error}</div>}

        {/* Results toolbar */}
        {job.results && job.results.length > 0 && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-sm font-medium flex-1">{job.results.length} rows</span>
            {selectedRows.size > 0 && (
              <button onClick={async () => {
                setRerunningMulti(true)
                try {
                  const sb = createClient()
                  const { data: { session } } = await sb.auth.getSession()
                  if (session) {
                    const indices = Array.from(selectedRows)
                    await aioApi.rerunRows(session.access_token, job.id, indices)
                    const refreshed = await aioApi.getJob(session.access_token, job.id)
                    markUpdated(indices, refreshed.results || [])
                    setSelectedRows(new Set())
                    load()
                  }
                } catch {}
                setRerunningMulti(false)
              }} disabled={rerunningMulti} className="btn-primary flex items-center gap-2 text-sm">
                <RefreshCw size={13} className={rerunningMulti ? 'animate-spin' : ''} />
                {rerunningMulti ? 'Starting...' : `Re-run ${selectedRows.size} row${selectedRows.size !== 1 ? 's' : ''}`}
              </button>
            )}
            {selectedRows.size === 0 && job.results.some(r => r.status !== 'ok') && (
              <button onClick={() => setSelectedRows(new Set(
                job.results!.map((r, i) => r.status !== 'ok' ? i : -1).filter(i => i >= 0)
              ))} className="btn-ghost text-xs">Select all failed</button>
            )}
            <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none">
              <input type="checkbox" className="accent-[var(--accent)]"
                checked={selectedRows.size === job.results.length && job.results.length > 0}
                onChange={e => setSelectedRows(e.target.checked ? new Set(job.results!.map((_, i) => i)) : new Set())} />
              {selectedRows.size > 0 ? `${selectedRows.size} selected` : 'Select all'}
            </label>
            {job.results.some(r => r.docx_b64) && (
              <button onClick={downloadAllDocx} className="btn-ghost text-xs flex items-center gap-1.5">
                <Download size={12} /> Download all .docx
              </button>
            )}
            <button onClick={downloadCsv} className="btn-ghost text-xs flex items-center gap-1.5">
              <Download size={12} /> Export CSV
            </button>
          </div>
        )}

        {/* Result cards */}
        {job.results && job.results.length > 0 && (
          <div className="card divide-y divide-border">
            {job.results.map((row, i) => (
              <div key={i} className={`${selectedRows.has(i) ? 'bg-accent/5' : ''} ${newlyUpdated.has(i) ? 'row-flash' : ''}`}>
                {/* Row header */}
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-border/20 cursor-pointer transition-colors"
                  onClick={() => { setExpanded(expanded === i ? null : i); setNewlyUpdated(prev => { const n = new Set(prev); n.delete(i); return n }) }}>
                  <input type="checkbox" className="accent-[var(--accent)] shrink-0"
                    checked={selectedRows.has(i)}
                    onClick={e => e.stopPropagation()}
                    onChange={e => setSelectedRows(prev => {
                      const next = new Set(prev)
                      e.target.checked ? next.add(i) : next.delete(i)
                      return next
                    })} />
                  <span className="text-xs font-mono text-muted shrink-0">{i + 1}</span>
                  <span className="text-xs font-mono text-muted truncate flex-1">{row.url}</span>
                  {row.primary_keyword && (
                    <span className="text-xs font-mono text-accent shrink-0 hidden sm:block">{row.primary_keyword}</span>
                  )}
                  {row.generated_title && <span className="text-xs text-muted font-mono hidden lg:block">meta ✓</span>}
                  {row.faq_count ? <span className="text-xs text-muted font-mono hidden lg:block">{row.faq_count} FAQs</span> : null}
                  <div className="flex items-center gap-2 shrink-0">
                    {row.word_count ? <span className="text-xs text-muted font-mono">{row.word_count}w</span> : null}
                    {row.template_name && <span className="text-xs text-muted font-mono hidden md:block">{row.template_name}</span>}
                    {newlyUpdated.has(i) && (
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                        style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}>
                        ✓ new
                      </span>
                    )}
                    <Badge label={row.error ? 'error' : (row.status || 'ok')} />
                    {/* Download docx button */}
                    {row.docx_b64 && (
                      <button onClick={e => { e.stopPropagation(); downloadDocx(row, i) }}
                        className="text-xs px-2 py-1 rounded border border-accent/30 text-accent hover:bg-accent/10 transition-colors flex items-center gap-1">
                        <Download size={11} /> .docx
                      </button>
                    )}
                    {/* Rerun button */}
                    {rerunning === i ? (
                      <RefreshCw size={12} className="animate-spin text-accent" />
                    ) : (
                      <button onClick={async e => {
                        e.stopPropagation()
                        setRerunning(i)
                        const sb = createClient()
                        const { data: { session } } = await sb.auth.getSession()
                        if (session) {
                          await aioApi.rerunRow(session.access_token, job.id, i)
                          const poll = setInterval(async () => {
                            const updated = await aioApi.getJob(session.access_token, job.id)
                            if (updated.status !== 'running') {
                              setRerunning(null)
                              clearInterval(poll)
                              markUpdated([i], updated.results || [])
                              load()
                            }
                          }, 3000)
                        }
                      }} className="text-muted hover:text-accent transition-colors">
                        <RefreshCw size={12} />
                      </button>
                    )}
                    {expanded === i ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
                  </div>
                </div>

                {/* Expanded: section preview */}
                {expanded === i && (
                  <div className="px-4 pb-4 space-y-4 bg-bg/40">
                    {/* Meta */}
                    <div className="flex items-center gap-4 pt-3 flex-wrap">
                      {row.primary_keyword && <span className="text-xs text-muted">Keyword: <span className="text-accent font-mono">{row.primary_keyword}</span></span>}
                      {row.kw_volume && <span className="text-xs text-muted font-mono">vol: {row.kw_volume}</span>}
                      {row.keyword_source && <span className="text-xs text-muted font-mono">{row.keyword_source}</span>}
                      {row.word_count && <span className="text-xs text-muted font-mono">{row.word_count} words</span>}
                      {row.template_name && <span className="text-xs text-muted">Template: <span className="text-text">{row.template_name}</span></span>}
                    </div>

                    {row.competitor_urls && row.competitor_urls.length > 0 && (
                      <div>
                        <p className="text-xs text-muted mb-1 uppercase tracking-wider">Competitors scraped</p>
                        <div className="space-y-1">
                          {row.competitor_urls.map((u, ci) => (
                            <a key={ci} href={u} target="_blank" rel="noopener noreferrer"
                              className="block text-xs font-mono text-accent hover:underline truncate">{u}</a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Meta copy */}
                    {(row.generated_title || row.generated_description) && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted uppercase tracking-wider">Meta Copy</p>
                        {row.generated_title && (
                          <div className="p-3 bg-surface border border-border rounded-lg">
                            <p className="text-xs text-muted mb-1">Title Tag <span className={row.title_length && row.title_length > 60 ? 'text-error' : 'text-success'}>{row.title_length}/60</span></p>
                            <p className="text-sm">{row.generated_title}</p>
                          </div>
                        )}
                        {row.generated_description && (
                          <div className="p-3 bg-surface border border-border rounded-lg">
                            <p className="text-xs text-muted mb-1">Description <span className={row.description_length && row.description_length > 155 ? 'text-error' : 'text-success'}>{row.description_length}/155</span></p>
                            <p className="text-sm">{row.generated_description}</p>
                          </div>
                        )}
                        {row.optimised_h1 && (
                          <div className="p-3 bg-surface border border-border rounded-lg">
                            <p className="text-xs text-muted mb-1">Optimised H1</p>
                            <p className="text-sm font-medium">{row.optimised_h1}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* FAQ preview */}
                    {row.faq_items && row.faq_items.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted uppercase tracking-wider">FAQs ({row.faq_count})</p>
                        {row.faq_items.slice(0, 3).map((faq, fi) => (
                          <div key={fi} className="border border-border rounded-lg p-3">
                            <p className="text-xs font-semibold mb-1">{faq.question}</p>
                            <p className="text-xs text-muted line-clamp-2">{faq.answer}</p>
                          </div>
                        ))}
                        {(row.faq_items.length > 3) && <p className="text-xs text-muted">+{row.faq_items.length - 3} more FAQs in docx</p>}
                      </div>
                    )}

                    {/* Section previews */}
                    {row.section_results && Object.keys(row.section_results).length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs text-muted uppercase tracking-wider">Page Copy Sections</p>
                        {Object.entries(row.section_results).map(([name, text]) => (
                          <div key={name} className="border border-border rounded-lg overflow-hidden">
                            <div className="px-3 py-2 bg-border/20 flex items-center justify-between">
                              <span className="text-xs font-mono text-muted">{name}</span>
                              <span className="text-xs text-muted">{text.split(' ').length}w</span>
                            </div>
                            <p className="text-xs text-muted px-3 py-2 line-clamp-3">{text.slice(0, 300)}{text.length > 300 ? '...' : ''}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Download button */}
                    {row.docx_b64 && (
                      <button onClick={() => downloadDocx(row, i)}
                        className="btn-primary flex items-center gap-2 text-sm w-full justify-center">
                        <Download size={14} /> Download .docx
                      </button>
                    )}

                    {row.error && <p className="text-error text-xs">{row.error}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
