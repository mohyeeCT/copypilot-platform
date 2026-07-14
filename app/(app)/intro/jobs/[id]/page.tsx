'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Check,
  ClipboardCheck,
  Copy,
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
import { exportRowsToGoogleSheets, googleSheetsExportError } from '@/lib/export/googleSheets'
import { introApi } from '@/lib/api/intro'
import { createClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type RowResult = {
  url: string
  intro_copy: string
  primary_keyword: string
  supporting_keywords: string
  word_count: number
  cluster_source: string
  keyword_source: string
  gsc_auth_method?: 'google_oauth' | 'service_account' | 'disabled' | 'unavailable'
  scrape_status?: string
  runner_up?: string
  primary_volume?: number
  primary_difficulty?: number
  status?: string
  qa_flags?: string[]
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
  logs?: { ts: string; msg: string }[]
  results: RowResult[]
  created_at: string
  error: string | null
}

type ResultFilter = 'all' | 'ready' | 'review' | 'error'
type DetailTab = 'copy' | 'quality' | 'sources'
type ResultState = Exclude<ResultFilter, 'all'>

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

function previewText(text?: string, max = 120) {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  const firstSentence = cleaned.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || cleaned
  return firstSentence.length > max ? `${firstSentence.slice(0, max - 3).trim()}...` : firstSentence
}

function resultState(row: RowResult): ResultState {
  if (row.error || row.status === 'error' || row.status === 'failed') return 'error'
  if (row.qa_flags?.length || !row.intro_copy) return 'review'
  return 'ready'
}

function resultStateLabel(state: ResultState) {
  if (state === 'review') return 'Needs review'
  if (state === 'error') return 'Error'
  return 'Ready'
}

export default function JobPage() {
  const { id } = useParams<{ id: string }>()
  const [job, setJob] = useState<Job | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [rerunningMulti, setRerunningMulti] = useState(false)
  const [logsCollapsed, setLogsCollapsed] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [rerunning, setRerunning] = useState<number | null>(null)
  const [newlyUpdated, setNewlyUpdated] = useState<Set<number>>(new Set())
  const [keywordOverrides, setKeywordOverrides] = useState<Record<number, string>>({})
  const [editingKeyword, setEditingKeyword] = useState<number | null>(null)
  const [edits, setEdits] = useState<Record<number, string>>({})
  const [editingRow, setEditingRow] = useState<number | null>(null)
  const [exportingSheets, setExportingSheets] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [resultQuery, setResultQuery] = useState('')
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all')
  const [detailTab, setDetailTab] = useState<DetailTab>('copy')

  useEffect(() => {
    const resetRateLimitedAction = () => {
      setRerunning(null); setRerunningMulti(false)
    }
    window.addEventListener('api-rate-limit', resetRateLimitedAction)
    return () => window.removeEventListener('api-rate-limit', resetRateLimitedAction)
  }, [])

  const load = useCallback(async () => {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) return
    try {
      setJob(await introApi.getJob(session.access_token, id))
    } catch (error) {
      console.error('Failed to fetch job:', error)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!job || (job.status !== 'running' && job.status !== 'cancelling')) return
    const timer = window.setInterval(() => { void load() }, 3000)
    return () => window.clearInterval(timer)
  }, [job, load])

  const results = useMemo(() => job?.results || [], [job?.results])
  const filteredResults = useMemo(() => {
    const needle = resultQuery.trim().toLowerCase()
    return results
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => {
        const matchesQuery = !needle || [row.url, row.primary_keyword, row.intro_copy]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(needle)
        const matchesState = resultFilter === 'all' || resultState(row) === resultFilter
        return matchesQuery && matchesState
      })
  }, [resultFilter, resultQuery, results])

  function copy(text: string, key: string) {
    void navigator.clipboard.writeText(text)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1500)
  }

  function markUpdated(indices: number[], refreshedResults: RowResult[]) {
    const successful = indices.filter(index => {
      const row = refreshedResults[index]
      return row && !row.error && row.intro_copy
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
        await introApi.cancelJob(session.access_token, job.id)
        await load()
      }
    } catch (error) {
      console.error('Cancel request failed:', error)
    }
    setCancelling(false)
  }

  function buildExportRows() {
    const headers = [
      'URL', 'Intro Copy', 'Primary Keyword', 'Supporting Keywords',
      'Word Count', 'Cluster Source', 'Keyword Source', 'Runner Up',
      'Primary Volume', 'Primary Difficulty', 'Scrape Status', 'Intro Status', 'QA Flags',
    ]
    const rows = results.map((row, index) => ({
      'URL': row.url || '',
      'Intro Copy': edits[index] ?? row.intro_copy ?? '',
      'Primary Keyword': row.primary_keyword || '',
      'Supporting Keywords': row.supporting_keywords || '',
      'Word Count': row.word_count ?? '',
      'Cluster Source': row.cluster_source || '',
      'Keyword Source': row.keyword_source || '',
      'Runner Up': row.runner_up || '',
      'Primary Volume': row.primary_volume ?? '',
      'Primary Difficulty': row.primary_difficulty ?? '',
      'Scrape Status': row.scrape_status || '',
      'Intro Status': row.status || (row.error ? 'error' : 'ok'),
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
    anchor.download = `${job.name || 'intro-results'}.csv`
    anchor.click()
    URL.revokeObjectURL(anchor.href)
  }

  function downloadXlsx() {
    if (!job || !results.length) return
    const { rows } = buildExportRows()
    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Results')
    XLSX.writeFile(workbook, `${job.name || 'intro-results'}.xlsx`)
  }

  async function exportGoogleSheets() {
    if (!job || !results.length || exportingSheets) return
    setExportingSheets(true)
    try {
      const { headers, rows } = buildExportRows()
      await exportRowsToGoogleSheets({
        title: `${job.name || 'Intro results'} - Intro`,
        sheet_name: 'Intro Results',
        headers,
        rows,
      })
    } catch (error) {
      alert(googleSheetsExportError(error))
    } finally {
      setExportingSheets(false)
    }
  }

  async function startRowRerun(index: number, keywordOverride?: string) {
    if (!job || rerunning !== null) return
    setRerunning(index)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) {
        setRerunning(null)
        return
      }
      await introApi.rerunRow(session.access_token, job.id, index, keywordOverride)
      const poll = window.setInterval(async () => {
        try {
          const updated = await introApi.getJob(session.access_token, job.id)
          if (!updated.current_step?.includes('Re-running')) {
            window.clearInterval(poll)
            setRerunning(null)
            markUpdated([index], updated.results || [])
            setJob(updated)
          }
        } catch (error) {
          window.clearInterval(poll)
          setRerunning(null)
          console.error('Rerun polling failed:', error)
        }
      }, 2000)
    } catch (error) {
      setRerunning(null)
      console.error('Rerun request failed:', error)
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
        await introApi.rerunRows(session.access_token, job.id, indices)
        const refreshed = await introApi.getJob(session.access_token, job.id)
        markUpdated(indices, refreshed.results || [])
        setSelectedRows(new Set())
        setJob(refreshed)
      }
    } catch (error) {
      console.error('Rerun request failed:', error)
    }
    setRerunningMulti(false)
  }

  if (!job) {
    return (
      <AppLayout title="Page Intro">
        <div className="flex h-48 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </AppLayout>
    )
  }

  const failedRows = job.failed_rows ?? results.filter(row => resultState(row) === 'error').length
  const selectedIndex = results[activeIndex] ? activeIndex : 0
  const selectedResult = results[selectedIndex]
  const row = selectedResult as RowResult
  const selectedState = selectedResult ? resultState(selectedResult) : 'ready'
  const readyCount = results.filter(row => resultState(row) === 'ready').length
  const reviewCount = results.filter(row => resultState(row) === 'review').length
  const errorCount = results.filter(row => resultState(row) === 'error').length

  return (
    <AppLayout title="Page Intro">
      <div className={styles.jobPage}>
        <header className={styles.pageHeader}>
          <div className={styles.pageHeaderCopy}>
            <Link href="/intro/jobs" className={styles.backButton}>
              <ArrowLeft size={14} /> All Page Intro jobs
            </Link>
            <span className={styles.eyebrow}>Page Intro job</span>
            <h1>{job.name || 'Untitled job'}</h1>
            <div className={styles.headerMeta}>
              <Badge label={job.status} />
              <span>{job.completed_rows}/{job.total_rows} rows</span>
              {failedRows > 0 && <span className="text-error">{failedRows} failed</span>}
              <span>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(job.created_at))}</span>
            </div>
          </div>
          {results.length > 0 && (
            <div className={styles.headerActions}>
              {selectedRows.size > 0 && (
                <button type="button" onClick={() => void rerunSelectedRows()} disabled={rerunningMulti} className="btn-primary text-sm">
                  <RefreshCw size={13} className={rerunningMulti ? 'animate-spin' : ''} />
                  {rerunningMulti ? 'Starting...' : `Rerun ${selectedRows.size}`}
                </button>
              )}
              <ExportMenu onCsv={downloadCsv} onXlsx={downloadXlsx} onGoogleSheets={exportGoogleSheets} sheetsLoading={exportingSheets} />
            </div>
          )}
        </header>

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

        {job.error && <div className={styles.errorNotice}>{gscErrorMessage(job.error)}</div>}

        {results.length > 0 && (
          <>
            <section className={styles.metricStrip} aria-label="Page Intro result summary">
              <div><span>Total rows</span><strong>{results.length}</strong><small>URLs processed</small></div>
              <div><span>Ready</span><strong className={styles.successValue}>{readyCount}</strong><small>No QA flags</small></div>
              <div><span>Needs review</span><strong className={reviewCount ? styles.warningValue : undefined}>{reviewCount}</strong><small>Editorial check</small></div>
              <div><span>Errors</span><strong className={errorCount ? styles.warningValue : undefined}>{errorCount}</strong><small>Rerun available</small></div>
            </section>

            <div className={styles.toolbar}>
              <div className={styles.toolbarGroup}>
                <label className="flex items-center gap-2 text-xs text-muted">
                  <StyledCheckbox
                    ariaLabel="Select all Page Intro result rows"
                    checked={selectedRows.size === results.length && results.length > 0}
                    onChange={checked => setSelectedRows(checked ? new Set(results.map((_, index) => index)) : new Set())}
                  />
                  {selectedRows.size ? `${selectedRows.size} selected` : 'Select all'}
                </label>
                {selectedRows.size === 0 && errorCount > 0 && (
                  <button type="button" className={styles.iconTextButton} onClick={() => setSelectedRows(new Set(results.map((row, index) => resultState(row) === 'error' ? index : -1).filter(index => index >= 0)))}>
                    Select failed rows
                  </button>
                )}
                {job.logs?.length ? (
                  <button type="button" className={styles.iconTextButton} aria-expanded={!logsCollapsed} onClick={() => setLogsCollapsed(value => !value)}>
                    {logsCollapsed ? 'Show activity' : 'Hide activity'} ({job.logs.length})
                  </button>
                ) : null}
              </div>
            </div>

            {!logsCollapsed && job.logs?.length ? (
              <div className={styles.logsPanel}>
                {job.logs.map((entry, index) => {
                  const elapsed = Math.round((new Date(entry.ts).getTime() - new Date(job.logs![0].ts).getTime()) / 1000)
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
                    <span className={styles.srOnly}>Search Page Intro results</span>
                    <input value={resultQuery} onChange={event => setResultQuery(event.target.value)} placeholder="Search URL or keyword" />
                    {resultQuery && <button type="button" aria-label="Clear result search" onClick={() => setResultQuery('')}><X size={13} /></button>}
                  </label>
                  <div className={styles.resultFilters} role="tablist" aria-label="Filter Page Intro results">
                    {([['all', 'All'], ['ready', 'Ready'], ['review', 'Review'], ['error', 'Error']] as Array<[ResultFilter, string]>).map(([value, label]) => (
                      <button type="button" role="tab" key={value} aria-selected={resultFilter === value} data-active={resultFilter === value ? 'true' : 'false'} onClick={() => setResultFilter(value)}>{label}</button>
                    ))}
                  </div>
                </div>
                <div className={styles.resultList}>
                  {filteredResults.map(({ row, index }) => {
                    const state = resultState(row)
                    return (
                      <article key={`${row.url}-${index}`} className={`${styles.resultRow} ${selectedIndex === index ? styles.resultRowActive : ''} ${newlyUpdated.has(index) ? 'row-flash' : ''}`}>
                        <div className={styles.resultCheckbox}>
                          <StyledCheckbox
                            ariaLabel={`Select Page Intro result row ${index + 1}`}
                            checked={selectedRows.has(index)}
                            onChange={checked => setSelectedRows(previous => {
                              const next = new Set(previous)
                              if (checked) next.add(index)
                              else next.delete(index)
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
                            setEditingKeyword(null)
                            setEditingRow(null)
                            setNewlyUpdated(previous => {
                              const next = new Set(previous)
                              next.delete(index)
                              return next
                            })
                          }}
                        >
                          <span className={styles.resultPrimaryTop}>
                            <strong>{row.primary_keyword || `Row ${index + 1}`}</strong>
                            <span className={styles.statusPill} data-state={state}>{resultStateLabel(state)}</span>
                          </span>
                          <p>{previewText(row.intro_copy || gscErrorMessage(row.error) || 'No generated intro copy')}</p>
                          <span className={styles.resultMeta}>
                            <span>{row.url}</span>
                            <span>{row.word_count || 0} words</span>
                          </span>
                        </button>
                      </article>
                    )
                  })}
                  {!filteredResults.length && <div className={styles.emptyResults}><Search size={22} /><strong>No matching rows</strong><p>Clear the search or choose another status.</p></div>}
                </div>
              </section>

              {selectedResult && (
                <section className={styles.resultDetail}>
                  <header className={styles.detailHeader}>
                    <div>
                      <span className={styles.eyebrow}>Selected row</span>
                      <h2>{selectedResult.primary_keyword || `Row ${selectedIndex + 1}`}</h2>
                      <p>{selectedResult.url}</p>
                    </div>
                    <div className={styles.detailHeaderActions}>
                      <span className={styles.statusPill} data-state={selectedState}>{resultStateLabel(selectedState)}</span>
                      <button type="button" className={styles.queueIconButton} aria-label="Rerun selected row" title="Rerun selected row" disabled={rerunning !== null} onClick={() => void startRowRerun(selectedIndex)}>
                        <RefreshCw size={13} className={rerunning === selectedIndex ? 'animate-spin' : ''} />
                      </button>
                    </div>
                  </header>
                  <nav className={styles.detailTabs} aria-label="Page Intro result detail">
                    {([['copy', 'Intro copy'], ['quality', `Quality${selectedResult.qa_flags?.length ? ` (${selectedResult.qa_flags.length})` : ''}`], ['sources', 'Sources']] as Array<[DetailTab, string]>).map(([value, label]) => (
                      <button type="button" key={value} aria-pressed={detailTab === value} data-active={detailTab === value ? 'true' : 'false'} onClick={() => { setDetailTab(value); setEditingRow(null) }}>{label}</button>
                    ))}
                  </nav>

                  {detailTab === 'copy' && (
                    <div className={styles.detailBody}>
                      {selectedResult.error ? (
                        <section className={styles.qualitySummary}>
                          <span className={styles.qualityIcon} data-state="error"><AlertTriangle size={18} /></span>
                          <div><h3>This row did not generate</h3><p>{gscErrorMessage(selectedResult.error)}</p></div>
                        </section>
                      ) : selectedResult.intro_copy || edits[selectedIndex] ? (
                        <section className={styles.copyBlock}>
                          <div className={styles.blockHeader}>
                            <div><span>Generated introduction</span><span className={styles.meter}>{selectedResult.word_count || 0} words</span></div>
                            <div className="flex items-center gap-1">
                              <button type="button" className={styles.copyButton} aria-label="Edit intro copy" title="Edit intro copy" onClick={() => { setEditingRow(selectedIndex); setEdits(previous => ({ ...previous, [selectedIndex]: previous[selectedIndex] ?? selectedResult.intro_copy })) }}><Pencil size={13} /></button>
                              <button type="button" className={styles.copyButton} aria-label="Copy intro copy" title="Copy intro copy" onClick={() => copy(edits[selectedIndex] ?? selectedResult.intro_copy, `intro-${selectedIndex}`)}>{copied === `intro-${selectedIndex}` ? <Check size={13} /> : <Copy size={13} />}</button>
                            </div>
                          </div>
                          {editingRow === selectedIndex ? (
                            <div className="space-y-2">
                              <textarea className="input-base min-h-40 text-sm leading-relaxed" value={edits[selectedIndex] ?? selectedResult.intro_copy} onChange={event => setEdits(previous => ({ ...previous, [selectedIndex]: event.target.value }))} />
                              <button type="button" className="btn-primary text-xs" onClick={() => setEditingRow(null)}><Check size={13} /> Save local edit</button>
                            </div>
                          ) : <p>{edits[selectedIndex] ?? selectedResult.intro_copy}</p>}
                          {edits[selectedIndex] !== undefined && editingRow !== selectedIndex && <small>Edited locally. The export will use this version.</small>}
                        </section>
                      ) : (
                        <div className={styles.emptyResults}><FileText size={22} /><strong>No generated intro saved</strong><p>Rerun this row to try again.</p></div>
                      )}
                    </div>
                  )}

                  {detailTab === 'quality' && (
                    <div className={styles.detailBody}>
                      <section className={styles.qualitySummary}>
                        <span className={styles.qualityIcon} data-state={selectedState}>{selectedState === 'ready' ? <ClipboardCheck size={18} /> : <AlertTriangle size={18} />}</span>
                        <div><h3>{resultStateLabel(selectedState)}</h3><p>{selectedState === 'ready' ? 'This introduction is ready for editorial review and export.' : selectedState === 'error' ? gscErrorMessage(selectedResult.error) : 'Check the flagged rules before using this introduction.'}</p></div>
                      </section>
                      <section className={styles.lengthChecks} aria-label="Intro quality facts">
                        <div><span>Words</span><strong>{selectedResult.word_count || 0}</strong><small>Generated length</small></div>
                        <div><span>QA flags</span><strong>{selectedResult.qa_flags?.length || 0}</strong><small>Deterministic checks</small></div>
                        <div><span>Scrape</span><strong>{selectedResult.scrape_status || '-'}</strong><small>Page context</small></div>
                      </section>
                      {selectedResult.qa_flags?.length ? (
                        <div className={styles.checkList}>{selectedResult.qa_flags.map(flag => <div key={flag}><span><AlertTriangle size={13} /></span><p>{flag}</p></div>)}</div>
                      ) : null}
                    </div>
                  )}

                  {detailTab === 'sources' && (
                    <div className={styles.detailBody}>
                      <section className={styles.sourceSummary}>
                        <div><span>Primary keyword</span><strong>{selectedResult.primary_keyword || 'Not selected'}</strong><small>{selectedResult.keyword_source || 'No source label'}</small></div>
                        <div><span>Volume</span><strong>{selectedResult.primary_volume ?? '-'}</strong><small>Monthly searches</small></div>
                        <div><span>Difficulty</span><strong>{selectedResult.primary_difficulty ?? '-'}</strong><small>DataForSEO</small></div>
                      </section>
                      <div className={styles.sourceList}>
                        <div><span><Search size={14} /></span><div><strong>Search Console</strong><p>{gscAuthLabel(row.gsc_auth_method) || 'No Search Console method was recorded.'}</p></div></div>
                        <div><span><BarChart3 size={14} /></span><div><strong>Keyword cluster</strong><p>{selectedResult.cluster_source || 'No cluster source was recorded.'}</p></div></div>
                        <div><span><FileText size={14} /></span><div><strong>Page context</strong><p>{selectedResult.scrape_status || 'No page scrape status was recorded.'}</p></div></div>
                      </div>
                      <section className={styles.keywordPanel}>
                        <label>Primary keyword</label>
                        {editingKeyword === selectedIndex ? (
                          <div className={styles.keywordEditor}>
                            <input autoFocus className="input-base text-xs" value={keywordOverrides[selectedIndex] ?? selectedResult.primary_keyword ?? ''} onChange={event => setKeywordOverrides(previous => ({ ...previous, [selectedIndex]: event.target.value }))} />
                            <button type="button" className={styles.copyButton} aria-label="Save keyword and rerun" title="Save keyword and rerun" onClick={() => {
                              const override = (keywordOverrides[selectedIndex] ?? selectedResult.primary_keyword ?? '').trim()
                              if (!override) return
                              setEditingKeyword(null)
                              void startRowRerun(selectedIndex, override)
                            }}><Check size={14} /></button>
                            <button type="button" className={styles.copyButton} aria-label="Cancel keyword edit" title="Cancel keyword edit" onClick={() => setEditingKeyword(null)}><X size={14} /></button>
                          </div>
                        ) : (
                          <div className={styles.keywordValue}>
                            <strong>{selectedResult.primary_keyword || 'No keyword selected'}</strong>
                            <button type="button" className={styles.copyButton} aria-label="Edit keyword" title="Edit keyword" onClick={() => setEditingKeyword(selectedIndex)}><Pencil size={13} /></button>
                          </div>
                        )}
                        {selectedResult.runner_up && (
                          <div className={styles.runnerUp}>
                            <span>Runner-up: <strong>{selectedResult.runner_up}</strong></span>
                            <button type="button" className={styles.iconTextButton} disabled={rerunning !== null} onClick={() => void startRowRerun(selectedIndex, selectedResult.runner_up)}><RefreshCw size={12} /> Use and rerun</button>
                          </div>
                        )}
                      </section>
                      {selectedResult.supporting_keywords && <section className={styles.copyBlock}><div className={styles.blockHeader}><div><span>Supporting keywords</span></div></div><p>{selectedResult.supporting_keywords}</p></section>}
                    </div>
                  )}

                  <footer className={styles.detailFooter}>
                    <span>Row {selectedIndex + 1} of {results.length}</span>
                    <div>
                      <button type="button" className="btn-ghost text-xs" onClick={() => { setDetailTab('sources'); setEditingKeyword(selectedIndex) }}><Pencil size={13} /> Edit keyword</button>
                      <button type="button" className="btn-primary text-xs" disabled={rerunning !== null} onClick={() => void startRowRerun(selectedIndex)}><RefreshCw size={13} className={rerunning === selectedIndex ? 'animate-spin' : ''} /> {rerunning === selectedIndex ? 'Rerunning...' : 'Rerun row'}</button>
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
