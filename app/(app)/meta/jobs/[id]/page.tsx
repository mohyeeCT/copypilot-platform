'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileText,
  Pencil,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import AppLayout from '@/components/layout/AppLayout'
import styles from '@/components/meta/MetaCopyWorkspace.module.css'
import Badge from '@/components/ui/Badge'
import ExportMenu from '@/components/ui/ExportMenu'
import RunningJobPanel from '@/components/ui/RunningJobPanel'
import StyledCheckbox from '@/components/ui/StyledCheckbox'
import { metaApi } from '@/lib/api/meta'
import { getProviderMetadata } from '@/lib/api/shared'
import { exportRowsToGoogleSheets, googleSheetsExportError } from '@/lib/export/googleSheets'
import { createClient } from '@/lib/supabase'

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
  scrape_status?: string
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
  results?: MetaResult[]
  rows?: unknown[]
  settings?: Record<string, unknown>
  logs?: { ts: string; msg: string }[]
}

type ResultFilter = 'all' | 'ready' | 'review' | 'error'
type DetailTab = 'copy' | 'quality' | 'sources'
type ResultState = Exclude<ResultFilter, 'all'>

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

function previewText(text?: string, max = 120) {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  return cleaned.length > max ? `${cleaned.slice(0, max - 3).trim()}...` : cleaned
}

function resultState(row: MetaResult): ResultState {
  if (row.error || row.status === 'error' || row.status === 'failed') return 'error'
  if (row.qa_flags?.length) return 'review'
  if (!row.generated_title && !row.generated_description && !row.optimised_h1) return 'review'
  return 'ready'
}

function resultStateLabel(state: ResultState) {
  if (state === 'review') return 'Needs review'
  if (state === 'error') return 'Error'
  return 'Ready'
}

function domainFromUrl(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return value
  }
}

function characterCount(value?: string, supplied?: number) {
  return supplied ?? value?.length ?? 0
}

export default function MetaJobPage() {
  const { id } = useParams()
  const router = useRouter()
  const [job, setJob] = useState<Job | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [rerunning, setRerunning] = useState<number | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [rerunningMulti, setRerunningMulti] = useState(false)
  const [newlyUpdated, setNewlyUpdated] = useState<Set<number>>(new Set())
  const [activeIndex, setActiveIndex] = useState(0)
  const [resultQuery, setResultQuery] = useState('')
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all')
  const [detailTab, setDetailTab] = useState<DetailTab>('copy')
  const [firecrawlKeyConfigured, setFirecrawlKeyConfigured] = useState(false)
  const [logsCollapsed, setLogsCollapsed] = useState(true)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [editingKw, setEditingKw] = useState<number | null>(null)
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
    if (!session) {
      router.push('/login')
      return
    }
    try {
      const data = await metaApi.getJob(session.access_token, id as string)
      setJob(data)
    } catch (loadError) {
      console.error('Failed to fetch job:', loadError)
    }
  }, [id, router])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    async function loadFirecrawlStatus() {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) return
      try {
        const metadata = await getProviderMetadata(session.access_token)
        setFirecrawlKeyConfigured(Boolean(metadata?.has_firecrawl_key))
      } catch {
        setFirecrawlKeyConfigured(false)
      }
    }
    void loadFirecrawlStatus()
  }, [])

  // Poll until running or cancellation reaches a terminal state.
  useEffect(() => {
    if (!job || (job.status !== 'running' && job.status !== 'cancelling')) return
    const timer = window.setInterval(() => { void load() }, 2500)
    return () => window.clearInterval(timer)
  }, [job, load])

  const results = useMemo(() => job?.results || [], [job?.results])
  const filteredResults = useMemo(() => {
    const needle = resultQuery.trim().toLowerCase()
    return results
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => {
        const matchesQuery = !needle || [row.url, row.selected_keyword, row.generated_title]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(needle)
        const matchesState = resultFilter === 'all' || resultState(row) === resultFilter
        return matchesQuery && matchesState
      })
  }, [resultFilter, resultQuery, results])

  function markUpdated(indices: number[], refreshedResults: MetaResult[]) {
    const successful = indices.filter(index => {
      const row = refreshedResults[index]
      return row && !row.error && row.generated_title && row.generated_title.length > 0
    })
    if (!successful.length) return
    setNewlyUpdated(previous => new Set([...Array.from(previous), ...successful]))
    window.setTimeout(() => {
      setNewlyUpdated(previous => {
        const next = new Set(previous)
        successful.forEach(index => next.delete(index))
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
    } catch (cancelError) {
      console.error('Cancel request failed:', cancelError)
    }
    setCancelling(false)
  }

  function copyToClipboard(text: string, fieldKey: string) {
    void navigator.clipboard.writeText(text)
    setCopiedField(fieldKey)
    window.setTimeout(() => setCopiedField(null), 1500)
  }

  function buildExportRows() {
    const headers = ['URL', 'Title Tag', 'Title Length', 'Meta Description', 'Description Length', 'Optimised H1', 'H1 Length', 'Keyword', 'Volume', 'Difficulty', 'Keyword Source', 'Runner Up', 'Status', 'QA Flags']
    const rows = results.map(row => ({
      URL: row.url || '',
      'Title Tag': row.generated_title || '',
      'Title Length': row.title_length || '',
      'Meta Description': row.generated_description || '',
      'Description Length': row.description_length || '',
      'Optimised H1': row.optimised_h1 || '',
      'H1 Length': row.h1_length || '',
      Keyword: row.selected_keyword || '',
      Volume: row.kw_volume ?? '',
      Difficulty: row.kw_difficulty ?? '',
      'Keyword Source': row.keyword_source || '',
      'Runner Up': row.runner_up || '',
      Status: row.status || '',
      'QA Flags': (row.qa_flags || []).join('; '),
    }))
    return { headers, rows }
  }

  function downloadCsv() {
    if (!job || !results.length) return
    const { headers, rows } = buildExportRows()
    const csvRows = rows.map(row => headers.map(header => `"${String(row[header as keyof typeof row] ?? '').replace(/"/g, '""')}"`).join(','))
    const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv' })
    const anchor = document.createElement('a')
    anchor.href = URL.createObjectURL(blob)
    anchor.download = `meta_copy_${job.name.replace(/\s+/g, '_')}.csv`
    anchor.click()
    URL.revokeObjectURL(anchor.href)
  }

  function downloadXlsx() {
    if (!job || !results.length) return
    const { rows } = buildExportRows()
    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Results')
    XLSX.writeFile(workbook, `meta_copy_${job.name.replace(/\s+/g, '_')}.xlsx`)
  }

  async function exportGoogleSheets() {
    if (!job || !results.length || exportingSheets) return
    setExportingSheets(true)
    try {
      const { headers, rows } = buildExportRows()
      await exportRowsToGoogleSheets({
        title: `${job.name || 'Meta results'} - Meta`,
        sheet_name: 'Meta Results',
        headers,
        rows,
      })
    } catch (exportError) {
      alert(googleSheetsExportError(exportError))
    } finally {
      setExportingSheets(false)
    }
  }

  async function startRowRerun(index: number, keywordOverride?: string, scraperOverride?: 'firecrawl') {
    if (!job || rerunning !== null) return
    setRerunning(index)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) {
        setRerunning(null)
        return
      }
      await metaApi.rerunRow(session.access_token, job.id, index, keywordOverride, scraperOverride)
      const poll = window.setInterval(async () => {
        try {
          const updated = await metaApi.getJob(session.access_token, job.id)
          if (updated.status !== 'running') {
            window.clearInterval(poll)
            setRerunning(null)
            markUpdated([index], updated.results || [])
            setJob(updated)
          }
        } catch (pollError) {
          window.clearInterval(poll)
          setRerunning(null)
          console.error('Rerun polling failed:', pollError)
        }
      }, 2000)
    } catch (rerunError) {
      setRerunning(null)
      console.error('Rerun request failed:', rerunError)
    }
  }

  async function rerunSelectedRows() {
    if (!job || !selectedRows.size) return
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
        setJob(refreshed)
      }
    } catch (rerunError) {
      console.error('Rerun request failed:', rerunError)
    }
    setRerunningMulti(false)
  }

  if (!job) {
    return (
      <AppLayout title="Meta Copy">
        <div className="flex h-48 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </AppLayout>
    )
  }

  const selectedIndex = results[activeIndex] ? activeIndex : 0
  const selectedResult = results[selectedIndex]
  const selectedState = selectedResult ? resultState(selectedResult) : 'ready'
  const readyCount = results.filter(row => resultState(row) === 'ready').length
  const reviewCount = results.filter(row => resultState(row) === 'review').length
  const errorCount = results.filter(row => resultState(row) === 'error').length
  const selectedScrapeFailed = selectedResult?.scrape_status?.toLowerCase().startsWith('failed:') ?? false
  const jobStartedWithFirecrawl = job.settings?.scrape_provider === 'firecrawl'
  const gscLabels = Array.from(new Set(results.map(row => gscAuthLabel(row.gsc_auth_method)).filter(Boolean)))
  const gscSummary = gscLabels.length === 0 ? 'Manual' : gscLabels.length === 1 ? gscLabels[0] : 'Mixed'

  return (
    <AppLayout title="Meta Copy">
      <div className={styles.jobPage}>
        <header className={styles.pageHeader}>
          <div className={styles.pageHeaderCopy}>
            <Link href="/meta/jobs" className={styles.backButton}>
              <ArrowLeft size={14} /> All Meta jobs
            </Link>
            <span className={styles.eyebrow}>Meta Copy job</span>
            <h1>{job.name}</h1>
            <div className={styles.headerMeta}>
              <Badge label={job.status} />
              <span>{job.completed_rows}/{job.total_rows} rows</span>
              {job.failed_rows > 0 && <span className="text-error">{job.failed_rows} failed</span>}
              {job.current_step && (job.status === 'running' || job.status === 'cancelling') && <span>{job.current_step}</span>}
            </div>
          </div>
          {results.length > 0 && (
            <div className={styles.headerActions}>
              {selectedRows.size > 0 && (
                <button type="button" className="btn-ghost" disabled={rerunningMulti} onClick={() => void rerunSelectedRows()}>
                  <RefreshCw size={14} className={rerunningMulti ? 'animate-spin' : ''} />
                  {rerunningMulti ? 'Starting...' : `Rerun ${selectedRows.size}`}
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
        </header>

        {(job.status === 'running' || job.status === 'cancelling') && (
          <RunningJobPanel
            status={job.status}
            completedRows={job.completed_rows}
            totalRows={job.total_rows}
            failedRows={job.failed_rows || 0}
            currentStep={job.current_step}
            logs={job.logs}
            cancelling={cancelling}
            onCancel={() => void handleCancel()}
          />
        )}

        {job.error && <div className={styles.errorNotice}>{gscErrorMessage(job.error)}</div>}

        {results.length > 0 && (
          <>
            <section className={styles.metricStrip} aria-label="Meta result summary">
              <div><span>Rows</span><strong>{job.completed_rows} / {job.total_rows}</strong><small>{job.status === 'complete' ? 'Processing complete' : 'Saved so far'}</small></div>
              <div><span>Ready</span><strong className={styles.successValue}>{readyCount}</strong><small>No QA flags</small></div>
              <div><span>Needs review</span><strong className={reviewCount ? styles.warningValue : undefined}>{reviewCount}</strong><small>Deterministic QA</small></div>
              <div><span>Search context</span><strong>{gscSummary}</strong><small>{errorCount ? `${errorCount} failed row${errorCount === 1 ? '' : 's'}` : 'No failed rows'}</small></div>
            </section>

            <div className={styles.toolbar}>
              <div className={styles.toolbarGroup}>
                <div className="flex select-none items-center gap-2 text-xs text-muted">
                  <StyledCheckbox
                    ariaLabel="Select all meta result rows"
                    checked={selectedRows.size === results.length && results.length > 0}
                    onChange={checked => setSelectedRows(checked ? new Set(results.map((_, index) => index)) : new Set())}
                  />
                  {selectedRows.size > 0 ? `${selectedRows.size} selected` : 'Select all'}
                </div>
                {selectedRows.size === 0 && errorCount > 0 && (
                  <button
                    type="button"
                    className={styles.iconTextButton}
                    onClick={() => setSelectedRows(new Set(results.map((row, index) => resultState(row) === 'error' ? index : -1).filter(index => index >= 0)))}
                  >
                    <AlertTriangle size={13} /> Select failed
                  </button>
                )}
              </div>
              {job.status === 'complete' && job.logs?.length ? (
                <button type="button" className={styles.iconTextButton} aria-expanded={!logsCollapsed} onClick={() => setLogsCollapsed(value => !value)}>
                  {logsCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                  {logsCollapsed ? `Show activity (${job.logs.length})` : 'Hide activity'}
                </button>
              ) : null}
            </div>

            {job.status === 'complete' && !logsCollapsed && job.logs?.length ? (
              <div className={styles.logsPanel}>
                {job.logs.map((entry, index) => {
                  const chapterStart = [...job.logs!].slice(0, index + 1).reverse().find(log => log.msg.includes('starting \u2014') || log.msg.startsWith('==='))
                  const baseTimestamp = chapterStart ? new Date(chapterStart.ts).getTime() : new Date(job.logs?.[0]?.ts || entry.ts).getTime()
                  const elapsed = Math.round((new Date(entry.ts).getTime() - baseTimestamp) / 1000)
                  return <div key={`${entry.ts}-${index}`} className={styles.logRow}><span>+{elapsed}s</span><span>{entry.msg}</span></div>
                })}
              </div>
            ) : null}

            <div className={styles.reviewWorkspace}>
              <section className={styles.resultQueue}>
                <header className={styles.queueHeader}>
                  <div><h2>Review queue</h2><p>{filteredResults.length} of {results.length} rows visible</p></div>
                </header>
                <div className={styles.queueTools}>
                  <label className={styles.searchField}>
                    <Search size={14} />
                    <span className={styles.srOnly}>Search Meta results</span>
                    <input type="search" value={resultQuery} onChange={event => setResultQuery(event.target.value)} placeholder="Search URL or keyword" />
                    {resultQuery && <button type="button" aria-label="Clear result search" onClick={() => setResultQuery('')}><X size={13} /></button>}
                  </label>
                  <div className={styles.resultFilters} role="tablist" aria-label="Filter Meta results">
                    {([
                      ['all', 'All'],
                      ['ready', 'Ready'],
                      ['review', 'Review'],
                      ['error', 'Error'],
                    ] as Array<[ResultFilter, string]>).map(([value, label]) => (
                      <button
                        type="button"
                        role="tab"
                        key={value}
                        aria-selected={resultFilter === value}
                        data-active={resultFilter === value ? 'true' : 'false'}
                        onClick={() => setResultFilter(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.resultList}>
                  {filteredResults.map(({ row, index }) => {
                    const state = resultState(row)
                    const title = row.generated_title || gscErrorMessage(row.error) || 'No generated title'
                    return (
                      <article key={`${row.url}-${index}`} className={`${styles.resultRow} ${selectedIndex === index ? styles.resultRowActive : ''} ${newlyUpdated.has(index) ? 'row-flash' : ''}`}>
                        <div className={styles.resultCheckbox}>
                          <StyledCheckbox
                            ariaLabel={`Select meta result row ${index + 1}`}
                            checked={selectedRows.has(index)}
                            onChange={checked => setSelectedRows(previous => {
                              const next = new Set(previous)
                              checked ? next.add(index) : next.delete(index)
                              return next
                            })}
                          />
                        </div>
                        <button
                          type="button"
                          className={styles.resultPrimary}
                          onClick={() => {
                            setActiveIndex(index)
                            setDetailTab('copy')
                            setNewlyUpdated(previous => {
                              const next = new Set(previous)
                              next.delete(index)
                              return next
                            })
                          }}
                        >
                          <span className={styles.resultPrimaryTop}>
                            <span><strong>{row.selected_keyword || `Row ${index + 1}`}</strong><small>{domainFromUrl(row.url)}</small></span>
                            <span className={styles.statusPill} data-state={state}>{resultStateLabel(state)}</span>
                          </span>
                          <p>{previewText(title)}</p>
                          <span className={styles.resultMeta}>
                            <span>{characterCount(row.generated_title, row.title_length)} title chars</span>
                            <span>{characterCount(row.generated_description, row.description_length)} description chars</span>
                            {newlyUpdated.has(index) && <span className="text-accent">Updated</span>}
                          </span>
                        </button>
                      </article>
                    )
                  })}
                  {filteredResults.length === 0 && (
                    <div className={styles.emptyResults}>
                      <Search size={22} /><strong>No matching rows</strong><p>Clear the search or choose another status.</p>
                      <button type="button" className="btn-ghost text-xs" onClick={() => { setResultQuery(''); setResultFilter('all') }}>Clear filters</button>
                    </div>
                  )}
                </div>
              </section>

              {selectedResult && (
                <section className={styles.resultDetail}>
                  <header className={styles.detailHeader}>
                    <div>
                      <span className={styles.eyebrow}>Selected row</span>
                      <h2>{selectedResult.selected_keyword || `Row ${selectedIndex + 1}`}</h2>
                      <p>{selectedResult.url}</p>
                    </div>
                    <div className={styles.detailHeaderActions}>
                      <span className={styles.statusPill} data-state={selectedState}>{resultStateLabel(selectedState)}</span>
                      <button
                        type="button"
                        className={styles.queueIconButton}
                        aria-label="Rerun selected row"
                        title="Rerun selected row"
                        disabled={rerunning !== null}
                        onClick={() => void startRowRerun(selectedIndex)}
                      >
                        <RefreshCw size={14} className={rerunning === selectedIndex ? 'animate-spin' : ''} />
                      </button>
                    </div>
                  </header>

                  <nav className={styles.detailTabs} aria-label="Meta result detail">
                    {([
                      ['copy', 'Copy'],
                      ['quality', `Quality${selectedResult.qa_flags?.length ? ` (${selectedResult.qa_flags.length})` : ''}`],
                      ['sources', 'Sources'],
                    ] as Array<[DetailTab, string]>).map(([value, label]) => (
                      <button type="button" key={value} aria-pressed={detailTab === value} data-active={detailTab === value ? 'true' : 'false'} onClick={() => setDetailTab(value)}>{label}</button>
                    ))}
                  </nav>

                  {detailTab === 'copy' && (
                    <div className={styles.detailBody}>
                      {selectedResult.error ? (
                        <section className={styles.qualitySummary}>
                          <span className={styles.qualityIcon} data-state="error"><AlertTriangle size={18} /></span>
                          <div><h3>This row did not generate</h3><p>{gscErrorMessage(selectedResult.error)}</p></div>
                        </section>
                      ) : (
                        <>
                          {(selectedResult.generated_title || selectedResult.generated_description) && (
                            <section className={styles.serpSection}>
                              <div className={styles.blockHeader}>
                                <div><span>Search preview</span><span className={styles.meter}>Desktop result</span></div>
                                <Link href={selectedResult.url} target="_blank" rel="noreferrer" className={styles.iconTextButton}>
                                  <ExternalLink size={12} /> Open page
                                </Link>
                              </div>
                              <div className={styles.serpPreview}>
                                <div className={styles.serpSource}>
                                  <span className={styles.serpFavicon}>{domainFromUrl(selectedResult.url).charAt(0).toUpperCase() || 'M'}</span>
                                  <div><strong>{domainFromUrl(selectedResult.url)}</strong><small>{selectedResult.url}</small></div>
                                </div>
                                <h3>{selectedResult.generated_title || 'Generated title unavailable'}</h3>
                                <p>{selectedResult.generated_description || 'Generated description unavailable'}</p>
                              </div>
                            </section>
                          )}

                          {selectedResult.generated_title && (
                            <CopyBlock
                              label="Title tag"
                              value={selectedResult.generated_title}
                              count={characterCount(selectedResult.generated_title, selectedResult.title_length)}
                              max={60}
                              warn={55}
                              copied={copiedField === `title-${selectedIndex}`}
                              onCopy={() => copyToClipboard(selectedResult.generated_title!, `title-${selectedIndex}`)}
                            />
                          )}
                          {selectedResult.generated_description && (
                            <CopyBlock
                              label="Meta description"
                              value={selectedResult.generated_description}
                              count={characterCount(selectedResult.generated_description, selectedResult.description_length)}
                              max={155}
                              warn={145}
                              copied={copiedField === `description-${selectedIndex}`}
                              onCopy={() => copyToClipboard(selectedResult.generated_description!, `description-${selectedIndex}`)}
                            />
                          )}
                          {selectedResult.optimised_h1 && (
                            <CopyBlock
                              label="Optimised H1"
                              value={selectedResult.optimised_h1}
                              count={characterCount(selectedResult.optimised_h1, selectedResult.h1_length)}
                              max={70}
                              warn={65}
                              copied={copiedField === `h1-${selectedIndex}`}
                              onCopy={() => copyToClipboard(selectedResult.optimised_h1!, `h1-${selectedIndex}`)}
                              h1
                              note={selectedResult.h1_input ? `Original: ${selectedResult.h1_input}` : undefined}
                            />
                          )}
                          {!selectedResult.generated_title && !selectedResult.generated_description && !selectedResult.optimised_h1 && (
                            <div className={styles.emptyResults}><FileText size={22} /><strong>No generated copy saved</strong><p>Rerun this row to try again.</p></div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {detailTab === 'quality' && (
                    <div className={styles.detailBody}>
                      <section className={styles.qualitySummary}>
                        <span className={styles.qualityIcon} data-state={selectedState}>
                          {selectedState === 'ready' ? <ClipboardCheck size={18} /> : <AlertTriangle size={18} />}
                        </span>
                        <div>
                          <h3>{selectedState === 'ready' ? 'No deterministic QA flags' : selectedState === 'error' ? 'Generation error' : 'Review recommended'}</h3>
                          <p>{selectedState === 'ready' ? 'This row is ready for editorial review and export.' : selectedState === 'error' ? gscErrorMessage(selectedResult.error) : 'Check the flagged rules before using this copy.'}</p>
                        </div>
                      </section>

                      <section className={styles.lengthChecks} aria-label="Character counts">
                        <LengthCheck label="Title" value={characterCount(selectedResult.generated_title, selectedResult.title_length)} max={60} />
                        <LengthCheck label="Description" value={characterCount(selectedResult.generated_description, selectedResult.description_length)} max={155} />
                        <LengthCheck label="H1" value={characterCount(selectedResult.optimised_h1, selectedResult.h1_length)} max={70} />
                      </section>

                      {selectedResult.qa_flags?.length ? (
                        <div className={styles.checkList}>
                          {selectedResult.qa_flags.map(flag => (
                            <div key={flag}><span><AlertTriangle size={13} /></span><p>{flag}</p></div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}

                  {detailTab === 'sources' && (
                    <div className={styles.detailBody}>
                      <section className={styles.sourceSummary}>
                        <div><span>Primary keyword</span><strong>{selectedResult.selected_keyword || 'Not selected'}</strong><small>{selectedResult.keyword_source || 'No source label'}</small></div>
                        <div><span>Volume</span><strong>{selectedResult.kw_volume ?? '-'}</strong><small>Monthly searches</small></div>
                        <div><span>Difficulty</span><strong>{selectedResult.kw_difficulty ?? '-'}</strong><small>DataForSEO</small></div>
                      </section>

                      <div className={styles.sourceList}>
                        <div><span><Search size={14} /></span><div><strong>Search Console</strong><p>{gscAuthLabel(selectedResult.gsc_auth_method) || 'No GSC method was recorded for this row.'}</p></div></div>
                        <div><span><BarChart3 size={14} /></span><div><strong>Keyword data</strong><p>{selectedResult.keyword_source || 'No keyword source label was recorded.'}</p></div></div>
                        <div><span><FileText size={14} /></span><div><strong>Page context</strong><p>{selectedResult.scrape_status || 'No page scrape status was recorded.'}</p></div></div>
                        <div><span><FileText size={14} /></span><div><strong>Target page</strong><p>{selectedResult.url}</p></div></div>
                      </div>

                      <section className={styles.keywordPanel}>
                        <label>Primary keyword</label>
                        {editingKw === selectedIndex ? (
                          <div className={styles.keywordEditor}>
                            <input
                              autoFocus
                              className="input-base text-xs"
                              value={kwOverrides[selectedIndex] ?? (selectedResult.selected_keyword || '')}
                              onChange={event => setKwOverrides(previous => ({ ...previous, [selectedIndex]: event.target.value }))}
                            />
                            <button
                              type="button"
                              className={styles.copyButton}
                              aria-label="Save keyword and rerun"
                              title="Save keyword and rerun"
                              onClick={() => {
                                const override = (kwOverrides[selectedIndex] ?? (selectedResult.selected_keyword || '')).trim()
                                if (!override) return
                                setEditingKw(null)
                                void startRowRerun(selectedIndex, override)
                              }}
                            >
                              <Check size={14} />
                            </button>
                            <button type="button" className={styles.copyButton} aria-label="Cancel keyword edit" title="Cancel keyword edit" onClick={() => setEditingKw(null)}><X size={14} /></button>
                          </div>
                        ) : (
                          <div className={styles.keywordValue}>
                            <strong>{selectedResult.selected_keyword || 'No keyword selected'}</strong>
                            <button type="button" className={styles.copyButton} aria-label="Edit keyword" title="Edit keyword" onClick={() => setEditingKw(selectedIndex)}><Pencil size={13} /></button>
                          </div>
                        )}
                        {selectedResult.runner_up && (
                          <div className={styles.runnerUp}>
                            <span>Runner-up: <strong>{selectedResult.runner_up}</strong></span>
                            <button type="button" className={styles.iconTextButton} disabled={rerunning !== null} onClick={() => void startRowRerun(selectedIndex, selectedResult.runner_up)}>
                              <RefreshCw size={12} /> Use and rerun
                            </button>
                          </div>
                        )}
                      </section>
                    </div>
                  )}

                  <footer className={styles.detailFooter}>
                    <span>Row {selectedIndex + 1} of {results.length}</span>
                    <div>
                      <button type="button" className="btn-ghost text-xs" onClick={() => { setDetailTab('sources'); setEditingKw(selectedIndex) }}><Pencil size={13} /> Edit keyword</button>
                      {selectedScrapeFailed && !jobStartedWithFirecrawl && firecrawlKeyConfigured ? (
                        <button type="button" className="btn-ghost text-xs" disabled={rerunning !== null} onClick={() => void startRowRerun(selectedIndex, selectedResult.selected_keyword, 'firecrawl')}>
                          <RefreshCw size={13} /> Rerun with Firecrawl
                        </button>
                      ) : null}
                      <button type="button" className="btn-primary text-xs" disabled={rerunning !== null} onClick={() => void startRowRerun(selectedIndex)}>
                        <RefreshCw size={13} className={rerunning === selectedIndex ? 'animate-spin' : ''} /> {rerunning === selectedIndex ? 'Rerunning...' : 'Rerun row'}
                      </button>
                    </div>
                  </footer>
                </section>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}

function CopyBlock({
  label,
  value,
  count,
  max,
  warn,
  copied,
  onCopy,
  h1 = false,
  note,
}: {
  label: string
  value: string
  count: number
  max: number
  warn: number
  copied: boolean
  onCopy: () => void
  h1?: boolean
  note?: string
}) {
  return (
    <section className={styles.copyBlock}>
      <div className={styles.blockHeader}>
        <div><span>{label}</span><span className={count > warn ? styles.meterWarning : styles.meter}>{count} / {max} chars</span></div>
        <button type="button" className={styles.copyButton} aria-label={`Copy ${label}`} title={`Copy ${label}`} onClick={onCopy}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>
      <p className={h1 ? styles.h1Value : undefined}>{value}</p>
      {note && <small>{note}</small>}
    </section>
  )
}

function LengthCheck({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div>
      <span>{label}</span>
      <strong className={value > max ? styles.warningValue : undefined}>{value}</strong>
      <small>Maximum {max} characters</small>
    </div>
  )
}
