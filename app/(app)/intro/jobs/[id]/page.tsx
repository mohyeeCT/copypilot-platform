'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import Badge from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase'
import { introApi } from '@/lib/api/intro'
import { Copy, Download, ArrowLeft, RefreshCw, Pencil, X, Square, ChevronDown, ChevronUp } from 'lucide-react'

type RowResult = {
  url: string
  intro_copy: string
  primary_keyword: string
  supporting_keywords: string
  word_count: number
  cluster_source: string
  keyword_source: string
  scrape_status?: string
  runner_up?: string
  primary_volume?: number
  primary_difficulty?: number
  status?: string
  error: string | null
}

type Job = {
  id: string
  name: string
  status: string
  total_rows: number
  completed_rows: number
  failed_rows?: number
  current_step?: string
  results: RowResult[]
  created_at: string
  error: string | null
}

export default function JobPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [job, setJob] = useState<Job | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [rerunningMulti, setRerunningMulti] = useState(false)
  const [logsCollapsed, setLogsCollapsed] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [rerunning, setRerunning] = useState<number | null>(null)
  const [newlyUpdated, setNewlyUpdated] = useState<Set<number>>(new Set())
  const [keywordOverrides, setKeywordOverrides] = useState<Record<number, string>>({})
  const [editingKeyword, setEditingKeyword] = useState<number | null>(null)
  const [edits, setEdits] = useState<Record<number, string>>({})
  const [editingRow, setEditingRow] = useState<number | null>(null)

  const load = useCallback(async () => {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) return
    try {
      const data = await introApi.getJob(session.access_token, id)
      setJob(data)
    } catch {}
  }, [id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!job || job.status !== 'running') return
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [job, load])

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }


  const markUpdated = (indices: number[], results: RowResult[]) => {
    const successful = indices.filter(i => {
      const r = results[i]
      return r && !r.error && r.intro_copy && r.intro_copy.length > 0
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
      if (session) await introApi.cancelJob(session.access_token, job.id)
    } catch {}
    setCancelling(false)
  }

  function downloadCsv() {
    if (!job?.results?.length) return
    const headers = [
      'URL', 'Intro Copy', 'Primary Keyword', 'Supporting Keywords',
      'Word Count', 'Cluster Source', 'Keyword Source', 'Runner Up',
      'Primary Volume', 'Primary Difficulty', 'Scrape Status', 'Intro Status',
    ]
    const csvRows = job.results.map(r => {
      const introCopy = edits[job.results.indexOf(r)] ?? r.intro_copy
      return [
        r.url || '',
        introCopy || '',
        r.primary_keyword || '',
        r.supporting_keywords || '',
        r.word_count ?? '',
        r.cluster_source || '',
        r.keyword_source || '',
        r.runner_up || '',
        r.primary_volume ?? '',
        r.primary_difficulty ?? '',
        r.scrape_status || '',
        r.status || (r.error ? 'error' : 'ok'),
      ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)
    })
    const csv = [headers, ...csvRows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${job.name || 'intro-results'}.csv`
    a.click()
  }

  if (!job) return (
    <AppLayout title="Page Intro">
      <div className="flex items-center justify-center py-24">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  )

  const progress = job.total_rows > 0 ? (job.completed_rows / job.total_rows) * 100 : 0

  return (
    <AppLayout title="Page Intro">
      <div className="max-w-5xl">
        <button onClick={() => router.push('/intro/jobs')}
          className="flex items-center gap-2 text-muted hover:text-text text-sm mb-6 transition-colors">
          <ArrowLeft size={14} /> Back to Intro jobs
        </button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{job.name || 'Untitled Job'}</h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge label={job.status} />
              <span className="text-muted text-xs font-mono">{job.completed_rows}/{job.total_rows} rows</span>
              {job.failed_rows != null && job.failed_rows > 0 && (
                <span className="text-error text-xs font-mono">{job.failed_rows} failed</span>
              )}
              <span className="text-muted text-xs font-mono">
                {new Date(job.created_at).toLocaleString('en-GB')}
              </span>
            </div>
          </div>

          {job.status === 'complete' && job.results?.length > 0 && (
            <>
              {selectedRows.size > 0 && (
                <button
                  onClick={async () => {
                    setRerunningMulti(true)
                    try {
                      const sb = createClient()
                      const { data: { session } } = await sb.auth.getSession()
                      if (session) {
                        const indices = Array.from(selectedRows)
                        await introApi.rerunRows(session.access_token, job.id, indices)
                        const refreshed = await introApi.getJob(session.access_token, job.id)
                        markUpdated(indices, refreshed.results || [])
                        setSelectedRows(new Set())
                        load()
                      }
                    } catch {}
                    setRerunningMulti(false)
                  }}
                  disabled={rerunningMulti}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  <RefreshCw size={13} className={rerunningMulti ? 'animate-spin' : ''} />
                  {rerunningMulti ? 'Starting...' : `Re-run ${selectedRows.size} row${selectedRows.size !== 1 ? 's' : ''}`}
                </button>
              )}
              {selectedRows.size === 0 && job.results.some(r => r.status === 'error' || r.error) && (
                <button
                  onClick={() => setSelectedRows(new Set(
                    job.results.map((r, i) => r.status === 'error' || r.error ? i : -1).filter(i => i >= 0)
                  ))}
                  className="btn-ghost flex items-center gap-2 text-xs"
                >
                  Select all failed
                </button>
              )}
              <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="accent-[var(--accent)]"
                  checked={selectedRows.size === job.results.length && job.results.length > 0}
                  onChange={e => setSelectedRows(e.target.checked ? new Set(job.results.map((_, i) => i)) : new Set())}
                />
                {selectedRows.size > 0 ? `${selectedRows.size} selected` : 'Select all'}
              </label>
              <div className="flex items-center bg-border/40 rounded-lg p-0.5">
                <button onClick={() => setView('cards')}
                  className={`text-xs px-3 py-1.5 rounded-md transition-colors ${view === 'cards' ? 'bg-surface text-text' : 'text-muted hover:text-text'}`}>
                  Cards
                </button>
                <button onClick={() => setView('table')}
                  className={`text-xs px-3 py-1.5 rounded-md transition-colors ${view === 'table' ? 'bg-surface text-text' : 'text-muted hover:text-text'}`}>
                  Table
                </button>
              </div>
              <button onClick={downloadCsv} className="btn-secondary text-xs flex items-center gap-1.5">
                <Download size={12} /> Export CSV
              </button>
            </>
          )}
        </div>

        {/* Progress bar */}
        {(job.status === 'running' || job.status === 'cancelling') && (
          <div className="mb-6 flex flex-col md:grid md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }} />
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-accent font-mono animate-pulse">
                  {job.current_step || 'Processing...'}
                </p>
                <p className="text-xs text-muted font-mono">{Math.round(progress)}%</p>
              </div>
            </div>
            <div className="md:col-span-3 card p-3 font-mono text-xs overflow-y-auto" style={{ maxHeight: 180 }}>
              {((job as unknown as {logs?: {ts: string; msg: string}[]}).logs || []).length === 0 ? (
                <p className="text-muted">Waiting for first update...</p>
              ) : (
                ((job as unknown as {logs?: {ts: string; msg: string}[]}).logs || []).map((entry, i) => {
                  const elapsed = Math.round((new Date(entry.ts).getTime() - new Date((job as unknown as {logs?: {ts: string; msg: string}[]}).logs![0].ts).getTime()) / 1000)
                  return (
                    <div key={i} className="flex gap-2 py-0.5 border-b border-border/30 last:border-0">
                      <span className="text-muted shrink-0" style={{ minWidth: 36 }}>+{elapsed}s</span>
                      <span className="text-text">{entry.msg}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* Stop job button */}
        {(job.status === 'running' || job.status === 'cancelling') && (
          <div className="mb-4">
            <button
              onClick={handleCancel}
              disabled={cancelling || job.status === 'cancelling'}
              className="flex items-center gap-2 text-xs border border-error/30 text-error bg-error/8 hover:bg-error/15 transition-colors rounded-lg px-3 py-2 disabled:opacity-50"
            >
              <Square size={12} fill="currentColor" />
              {job.status === 'cancelling' ? 'Stopping...' : cancelling ? 'Stopping...' : 'Stop job'}
            </button>
          </div>
        )}

        {/* Collapsible log after completion */}
        {job.status === 'complete' && (job as unknown as {logs?: {ts: string; msg: string}[]}).logs?.length ? (
          <div className="mb-6">
            <button
              onClick={() => setLogsCollapsed(!logsCollapsed)}
              className="flex items-center gap-2 text-xs text-muted hover:text-text transition-colors mb-2"
            >
              {logsCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
              {logsCollapsed ? 'Show run log' : 'Hide run log'}
              <span className="text-muted/50">({((job as unknown as {logs?: {ts: string; msg: string}[]}).logs || []).length} steps)</span>
            </button>
            {!logsCollapsed && (
              <div className="card p-3 font-mono text-xs overflow-y-auto" style={{ maxHeight: 200 }}>
                {((job as unknown as {logs?: {ts: string; msg: string}[]}).logs || []).map((entry, i) => {
                  const logs = (job as unknown as {logs?: {ts: string; msg: string}[]}).logs!
                  const elapsed = Math.round((new Date(entry.ts).getTime() - new Date(logs[0].ts).getTime()) / 1000)
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

        {job.error && (
          <div className="text-error text-sm bg-error/10 border border-error/20 rounded-lg px-4 py-3 mb-4">
            {job.error}
          </div>
        )}

        {/* Results */}
        {job.results?.length > 0 && (
          <>
            {view === 'table' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      {['URL', 'Primary Keyword', 'Supporting Keywords', 'Words', 'Source', 'Status'].map(h => (
                        <th key={h} className="text-left py-2 pr-4 text-muted font-normal whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {job.results.map((row, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-surface/50 cursor-pointer"
                        onClick={() => { setView('cards'); setExpanded(i) }}>
                        <td className="py-2 pr-4 font-mono text-muted max-w-xs truncate">{row.url}</td>
                        <td className="py-2 pr-4 text-accent font-mono">{row.primary_keyword || 'none'}</td>
                        <td className="py-2 pr-4 text-muted max-w-xs truncate">{row.supporting_keywords || ''}</td>
                        <td className="py-2 pr-4">{row.word_count ?? ''}</td>
                        <td className="py-2 pr-4"><Badge label={row.cluster_source || ''} /></td>
                        <td className="py-2 pr-4">
                          <Badge label={row.error ? 'error' : (row.status || 'ok')} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-3">
                {job.results.map((row, i) => (
                  <div key={i} className={`card overflow-hidden ${selectedRows.has(i) ? 'ring-1 ring-accent/30' : ''} ${newlyUpdated.has(i) ? 'row-flash' : ''}`}>
                    {/* Row header */}
                    <button
                      onClick={() => { setExpanded(expanded === i ? null : i); setNewlyUpdated(prev => { const n = new Set(prev); n.delete(i); return n }) }}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface/50 transition-colors text-left">
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          className="accent-[var(--accent)] shrink-0"
                          checked={selectedRows.has(i)}
                          onClick={e => e.stopPropagation()}
                          onChange={e => setSelectedRows(prev => {
                            const next = new Set(prev)
                            e.target.checked ? next.add(i) : next.delete(i)
                            return next
                          })}
                        />
                        <span className="text-xs font-mono text-muted shrink-0">{i + 1}</span>
                        <span className="text-xs font-mono text-muted truncate">{row.url}</span>
                        {row.primary_keyword && (
                          <span className="text-xs font-mono text-accent shrink-0">{row.primary_keyword}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {row.word_count != null && (
                          <span className="text-xs text-muted font-mono">{row.word_count}w</span>
                        )}
                        {newlyUpdated.has(i) && (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                            style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}>
                            ✓ new
                          </span>
                        )}
                        <Badge label={row.cluster_source || ''} />
                        <Badge label={row.error ? 'error' : (row.status || 'ok')} />
                      </div>
                    </button>

                    {/* Row detail */}
                    {expanded === i && (
                      <div className="px-4 pb-4 space-y-4 border-t border-border">
                        {row.error && (
                          <p className="text-xs text-error bg-error/10 rounded px-3 py-2 mt-3 font-mono">{row.error}</p>
                        )}

                        {/* Keyword header row */}
                        <div className="flex items-center gap-3 mt-3">
                          {/* Primary keyword with override */}
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-xs text-muted shrink-0">Primary:</span>
                            {editingKeyword === i ? (
                              <>
                                <input
                                  autoFocus
                                  value={keywordOverrides[i] ?? row.primary_keyword ?? ''}
                                  onChange={e => setKeywordOverrides(prev => ({ ...prev, [i]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === 'Escape') setEditingKeyword(null) }}
                                  className="input-base text-xs flex-1"
                                />
                                <button
                                  onClick={async () => {
                                    const override = keywordOverrides[i]?.trim()
                                    if (!override) return
                                    setRerunning(i)
                                    setEditingKeyword(null)
                                    const sb = createClient()
                                    const { data: { session } } = await sb.auth.getSession()
                                    if (session) {
                                      await introApi.rerunRow(session.access_token, job.id, i, override)
                                      const poll = setInterval(async () => {
                                        const updated = await introApi.getJob(session.access_token, job.id)
                                        if (!updated.current_step?.includes('Re-running')) {
                                          setRerunning(null)
                                          clearInterval(poll)
                                          load()
                                        }
                                      }, 2000)
                                    }
                                  }}
                                  className="text-xs text-accent font-medium hover:opacity-70 transition-opacity shrink-0">
                                  Re-run
                                </button>
                                <button onClick={() => setEditingKeyword(null)} className="text-muted hover:text-error transition-colors">
                                  <X size={11} />
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="text-xs text-accent font-mono truncate">{row.primary_keyword || 'none'}</span>
                                <button
                                  onClick={e => { e.stopPropagation(); setEditingKeyword(i); setKeywordOverrides(prev => ({ ...prev, [i]: row.primary_keyword || '' })) }}
                                  className="text-muted hover:text-accent transition-colors shrink-0" title="Override keyword">
                                  <Pencil size={11} />
                                </button>
                              </>
                            )}
                          </div>

                          {row.runner_up && (
                            <span className="text-xs text-muted">
                              Runner up: <span className="font-mono">{row.runner_up}</span>
                            </span>
                          )}

                          {rerunning === i && (
                            <span className="flex items-center gap-1.5 text-xs text-muted">
                              <RefreshCw size={11} className="animate-spin" /> Re-running...
                            </span>
                          )}
                        </div>

                        {row.supporting_keywords && (
                          <div className="text-xs text-muted">
                            Supporting: <span className="font-mono">{row.supporting_keywords}</span>
                          </div>
                        )}

                        {/* Intro copy */}
                        {row.intro_copy || edits[i] ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted">Intro copy</span>
                              <div className="flex items-center gap-2">
                                {editingRow !== i ? (
                                  <button onClick={() => { setEditingRow(i); setEdits(prev => ({ ...prev, [i]: prev[i] ?? row.intro_copy })) }}
                                    className="text-muted hover:text-accent transition-colors p-1" title="Edit">
                                    <Pencil size={11} />
                                  </button>
                                ) : (
                                  <button onClick={() => setEditingRow(null)}
                                    className="text-xs text-accent hover:opacity-70 transition-opacity font-medium">
                                    Save
                                  </button>
                                )}
                                <button onClick={() => copy(edits[i] ?? row.intro_copy, `intro-${i}`)}
                                  className="flex items-center gap-1 text-xs text-muted hover:text-accent transition-colors">
                                  <Copy size={11} />
                                  {copied === `intro-${i}` ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                            </div>

                            {editingRow === i ? (
                              <textarea
                                className="input-base text-sm w-full resize-y leading-relaxed"
                                rows={5}
                                value={edits[i] ?? row.intro_copy}
                                onChange={e => setEdits(prev => ({ ...prev, [i]: e.target.value }))}
                              />
                            ) : (
                              <p className="text-sm leading-relaxed bg-bg border border-border rounded-lg px-4 py-3">
                                {edits[i] ?? row.intro_copy}
                              </p>
                            )}
                          </div>
                        ) : null}

                        {/* Debug panel */}
                        <details className="group">
                          <summary className="text-xs text-muted cursor-pointer hover:text-accent transition-colors select-none flex items-center gap-1.5">
                            <span className="font-mono">Debug: keyword signals</span>
                          </summary>
                          <div className="mt-2 space-y-2">
                            <p className="text-xs font-mono text-muted bg-border/30 rounded px-3 py-2 leading-relaxed">
                              Cluster source: <span className="text-accent">{row.cluster_source || 'n/a'}</span>
                              {' | '}Keyword source: {row.keyword_source || 'n/a'}
                              {' | '}Volume: {row.primary_volume ?? 'n/a'}
                              {' | '}Difficulty: {row.primary_difficulty ?? 'n/a'}
                              {' | '}Scrape: {row.scrape_status || 'n/a'}
                            </p>
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}
