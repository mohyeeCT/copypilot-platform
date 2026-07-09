'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Download, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import Badge from '@/components/ui/Badge'
import CompletedJobSummary from '@/components/ui/CompletedJobSummary'
import ExportMenu from '@/components/ui/ExportMenu'
import RunningJobPanel from '@/components/ui/RunningJobPanel'
import StyledCheckbox from '@/components/ui/StyledCheckbox'
import { createClient } from '@/lib/supabase'
import { aioApi } from '@/lib/api/all-in-one'
import { exportRowsToGoogleSheets, googleSheetsExportError } from '@/lib/export/googleSheets'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

interface PageCopyResult {
  url: string
  primary_keyword?: string
  keyword_source?: string
  gsc_auth_method?: 'google_oauth' | 'service_account' | 'disabled' | 'unavailable'
  kw_volume?: number
  template_name?: string
  word_count?: number
  competitor_urls?: string[]
  docx_b64?: string
  full_page?: string
  section_results?: Record<string, string>
  content_gap_summary?: {section: string; missing_topics: string[]; summary?: string}[]
  brand_consistency?: {score?: number; reason?: string}
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

interface InternalLinkSuggestion {
  source_url: string
  target_url: string
  anchor_text: string
  confidence?: number
  reason?: string
}

function gscAuthLabel(method?: PageCopyResult['gsc_auth_method']) {
  if (method === 'google_oauth') return 'Google OAuth'
  if (method === 'service_account') return 'Service account'
  if (method === 'unavailable') return 'GSC unavailable'
  if (method === 'disabled') return 'GSC disabled'
  return ''
}

function gscErrorMessage(error?: string | null) {
  if (error === 'Google Search Console reconnect required.') {
    return 'Reconnect Google in Settings to restore Search Console data.'
  }
  if (error === 'Google Search Console OAuth configuration missing.') {
    return 'Google OAuth is not configured for this backend. Please contact the app owner.'
  }
  if (error === 'Selected Google Search Console connection unavailable.') {
    return 'Choose Google OAuth or service account in Settings, then rerun this job.'
  }
  return error || ''
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
  internal_link_suggestions?: InternalLinkSuggestion[]
  rows?: unknown[]
  settings?: Record<string, unknown>
  logs?: {ts: string; msg: string}[]
}

function previewText(text?: string, max = 120) {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  return cleaned.length > max ? `${cleaned.slice(0, max - 3).trim()}...` : cleaned
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
  const [rerunningSections, setRerunningSections] = useState<Set<string>>(new Set())
  const [reviewerInstruction, setReviewerInstruction] = useState<Record<string, string>>({})
  const [logsCollapsed, setLogsCollapsed] = useState(true)
  const [exportingSheets, setExportingSheets] = useState(false)
  const [exportingLinksSheets, setExportingLinksSheets] = useState(false)
  const jobStatus = job?.status

  useEffect(() => {
    const resetRateLimitedAction = () => { setRerunning(null); setRerunningMulti(false); setRerunningSections(new Set()) }
    window.addEventListener('api-rate-limit', resetRateLimitedAction)
    return () => window.removeEventListener('api-rate-limit', resetRateLimitedAction)
  }, [])

  const load = useCallback(async () => {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { router.push('/login'); return }
    try {
      const data = await aioApi.getJob(session.access_token, id as string)
      setJob(data)
    } catch (e) {
      console.error('Failed to fetch job:', e)
    }
  }, [id, router])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (jobStatus !== 'running' && jobStatus !== 'cancelling') return
    const t = setInterval(load, 3000) // 3s poll — page copy is slow
    return () => clearInterval(t)
  }, [jobStatus, load])

  useEffect(() => {
    if (jobStatus && jobStatus !== 'running' && jobStatus !== 'cancelling') setCancelling(false)
  }, [jobStatus])

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
      if (session) {
        await aioApi.cancelJob(session.access_token, job.id)
        await load()
      }
    } catch (e) {
      console.error('Cancel request failed:', e)
    }
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

  function buildResultsExportRows() {
    const headers = ['URL', 'Primary Keyword', 'Word Count', 'Template', 'Keyword Source', 'Volume', 'Status', 'Competitor URLs']
    const rows = job!.results!.map(r => ({
      'URL': r.url || '',
      'Primary Keyword': r.primary_keyword || '',
      'Word Count': r.word_count || '',
      'Template': r.template_name || '',
      'Keyword Source': r.keyword_source || '',
      'Volume': r.kw_volume || '',
      'Status': r.status || '',
      'Competitor URLs': (r.competitor_urls || []).join('; '),
    }))
    return { headers, rows }
  }

  function downloadCsv() {
    if (!job?.results?.length) return
    const { headers, rows } = buildResultsExportRows()
    const csvRows = rows.map(row => headers.map(header => `"${String(row[header as keyof typeof row] ?? '').replace(/"/g, '""')}"`).join(','))
    const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `page_copy_${(job.name || 'job').replace(/\s+/g, '_')}.csv`
    a.click()
  }

  function downloadXlsx() {
    if (!job?.results?.length) return
    const { rows } = buildResultsExportRows()
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Results')
    XLSX.writeFile(wb, `page_copy_${(job.name || 'job').replace(/\s+/g, '_')}.xlsx`)
  }

  async function exportGoogleSheets() {
    if (!job?.results?.length || exportingSheets) return
    setExportingSheets(true)
    try {
      const { headers, rows } = buildResultsExportRows()
      await exportRowsToGoogleSheets({
        title: `${job.name || 'All in One results'} - All in One`,
        sheet_name: 'All in One Results',
        headers,
        rows,
      })
    } catch (error) {
      alert(googleSheetsExportError(error))
    } finally {
      setExportingSheets(false)
    }
  }

  function buildInternalLinksExportRows() {
    const headers = ['Source URL', 'Target URL', 'Suggested Anchor', 'Confidence', 'Reason']
    const rows = job!.internal_link_suggestions!.map(s => ({
      'Source URL': s.source_url || '',
      'Target URL': s.target_url || '',
      'Suggested Anchor': s.anchor_text || '',
      'Confidence': s.confidence ?? '',
      'Reason': s.reason || '',
    }))
    return { headers, rows }
  }

  function downloadInternalLinksCsv() {
    if (!job?.internal_link_suggestions?.length) return
    const { headers, rows } = buildInternalLinksExportRows()
    const csvRows = rows.map(row => headers.map(header => `"${String(row[header as keyof typeof row] ?? '').replace(/"/g, '""')}"`).join(','))
    const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `internal_links_${(job.name || 'job').replace(/\s+/g, '_')}.csv`
    a.click()
  }

  function downloadInternalLinksXlsx() {
    if (!job?.internal_link_suggestions?.length) return
    const { rows } = buildInternalLinksExportRows()
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Internal Links')
    XLSX.writeFile(wb, `internal_links_${(job.name || 'job').replace(/\s+/g, '_')}.xlsx`)
  }

  async function exportInternalLinksGoogleSheets() {
    if (!job?.internal_link_suggestions?.length || exportingLinksSheets) return
    setExportingLinksSheets(true)
    try {
      const { headers, rows } = buildInternalLinksExportRows()
      await exportRowsToGoogleSheets({
        title: `${job.name || 'Internal links'} - Internal Links`,
        sheet_name: 'Internal Links',
        headers,
        rows,
      })
    } catch (error) {
      alert(googleSheetsExportError(error))
    } finally {
      setExportingLinksSheets(false)
    }
  }

  if (!job) return (
    <AppLayout title="All in One">
      <div className="flex items-center justify-center h-48">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  )

  const metaRows = job.results?.filter(row => !row.error && row.generated_title).length ?? 0
  const faqTotal = job.results?.reduce((sum, row) => sum + (row.faq_count ?? row.faq_items?.length ?? 0), 0) ?? 0
  const failedRows = job.failed_rows ?? job.results?.filter(row => row.status !== 'ok' || row.error).length ?? 0
  const linkSuggestions = job.internal_link_suggestions?.length ?? 0

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

        {/* Running job panel */}
        {(job.status === 'running' || job.status === 'cancelling') && (
          <RunningJobPanel
            status={job.status}
            completedRows={job.completed_rows}
            totalRows={job.total_rows}
            failedRows={job.failed_rows || 0}
            currentStep={job.current_step}
            logs={job.logs}
            cancelling={cancelling}
            onCancel={handleCancel}
            helperText="All in One jobs can take longer because each URL may run meta, FAQ, page copy, competitor scraping, and QA steps."
          />
        )}

        {job.status === 'complete' && job.results && job.results.length > 0 && (
          <CompletedJobSummary
            stats={[
              { label: 'Rows', value: `${job.completed_rows} / ${job.total_rows}` },
              { label: 'Meta rows', value: metaRows, tone: 'success' },
              { label: 'FAQs generated', value: faqTotal, tone: 'success' },
              { label: 'Link ideas', value: linkSuggestions, tone: 'muted' },
            ]}
            message={failedRows > 0 ? `${failedRows} rows need review before download` : 'All rows complete - ready to download'}
            logCount={job.logs?.length}
            logsCollapsed={logsCollapsed}
            onToggleLogs={job.logs?.length ? () => setLogsCollapsed(!logsCollapsed) : undefined}
          />
        )}

        {/* Collapsible log after completion */}
        {job.status === 'complete' && !logsCollapsed && job.logs?.length ? (
          <div className="mb-6">
            {!logsCollapsed && (
              <div className="rounded-xl p-3 font-mono text-xs overflow-y-auto" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", maxHeight: 200 }}>
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

        {job.error && <div className="text-error text-sm bg-error/10 border border-error/20 rounded-lg px-4 py-3 mb-4">{gscErrorMessage(job.error)}</div>}

        {job.internal_link_suggestions && job.internal_link_suggestions.length > 0 && (
          <div className="mb-6 rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-sm font-semibold">Internal link suggestions</h2>
                <p className="text-xs text-muted">{job.internal_link_suggestions.length} opportunities found across this job</p>
              </div>
              <div className="flex items-center gap-2">
                <ExportMenu
                  onCsv={downloadInternalLinksCsv}
                  onXlsx={downloadInternalLinksXlsx}
                  onGoogleSheets={exportInternalLinksGoogleSheets}
                  sheetsLoading={exportingLinksSheets}
                />
              </div>
            </div>
            <div className="space-y-2">
              {job.internal_link_suggestions.slice(0, 6).map((suggestion, si) => (
                <div key={`${suggestion.source_url}-${suggestion.target_url}-${si}`} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="text-xs font-mono text-accent truncate">{suggestion.anchor_text}</span>
                    {suggestion.confidence !== undefined && <span className="text-xs text-muted">{Math.round(suggestion.confidence * 100)}%</span>}
                  </div>
                  <p className="text-xs text-muted truncate">From: {suggestion.source_url}</p>
                  <p className="text-xs text-muted truncate">To: {suggestion.target_url}</p>
                  {suggestion.reason && <p className="text-xs text-muted mt-1">{suggestion.reason}</p>}
                </div>
              ))}
              {job.internal_link_suggestions.length > 6 && (
                <p className="text-xs text-muted">+{job.internal_link_suggestions.length - 6} more suggestions in CSV export</p>
              )}
            </div>
          </div>
        )}

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
                } catch (e) {
                  console.error('Rerun request failed:', e)
                }
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
              <StyledCheckbox
                ariaLabel="Select all All in One result rows"
                checked={selectedRows.size === job.results.length && job.results.length > 0}
                onChange={checked => setSelectedRows(checked ? new Set(job.results!.map((_, i) => i)) : new Set())}
              />
              {selectedRows.size > 0 ? `${selectedRows.size} selected` : 'Select all'}
            </label>
            {job.results.some(r => r.docx_b64) && (
              <button onClick={downloadAllDocx} className="btn-ghost text-xs flex items-center gap-1.5">
                <Download size={12} /> Download all .docx
              </button>
            )}
            <ExportMenu
              onCsv={downloadCsv}
              onXlsx={downloadXlsx}
              onGoogleSheets={exportGoogleSheets}
              sheetsLoading={exportingSheets}
            />
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
                  <StyledCheckbox
                    ariaLabel={`Select All in One result row ${i + 1}`}
                    className="shrink-0"
                    checked={selectedRows.has(i)}
                    onClick={e => e.stopPropagation()}
                    onChange={checked => setSelectedRows(prev => {
                      const next = new Set(prev)
                      checked ? next.add(i) : next.delete(i)
                      return next
                    })}
                  />
                  <span className="text-xs font-mono text-muted shrink-0">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono text-muted truncate">{row.url}</span>
                      {row.primary_keyword && (
                        <span className="text-xs font-mono text-accent shrink-0 hidden sm:block">{row.primary_keyword}</span>
                      )}
                    </div>
                    {(row.generated_title || row.optimised_h1 || row.faq_items?.[0]?.question || Object.values(row.section_results || {})[0]) && (
                      <p className="text-xs text-muted mt-1 truncate">
                        {previewText(row.generated_title || row.optimised_h1 || row.faq_items?.[0]?.question || Object.values(row.section_results || {})[0])}
                      </p>
                    )}
                  </div>
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
                      {gscAuthLabel(row.gsc_auth_method) && <span className="text-xs text-muted font-mono">GSC: {gscAuthLabel(row.gsc_auth_method)}</span>}
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

                    {row.brand_consistency?.score !== undefined && (
                      <div className="p-3 rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                        <p className="text-xs text-muted mb-1 uppercase tracking-wider">Brand match</p>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${(row.brand_consistency.score || 0) < 70 ? 'text-error' : 'text-success'}`}>
                            {row.brand_consistency.score}/100
                          </span>
                          {row.brand_consistency.reason && <span className="text-xs text-muted">{row.brand_consistency.reason}</span>}
                        </div>
                      </div>
                    )}

                    {row.content_gap_summary && row.content_gap_summary.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted uppercase tracking-wider">Content gaps</p>
                        {row.content_gap_summary.map((gap, gi) => (
                          <div key={`${gap.section}-${gi}`} className="border border-border rounded-lg p-3">
                            <p className="text-xs font-mono text-muted mb-1">{gap.section}</p>
                            <p className="text-xs text-text">{gap.summary || gap.missing_topics.join(', ')}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Meta copy */}
                    {(row.generated_title || row.generated_description) && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted uppercase tracking-wider">Meta Copy</p>
                        {row.generated_title && (
                          <div className="p-3 rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                            <p className="text-xs text-muted mb-1">Title Tag <span className={row.title_length && row.title_length > 90 ? 'text-error' : 'text-success'}>{row.title_length}/90</span></p>
                            <p className="text-sm">{row.generated_title}</p>
                          </div>
                        )}
                        {row.generated_description && (
                          <div className="p-3 rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                            <p className="text-xs text-muted mb-1">Description <span className={row.description_length && row.description_length > 200 ? 'text-error' : 'text-success'}>{row.description_length}/200</span></p>
                            <p className="text-sm">{row.generated_description}</p>
                          </div>
                        )}
                        {row.optimised_h1 && (
                          <div className="p-3 rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
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
                        {Object.entries(row.section_results).map(([name, text]) => {
                          const sectionKey = `${i}-${name}`
                          const isRegenerating = rerunningSections.has(sectionKey)
                          return (
                            <div key={name} className="border border-border rounded-lg overflow-hidden">
                              <div className="px-3 py-2 bg-border/20 flex items-center justify-between">
                                <span className="text-xs font-mono text-muted">{name}</span>
                                <span className="text-xs text-muted">{text.split(' ').length}w</span>
                              </div>
                              <div className="px-3 py-2 border-b border-border/60 flex flex-col sm:flex-row gap-2">
                                <input
                                  className="input-base text-xs flex-1 py-1.5"
                                  placeholder="Optional rerun note"
                                  value={reviewerInstruction[sectionKey] || ''}
                                  onClick={e => e.stopPropagation()}
                                  onChange={e => setReviewerInstruction(prev => ({ ...prev, [sectionKey]: e.target.value }))}
                                />
                                <button
                                  title="Regenerate this section"
                                  disabled={isRegenerating}
                                  onClick={async e => {
                                    e.stopPropagation()
                                    if (!job) return
                                    setRerunningSections(prev => new Set([...Array.from(prev), sectionKey]))
                                    try {
                                      const sb = createClient()
                                      const { data: { session } } = await sb.auth.getSession()
                                      if (!session) return
                                      await aioApi.rerunSection(session.access_token, job.id, i, name, reviewerInstruction[sectionKey] || '')
                                      const poll = setInterval(async () => {
                                        const updated = await aioApi.getJob(session.access_token, job.id)
                                        const step: string = updated.current_step || ''
                                        if (!step.startsWith(`Regenerating section '${name}'`)) {
                                          clearInterval(poll)
                                          setRerunningSections(prev => {
                                            const next = new Set(prev)
                                            next.delete(sectionKey)
                                            return next
                                          })
                                          setReviewerInstruction(prev => ({ ...prev, [sectionKey]: '' }))
                                          setJob(updated)
                                        }
                                      }, 3000)
                                    } catch (e) {
                                      console.error('Section rerun request failed:', e)
                                      setRerunningSections(prev => {
                                        const next = new Set(prev)
                                        next.delete(sectionKey)
                                        return next
                                      })
                                    }
                                  }}
                                  className="btn-ghost text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"
                                >
                                  <RefreshCw size={11} className={isRegenerating ? 'animate-spin' : ''} />
                                  Re-run
                                </button>
                              </div>
                              <p className="text-xs px-3 py-2 line-clamp-3 prose-result">{text.slice(0, 300)}{text.length > 300 ? '...' : ''}</p>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Download button */}
                    {row.docx_b64 && (
                      <button onClick={() => downloadDocx(row, i)}
                        className="btn-primary flex items-center gap-2 text-sm w-full justify-center">
                        <Download size={14} /> Download .docx
                      </button>
                    )}

                    {row.error && <p className="text-error text-xs">{gscErrorMessage(row.error)}</p>}
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
