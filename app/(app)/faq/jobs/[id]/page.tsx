'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Copy,
  Database,
  FileJson,
  FileText,
  Pencil,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import AppLayout from '@/components/layout/AppLayout'
import faqStyles from '@/components/faq/FaqCopyWorkspace.module.css'
import styles from '@/components/meta/MetaCopyWorkspace.module.css'
import Badge from '@/components/ui/Badge'
import ExportMenu from '@/components/ui/ExportMenu'
import RunningJobPanel from '@/components/ui/RunningJobPanel'
import StyledCheckbox from '@/components/ui/StyledCheckbox'
import { faqApi } from '@/lib/api/faq'
import { buildFaqExportRows } from '@/lib/faq-export'
import { exportRowsToGoogleSheets, googleSheetsExportError } from '@/lib/export/googleSheets'
import { createClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type FAQ = { question: string; answer: string; source: string }
type RowResult = {
  url: string
  keyword?: string
  selected_keyword?: string
  keyword_source?: string
  gsc_auth_method?: 'google_oauth' | 'service_account' | 'disabled' | 'unavailable'
  runner_up?: string
  scrape_status?: string
  ai_overview_present?: boolean
  ao_question_count?: number
  ai_overview_raw_text?: string
  paa_raw_text?: string
  ao_attempts?: number
  serp_item_types?: string
  page_context_preview?: string
  paa_count?: number
  faq_count?: number
  faq_combined?: string
  faq_sources?: string
  faq_schema_json?: string
  faq_schema_script?: string
  qa_flags?: string[]
  status?: string
  faqs?: FAQ[]
  schema_json?: string
  schema_script?: string
  error?: string | null
}

type Job = {
  id: string
  name: string
  status: string
  total_rows: number
  completed_rows: number
  current_step?: string
  logs?: { ts: string; msg: string }[]
  results?: RowResult[]
  created_at?: string
  error?: string | null
}

type ResultFilter = 'all' | 'ready' | 'review' | 'error'
type ResultState = Exclude<ResultFilter, 'all'>
type DetailTab = 'copy' | 'quality' | 'sources' | 'schema'

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

function resultState(row: RowResult): ResultState {
  if (row.error || row.status === 'error' || row.status === 'failed') return 'error'
  if (row.qa_flags?.length || !(row.faqs?.length || row.faq_count)) return 'review'
  return 'ready'
}

function resultStateLabel(state: ResultState) {
  if (state === 'review') return 'Needs review'
  if (state === 'error') return 'Error'
  return 'Ready'
}

function previewText(text?: string, max = 120) {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  return cleaned.length > max ? `${cleaned.slice(0, max - 3).trim()}...` : cleaned
}

function domainFromUrl(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return value
  }
}

function wordCount(value?: string) {
  return (value || '').trim().split(/\s+/).filter(Boolean).length
}

function schemaText(row: RowResult) {
  return row.faq_schema_script || row.schema_script || row.faq_schema_json || row.schema_json || ''
}

export default function FaqJobPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [job, setJob] = useState<Job | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [rerunningMulti, setRerunningMulti] = useState(false)
  const [rerunning, setRerunning] = useState<number | null>(null)
  const [newlyUpdated, setNewlyUpdated] = useState<Set<number>>(new Set())
  const [activeIndex, setActiveIndex] = useState(0)
  const [resultQuery, setResultQuery] = useState('')
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all')
  const [detailTab, setDetailTab] = useState<DetailTab>('copy')
  const [logsCollapsed, setLogsCollapsed] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [keywordOverrides, setKeywordOverrides] = useState<Record<number, string>>({})
  const [editingKeyword, setEditingKeyword] = useState<number | null>(null)
  const [edits, setEdits] = useState<Record<string, { question: string; answer: string }>>({})
  const [editingFaq, setEditingFaq] = useState<string | null>(null)
  const [exportingSheets, setExportingSheets] = useState(false)
  const detailBodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const resetRateLimitedAction = () => { setRerunning(null); setRerunningMulti(false) }
    window.addEventListener('api-rate-limit', resetRateLimitedAction)
    return () => window.removeEventListener('api-rate-limit', resetRateLimitedAction)
  }, [])

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }
    try {
      const data = await faqApi.getJob(session.access_token, id)
      setJob(data)
    } catch (loadError) {
      console.error('Failed to fetch FAQ job:', loadError)
    }
  }, [id, router])

  useEffect(() => { void load() }, [load])

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
        const matchesQuery = !needle || [row.url, row.selected_keyword, row.keyword, row.faqs?.[0]?.question]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(needle)
        return matchesQuery && (resultFilter === 'all' || resultState(row) === resultFilter)
      })
  }, [resultFilter, resultQuery, results])

  useEffect(() => {
    if (detailBodyRef.current) detailBodyRef.current.scrollTop = 0
  }, [activeIndex, detailTab])

  function markUpdated(indices: number[], refreshedResults: RowResult[]) {
    const successful = indices.filter(index => {
      const row = refreshedResults[index]
      return row && !row.error && (row.faqs?.length || row.faq_count)
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
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await faqApi.cancelJob(session.access_token, job.id)
        await load()
      }
    } catch (cancelError) {
      console.error('Cancel request failed:', cancelError)
    }
    setCancelling(false)
  }

  function copyToClipboard(value: string, key: string) {
    void navigator.clipboard.writeText(value)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1500)
  }

  function buildExportRows() {
    return buildFaqExportRows(results, edits)
  }

  function downloadCsv() {
    if (!job || !results.length) return
    const { headers, rows } = buildExportRows()
    const csvRows = rows.map(row => headers.map(header => `"${String(row[header] ?? '').replace(/"/g, '""')}"`).join(','))
    const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv' })
    const anchor = document.createElement('a')
    anchor.href = URL.createObjectURL(blob)
    anchor.download = `${job.name || 'faq-results'}.csv`
    anchor.click()
    URL.revokeObjectURL(anchor.href)
  }

  function downloadXlsx() {
    if (!job || !results.length) return
    const { rows } = buildExportRows()
    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Results')
    XLSX.writeFile(workbook, `${job.name || 'faq-results'}.xlsx`)
  }

  async function exportGoogleSheets() {
    if (!job || !results.length || exportingSheets) return
    setExportingSheets(true)
    try {
      const { headers, rows } = buildExportRows()
      await exportRowsToGoogleSheets({
        title: `${job.name || 'FAQ results'} - FAQ`,
        sheet_name: 'FAQ Results',
        headers,
        rows,
      })
    } catch (exportError) {
      alert(googleSheetsExportError(exportError))
    } finally {
      setExportingSheets(false)
    }
  }

  async function startRowRerun(index: number, keywordOverride?: string) {
    if (!job || rerunning !== null) return
    setRerunning(index)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setRerunning(null)
        return
      }
      await faqApi.rerunRow(session.access_token, job.id, index, keywordOverride)
      const poll = window.setInterval(async () => {
        try {
          const updated = await faqApi.getJob(session.access_token, job.id)
          if (updated.status !== 'running') {
            window.clearInterval(poll)
            setRerunning(null)
            markUpdated([index], updated.results || [])
            setJob(updated)
          }
        } catch (pollError) {
          window.clearInterval(poll)
          setRerunning(null)
          console.error('FAQ rerun polling failed:', pollError)
        }
      }, 2000)
    } catch (rerunError) {
      setRerunning(null)
      console.error('FAQ rerun request failed:', rerunError)
    }
  }

  async function rerunSelectedRows() {
    if (!job || !selectedRows.size) return
    setRerunningMulti(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const indices = Array.from(selectedRows)
        await faqApi.rerunRows(session.access_token, job.id, indices)
        const refreshed = await faqApi.getJob(session.access_token, job.id)
        markUpdated(indices, refreshed.results || [])
        setSelectedRows(new Set())
        setJob(refreshed)
      }
    } catch (rerunError) {
      console.error('FAQ rerun request failed:', rerunError)
    }
    setRerunningMulti(false)
  }

  if (!job) {
    return (
      <AppLayout title="FAQ Copy">
        <div className="flex h-48 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </AppLayout>
    )
  }

  const selectedIndex = results[activeIndex] ? activeIndex : 0
  const selectedResult = results[selectedIndex]
  const selectedState = selectedResult ? resultState(selectedResult) : 'ready'
  const selectedFaqs = selectedResult?.faqs || []
  const readyCount = results.filter(row => resultState(row) === 'ready').length
  const reviewCount = results.filter(row => resultState(row) === 'review').length
  const errorCount = results.filter(row => resultState(row) === 'error').length
  const faqTotal = results.reduce((sum, row) => sum + (row.faq_count ?? row.faqs?.length ?? 0), 0)
  const gscLabels = Array.from(new Set(results.map(row => gscAuthLabel(row.gsc_auth_method)).filter(Boolean)))
  const gscSummary = gscLabels.length === 0 ? 'Manual' : gscLabels.length === 1 ? gscLabels[0] : 'Mixed'

  return (
    <AppLayout title="FAQ Copy">
      <div className={styles.jobPage}>
        <header className={styles.pageHeader}>
          <div className={styles.pageHeaderCopy}>
            <Link href="/faq/jobs" className={styles.backButton}>
              <ArrowLeft size={14} /> All FAQ jobs
            </Link>
            <span className={styles.eyebrow}>FAQ Copy job</span>
            <h1>{job.name || 'Untitled job'}</h1>
            <div className={styles.headerMeta}>
              <Badge label={job.status} />
              <span>{job.completed_rows}/{job.total_rows} rows</span>
              {job.created_at && <span>{new Date(job.created_at).toLocaleString('en-GB')}</span>}
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
              <ExportMenu onCsv={downloadCsv} onXlsx={downloadXlsx} onGoogleSheets={exportGoogleSheets} sheetsLoading={exportingSheets} />
            </div>
          )}
        </header>

        {(job.status === 'running' || job.status === 'cancelling') && (
          <RunningJobPanel
            status={job.status}
            completedRows={job.completed_rows}
            totalRows={job.total_rows}
            failedRows={errorCount}
            currentStep={job.current_step}
            logs={job.logs}
            cancelling={cancelling}
            onCancel={() => void handleCancel()}
          />
        )}

        {job.error && <div className={styles.errorNotice}>{gscErrorMessage(job.error)}</div>}

        {results.length > 0 && (
          <>
            <section className={styles.metricStrip} aria-label="FAQ result summary">
              <div><span>FAQs generated</span><strong>{faqTotal}</strong><small>Across {results.length} rows</small></div>
              <div><span>Ready</span><strong className={styles.successValue}>{readyCount}</strong><small>No QA flags</small></div>
              <div><span>Needs review</span><strong className={reviewCount ? styles.warningValue : undefined}>{reviewCount}</strong><small>Deterministic QA</small></div>
              <div><span>Search context</span><strong>{gscSummary}</strong><small>{errorCount ? `${errorCount} failed row${errorCount === 1 ? '' : 's'}` : 'No failed rows'}</small></div>
            </section>

            <div className={styles.toolbar}>
              <div className={styles.toolbarGroup}>
                <div className="flex select-none items-center gap-2 text-xs text-muted">
                  <StyledCheckbox
                    ariaLabel="Select all FAQ result rows"
                    checked={selectedRows.size === results.length && results.length > 0}
                    onChange={checked => setSelectedRows(checked ? new Set(results.map((_, index) => index)) : new Set())}
                  />
                  {selectedRows.size > 0 ? `${selectedRows.size} selected` : 'Select all'}
                </div>
                {selectedRows.size === 0 && errorCount > 0 && (
                  <button type="button" className={styles.iconTextButton} onClick={() => setSelectedRows(new Set(results.map((row, index) => resultState(row) === 'error' ? index : -1).filter(index => index >= 0)))}>
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
                  const elapsed = Math.round((new Date(entry.ts).getTime() - new Date(job.logs?.[0]?.ts || entry.ts).getTime()) / 1000)
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
                    <span className={styles.srOnly}>Search FAQ results</span>
                    <input type="search" value={resultQuery} onChange={event => setResultQuery(event.target.value)} placeholder="Search URL or keyword" />
                    {resultQuery && <button type="button" aria-label="Clear result search" onClick={() => setResultQuery('')}><X size={13} /></button>}
                  </label>
                  <div className={styles.resultFilters} role="tablist" aria-label="Filter FAQ results">
                    {([['all', 'All'], ['ready', 'Ready'], ['review', 'Review'], ['error', 'Error']] as Array<[ResultFilter, string]>).map(([value, label]) => (
                      <button type="button" role="tab" key={value} aria-selected={resultFilter === value} data-active={resultFilter === value ? 'true' : 'false'} onClick={() => setResultFilter(value)}>{label}</button>
                    ))}
                  </div>
                </div>
                <div className={styles.resultList}>
                  {filteredResults.map(({ row, index }) => {
                    const state = resultState(row)
                    const faqCount = row.faq_count ?? row.faqs?.length ?? 0
                    return (
                      <article key={`${row.url}-${index}`} className={`${styles.resultRow} ${selectedIndex === index ? styles.resultRowActive : ''} ${newlyUpdated.has(index) ? 'row-flash' : ''}`}>
                        <div className={styles.resultCheckbox}>
                          <StyledCheckbox
                            ariaLabel={`Select FAQ result row ${index + 1}`}
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
                            setEditingFaq(null)
                            setNewlyUpdated(previous => {
                              const next = new Set(previous)
                              next.delete(index)
                              return next
                            })
                          }}
                        >
                          <span className={styles.resultPrimaryTop}>
                            <span><strong>{row.selected_keyword || row.keyword || `Row ${index + 1}`}</strong><small>{domainFromUrl(row.url)}</small></span>
                            <span className={styles.statusPill} data-state={state}>{resultStateLabel(state)}</span>
                          </span>
                          <p>{previewText(row.faqs?.[0]?.question || gscErrorMessage(row.error) || 'No generated FAQ copy')}</p>
                          <span className={styles.resultMeta}>
                            <span>{faqCount} FAQ{faqCount === 1 ? '' : 's'}</span>
                            <span>{row.keyword_source || 'Manual'}</span>
                            {!!row.qa_flags?.length && <span>{row.qa_flags.length} flag{row.qa_flags.length === 1 ? '' : 's'}</span>}
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
                      <h2>{selectedResult.selected_keyword || selectedResult.keyword || `Row ${selectedIndex + 1}`}</h2>
                      <p>{selectedResult.url}</p>
                    </div>
                    <div className={styles.detailHeaderActions}>
                      <span className={styles.statusPill} data-state={selectedState}>{resultStateLabel(selectedState)}</span>
                      <button type="button" className={styles.queueIconButton} aria-label="Rerun selected row" title="Rerun selected row" disabled={rerunning !== null} onClick={() => void startRowRerun(selectedIndex)}>
                        <RefreshCw size={14} className={rerunning === selectedIndex ? 'animate-spin' : ''} />
                      </button>
                    </div>
                  </header>

                  <nav className={styles.detailTabs} aria-label="FAQ result detail">
                    {([
                      ['copy', 'FAQ copy'],
                      ['quality', `Quality${selectedResult.qa_flags?.length ? ` (${selectedResult.qa_flags.length})` : ''}`],
                      ['sources', 'Sources'],
                      ['schema', 'Schema'],
                    ] as Array<[DetailTab, string]>).map(([value, label]) => (
                      <button type="button" key={value} aria-pressed={detailTab === value} data-active={detailTab === value ? 'true' : 'false'} onClick={() => { setDetailTab(value); setEditingFaq(null) }}>{label}</button>
                    ))}
                  </nav>

                  {detailTab === 'copy' && (
                    <div key={`copy-${selectedIndex}`} ref={detailBodyRef} className={styles.detailBody}>
                      {selectedResult.error ? (
                        <section className={styles.qualitySummary}>
                          <span className={styles.qualityIcon} data-state="error"><AlertTriangle size={18} /></span>
                          <div><h3>This row did not generate</h3><p>{gscErrorMessage(selectedResult.error)}</p></div>
                        </section>
                      ) : selectedFaqs.length ? (
                        <>
                          <section className={faqStyles.faqSummary}>
                            <div><strong>{selectedFaqs.length} generated questions</strong><span>{selectedFaqs.reduce((sum, faq) => sum + wordCount(faq.answer), 0)} answer words</span></div>
                            <button type="button" className="btn-ghost text-xs" onClick={() => copyToClipboard(selectedFaqs.map((faq, faqIndex) => {
                              const edit = edits[`${selectedIndex}-${faqIndex}`]
                              return `${edit?.question ?? faq.question}\n${edit?.answer ?? faq.answer}`
                            }).join('\n\n'), `all-${selectedIndex}`)}>
                              {copied === `all-${selectedIndex}` ? <Check size={13} /> : <Copy size={13} />} {copied === `all-${selectedIndex}` ? 'Copied' : 'Copy all'}
                            </button>
                          </section>

                          <div className={faqStyles.faqStack}>
                            {selectedFaqs.map((faq, faqIndex) => {
                              const key = `${selectedIndex}-${faqIndex}`
                              const edit = edits[key]
                              const question = edit?.question ?? faq.question
                              const answer = edit?.answer ?? faq.answer
                              const isEditing = editingFaq === key
                              return (
                                <article key={`${faq.question}-${faqIndex}`} className={faqStyles.faqItem}>
                                  <span className={faqStyles.faqNumber}>{String(faqIndex + 1).padStart(2, '0')}</span>
                                  <div className={faqStyles.faqContent}>
                                    <div className={faqStyles.faqQuestion}>
                                      {isEditing ? (
                                        <textarea
                                          className="input-base text-sm font-semibold"
                                          rows={2}
                                          value={question}
                                          onChange={event => setEdits(previous => ({ ...previous, [key]: { question: event.target.value, answer } }))}
                                        />
                                      ) : <h3>{question}</h3>}
                                      {!isEditing && (
                                        <div className={faqStyles.faqActions}>
                                          <button type="button" title="Copy FAQ" aria-label={`Copy FAQ ${faqIndex + 1}`} onClick={() => copyToClipboard(`${question}\n${answer}`, `faq-${key}`)}>{copied === `faq-${key}` ? <Check size={13} /> : <Copy size={13} />}</button>
                                          <button type="button" title="Edit FAQ" aria-label={`Edit FAQ ${faqIndex + 1}`} onClick={() => { setEditingFaq(key); setEdits(previous => ({ ...previous, [key]: { question, answer } })) }}><Pencil size={13} /></button>
                                        </div>
                                      )}
                                    </div>

                                    {isEditing ? (
                                      <div className={faqStyles.answerEditor}>
                                        <textarea className="input-base text-sm" value={answer} onChange={event => setEdits(previous => ({ ...previous, [key]: { question, answer: event.target.value } }))} />
                                        <div className={faqStyles.editorActions}>
                                          <span>{wordCount(answer)} words</span>
                                          <div className={faqStyles.editorButtons}>
                                            <button type="button" className="btn-ghost text-xs" onClick={() => {
                                              setEdits(previous => {
                                                const next = { ...previous }
                                                delete next[key]
                                                return next
                                              })
                                              setEditingFaq(null)
                                            }}>Cancel</button>
                                            <button type="button" className="btn-primary text-xs" onClick={() => setEditingFaq(null)}><Check size={13} /> Save</button>
                                          </div>
                                        </div>
                                      </div>
                                    ) : <p className={faqStyles.faqAnswer}>{answer}</p>}

                                    <footer className={faqStyles.faqFooter}>
                                      <span>{wordCount(answer)} words</span>
                                      <span>{faq.source || 'Generated'}</span>
                                      {edit && !isEditing && <span className={faqStyles.editedLabel}>Edited locally</span>}
                                    </footer>
                                  </div>
                                </article>
                              )
                            })}
                          </div>
                        </>
                      ) : (
                        <div className={faqStyles.emptyCopy}><FileText size={22} /><strong>No generated FAQ copy saved</strong><p>Rerun this row to try again.</p></div>
                      )}
                    </div>
                  )}

                  {detailTab === 'quality' && (
                    <div key={`quality-${selectedIndex}`} ref={detailBodyRef} className={styles.detailBody}>
                      <section className={styles.qualitySummary}>
                        <span className={styles.qualityIcon} data-state={selectedState}>{selectedState === 'ready' ? <ClipboardCheck size={18} /> : <AlertTriangle size={18} />}</span>
                        <div>
                          <h3>{selectedState === 'ready' ? 'No deterministic QA flags' : selectedState === 'error' ? 'Generation error' : 'Review recommended'}</h3>
                          <p>{selectedState === 'ready' ? 'This row is ready for editorial review and export.' : selectedState === 'error' ? gscErrorMessage(selectedResult.error) : 'Check the flagged rules before using this FAQ copy.'}</p>
                        </div>
                      </section>
                      <section className={faqStyles.qualityFacts} aria-label="FAQ quality facts">
                        <div><span>Questions</span><strong>{selectedFaqs.length}</strong><small>{selectedFaqs.length ? 'Generated FAQ set' : 'No saved questions'}</small></div>
                        <div><span>Average answer</span><strong>{selectedFaqs.length ? Math.round(selectedFaqs.reduce((sum, faq) => sum + wordCount(faq.answer), 0) / selectedFaqs.length) : 0}</strong><small>Words per answer</small></div>
                        <div><span>QA flags</span><strong>{selectedResult.qa_flags?.length || 0}</strong><small>Deterministic checks</small></div>
                      </section>
                      {selectedResult.qa_flags?.length ? (
                        <div className={styles.checkList}>
                          {selectedResult.qa_flags.map(flag => <div key={flag}><span><AlertTriangle size={13} /></span><p>{flag}</p></div>)}
                        </div>
                      ) : null}
                    </div>
                  )}

                  {detailTab === 'sources' && (
                    <div key={`sources-${selectedIndex}`} ref={detailBodyRef} className={`${styles.detailBody} ${faqStyles.sourcesBody}`}>
                      <section className={styles.sourceSummary}>
                        <div><span>Page context</span><strong>{selectedResult.scrape_status || 'Not recorded'}</strong><small>Target page read</small></div>
                        <div><span>People Also Ask</span><strong>{selectedResult.paa_count ?? 0}</strong><small>Questions returned</small></div>
                        <div><span>AI Overview</span><strong>{selectedResult.ai_overview_present ? 'Available' : 'Not found'}</strong><small>Search context</small></div>
                      </section>

                      <div className={styles.sourceList}>
                        <div><span><FileText size={14} /></span><div><strong>Target page</strong><p>{selectedResult.url}</p></div></div>
                        <div><span><Search size={14} /></span><div><strong>Search Console</strong><p>{gscAuthLabel(selectedResult.gsc_auth_method) || 'No GSC method was recorded for this row.'}</p></div></div>
                        <div><span><Database size={14} /></span><div><strong>Keyword source</strong><p>{selectedResult.keyword_source || 'No keyword source label was recorded.'}</p></div></div>
                      </div>

                      <section className={styles.keywordPanel}>
                        <label>Primary keyword</label>
                        {editingKeyword === selectedIndex ? (
                          <div className={styles.keywordEditor}>
                            <input autoFocus className="input-base text-xs" value={keywordOverrides[selectedIndex] ?? (selectedResult.selected_keyword || selectedResult.keyword || '')} onChange={event => setKeywordOverrides(previous => ({ ...previous, [selectedIndex]: event.target.value }))} />
                            <button type="button" className={styles.copyButton} aria-label="Save keyword and rerun" title="Save keyword and rerun" onClick={() => {
                              const override = (keywordOverrides[selectedIndex] ?? (selectedResult.selected_keyword || selectedResult.keyword || '')).trim()
                              if (!override) return
                              setEditingKeyword(null)
                              void startRowRerun(selectedIndex, override)
                            }}><Check size={14} /></button>
                            <button type="button" className={styles.copyButton} aria-label="Cancel keyword edit" title="Cancel keyword edit" onClick={() => setEditingKeyword(null)}><X size={14} /></button>
                          </div>
                        ) : (
                          <div className={styles.keywordValue}>
                            <strong>{selectedResult.selected_keyword || selectedResult.keyword || 'No keyword selected'}</strong>
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

                      <div className={faqStyles.sourceEvidence}>
                        <EvidenceBlock title="Owned page context" detail={selectedResult.scrape_status || 'Not recorded'} value={selectedResult.page_context_preview} initiallyOpen />
                        <EvidenceBlock title="Google AI Overview" detail={selectedResult.ai_overview_present ? 'Available' : 'Not found'} value={selectedResult.ai_overview_raw_text} />
                        <EvidenceBlock title="People Also Ask" detail={`${selectedResult.paa_count ?? 0} questions`} value={selectedResult.paa_raw_text} />
                      </div>

                      <details className={faqStyles.debugDetails}>
                        <summary className={faqStyles.debugSummary}><span>Processing details</span><ChevronDown size={13} /></summary>
                        <div className={faqStyles.debugBody}>
                          <p className={faqStyles.debugMeta}>AI Overview attempts: {selectedResult.ao_attempts ?? 1} | SERP item types: {selectedResult.serp_item_types || 'not recorded'} | FAQ sources: {selectedResult.faq_sources || 'not recorded'}</p>
                        </div>
                      </details>
                    </div>
                  )}

                  {detailTab === 'schema' && (
                    <div key={`schema-${selectedIndex}`} ref={detailBodyRef} className={styles.detailBody}>
                      <section className={faqStyles.schemaHeader}>
                        <div><FileJson size={18} /><span><strong>FAQPage JSON-LD</strong><small>{selectedFaqs.length} Question entities</small></span></div>
                        <button type="button" disabled={!schemaText(selectedResult)} aria-label="Copy FAQ schema" title="Copy FAQ schema" onClick={() => copyToClipboard(schemaText(selectedResult), `schema-${selectedIndex}`)}>{copied === `schema-${selectedIndex}` ? <Check size={13} /> : <Copy size={13} />}</button>
                      </section>
                      <pre className={faqStyles.codeBlock}>{schemaText(selectedResult) || '// Schema will be available after this row generates successfully.'}</pre>
                    </div>
                  )}

                  <footer className={styles.detailFooter}>
                    <span>Row {selectedIndex + 1} of {results.length}</span>
                    <div>
                      <button type="button" className="btn-ghost text-xs" onClick={() => { setDetailTab('sources'); setEditingKeyword(selectedIndex) }}><Pencil size={13} /> Edit keyword</button>
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

function EvidenceBlock({ title, detail, value, initiallyOpen = false }: { title: string; detail: string; value?: string; initiallyOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(initiallyOpen)

  return (
    <details className={faqStyles.evidenceBlock} open={isOpen} onToggle={event => setIsOpen(event.currentTarget.open)}>
      <summary className={faqStyles.evidenceHeader}>
        <span><Database size={13} /> {title}</span>
        <span className={faqStyles.evidenceMeta}><small>{detail}</small><ChevronDown className={faqStyles.evidenceChevron} size={13} /></span>
      </summary>
      <div className={faqStyles.evidenceText}>{value?.trim() || 'No saved content was available for this source.'}</div>
    </details>
  )
}
