'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Copy, Download, ChevronDown, ChevronUp, ArrowLeft, RefreshCw, Pencil, X } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import Badge from '@/components/ui/Badge'
import CompletedJobSummary from '@/components/ui/CompletedJobSummary'
import RunningJobPanel from '@/components/ui/RunningJobPanel'
import StyledCheckbox from '@/components/ui/StyledCheckbox'
import { createClient } from '@/lib/supabase'
import { faqApi } from '@/lib/api/faq'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

type FAQ = { question: string; answer: string; source: string }
type RowResult = {
  url: string; keyword: string; selected_keyword?: string; keyword_source: string
  gsc_auth_method?: 'google_oauth' | 'service_account' | 'disabled' | 'unavailable'
  runner_up?: string; scrape_status?: string
  ai_overview_present?: boolean; ao_question_count?: number
  ai_overview_raw_text?: string; paa_raw_text?: string
  ao_attempts?: number; serp_item_types?: string
  page_context_preview?: string
  paa_count?: number; faq_count?: number
  faq_combined?: string; faq_sources?: string
  faq_schema_json?: string; faq_schema_script?: string
  qa_flags?: string[]
  status?: string
  faqs: FAQ[]; schema_json: string; schema_script: string; error: string | null
}
type Job = {
  id: string; name: string; status: string
  total_rows: number; completed_rows: number
  current_step?: string
  logs?: {ts: string; msg: string}[]
  results: RowResult[]; created_at: string; error: string | null
}

function previewText(text?: string, max = 110) {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  return cleaned.length > max ? `${cleaned.slice(0, max - 3).trim()}...` : cleaned
}

export default function JobPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [job, setJob] = useState<Job | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [rerunningMulti, setRerunningMulti] = useState(false)
  const [logsCollapsed, setLogsCollapsed] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [rerunning, setRerunning] = useState<number | null>(null)
  const [newlyUpdated, setNewlyUpdated] = useState<Set<number>>(new Set())
  const [keywordOverrides, setKeywordOverrides] = useState<Record<number, string>>({})
  const [editingKeyword, setEditingKeyword] = useState<number | null>(null)
  const [edits, setEdits] = useState<Record<string, {question: string; answer: string}>>({})
  const [editingFaq, setEditingFaq] = useState<string | null>(null)

  useEffect(() => {
    const resetRateLimitedAction = () => { setRerunning(null); setRerunningMulti(false) }
    window.addEventListener('api-rate-limit', resetRateLimitedAction)
    return () => window.removeEventListener('api-rate-limit', resetRateLimitedAction)
  }, [])

  const load = useCallback(async () => {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) return
    try {
      const data = await faqApi.getJob(session.access_token, id)
      setJob(data)
    } catch (e) {
      console.error('Failed to fetch job:', e)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!job || (job.status !== 'running' && job.status !== 'cancelling')) return
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [job, load])

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

function gscAuthLabel(method?: RowResult['gsc_auth_method']) {
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


  const markUpdated = (indices: number[], results: RowResult[]) => {
    // Only mark rows that actually have new content (not errors)
    const successful = indices.filter(i => {
      const r = results[i]
      return r && !r.error && (r.faqs?.length > 0 || (r.faq_count ?? 0) > 0)
    })
    if (!successful.length) return
    setNewlyUpdated(prev => new Set([...Array.from(prev), ...successful]))
    // Auto-clear after 8 seconds
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
        await faqApi.cancelJob(session.access_token, job.id)
        await load()
      }
    } catch (e) {
      console.error('Cancel request failed:', e)
    }
    setCancelling(false)
  }

  function buildExportRows() {
    const headers = [
      'URL',
      'SEO Target Keyword',
      'Keyword Source',
      'Runner Up Keyword',
      'Page Scrape Status',
      'AI Overview Content',
      'PAA Content',
      'AI Overview Present',
      'FAQs from AI Overview',
      'PAA Questions Found',
      'FAQs Generated',
      'FAQ Schema JSON-LD',
      'FAQ Status',
      'QA Flags',
      'FAQ Content',
      'FAQ Sources',
      'FAQ Schema Script',  // bonus column not in Streamlit
    ]
    const results = job!.results
    const rows = results.map(r => {
      // Build faq_combined from faqs array if faq_combined not on result
      const faqCombined = r.faq_combined ||
        (r.faqs || []).map((f: FAQ, fi: number) => {
          const key = `${results.indexOf(r)}-${fi}`
          const edited = edits[key]
          return `Q: ${edited?.question ?? f.question}\nA: ${edited?.answer ?? f.answer}`
        }).join('\n\n')
      const faqSources = r.faq_sources ||
        (r.faqs || []).map((f: FAQ) => f.source || 'generated').join(', ')

      return {
        'URL': r.url || '',
        'SEO Target Keyword': r.selected_keyword || r.keyword || '',
        'Keyword Source': r.keyword_source || '',
        'Runner Up Keyword': r.runner_up || '',
        'Page Scrape Status': r.scrape_status || '',
        'AI Overview Content': r.ai_overview_raw_text || '',
        'PAA Content': r.paa_raw_text || '',
        'AI Overview Present': r.ai_overview_present ? 'Yes' : 'No',
        'FAQs from AI Overview': r.ao_question_count ?? '',
        'PAA Questions Found': r.paa_count ?? '',
        'FAQs Generated': r.faq_count ?? (r.faqs?.length ?? ''),
        'FAQ Schema JSON-LD': r.faq_schema_json || r.schema_json || '',
        'FAQ Status': r.status || (r.error ? 'error' : 'ok'),
        'QA Flags': (r.qa_flags || []).join('; '),
        'FAQ Content': faqCombined,
        'FAQ Sources': faqSources,
        'FAQ Schema Script': r.faq_schema_script || r.schema_script || '',
      }
    })
    return { headers, rows }
  }

  function downloadCsv() {
    if (!job?.results?.length) return
    const { headers, rows } = buildExportRows()
    const csvRows = rows.map(row => headers.map(header => `"${String(row[header as keyof typeof row] ?? '').replace(/"/g, '""')}"`))
    const csv = [headers, ...csvRows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${job.name || 'results'}.csv`
    a.click()
  }

  function downloadXlsx() {
    if (!job?.results?.length) return
    const { rows } = buildExportRows()
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Results')
    XLSX.writeFile(wb, `${job.name || 'results'}.xlsx`)
  }

  if (!job) return (
    <AppLayout title="FAQ Copy">
      <div className="flex items-center justify-center py-24">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  )

  const failedRows = job.results?.filter(row => row.status === 'error' || row.error).length ?? 0
  const faqTotal = job.results?.reduce((sum, row) => sum + (row.faq_count ?? row.faqs?.length ?? 0), 0) ?? 0
  const gscLabels = Array.from(new Set((job.results || []).map(row => gscAuthLabel(row.gsc_auth_method)).filter(Boolean)))
  const gscSummary = gscLabels.length === 0 ? 'Manual' : gscLabels.length === 1 ? gscLabels[0] : 'Mixed'

  return (
    <AppLayout title="FAQ Copy">
      <div className="max-w-5xl mx-auto">
        <button onClick={() => router.push('/faq/jobs')}
          className="flex items-center gap-2 text-muted hover:text-text text-sm mb-6 transition-colors">
          <ArrowLeft size={14} /> Back to FAQ jobs
        </button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{job.name || 'Untitled Job'}</h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge label={job.status} />
              <span className="text-muted text-xs font-mono">{job.completed_rows}/{job.total_rows} rows</span>
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
                        await faqApi.rerunRows(session.access_token, job.id, indices)
                        const refreshed = await faqApi.getJob(session.access_token, job.id)
                        markUpdated(indices, refreshed.results || [])
                        setSelectedRows(new Set())
                        load()
                      }
                    } catch (e) {
                      console.error('Rerun request failed:', e)
                    }
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
            </>
          )}
          {job.status === 'complete' && job.results?.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none">
                <StyledCheckbox
                  ariaLabel="Select all FAQ result rows"
                  checked={selectedRows.size === job.results.length && job.results.length > 0}
                  onChange={checked => setSelectedRows(checked ? new Set(job.results.map((_, i) => i)) : new Set())}
                />
                {selectedRows.size > 0 ? `${selectedRows.size} selected` : 'Select all'}
              </label>
              <div className="flex items-center bg-border/40 rounded-lg p-0.5">
                <button onClick={() => setView('cards')}
                  className={`text-xs px-3 py-1.5 rounded-md transition-colors ${view === 'cards' ? 'bg-surface text-text' : 'text-muted hover:text-text'}`}>Cards</button>
                <button onClick={() => setView('table')}
                  className={`text-xs px-3 py-1.5 rounded-md transition-colors ${view === 'table' ? 'bg-surface text-text' : 'text-muted hover:text-text'}`}>Table</button>
              </div>
              <button onClick={downloadCsv} className="btn-primary flex items-center gap-2">
                <Download size={14} /> Download CSV
              </button>
              <button onClick={downloadXlsx} className="btn-secondary flex items-center gap-2">
                <Download size={14} /> Download XLSX
              </button>
            </div>
          )}
        </div>

        {/* Running job panel */}
        {(job.status === 'running' || job.status === 'cancelling') && (
          <RunningJobPanel
            status={job.status}
            completedRows={job.completed_rows}
            totalRows={job.total_rows}
            failedRows={failedRows}
            currentStep={job.current_step}
            logs={job.logs}
            cancelling={cancelling}
            onCancel={handleCancel}
          />
        )}

        {job.status === 'complete' && job.results?.length > 0 && (
          <CompletedJobSummary
            stats={[
              { label: 'Rows', value: `${job.completed_rows} / ${job.total_rows}` },
              { label: 'FAQs generated', value: faqTotal, tone: 'success' },
              { label: 'Failed', value: failedRows, tone: failedRows > 0 ? 'error' : 'default' },
              { label: 'GSC', value: gscSummary, tone: 'muted' },
            ]}
            logCount={job.logs?.length}
            logsCollapsed={logsCollapsed}
            onToggleLogs={job.logs?.length ? () => setLogsCollapsed(!logsCollapsed) : undefined}
          />
        )}

        {/* Run log after completion */}
        {job.status === 'complete' && !logsCollapsed && job.logs?.length ? (
          <div className="mb-6">
            <div className="rounded-xl p-3 font-mono text-xs overflow-y-auto" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", maxHeight: 200 }}>
              {(job.logs || []).map((entry, i) => {
                const logs = job.logs!
                const elapsed = Math.round((new Date(entry.ts).getTime() - new Date(logs[0].ts).getTime()) / 1000)
                return (
                  <div key={i} className="flex gap-2 py-0.5 border-b border-border/30 last:border-0">
                    <span className="text-muted shrink-0" style={{ minWidth: 36 }}>+{elapsed}s</span>
                    <span className="text-muted">{entry.msg}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        {job.error && (
          <div className="mb-6 text-error text-sm bg-error/5 border border-error/20 rounded-lg px-4 py-3">
            {gscErrorMessage(job.error)}
          </div>
        )}

        {/* Results */}
        {job.results?.length > 0 && (
          <>
            {/* Table view */}
            {view === 'table' && (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['URL', 'Keyword', 'Source', 'GSC Auth', 'Scrape', 'AO', 'PAA', 'FAQs', 'Status', 'QA Flags'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {job.results.map((row, i) => (
                        <tr
                          key={i}
                          style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          onClick={() => { setView('cards'); setExpanded(i); }}
                        >
                          <td style={{ padding: '10px 14px', maxWidth: 260 }}>
                            <p className="font-mono truncate" style={{ fontSize: 11, color: 'var(--muted)' }}>{row.url}</p>
                          </td>
                          <td style={{ padding: '10px 14px', maxWidth: 180 }}>
                            <p className="font-mono truncate" style={{ fontSize: 11, color: 'var(--accent)' }}>
                              {row.selected_keyword || row.keyword || 'n/a'}
                            </p>
                          </td>
                          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--muted)', background: 'var(--border)', borderRadius: 4, padding: '2px 6px' }}>
                              {row.keyword_source || 'manual'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                            {gscAuthLabel(row.gsc_auth_method) ? (
                              <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--muted)', background: 'var(--border)', borderRadius: 4, padding: '2px 6px' }}>
                                {gscAuthLabel(row.gsc_auth_method)}
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, color: 'var(--muted)' }}>n/a</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: 11, color: row.scrape_status?.startsWith('ok') ? 'var(--accent)' : 'var(--muted)' }}>
                              {row.scrape_status || 'n/a'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <span style={{ fontSize: 11, color: row.ai_overview_present ? 'var(--accent)' : 'var(--muted)' }}>
                              {row.ai_overview_present ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{row.paa_count ?? 'n/a'}</span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: (row.faq_count ?? row.faqs?.length ?? 0) > 0 ? 'var(--text)' : 'var(--muted)' }}>
                              {row.faq_count ?? row.faqs?.length ?? 0}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontSize: 10, fontWeight: 500, color: row.error ? 'var(--error)' : 'var(--accent)', background: row.error ? 'rgba(255,77,109,0.08)' : 'var(--accent-subtle)', borderRadius: 4, padding: '2px 6px' }}>
                              {row.error ? 'error' : (row.status || 'ok')}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', maxWidth: 260 }}>
                            <p className="font-mono truncate" style={{ fontSize: 11, color: 'var(--muted)' }}>{(row.qa_flags || []).join('; ')}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
                  <p style={{ fontSize: 11, color: 'var(--muted)' }}>Click any row to open in card view</p>
                </div>
              </div>
            )}

            {/* Cards view (unchanged) */}
            {view === 'cards' && (
          <div className="card overflow-hidden">
            {job.results.map((row, i) => (
              <div
                key={i}
                className={`border-b border-border/50 last:border-0 ${selectedRows.has(i) ? 'bg-accent/5' : ''} ${newlyUpdated.has(i) ? 'row-flash' : ''}`}
              >
                {/* Row header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 hover:bg-border/20 cursor-pointer transition-colors"
                  onClick={() => { setExpanded(expanded === i ? null : i); setNewlyUpdated(prev => { const n = new Set(prev); n.delete(i); return n }) }}
                >
                  <StyledCheckbox
                    ariaLabel={`Select FAQ result row ${i + 1}`}
                    className="shrink-0"
                    checked={selectedRows.has(i)}
                    onClick={e => e.stopPropagation()}
                    onChange={checked => setSelectedRows(prev => {
                      const next = new Set(prev)
                      checked ? next.add(i) : next.delete(i)
                      return next
                    })}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs text-muted truncate">{row.url}</p>
                    {row.keyword && (
                      <p className="font-mono text-xs text-accent mt-0.5 truncate">{row.keyword}</p>
                    )}
                    {row.faqs?.[0]?.question && (
                      <p className="text-xs text-muted mt-1 truncate">{previewText(row.faqs[0].question)}</p>
                    )}
                  </div>
                  <Badge label={row.keyword_source || 'manual'} />
                  {gscAuthLabel(row.gsc_auth_method) && <Badge label={gscAuthLabel(row.gsc_auth_method)} />}
                  <span className="text-xs text-muted font-mono shrink-0">{row.faqs?.length || 0} FAQs</span>
                  {newlyUpdated.has(i) && (
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                      style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}>
                      ✓ new
                    </span>
                  )}
                  {row.error && <Badge label="failed" />}
                  {!!row.qa_flags?.length && !row.error && <Badge label={row.status || 'review'} />}
                  {job.status === 'complete' && (
                    <button
                      onClick={async e => {
                        e.stopPropagation()
                        setRerunning(i)
                        const sb = createClient()
                        const { data: { session } } = await sb.auth.getSession()
                        if (session) {
                          await faqApi.rerunRow(session.access_token, job.id, i)
                          const poll = setInterval(async () => {
                            const updated = await faqApi.getJob(session.access_token, job.id)
                            if (updated.status !== 'running') {
                              setRerunning(null)
                              clearInterval(poll)
                              markUpdated([i], updated.results || [])
                              load()
                            }
                          }, 2000)
                        }
                      }}
                      disabled={rerunning === i}
                      className="shrink-0 text-muted hover:text-accent transition-colors disabled:opacity-40"
                      title="Re-run this row"
                    >
                      <RefreshCw size={12} className={rerunning === i ? 'animate-spin' : ''} />
                    </button>
                  )}
                  {expanded === i ? <ChevronUp size={13} className="text-muted shrink-0" /> : <ChevronDown size={13} className="text-muted shrink-0" />}
                </div>

                {/* Expanded FAQs */}
                {expanded === i && (
                  <div className="px-4 pb-4 space-y-3">
                    {row.error && (
                      <p className="text-error text-xs bg-error/5 border border-error/20 rounded px-3 py-2">{gscErrorMessage(row.error)}</p>
                    )}
                    {!!row.qa_flags?.length && !row.error && (
                      <p className="text-xs text-accent bg-accent/10 rounded px-3 py-2 font-mono">{row.qa_flags.join('; ')}</p>
                    )}

                    {/* Keyword override */}
                    {job.status === 'complete' && (
                      <div className="flex items-center gap-2 bg-border/20 rounded-lg px-3 py-2">
                        <span className="text-xs text-muted shrink-0">Keyword:</span>
                        {editingKeyword === i ? (
                          <>
                            <input
                              autoFocus
                              className="input-base text-xs flex-1 py-0.5"
                              value={keywordOverrides[i] ?? (row.selected_keyword || row.keyword || '')}
                              onChange={e => setKeywordOverrides(prev => ({ ...prev, [i]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Escape') setEditingKeyword(null) }}
                              placeholder="Enter keyword override..."
                            />
                            <button
                              onClick={async () => {
                                setEditingKeyword(null)
                                // Use typed value if user edited it, otherwise use the pre-filled displayed value
                                const override = (keywordOverrides[i] ?? (row.selected_keyword || row.keyword || '')).trim()
                                if (!override) return
                                setRerunning(i)
                                const sb = createClient()
                                const { data: { session } } = await sb.auth.getSession()
                                if (session) {
                                  await faqApi.rerunRow(session.access_token, job.id, i, override)
                                  const poll = setInterval(async () => {
                                    const updated = await faqApi.getJob(session.access_token, job.id)
                                    if (updated.status !== 'running') {
                                      setRerunning(null)
                                      clearInterval(poll)
                                      markUpdated([i], updated.results || [])
                                      load()
                                    }
                                  }, 2000)
                                }
                              }}
                              className="text-xs text-accent font-medium hover:opacity-70 transition-opacity shrink-0"
                            >
                              Re-run with this keyword
                            </button>
                            <button onClick={() => setEditingKeyword(null)} className="text-muted hover:text-error transition-colors">
                              <X size={11} />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="text-xs text-accent font-mono flex-1 truncate">
                              {row.selected_keyword || row.keyword || 'none'}
                            </span>
                            <button
                              onClick={e => { e.stopPropagation(); setEditingKeyword(i); setKeywordOverrides(prev => ({ ...prev, [i]: row.selected_keyword || row.keyword || '' })) }}
                              className="text-muted hover:text-accent transition-colors shrink-0"
                              title="Override keyword"
                            >
                              <Pencil size={11} />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    {row.faqs?.map((faq, j) => {
                      const key = `${i}-${j}`
                      const isEditing = editingFaq === key
                      const edited = edits[key]
                      const q = edited?.question ?? faq.question
                      const a = edited?.answer ?? faq.answer
                      return (
                        <div key={j} className="bg-bg border border-border rounded-lg p-3">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            {isEditing ? (
                              <textarea
                                className="input-base text-sm font-medium w-full resize-none"
                                rows={2}
                                value={edits[key]?.question ?? faq.question}
                                onChange={e => setEdits(prev => ({ ...prev, [key]: { question: e.target.value, answer: prev[key]?.answer ?? faq.answer } }))}
                              />
                            ) : (
                              <p className="text-sm font-medium">{q}</p>
                            )}
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge label={faq.source} />
                              {!isEditing && (
                                <button onClick={() => { setEditingFaq(key); setEdits(prev => ({ ...prev, [key]: { question: q, answer: a } })) }}
                                  className="p-1 text-muted hover:text-accent transition-colors" title="Edit">
                                  <Pencil size={11} />
                                </button>
                              )}
                              {isEditing && (
                                <>
                                  <button onClick={() => setEditingFaq(null)}
                                    className="p-1 text-accent hover:opacity-70 transition-opacity text-xs font-medium">
                                    Save
                                  </button>
                                  <button onClick={() => { const next = {...edits}; delete next[key]; setEdits(next); setEditingFaq(null) }}
                                    className="p-1 text-muted hover:text-error transition-colors">
                                    <X size={11} />
                                  </button>
                                </>
                              )}
                              <button onClick={() => copy(`${q}\n${a}`, `faq-${i}-${j}`)}
                                className="p-1 text-muted hover:text-accent transition-colors">
                                <Copy size={11} />
                              </button>
                            </div>
                          </div>
                          {isEditing ? (
                            <textarea
                              className="input-base text-sm text-muted w-full resize-none mt-1"
                              rows={3}
                              value={edits[key]?.answer ?? faq.answer}
                              onChange={e => setEdits(prev => ({ ...prev, [key]: { question: prev[key]?.question ?? faq.question, answer: e.target.value } }))}
                            />
                          ) : (
                            <p className="text-sm text-muted">{a}</p>
                          )}
                          {edited && !isEditing && (
                            <p className="text-xs text-accent mt-1.5 opacity-60">Edited</p>
                          )}
                        </div>
                      )
                    })}
                    {row.schema_script && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-muted">Schema.org JSON-LD</span>
                          <button onClick={() => copy(row.schema_script, `schema-${i}`)}
                            className="flex items-center gap-1 text-xs text-muted hover:text-accent transition-colors">
                            <Copy size={11} />
                            {copied === `schema-${i}` ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <pre className="bg-bg border border-border rounded-lg p-3 text-xs font-mono text-muted overflow-x-auto">
                          {row.schema_script}
                        </pre>
                      </div>
                    )}

                    {/* Debug panel */}
                    <details className="mt-3 group">
                      <summary className="text-xs text-muted cursor-pointer hover:text-accent transition-colors select-none flex items-center gap-1.5">
                        <span className="font-mono">🔍 Debug: data sent to AI</span>
                      </summary>
                      <div className="mt-2 space-y-2">
                        <p className="text-xs font-mono text-muted bg-border/30 rounded px-3 py-2 leading-relaxed">
                          AI Overview: <span className={row.ai_overview_present ? 'text-accent' : 'text-muted'}>{row.ai_overview_present ? 'YES' : 'NO'}</span>
                          {' | '}Attempts: {row.ao_attempts ?? 1}
                          {' | '}Scrape: {row.scrape_status || 'n/a'}
                          {' | '}PAA: {row.paa_count ?? 0} questions
                          {row.serp_item_types ? <>{' | '}SERP types: {row.serp_item_types}</> : null}
                        </p>
                        <textarea
                          readOnly
                          rows={12}
                          className="w-full input-base text-xs font-mono resize-y leading-relaxed"
                          value={[
                            `KEYWORD: ${row.selected_keyword || row.keyword || ''}`,
                            '',
                            '='.repeat(60),
                            'PAGE CONTENT (scraped)',
                            '='.repeat(60),
                            row.page_context_preview || '(not scraped)',
                            '',
                            '='.repeat(60),
                            'GOOGLE AI OVERVIEW',
                            '='.repeat(60),
                            row.ai_overview_raw_text || '(not found)',
                            '',
                            '='.repeat(60),
                            'PEOPLE ALSO ASK',
                            '='.repeat(60),
                            row.paa_raw_text || '(not found)',
                          ].join('\n')}
                        />
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
