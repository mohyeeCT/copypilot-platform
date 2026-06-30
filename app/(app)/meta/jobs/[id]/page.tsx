'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, ChevronDown, ChevronUp, Copy, Pencil, X, Check } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import Badge from '@/components/ui/Badge'
import CompletedJobSummary from '@/components/ui/CompletedJobSummary'
import ExportMenu from '@/components/ui/ExportMenu'
import RunningJobPanel from '@/components/ui/RunningJobPanel'
import StyledCheckbox from '@/components/ui/StyledCheckbox'
import { createClient } from '@/lib/supabase'
import { metaApi } from '@/lib/api/meta'
import { exportRowsToGoogleSheets, googleSheetsExportError } from '@/lib/export/googleSheets'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

interface MetaResult {
  url: string
  selected_keyword?: string
  keyword_source?: string
  gsc_auth_method?: 'google_oauth' | 'service_account' | 'disabled' | 'unavailable'
  runner_up?: string
  kw_volume?: number
  kw_difficulty?: number
  generated_title?: string
  generated_description?: string
  optimised_h1?: string
  title_length?: number
  description_length?: number
  h1_length?: number
  h1_input?: string
  qa_flags?: string[]
  status?: string
  error?: string
}

function gscAuthLabel(method?: MetaResult['gsc_auth_method']) {
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
  results?: MetaResult[]
  rows?: unknown[]
  settings?: Record<string, unknown>
  logs?: {ts: string; msg: string}[]
}

function previewText(text?: string, max = 120) {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  return cleaned.length > max ? `${cleaned.slice(0, max - 3).trim()}...` : cleaned
}

export default function MetaJobPage() {
  const { id }  = useParams()
  const router  = useRouter()
  const [job, setJob]               = useState<Job | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [rerunning, setRerunning]   = useState<number | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [rerunningMulti, setRerunningMulti] = useState(false)
  const [newlyUpdated, setNewlyUpdated] = useState<Set<number>>(new Set())
  const [expanded, setExpanded]     = useState<number | null>(null)
  const [logsCollapsed, setLogsCollapsed] = useState(true)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [editingKw, setEditingKw]   = useState<number | null>(null)
  const [kwOverrides, setKwOverrides] = useState<Record<number, string>>({})
  const [exportingSheets, setExportingSheets] = useState(false)

  useEffect(() => {
    const resetRateLimitedAction = () => { setRerunning(null); setRerunningMulti(false) }
    window.addEventListener('api-rate-limit', resetRateLimitedAction)
    return () => window.removeEventListener('api-rate-limit', resetRateLimitedAction)
  }, [])

  const load = useCallback(async () => {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { router.push('/login'); return }
    try {
      const data = await metaApi.getJob(session.access_token, id as string)
      setJob(data)
    } catch (e) {
      console.error('Failed to fetch job:', e)
    }
  }, [id, router])

  useEffect(() => { load() }, [load])

  // Poll until running or cancellation reaches a terminal state
  useEffect(() => {
    if (!job || (job.status !== 'running' && job.status !== 'cancelling')) return
    const t = setInterval(load, 2500)
    return () => clearInterval(t)
  }, [job, load])

  function markUpdated(indices: number[], results: MetaResult[]) {
    const successful = indices.filter(i => {
      const r = results[i]
      return r && !r.error && r.generated_title && r.generated_title.length > 0
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
        await metaApi.cancelJob(session.access_token, job.id)
        await load()
      }
    } catch (e) {
      console.error('Cancel request failed:', e)
    }
    setCancelling(false)
  }

  function copyToClipboard(text: string, fieldKey: string) {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldKey)
    setTimeout(() => setCopiedField(null), 1500)
  }

  function buildExportRows() {
    const headers = ['URL', 'Title Tag', 'Title Length', 'Meta Description', 'Description Length', 'Optimised H1', 'H1 Length', 'Keyword', 'Volume', 'Difficulty', 'Keyword Source', 'Runner Up', 'Status', 'QA Flags']
    const rows = job!.results!.map(r => ({
      'URL': r.url || '',
      'Title Tag': r.generated_title || '',
      'Title Length': r.title_length || '',
      'Meta Description': r.generated_description || '',
      'Description Length': r.description_length || '',
      'Optimised H1': r.optimised_h1 || '',
      'H1 Length': r.h1_length || '',
      'Keyword': r.selected_keyword || '',
      'Volume': r.kw_volume ?? '',
      'Difficulty': r.kw_difficulty ?? '',
      'Keyword Source': r.keyword_source || '',
      'Runner Up': r.runner_up || '',
      'Status': r.status || '',
      'QA Flags': (r.qa_flags || []).join('; '),
    }))
    return { headers, rows }
  }

  function downloadCsv() {
    if (!job?.results?.length) return
    const { headers, rows } = buildExportRows()
    const csvRows = rows.map(row => headers.map(header => `"${String(row[header as keyof typeof row] ?? '').replace(/"/g, '""')}"`).join(','))
    const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `meta_copy_${job.name.replace(/\s+/g, '_')}.csv`
    a.click()
  }

  function downloadXlsx() {
    if (!job?.results?.length) return
    const { rows } = buildExportRows()
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Results')
    XLSX.writeFile(wb, `meta_copy_${job.name.replace(/\s+/g, '_')}.xlsx`)
  }

  async function exportGoogleSheets() {
    if (!job?.results?.length || exportingSheets) return
    setExportingSheets(true)
    try {
      const { headers, rows } = buildExportRows()
      await exportRowsToGoogleSheets({
        title: `${job.name || 'Meta results'} - Meta`,
        sheet_name: 'Meta Results',
        headers,
        rows,
      })
    } catch (error) {
      alert(googleSheetsExportError(error))
    } finally {
      setExportingSheets(false)
    }
  }

  function getLengthColor(len: number | undefined, max: number, warn: number) {
    if (!len) return ''
    if (len > max) return 'text-error'
    if (len > warn) return 'text-warning'
    return 'text-success'
  }

  if (!job) return (
    <AppLayout title="Meta Copy">
      <div className="flex items-center justify-center h-48">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  )

  const titleCount = job.results?.filter(row => !row.error && row.generated_title).length ?? 0
  const failedRows = job.failed_rows ?? job.results?.filter(row => row.status === 'error' || row.error).length ?? 0
  const gscLabels = Array.from(new Set((job.results || []).map(row => gscAuthLabel(row.gsc_auth_method)).filter(Boolean)))
  const gscSummary = gscLabels.length === 0 ? 'Manual' : gscLabels.length === 1 ? gscLabels[0] : 'Mixed'

  return (
    <AppLayout title="Meta Copy">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/meta/jobs" className="text-muted hover:text-text transition-colors">
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
          />
        )}

        {job.status === 'complete' && job.results && job.results.length > 0 && (
          <CompletedJobSummary
            stats={[
              { label: 'Rows', value: `${job.completed_rows} / ${job.total_rows}` },
              { label: 'Titles generated', value: titleCount, tone: 'success' },
              { label: 'Failed', value: failedRows, tone: failedRows > 0 ? 'error' : 'default' },
              { label: 'GSC', value: gscSummary, tone: 'muted' },
            ]}
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

        {/* Error */}
        {job.error && (
          <div className="text-error text-sm bg-error/10 border border-error/20 rounded-lg px-4 py-3 mb-4">{gscErrorMessage(job.error)}</div>
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
                    await metaApi.rerunRows(session.access_token, job.id, indices)
                    const refreshed = await metaApi.getJob(session.access_token, job.id)
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
            {selectedRows.size === 0 && job.results.some(r => r.status === 'error' || r.error) && (
              <button onClick={() => setSelectedRows(new Set(
                job.results!.map((r, i) => r.status === 'error' || r.error ? i : -1).filter(i => i >= 0)
              ))} className="btn-ghost flex items-center gap-2 text-xs">
                Select all failed
              </button>
            )}
            <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none">
              <StyledCheckbox
                ariaLabel="Select all meta result rows"
                checked={selectedRows.size === job.results.length && job.results.length > 0}
                onChange={checked => setSelectedRows(checked ? new Set(job.results!.map((_, i) => i)) : new Set())}
              />
              {selectedRows.size > 0 ? `${selectedRows.size} selected` : 'Select all'}
            </label>
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
                    ariaLabel={`Select meta result row ${i + 1}`}
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
                      {row.selected_keyword && <span className="text-xs font-mono text-accent shrink-0 hidden sm:block">{row.selected_keyword}</span>}
                    </div>
                    {(row.generated_title || row.generated_description) && (
                      <p className="text-xs text-muted mt-1 truncate">{previewText(row.generated_title || row.generated_description)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {row.generated_title && (
                      <span className={`text-xs font-mono shrink-0 ${getLengthColor(row.title_length, 60, 55)}`}>
                        {row.title_length}
                      </span>
                    )}
                    {newlyUpdated.has(i) && (
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                        style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}>
                        ✓ new
                      </span>
                    )}
                    <Badge label={row.error ? 'error' : (row.status || 'ok')} />
                    {rerunning === i ? (
                      <RefreshCw size={12} className="animate-spin text-accent" />
                    ) : (
                      <button onClick={async e => {
                        e.stopPropagation()
                        setRerunning(i)
                        const sb = createClient()
                        const { data: { session } } = await sb.auth.getSession()
                        if (session) {
                          await metaApi.rerunRow(session.access_token, job.id, i)
                          const poll = setInterval(async () => {
                            const updated = await metaApi.getJob(session.access_token, job.id)
                            if (updated.status !== 'running') {
                              setRerunning(null)
                              clearInterval(poll)
                              markUpdated([i], updated.results || [])
                              load()
                            }
                          }, 2000)
                        }
                      }} className="text-muted hover:text-accent transition-colors">
                        <RefreshCw size={12} />
                      </button>
                    )}
                    {expanded === i ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
                  </div>
                </div>

                {/* Expanded content */}
                {expanded === i && (
                  <div className="px-4 pb-4 space-y-4 bg-bg/40">
                    {/* Keyword info */}
                    <div className="flex items-center gap-4 pt-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted">Keyword:</span>
                        {editingKw === i ? (
                          <div className="flex items-center gap-1">
                            <input autoFocus className="input-base text-xs py-1 px-2 w-48"
                              value={kwOverrides[i] ?? (row.selected_keyword || '')}
                              onChange={e => setKwOverrides({...kwOverrides, [i]: e.target.value})} />
                            <button onClick={async () => {
                              const override = (kwOverrides[i] ?? (row.selected_keyword || '')).trim()
                              if (!override) return
                              setEditingKw(null)
                              setRerunning(i)
                              const sb = createClient()
                              const { data: { session } } = await sb.auth.getSession()
                              if (session) {
                                await metaApi.rerunRow(session.access_token, job.id, i, override)
                                const poll = setInterval(async () => {
                                  const updated = await metaApi.getJob(session.access_token, job.id)
                                  if (updated.status !== 'running') {
                                    setRerunning(null)
                                    clearInterval(poll)
                                    markUpdated([i], updated.results || [])
                                    load()
                                  }
                                }, 2000)
                              }
                            }} className="text-accent hover:text-accent/80"><Check size={14} /></button>
                            <button onClick={() => setEditingKw(null)} className="text-muted hover:text-text"><X size={14} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-accent font-mono">{row.selected_keyword || '—'}</span>
                            <button onClick={() => setEditingKw(i)} className="text-muted hover:text-accent transition-colors">
                              <Pencil size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                      {row.kw_volume && <span className="text-xs text-muted font-mono">vol: {row.kw_volume}</span>}
                      {row.keyword_source && <span className="text-xs text-muted font-mono">{row.keyword_source}</span>}
                      {gscAuthLabel(row.gsc_auth_method) && (
                        <span className="text-xs text-muted font-mono">GSC: {gscAuthLabel(row.gsc_auth_method)}</span>
                      )}
                    </div>

                    {/* Title tag */}
                    {!!row.qa_flags?.length && !row.error && (
                      <p className="text-xs text-accent bg-accent/10 rounded px-3 py-2 font-mono">{row.qa_flags.join('; ')}</p>
                    )}

                    {/* Title tag */}
                    {row.generated_title && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted uppercase tracking-wider">Title Tag</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-mono ${getLengthColor(row.title_length, 60, 55)}`}>
                              {row.title_length}/60 chars {(row.title_length || 0) > 60 ? '⚠ over limit' : ''}
                            </span>
                            <button onClick={() => copyToClipboard(row.generated_title!, `title-${i}`)}
                              className="text-muted hover:text-accent transition-colors">
                              {copiedField === `title-${i}` ? <Check size={13} /> : <Copy size={13} />}
                            </button>
                          </div>
                        </div>
                        <p className="text-sm font-medium p-3 bg-surface border border-border rounded-lg">{row.generated_title}</p>
                      </div>
                    )}

                    {/* Meta description */}
                    {row.generated_description && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted uppercase tracking-wider">Meta Description</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-mono ${getLengthColor(row.description_length, 155, 145)}`}>
                              {row.description_length}/155 chars {(row.description_length || 0) > 155 ? '⚠ over limit' : ''}
                            </span>
                            <button onClick={() => copyToClipboard(row.generated_description!, `desc-${i}`)}
                              className="text-muted hover:text-accent transition-colors">
                              {copiedField === `desc-${i}` ? <Check size={13} /> : <Copy size={13} />}
                            </button>
                          </div>
                        </div>
                        <p className="text-sm p-3 bg-surface border border-border rounded-lg">{row.generated_description}</p>
                      </div>
                    )}

                    {/* Optimised H1 */}
                    {row.optimised_h1 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted uppercase tracking-wider">Optimised H1</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-mono ${getLengthColor(row.h1_length, 70, 65)}`}>
                              {row.h1_length} chars {(row.h1_length || 0) > 70 ? '⚠ long' : ''}
                            </span>
                            <button onClick={() => copyToClipboard(row.optimised_h1!, `h1-${i}`)}
                              className="text-muted hover:text-accent transition-colors">
                              {copiedField === `h1-${i}` ? <Check size={13} /> : <Copy size={13} />}
                            </button>
                          </div>
                        </div>
                        <p className="text-sm font-medium p-3 bg-surface border border-border rounded-lg">{row.optimised_h1}</p>
                        {row.h1_input && (
                          <p className="text-xs text-muted">Original H1: {row.h1_input}</p>
                        )}
                      </div>
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
