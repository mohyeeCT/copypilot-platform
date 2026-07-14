'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Database,
  Download,
  FileText,
  Info,
  Layers,
  Link2,
  ListChecks,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import aioStyles from '@/components/all-in-one/AllInOneWorkspace.module.css'
import AppLayout from '@/components/layout/AppLayout'
import styles from '@/components/meta/MetaCopyWorkspace.module.css'
import Badge from '@/components/ui/Badge'
import ExportMenu from '@/components/ui/ExportMenu'
import RunningJobPanel from '@/components/ui/RunningJobPanel'
import StyledCheckbox from '@/components/ui/StyledCheckbox'
import { aioApi } from '@/lib/api/all-in-one'
import { exportRowsToGoogleDocs, googleDocsExportError } from '@/lib/export/googleDocs'
import { exportRowsToGoogleSheets, googleSheetsExportError } from '@/lib/export/googleSheets'
import { createClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface QaFlag {
  code: string
  message: string
  severity?: 'warning' | 'review' | 'error'
  output?: string
  phrase?: string
  details?: string[]
}

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
  content_gap_summary?: { section: string; missing_topics: string[]; summary?: string }[]
  strategy_brief?: Record<string, unknown>
  strategy_status?: 'ready' | 'needs_review' | 'unavailable' | 'not_requested'
  strategy_issues?: string[]
  qa_flags?: QaFlag[]
  run_diagnostics?: {
    provider?: string
    model?: string
    input_signal_counts?: {
      paa_questions?: number
      ai_overview_sections?: number
      competitors_scraped?: number
      scraped_page_chars?: number
    }
    scrape?: { page_context_success?: boolean }
  }
  generated_title?: string
  generated_description?: string
  optimised_h1?: string
  title_length?: number
  description_length?: number
  faq_items?: { question: string; answer: string }[]
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
  logs?: { ts: string; msg: string }[]
}

type ResultFilter = 'all' | 'ready' | 'review' | 'error'
type ResultState = Exclude<ResultFilter, 'all'>
type DetailTab = 'overview' | 'strategy' | 'meta' | 'faqs' | 'page' | 'quality' | 'sources'

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

function previewText(text?: string, max = 120) {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  return cleaned.length > max ? `${cleaned.slice(0, max - 3).trim()}...` : cleaned
}

function resultState(row: PageCopyResult): ResultState {
  if (row.error || row.status === 'error' || row.status === 'failed') return 'error'
  const hasOutput = Boolean(
    row.generated_title || row.generated_description || row.optimised_h1 ||
    row.faq_items?.length || Object.keys(row.section_results || {}).length,
  )
  if (row.status === 'review' || row.status === 'warning' || row.qa_flags?.length || !hasOutput) return 'review'
  return 'ready'
}

function resultStateLabel(state: ResultState) {
  if (state === 'review') return 'Needs review'
  if (state === 'error') return 'Error'
  return 'Ready'
}

const STRATEGY_BRIEF_ORDER = [
  'search_intent',
  'page_goal',
  'audience_need',
  'recommended_angle',
  'brand_positioning',
  'proof_points_to_use',
  'claims_to_avoid',
  'competitor_gaps',
  'meta_direction',
  'faq_direction',
  'section_guidance',
]

const STRATEGY_BRIEF_LABELS: Record<string, string> = {
  search_intent: 'Search intent',
  page_goal: 'Page goal',
  audience_need: 'Audience need',
  recommended_angle: 'Recommended angle',
  brand_positioning: 'Brand positioning',
  proof_points_to_use: 'Proof points to use',
  claims_to_avoid: 'Claims to avoid',
  competitor_gaps: 'Competitor gaps',
  meta_direction: 'Meta direction',
  faq_direction: 'FAQ direction',
  section_guidance: 'Section guidance',
}

function strategyLabel(key: string) {
  return STRATEGY_BRIEF_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

function formatStrategyBriefValue(value: unknown): string[] {
  if (value == null) return []
  if (Array.isArray(value)) {
    return value.flatMap(item => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const record = item as Record<string, unknown>
        const section = String(record.section || '').trim()
        const guidance = String(record.guidance || record.direction || record.notes || '').trim()
        if (guidance) return [section ? `${section}: ${guidance}` : guidance]
        return Object.entries(record)
          .map(([key, nested]) => `${strategyLabel(key)}: ${formatStrategyBriefValue(nested).join(', ')}`)
          .filter(line => !line.endsWith(': '))
      }
      const text = String(item || '').trim()
      return text ? [text] : []
    })
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nested]) => `${strategyLabel(key)}: ${formatStrategyBriefValue(nested).join(', ')}`)
      .filter(line => !line.endsWith(': '))
  }
  const text = String(value).trim()
  return text ? [text] : []
}

function strategyBriefEntries(brief?: Record<string, unknown>) {
  if (!brief) return []
  const keys = [...STRATEGY_BRIEF_ORDER, ...Object.keys(brief).filter(key => !STRATEGY_BRIEF_ORDER.includes(key))]
  return keys
    .map(key => ({ key, label: strategyLabel(key), lines: formatStrategyBriefValue(brief[key]) }))
    .filter(entry => entry.lines.length > 0)
}

export default function AllInOneJobPage() {
  const { id } = useParams()
  const router = useRouter()
  const [job, setJob] = useState<Job | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [rerunning, setRerunning] = useState<number | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [rerunningMulti, setRerunningMulti] = useState(false)
  const [newlyUpdated, setNewlyUpdated] = useState<Set<number>>(new Set())
  const [rerunningSections, setRerunningSections] = useState<Set<string>>(new Set())
  const [reviewerInstruction, setReviewerInstruction] = useState<Record<string, string>>({})
  const [logsCollapsed, setLogsCollapsed] = useState(true)
  const [exportingDocs, setExportingDocs] = useState(false)
  const [exportingLinksSheets, setExportingLinksSheets] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [resultQuery, setResultQuery] = useState('')
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all')
  const [detailTab, setDetailTab] = useState<DetailTab>('overview')
  const jobStatus = job?.status

  useEffect(() => {
    const resetRateLimitedAction = () => {
      setRerunning(null); setRerunningMulti(false)
      setRerunningSections(new Set())
    }
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
      setJob(await aioApi.getJob(session.access_token, id as string))
    } catch (error) {
      console.error('Failed to fetch job:', error)
    }
  }, [id, router])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (jobStatus !== 'running' && jobStatus !== 'cancelling') return
    const timer = window.setInterval(() => { void load() }, 3000)
    return () => window.clearInterval(timer)
  }, [jobStatus, load])

  useEffect(() => {
    if (jobStatus && jobStatus !== 'running' && jobStatus !== 'cancelling') setCancelling(false)
  }, [jobStatus])

  const results = useMemo(() => job?.results || [], [job?.results])
  const filteredResults = useMemo(() => {
    const needle = resultQuery.trim().toLowerCase()
    return results
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => {
        const matchesQuery = !needle || [row.url, row.primary_keyword, row.generated_title, row.optimised_h1]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(needle)
        const matchesState = resultFilter === 'all' || resultState(row) === resultFilter
        return matchesQuery && matchesState
      })
  }, [resultFilter, resultQuery, results])

  function markUpdated(indices: number[], refreshedResults: PageCopyResult[]) {
    const successful = indices.filter(index => {
      const row = refreshedResults[index]
      return row && !row.error && Boolean(row.word_count || row.generated_title || row.faq_items?.length)
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
        await aioApi.cancelJob(session.access_token, job.id)
        await load()
      }
    } catch (error) {
      console.error('Cancel request failed:', error)
    }
    setCancelling(false)
  }

  function downloadDocx(row: PageCopyResult, index: number) {
    if (!row.docx_b64) return
    const bytes = Uint8Array.from(atob(row.docx_b64), char => char.charCodeAt(0))
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    const anchor = document.createElement('a')
    anchor.href = URL.createObjectURL(blob)
    const slug = (row.url || `row-${index + 1}`).replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '_').slice(0, 50)
    anchor.download = `${slug}.docx`
    anchor.click()
    URL.revokeObjectURL(anchor.href)
  }

  function downloadAllDocx() {
    results.forEach((row, index) => {
      if (row.docx_b64) window.setTimeout(() => downloadDocx(row, index), index * 300)
    })
  }

  function buildGoogleDocBody() {
    const lines: string[] = [job?.name || 'All in One Results', `Rows: ${job?.completed_rows ?? 0}/${job?.total_rows ?? 0}`, '']
    results.forEach((row, index) => {
      lines.push(`${index + 1}. ${row.url || 'Untitled URL'}`)
      if (row.primary_keyword) lines.push(`Primary keyword: ${row.primary_keyword}`)
      if (row.keyword_source) lines.push(`Keyword source: ${row.keyword_source}`)
      if (row.kw_volume !== undefined) lines.push(`Volume: ${row.kw_volume}`)
      if (row.status) lines.push(`Status: ${row.status}`)
      if (row.error) lines.push(`Error: ${gscErrorMessage(row.error)}`)
      if (row.generated_title || row.generated_description || row.optimised_h1) {
        lines.push('', 'Meta Copy')
        if (row.generated_title) lines.push(`Title: ${row.generated_title}`)
        if (row.generated_description) lines.push(`Description: ${row.generated_description}`)
        if (row.optimised_h1) lines.push(`H1: ${row.optimised_h1}`)
      }
      if (row.faq_items?.length) {
        lines.push('', 'FAQs')
        row.faq_items.forEach((faq, faqIndex) => lines.push(`${faqIndex + 1}. ${faq.question}`, faq.answer))
      }
      if (row.section_results && Object.keys(row.section_results).length) {
        lines.push('', 'Page Copy')
        Object.entries(row.section_results).forEach(([section, text]) => lines.push(section, text, ''))
      }
      if (row.competitor_urls?.length) {
        lines.push('Competitors referenced')
        row.competitor_urls.forEach(url => lines.push(url))
      }
      lines.push('')
    })
    return lines.join('\n').replace(/\n{4,}/g, '\n\n\n').trim()
  }

  async function exportGoogleDocs() {
    if (!job || !results.length || exportingDocs) return
    setExportingDocs(true)
    try {
      await exportRowsToGoogleDocs({
        title: `${job.name || 'All in One results'} - All in One`,
        body: buildGoogleDocBody(),
      })
    } catch (error) {
      alert(googleDocsExportError(error))
    } finally {
      setExportingDocs(false)
    }
  }

  function buildInternalLinksExportRows() {
    const headers = ['Source URL', 'Target URL', 'Suggested Anchor', 'Confidence', 'Reason']
    const rows = (job?.internal_link_suggestions || []).map(suggestion => ({
      'Source URL': suggestion.source_url || '',
      'Target URL': suggestion.target_url || '',
      'Suggested Anchor': suggestion.anchor_text || '',
      'Confidence': suggestion.confidence ?? '',
      'Reason': suggestion.reason || '',
    }))
    return { headers, rows }
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

  async function startRowRerun(index: number) {
    if (!job || rerunning !== null) return
    setRerunning(index)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) {
        setRerunning(null)
        return
      }
      await aioApi.rerunRow(session.access_token, job.id, index)
      const poll = window.setInterval(async () => {
        try {
          const updated = await aioApi.getJob(session.access_token, job.id)
          if (updated.status !== 'running') {
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
      }, 3000)
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
        await aioApi.rerunRows(session.access_token, job.id, indices)
        const refreshed = await aioApi.getJob(session.access_token, job.id)
        markUpdated(indices, refreshed.results || [])
        setSelectedRows(new Set())
        setJob(refreshed)
      }
    } catch (error) {
      console.error('Rerun request failed:', error)
    }
    setRerunningMulti(false)
  }

  async function rerunSection(rowIndex: number, name: string) {
    if (!job) return
    const sectionKey = `${rowIndex}-${name}`
    setRerunningSections(previous => new Set([...Array.from(previous), sectionKey]))
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) return
      await aioApi.rerunSection(session.access_token, job.id, rowIndex, name, reviewerInstruction[sectionKey] || '')
      const poll = window.setInterval(async () => {
        const updated = await aioApi.getJob(session.access_token, job.id)
        const step: string = updated.current_step || ''
        if (!step.startsWith(`Regenerating section '${name}'`)) {
          window.clearInterval(poll)
          setRerunningSections(previous => {
            const next = new Set(previous)
            next.delete(sectionKey)
            return next
          })
          setReviewerInstruction(previous => ({ ...previous, [sectionKey]: '' }))
          setJob(updated)
        }
      }, 3000)
    } catch (error) {
      console.error('Section rerun request failed:', error)
      setRerunningSections(previous => {
        const next = new Set(previous)
        next.delete(sectionKey)
        return next
      })
    }
  }

  if (!job) {
    return (
      <AppLayout title="All in One">
        <div className="flex h-48 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </AppLayout>
    )
  }

  const selectedIndex = results[activeIndex] ? activeIndex : 0
  const selectedResult = results[selectedIndex]
  const row = {
    ...(selectedResult || { url: '' }),
    title_length: selectedResult?.title_length ?? selectedResult?.generated_title?.length ?? 0,
    description_length: selectedResult?.description_length ?? selectedResult?.generated_description?.length ?? 0,
  }
  const selectedState = selectedResult ? resultState(selectedResult) : 'ready'
  const readyCount = results.filter(row => resultState(row) === 'ready').length
  const reviewCount = results.filter(row => resultState(row) === 'review').length
  const errorCount = results.filter(row => resultState(row) === 'error').length
  const reviewSummary = reviewCount === 1
    ? '1 row needs review; generated files remain available.'
    : `${reviewCount} rows need review; generated files remain available.`
  const hasDocx = results.some(row => row.docx_b64)

  return (
    <AppLayout title="All in One">
      <div className={styles.jobPage}>
        <header className={styles.pageHeader}>
          <div className={styles.pageHeaderCopy}>
            <Link href="/all-in-one/jobs" className={styles.backButton}><ArrowLeft size={14} /> All AIO jobs</Link>
            <span className={styles.eyebrow}>All in One job</span>
            <h1>{job.name || 'Untitled job'}</h1>
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
                <button type="button" className="btn-primary text-sm" disabled={rerunningMulti} onClick={() => void rerunSelectedRows()}>
                  <RefreshCw size={13} className={rerunningMulti ? 'animate-spin' : ''} /> {rerunningMulti ? 'Starting...' : `Rerun ${selectedRows.size}`}
                </button>
              )}
              <ExportMenu onDocx={hasDocx ? downloadAllDocx : undefined} onGoogleDocs={exportGoogleDocs} docsLoading={exportingDocs} />
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
            onCancel={handleCancel}
            helperText="AIO jobs may run meta, FAQ, page copy, research, and quality steps for each URL."
          />
        )}

        {job.error && <div className={styles.errorNotice}>{gscErrorMessage(job.error)}</div>}

        {results.length > 0 && (
          <>
            <section className={styles.metricStrip} aria-label="All in One result summary">
              <div><span>Rows</span><strong>{results.length}</strong><small>{job.completed_rows} processed</small></div>
              <div><span>Ready</span><strong className={styles.successValue}>{readyCount}</strong><small>Ready to export</small></div>
              <div><span>Needs review</span><strong className={reviewCount ? styles.warningValue : undefined}>{reviewCount}</strong><small>Quality checks</small></div>
              <div><span>Errors</span><strong className={errorCount ? styles.warningValue : undefined}>{errorCount}</strong><small>Rerun available</small></div>
            </section>

            {reviewCount > 0 && (
              <div className={aioStyles.notice}>
                <AlertTriangle size={13} />
                <span>{reviewSummary}</span>
              </div>
            )}

            {job.internal_link_suggestions?.length ? (
              <details className={aioStyles.internalLinks}>
                <summary>
                  <div><strong>Internal link suggestions</strong><span>{job.internal_link_suggestions.length} opportunities across this job</span></div>
                  <ChevronDown size={15} className="text-muted" />
                </summary>
                <div className={aioStyles.internalLinksBody}>
                  <div><ExportMenu onGoogleSheets={exportInternalLinksGoogleSheets} sheetsLoading={exportingLinksSheets} /></div>
                  <div className={aioStyles.linkList}>
                    {job.internal_link_suggestions.slice(0, 8).map((suggestion, index) => (
                      <div key={`${suggestion.source_url}-${suggestion.target_url}-${index}`} className={aioStyles.linkItem}>
                        <strong>{suggestion.anchor_text}</strong>
                        {suggestion.reason && <p>{suggestion.reason}</p>}
                        <div className={aioStyles.linkMeta}>
                          <span>From: {suggestion.source_url}</span>
                          <span>To: {suggestion.target_url}</span>
                          {suggestion.confidence !== undefined && <span>{Math.round(suggestion.confidence * 100)}% confidence</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            ) : null}

            <div className={styles.toolbar}>
              <div className={styles.toolbarGroup}>
                <label className="flex items-center gap-2 text-xs text-muted">
                  <StyledCheckbox
                    ariaLabel="Select all All in One result rows"
                    checked={selectedRows.size === results.length && results.length > 0}
                    onChange={checked => setSelectedRows(checked ? new Set(results.map((_, index) => index)) : new Set())}
                  />
                  {selectedRows.size ? `${selectedRows.size} selected` : 'Select all'}
                </label>
                {selectedRows.size === 0 && (reviewCount > 0 || errorCount > 0) && (
                  <button type="button" className={styles.iconTextButton} onClick={() => setSelectedRows(new Set(results.map((row, index) => resultState(row) !== 'ready' ? index : -1).filter(index => index >= 0)))}>
                    Select rows needing attention
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
                <header className={styles.queueHeader}><div><h2>Review queue</h2><p>{filteredResults.length} of {results.length} rows visible</p></div></header>
                <div className={styles.queueTools}>
                  <label className={styles.searchField}>
                    <Search size={14} />
                    <span className={styles.srOnly}>Search All in One results</span>
                    <input value={resultQuery} onChange={event => setResultQuery(event.target.value)} placeholder="Search URL or keyword" />
                    {resultQuery && <button type="button" aria-label="Clear result search" onClick={() => setResultQuery('')}><X size={13} /></button>}
                  </label>
                  <div className={styles.resultFilters} role="tablist" aria-label="Filter All in One results">
                    {([['all', 'All'], ['ready', 'Ready'], ['review', 'Review'], ['error', 'Error']] as Array<[ResultFilter, string]>).map(([value, label]) => (
                      <button type="button" role="tab" key={value} aria-selected={resultFilter === value} data-active={resultFilter === value ? 'true' : 'false'} onClick={() => setResultFilter(value)}>{label}</button>
                    ))}
                  </div>
                </div>
                <div className={styles.resultList}>
                  {filteredResults.map(({ row, index }) => {
                    const state = resultState(row)
                    const outputCount = Number(Boolean(row.generated_title)) + Number(Boolean(row.faq_items?.length)) + Number(Boolean(Object.keys(row.section_results || {}).length))
                    return (
                      <article key={`${row.url}-${index}`} className={`${styles.resultRow} ${selectedIndex === index ? styles.resultRowActive : ''} ${newlyUpdated.has(index) ? 'row-flash' : ''}`}>
                        <div className={styles.resultCheckbox}>
                          <StyledCheckbox
                            ariaLabel={`Select All in One result row ${index + 1}`}
                            checked={selectedRows.has(index)}
                            onChange={checked => setSelectedRows(previous => {
                              const next = new Set(previous)
                              if (checked) next.add(index)
                              else next.delete(index)
                              return next
                            })}
                          />
                        </div>
                        <button type="button" className={styles.resultPrimary} onClick={() => {
                          setActiveIndex(index)
                          setDetailTab('overview')
                          setNewlyUpdated(previous => {
                            const next = new Set(previous)
                            next.delete(index)
                            return next
                          })
                        }}>
                          <span className={styles.resultPrimaryTop}><strong>{row.primary_keyword || `Row ${index + 1}`}</strong><span className={styles.statusPill} data-state={state}>{resultStateLabel(state)}</span></span>
                          <p>{previewText(row.generated_title || row.optimised_h1 || row.faq_items?.[0]?.question || Object.values(row.section_results || {})[0] || gscErrorMessage(row.error))}</p>
                          <span className={styles.resultMeta}><span>{row.url}</span><span>{outputCount} outputs</span></span>
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
                    <div><span className={styles.eyebrow}>Selected row</span><h2>{selectedResult.primary_keyword || `Row ${selectedIndex + 1}`}</h2><p>{selectedResult.url}</p></div>
                    <div className={styles.detailHeaderActions}>
                      <span className={styles.statusPill} data-state={selectedState}>{resultStateLabel(selectedState)}</span>
                      <button type="button" className={styles.queueIconButton} aria-label="Rerun selected row" title="Rerun selected row" disabled={rerunning !== null} onClick={() => void startRowRerun(selectedIndex)}><RefreshCw size={13} className={rerunning === selectedIndex ? 'animate-spin' : ''} /></button>
                    </div>
                  </header>
                  <nav className={styles.detailTabs} aria-label="All in One result detail">
                    {([
                      ['overview', 'Overview'],
                      ['strategy', 'Strategy'],
                      ['meta', 'Meta'],
                      ['faqs', `FAQs${selectedResult.faq_items?.length ? ` (${selectedResult.faq_items.length})` : ''}`],
                      ['page', 'Page copy'],
                      ['quality', `Quality${selectedResult.qa_flags?.length ? ` (${selectedResult.qa_flags.length})` : ''}`],
                      ['sources', 'Sources'],
                    ] as Array<[DetailTab, string]>).map(([value, label]) => (
                      <button type="button" key={value} aria-pressed={detailTab === value} data-active={detailTab === value ? 'true' : 'false'} onClick={() => setDetailTab(value)}>{label}</button>
                    ))}
                  </nav>

                  {detailTab === 'overview' && (
                    <div className={styles.detailBody}>
                      {selectedResult.error && <section className={styles.qualitySummary}><span className={styles.qualityIcon} data-state="error"><AlertTriangle size={18} /></span><div><h3>This row did not generate</h3><p>{gscErrorMessage(selectedResult.error)}</p></div></section>}
                      <div className={aioStyles.outputGrid}>
                        <div className={aioStyles.outputCard}><span>Meta copy</span><strong>{selectedResult.generated_title ? 'Generated' : 'Not generated'}</strong><small>{selectedResult.optimised_h1 || 'No H1 saved'}</small></div>
                        <div className={aioStyles.outputCard}><span>FAQs</span><strong>{selectedResult.faq_items?.length || 0}</strong><small>Questions generated</small></div>
                        <div className={aioStyles.outputCard}><span>Page copy</span><strong>{Object.keys(selectedResult.section_results || {}).length}</strong><small>{selectedResult.word_count || 0} words</small></div>
                      </div>
                      <div className={aioStyles.diagnosticsGrid}>
                        <div className={aioStyles.diagnostic}><span>Owned page</span><strong>{selectedResult.run_diagnostics?.scrape?.page_context_success ? 'Available' : 'Unavailable'}</strong><small>{selectedResult.run_diagnostics?.input_signal_counts?.scraped_page_chars || 0} characters</small></div>
                        <div className={aioStyles.diagnostic}><span>Search context</span><strong>{selectedResult.run_diagnostics?.input_signal_counts?.paa_questions || 0} PAA</strong><small>{selectedResult.run_diagnostics?.input_signal_counts?.ai_overview_sections || 0} AI Overview sections</small></div>
                        <div className={aioStyles.diagnostic}><span>Competitors</span><strong>{selectedResult.run_diagnostics?.input_signal_counts?.competitors_scraped || 0}</strong><small>Pages successfully scraped</small></div>
                      </div>
                    </div>
                  )}

                  {detailTab === 'strategy' && (
                    <div className={styles.detailBody}>
                      <div className={aioStyles.sectionHeading}><span>Strategy Brief</span><p>Read-only direction shared across this row&apos;s generated outputs.</p></div>
                      {selectedResult.strategy_issues?.map((issue, index) => <div key={`${issue}-${index}`} className={aioStyles.notice}><AlertTriangle size={13} /><span>{issue}</span></div>)}
                      {strategyBriefEntries(selectedResult.strategy_brief).length ? (
                        <div className={aioStyles.strategyGrid}>
                          {strategyBriefEntries(selectedResult.strategy_brief).map(entry => (
                            <div key={entry.key} className={aioStyles.strategyItem}><span>{entry.label}</span>{entry.lines.map((line, index) => <p key={`${entry.key}-${index}`}>{line}</p>)}</div>
                          ))}
                        </div>
                      ) : <div className={styles.emptyResults}><ListChecks size={22} /><strong>No strategy brief saved</strong><p>The row can still contain generated outputs.</p></div>}
                    </div>
                  )}

                  {detailTab === 'meta' && (
                    <div className={styles.detailBody}>
                      {row.generated_title && <section className={styles.copyBlock}><div className={styles.blockHeader}><div><span>Title tag</span><span className={`${styles.meter} ${row.title_length > 90 ? 'text-warning' : ''}`}>{row.title_length}/90</span></div></div><p>{row.generated_title}</p></section>}
                      {row.generated_description && <section className={styles.copyBlock}><div className={styles.blockHeader}><div><span>Meta description</span><span className={`${styles.meter} ${row.description_length > 200 ? 'text-warning' : ''}`}>{row.description_length}/200</span></div></div><p>{row.generated_description}</p></section>}
                      {selectedResult.optimised_h1 && <section className={styles.copyBlock}><div className={styles.blockHeader}><div><span>Optimised H1</span></div></div><p className={styles.h1Value}>{selectedResult.optimised_h1}</p></section>}
                      {!selectedResult.generated_title && !selectedResult.generated_description && !selectedResult.optimised_h1 && <div className={styles.emptyResults}><FileText size={22} /><strong>No meta copy saved</strong><p>This output was not requested or did not generate.</p></div>}
                    </div>
                  )}

                  {detailTab === 'faqs' && (
                    <div className={styles.detailBody}>
                      {selectedResult.faq_items?.length ? (
                        <div className={aioStyles.faqStack}>{selectedResult.faq_items.map((faq, index) => <div key={`${faq.question}-${index}`} className={aioStyles.faqItem}><strong>{index + 1}. {faq.question}</strong><p>{faq.answer}</p></div>)}</div>
                      ) : <div className={styles.emptyResults}><ListChecks size={22} /><strong>No FAQs saved</strong><p>This output was not requested or did not generate.</p></div>}
                    </div>
                  )}

                  {detailTab === 'page' && (
                    <div className={styles.detailBody}>
                      {Object.keys(selectedResult.section_results || {}).length ? (
                        <div className={aioStyles.sectionStack}>
                          {Object.entries(selectedResult.section_results || {}).map(([name, text]) => {
                            const sectionKey = `${selectedIndex}-${name}`
                            const isRegenerating = rerunningSections.has(sectionKey)
                            return (
                              <section key={name} className={aioStyles.sectionItem}>
                                <div className={aioStyles.sectionHeader}><strong>{name}</strong><span>{text.split(/\s+/).filter(Boolean).length} words</span></div>
                                <div className={aioStyles.sectionRerun}>
                                  <input className="input-base text-xs" placeholder="Optional rerun note" value={reviewerInstruction[sectionKey] || ''} onChange={event => setReviewerInstruction(previous => ({ ...previous, [sectionKey]: event.target.value }))} />
                                  <button type="button" className="btn-ghost text-xs" disabled={isRegenerating} onClick={() => void rerunSection(selectedIndex, name)}><RefreshCw size={12} className={isRegenerating ? 'animate-spin' : ''} /> {isRegenerating ? 'Rerunning...' : 'Rerun section'}</button>
                                </div>
                                <p>{text}</p>
                              </section>
                            )
                          })}
                        </div>
                      ) : <div className={styles.emptyResults}><Layers size={22} /><strong>No page copy saved</strong><p>This output was not requested or did not generate.</p></div>}
                    </div>
                  )}

                  {detailTab === 'quality' && (
                    <div className={styles.detailBody}>
                      <section className={styles.qualitySummary}>
                        <span className={styles.qualityIcon} data-state={selectedState}>{selectedState === 'ready' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}</span>
                        <div><h3>{resultStateLabel(selectedState)}</h3><p>{selectedState === 'ready' ? 'All generated outputs are ready for editorial review and export.' : selectedState === 'error' ? gscErrorMessage(selectedResult.error) : 'Check the flagged rules before using these outputs.'}</p></div>
                      </section>
                      <section className={styles.lengthChecks} aria-label="All in One quality facts">
                        <div><span>QA flags</span><strong>{selectedResult.qa_flags?.length || 0}</strong><small>Deterministic checks</small></div>
                        <div><span>Strategy</span><strong>{selectedResult.strategy_status || 'Not recorded'}</strong><small>Brief status</small></div>
                        <div><span>Provider</span><strong>{selectedResult.run_diagnostics?.provider || '-'}</strong><small>{selectedResult.run_diagnostics?.model || 'Model not recorded'}</small></div>
                      </section>
                      {selectedResult.qa_flags?.length ? (
                        <div className={styles.checkList}>
                          {selectedResult.qa_flags.map((flag, index) => {
                            const Icon = flag.severity === 'warning' ? Info : AlertTriangle
                            return <div key={`${flag.code}-${flag.output || 'row'}-${index}`}><span><Icon size={13} /></span><p><strong>{flag.message}</strong>{flag.details?.map((detail, detailIndex) => <small key={`${detail}-${detailIndex}`} className="block mt-1">{detail}</small>)}</p></div>
                          })}
                        </div>
                      ) : null}
                    </div>
                  )}

                  {detailTab === 'sources' && (
                    <div className={styles.detailBody}>
                      <section className={styles.sourceSummary}>
                        <div><span>Primary keyword</span><strong>{selectedResult.primary_keyword || 'Not selected'}</strong><small>{selectedResult.keyword_source || 'No source label'}</small></div>
                        <div><span>Volume</span><strong>{selectedResult.kw_volume ?? '-'}</strong><small>Monthly searches</small></div>
                        <div><span>Search Console</span><strong>{gscAuthLabel(row.gsc_auth_method) || 'Not recorded'}</strong><small>Connection used</small></div>
                      </section>
                      <div className={styles.sourceList}>
                        <div><span><Database size={14} /></span><div><strong>Owned page</strong><p>{selectedResult.run_diagnostics?.scrape?.page_context_success ? `${selectedResult.run_diagnostics.input_signal_counts?.scraped_page_chars || 0} characters available` : 'Owned-page context was unavailable.'}</p></div></div>
                        <div><span><Search size={14} /></span><div><strong>Search signals</strong><p>{selectedResult.run_diagnostics?.input_signal_counts?.paa_questions || 0} People Also Ask questions and {selectedResult.run_diagnostics?.input_signal_counts?.ai_overview_sections || 0} AI Overview sections.</p></div></div>
                        <div><span><Link2 size={14} /></span><div><strong>Competitor evidence</strong><p>{selectedResult.competitor_urls?.length || 0} competitor URLs recorded.</p></div></div>
                      </div>
                      {selectedResult.competitor_urls?.length ? <div className={aioStyles.linkList}>{selectedResult.competitor_urls.map(url => <div key={url} className={aioStyles.linkItem}><a href={url} target="_blank" rel="noreferrer" className="font-mono text-xs text-accent hover:underline">{url}</a></div>)}</div> : null}
                      {selectedResult.content_gap_summary?.length ? <div><div className={aioStyles.sectionHeading}><span>Content gaps</span><p>Topics found in the research that may strengthen this page.</p></div><div className={aioStyles.gapList}>{selectedResult.content_gap_summary.map((gap, index) => <div key={`${gap.section}-${index}`} className={aioStyles.gapItem}><span>{gap.section}</span><p>{gap.summary || gap.missing_topics.join(', ')}</p></div>)}</div></div> : null}
                    </div>
                  )}

                  <footer className={styles.detailFooter}>
                    <span>Row {selectedIndex + 1} of {results.length}</span>
                    <div>
                      {selectedResult.docx_b64 && <button type="button" className="btn-ghost text-xs" onClick={() => downloadDocx(selectedResult, selectedIndex)}><Download size={13} /> Download DOCX</button>}
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
