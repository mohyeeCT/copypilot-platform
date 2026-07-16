'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Check,
  ChevronRight,
  Clock3,
  CircleHelp,
  CircleDollarSign,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Link2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Share2,
  Sparkles,
  Square,
  Target,
  X,
} from 'lucide-react'
import clsx from 'clsx'
import AppLayout from '@/components/layout/AppLayout'
import CustomSelect from '@/components/ui/CustomSelect'
import ExportMenu from '@/components/ui/ExportMenu'
import CollectionMethodSelector from '@/components/geopilot/CollectionMethodSelector'
import RunSurfaceDialog, { type GeoPilotRunTarget } from '@/components/geopilot/RunSurfaceDialog'
import ReportShareDialog from '@/components/geopilot/ReportShareDialog'
import SourceMonitorPanel from '@/components/geopilot/SourceMonitorPanel'
import AttributionPanel from '@/components/geopilot/AttributionPanel'
import SurfaceSelector, { ALL_GEOPILOT_SURFACES, GEOPILOT_SURFACES } from '@/components/geopilot/SurfaceSelector'
import { createClient } from '@/lib/supabase'
import {
  downloadGeoPilotExport,
  fetchGeoPilotExportBundle,
  geopilotApi,
  type GeoPilotCapabilities,
  type GeoPilotAttribution,
  type GeoPilotCollectionMethod,
  type GeoPilotCollectionPayload,
  type GeoPilotCostSummary,
  type GeoPilotExportDataset,
  type GeoPilotMeasurementMethods,
  type GeoPilotPrimarySurface,
  type GeoPilotPromptPayload,
  type GeoPilotContentGapBrief,
  type GeoPilotSourceChange,
  type GeoPilotSourceMonitor,
} from '@/lib/api/geopilot'
import { exportRowsToGoogleSheets, googleSheetsExportError } from '@/lib/export/googleSheets'
import {
  downloadGeoPilotWorkbook,
  GEOPILOT_EXPORT_DATASETS,
  loadGeoPilotExportTables,
} from '@/lib/geopilot-exports'
import { formatUsd } from '@/lib/geopilot-costs'
import {
  availableSurfaceMethods,
  buildDashboardTrend,
  type GeoPilotDashboardMetric,
  type GeoPilotTrendPoint,
} from '@/lib/geopilot-dashboard'
import {
  buildMeasurementMethods,
  collectionRunModeLabel,
  collectionMethodLabel,
  CONSUMER_UI_SURFACES,
  deliveryMethodLabel,
  measurementCostKey,
  normalizeCollectionMeasurementMethods,
  PRIMARY_METHOD_BY_SURFACE,
  runModeForMeasurementMethods,
  surfaceMethodLabel,
} from '@/lib/geopilot-methods'
import styles from '@/components/geopilot/GeoPilotProfile.module.css'

type RecordValue = Record<string, unknown>
type Prompt = {
  id: string
  prompt_text: string
  google_query?: string
  calibration?: boolean
  source?: 'manual' | 'parallel'
  version?: number
  category?: string
  funnel_stage?: 'awareness' | 'consideration' | 'decision' | null
  active?: boolean
}
type Collection = {
  id: string
  name: string
  objective?: string
  schedule?: 'manual' | 'daily'
  prompt_count?: number
  prompts?: Prompt[]
  surfaces?: GeoPilotPrimarySurface[]
  measurement_methods?: GeoPilotMeasurementMethods
  active?: boolean
  funnel_stage?: 'awareness' | 'consideration' | 'decision' | null
  country_code?: string | null
  location_name?: string | null
  language_code?: string | null
  device?: 'desktop' | 'mobile' | null
  monthly_budget_usd?: number | null
}
type Profile = {
  id: string
  name: string
  brand_name: string
  primary_domain?: string
  owned_domains?: string[]
  country_code?: string
  language_code?: string
  device?: string
  active?: boolean
  competitors?: Array<{ name: string }>
  collections?: Collection[]
  latest_batch?: Batch | null
}
type Batch = {
  id: string
  status: string
  total_runs?: number
  completed_runs?: number
  failed_runs?: number
  created_at?: string
  error?: string | null
  surface_selection?: { retry?: { source_batch_id?: string } }
}
type Citation = {
  id?: string
  domain?: string
  url?: string
  title?: string
  excerpt?: string
  classification?: string
  page_type?: string
  position?: number
}
type Run = {
  id: string
  batch_id?: string
  prompt_id?: string
  profile_id?: string
  surface: string
  method: string
  collection_method?: GeoPilotCollectionMethod
  model_name?: string
  observed_model?: string
  provider_name?: string
  provider_product?: string
  method_version?: string
  personalization_mode?: string
  status: string
  attempt_count?: number
  error?: string | null
  response_text?: string
  raw_response?: unknown
  brand_mentioned?: boolean
  prominence?: string
  sentiment?: string
  summary?: string
  competitors_mentioned?: string[]
  web_search_requested?: boolean
  web_search_used?: boolean | null
  cost_usd?: number
  created_at?: string
  request_snapshot?: { prompt_text?: string; google_query?: string }
  citations?: Citation[]
}
type SurfaceMetrics = {
  collection_method?: GeoPilotCollectionMethod
  visibility_score?: number | null
  share_of_voice?: number | null
  prominence_score?: number | null
  sentiment_score?: number | null
  citation_share?: number | null
  ai_overview_coverage?: number | null
  successful_runs?: number
  mentioned_runs?: number
  cited_runs?: number
}
type Dashboard = {
  overall_visibility?: number | null
  display_overall_visibility?: number | null
  overall_share_of_voice?: number | null
  overall_citation_share?: number | null
  measured_surfaces?: GeoPilotPrimarySurface[]
  surfaces?: Record<string, SurfaceMetrics>
  display_surfaces?: Record<string, SurfaceMetrics>
  primary_methods?: Partial<Record<GeoPilotPrimarySurface, GeoPilotCollectionMethod>>
  method_comparison?: Partial<Record<'chatgpt' | 'gemini', Partial<Record<GeoPilotCollectionMethod, SurfaceMetrics>>>>
  calibration?: SurfaceMetrics
  timeline?: RecordValue[]
  prompt_performance?: Array<RecordValue & {
    id: string
    prompt_text?: string
    visibility_score?: number | null
    share_of_voice?: number | null
    successful_runs?: number
  }>
}
type Insight = {
  id: string
  status: string
  insight?: Record<string, unknown>
  evidence_urls?: string[]
  generated_at?: string
}
type CitationGap = {
  run_id: string
  prompt?: string
  surface?: string
  collection_method?: GeoPilotCollectionMethod
  observed_at?: string
  competitors?: string[]
  citations?: Citation[]
  recommended_page_type?: string
}
type CitationIntelligence = {
  period_days?: number
  summary: {
    total_citations: number
    owned: number
    competitor: number
    third_party: number
    verified_gaps: number
  }
  page_types: Array<{ page_type: string; citation_count: number }>
  top_domains: Array<{
    domain: string
    citation_count: number
    classification: 'owned' | 'competitor' | 'third_party'
    page_types: string[]
  }>
  gaps: CitationGap[]
}
type ProviderAlert = {
  id: string
  alert_type: 'parser_drift' | 'model_catalog_change' | 'citation_anomaly'
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  surface?: string
  occurrence_count?: number
  last_seen_at?: string
}

const ACTIVE_BATCH_STATES = new Set(['queued', 'submitting', 'collecting', 'classifying', 'enriching'])
const PRIMARY_SURFACES: GeoPilotPrimarySurface[] = ['google_ai_overview', 'chatgpt', 'gemini', 'claude']
const SURFACES: Record<string, string> = {
  google_ai_overview: 'Google AI Overview',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  claude: 'Claude',
  chatgpt_calibration: 'ChatGPT calibration',
}
const TABS = ['Overview', 'Prompts', 'Results', 'Opportunities', 'Attribution'] as const
type ResultOutcome = '' | 'mentioned' | 'not_found' | 'failed'
const EMPTY_CITATION_INTELLIGENCE: CitationIntelligence = {
  summary: { total_citations: 0, owned: 0, competitor: 0, third_party: 0, verified_gaps: 0 },
  page_types: [],
  top_domains: [],
  gaps: [],
}
const COLLECTION_SCHEDULE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'manual', label: 'Manual only' },
]
const COLLECTION_METHOD_FILTER_OPTIONS = [
  { value: '', label: 'All methods' },
  { value: 'model_api', label: 'Model API' },
  { value: 'consumer_ui_organic', label: 'Consumer UI' },
  { value: 'google_search_result', label: 'Google search result' },
  { value: 'consumer_ui_forced_search', label: 'Consumer calibration' },
]
const RESULT_OUTCOME_FILTER_OPTIONS = [
  { value: '', label: 'All results' },
  { value: 'mentioned', label: 'Mentioned' },
  { value: 'not_found', label: 'Not found' },
  { value: 'failed', label: 'Failed' },
]

const DASHBOARD_METRIC_DEFINITIONS: Record<GeoPilotDashboardMetric, {
  label: string
  description: string
}> = {
  visibility_score: {
    label: 'Visibility',
    description: 'The unweighted average of surface visibility. Each surface measures successful prompts that mention the tracked brand.',
  },
  share_of_voice: {
    label: 'Share of voice',
    description: 'Brand mentions divided by mentions of the tracked brand and configured competitors in the latest successful responses.',
  },
  citation_share: {
    label: 'Owned citation coverage',
    description: 'Cited responses containing at least one owned domain divided by all responses that include citations.',
  },
  ai_overview_coverage: {
    label: 'AI Overview coverage',
    description: 'Successful tracked Google searches where an AI Overview appeared, whether or not the tracked brand was mentioned.',
  },
}

function metric(value?: number | null, suffix = '%') {
  if (value == null) return '-'
  const number = Number(value)
  return `${number.toFixed(number % 1 ? 1 : 0)}${suffix}`
}

function dateLabel(value?: string) {
  if (!value) return '-'
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function sentenceCase(value: string) {
  return value.replaceAll('_', ' ').replace(/^./, character => character.toUpperCase())
}

function surfaceTone(surface: string) {
  if (surface === 'google_ai_overview') return 'google'
  if (surface === 'chatgpt_calibration') return 'calibration'
  if (surface === 'gemini') return 'gemini'
  if (surface === 'claude') return 'claude'
  return 'chatgpt'
}

function normalizeDomain(value?: string) {
  if (!value) return ''
  const normalized = value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '')
  return normalized.split('/')[0].split(':')[0]
}

function isOwnedDomain(
  domain: string | undefined,
  ownedDomains: string | undefined | Array<string | undefined>,
) {
  const candidate = normalizeDomain(domain)
  if (!candidate) return false
  const values = Array.isArray(ownedDomains) ? ownedDomains : [ownedDomains]
  return values.some(value => {
    const owned = normalizeDomain(value)
    return Boolean(owned && (candidate === owned || candidate.endsWith(`.${owned}`)))
  })
}

function safeExternalUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

function hostname(value: string) {
  const safeUrl = safeExternalUrl(value)
  return safeUrl ? new URL(safeUrl).hostname.replace(/^www\./, '') : ''
}

function statusClass(status: string) {
  if (status === 'complete') return styles.stateGood
  if (status === 'failed') return styles.stateError
  if (status === 'partial') return styles.stateWarning
  if (status === 'cancelled') return styles.stateMuted
  return styles.stateActive
}

function percent(numerator: number, denominator: number) {
  return denominator ? (numerator / denominator) * 100 : null
}

function latestMeasurementRuns(runs: Run[]) {
  const ordered = [...runs].sort((left, right) => (
    String(right.created_at || '').localeCompare(String(left.created_at || ''))
  ))
  const latest = new Map<string, Run>()
  for (const run of ordered) {
    const key = JSON.stringify([
      run.prompt_id || run.id,
      run.surface,
      run.collection_method || PRIMARY_METHOD_BY_SURFACE[run.surface as keyof typeof PRIMARY_METHOD_BY_SURFACE] || '',
    ])
    if (!latest.has(key)) latest.set(key, run)
  }
  return [...latest.values()]
}

function matchesOutcome(run: Run, outcome: ResultOutcome) {
  if (!outcome) return true
  if (outcome === 'failed') return run.status === 'failed'
  if (outcome === 'mentioned') return run.status === 'complete' && run.brand_mentioned === true
  return run.status === 'complete' && run.brand_mentioned !== true
}

function filterMeasurementRuns(
  runs: Run[],
  query: string,
  outcome: ResultOutcome,
  surface: string,
  collectionMethod: string,
) {
  const normalized = query.trim().toLowerCase()
  return runs.filter(run => {
    if (!matchesOutcome(run, outcome)) return false
    if (surface && run.surface !== surface) return false
    const runMethod = run.collection_method
      || PRIMARY_METHOD_BY_SURFACE[run.surface as keyof typeof PRIMARY_METHOD_BY_SURFACE]
      || ''
    if (collectionMethod && runMethod !== collectionMethod) return false
    if (!normalized) return true
    const prompt = run.request_snapshot?.prompt_text || ''
    const label = SURFACES[run.surface] || run.surface
    return prompt.toLowerCase().includes(normalized) || label.toLowerCase().includes(normalized)
  })
}

function SurfaceMark({ surface }: { surface: string }) {
  const tone = surfaceTone(surface)
  return (
    <span className={clsx(styles.surfaceMark, styles[`surface_${tone}`])}>
      <span className={styles.surfaceDot} />
      <span className={styles.surfaceLabel}>{SURFACES[surface] || sentenceCase(surface)}</span>
    </span>
  )
}

const EMPTY_COST_SUMMARY: GeoPilotCostSummary = {
  period_days: 30,
  period_actual_usd: 0,
  month_actual_usd: 0,
  priced_measurements: 0,
  unpriced_measurements: 0,
  by_surface: {},
  by_method: {},
  by_collection: [],
  by_batch: [],
  estimate_basis_days: 90,
}

const EMPTY_CAPABILITIES: GeoPilotCapabilities = {
  consumer_ui: {
    enabled: false,
    surfaces: [],
    manual_only: true,
    delivery_method: 'live',
    provider_device: 'desktop',
    personalization_mode: 'anonymous',
    unit_cost_usd: 0.004,
    pricing_effective_date: '',
  },
  primary_methods: { ...PRIMARY_METHOD_BY_SURFACE } as Record<GeoPilotPrimarySurface, GeoPilotCollectionMethod>,
  supported_methods: {
    google_ai_overview: ['google_search_result'],
    chatgpt: ['model_api'],
    gemini: ['model_api'],
    claude: ['model_api'],
  },
}

function responseExcerpt(value?: string) {
  const response = value?.trim() || ''
  if (response.length <= 900) return response
  return `${response.slice(0, 900).trimEnd()}...`
}

function ResultDrawer({
  run,
  loading,
  error,
  ownedDomain,
  retrying,
  retryDisabled,
  onRetry,
  onClose,
}: {
  run: Run | null
  loading: boolean
  error: string
  ownedDomain?: string
  retrying: boolean
  retryDisabled: boolean
  onRetry?: () => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (run && !dialog.open) dialog.showModal()
    if (!run && dialog.open) dialog.close()
  }, [run])

  const citationDomains: string[] = []
  for (const citation of run?.citations || []) {
    const domain = normalizeDomain(citation.domain || hostname(citation.url || ''))
    if (domain && !citationDomains.includes(domain)) citationDomains.push(domain)
  }

  const mentionLabel = run?.status === 'complete'
    ? run.brand_mentioned ? 'Yes' : 'No'
    : run?.status ? sentenceCase(run.status) : '-'
  const excerpt = responseExcerpt(run?.response_text)

  return (
    <dialog
      ref={dialogRef}
      className={clsx(styles.dialog, styles.sheetDialog)}
      aria-labelledby="geopilot-result-drawer-title"
      onCancel={event => {
        event.preventDefault()
        onClose()
      }}
      onClose={onClose}
      onClick={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      {run ? (
        <aside className={styles.resultSheet}>
          <div className={styles.sheetHeader}>
            <div>
              <span className={styles.eyebrow}>Measurement result</span>
              <h2 id="geopilot-result-drawer-title">Result details</h2>
            </div>
            <button type="button" className={styles.dialogClose} aria-label="Close result details" onClick={onClose}><X size={17} /></button>
          </div>

          <div className={styles.sheetBody}>
            <div className={styles.sheetPrompt}>
              <SurfaceMark surface={run.surface} />
              <p>{run.request_snapshot?.prompt_text || 'Tracked prompt'}</p>
              <small>{collectionMethodLabel(run.collection_method || PRIMARY_METHOD_BY_SURFACE[run.surface as keyof typeof PRIMARY_METHOD_BY_SURFACE])} / {run.observed_model || run.model_name || deliveryMethodLabel(run.method)} / {dateLabel(run.created_at)}</small>
            </div>

            <div className={styles.sheetStats}>
              <div>
                <span>Brand mention</span>
                <strong className={run.status === 'complete' ? run.brand_mentioned ? styles.positive : styles.negative : undefined}>{mentionLabel}</strong>
              </div>
              <div><span>Prominence</span><strong>{run.prominence ? sentenceCase(run.prominence) : '-'}</strong></div>
              <div><span>Sentiment</span><strong>{run.sentiment ? sentenceCase(run.sentiment) : '-'}</strong></div>
              <div><span>Provider cost</span><strong>{formatUsd(run.cost_usd)}</strong></div>
            </div>

            {loading ? (
              <div className={styles.loadingState} role="status"><RefreshCw size={18} className={styles.spinning} /> Loading result details</div>
            ) : error ? (
              <div className={styles.errorNotice} role="alert">{error}</div>
            ) : run.status === 'failed' ? (
              <section className={styles.failureDetails} role="alert">
                <div><AlertTriangle size={16} /><h3>Measurement failed</h3></div>
                <p>{run.error || 'The measurement provider did not return a usable result.'}</p>
                <small>Provider attempts: {run.attempt_count ?? 0}</small>
              </section>
            ) : (
              <>
                <section className={styles.sheetSection}>
                  <h3>Summary</h3>
                  <p>{run.summary || 'No summary was returned for this measurement.'}</p>
                </section>
                <section className={styles.sheetSection}>
                  <div className={styles.sheetSectionTitle}>
                    <h3>Response excerpt</h3>
                    <Link href={`/geopilot/runs/${run.id}`}>View full result <ExternalLink size={12} /></Link>
                  </div>
                  <blockquote>{excerpt || 'No answer text was returned.'}</blockquote>
                </section>
                <section className={styles.sheetSection}>
                  <h3>Citation domains</h3>
                  {citationDomains.length ? (
                    <div className={styles.domainList}>
                      {citationDomains.map(domain => (
                        <div key={domain}>
                          <Link2 size={14} />
                          <span>{domain}</span>
                          {isOwnedDomain(domain, ownedDomain) ? <small>Owned</small> : null}
                        </div>
                      ))}
                    </div>
                  ) : <p className={styles.compactEmpty}>No citations were returned for this measurement.</p>}
                </section>
              </>
            )}
          </div>

          <footer className={styles.sheetFooter}>
            {run.status === 'failed' && onRetry ? (
              <button type="button" className={styles.secondaryButton} onClick={onRetry} disabled={retryDisabled}>
                <RefreshCw size={13} className={retrying ? styles.spinning : undefined} />
                {retrying ? 'Starting' : 'Retry measurement'}
              </button>
            ) : null}
            <Link href={`/geopilot/runs/${run.id}`} className={styles.secondaryButton}>View full result <ExternalLink size={13} /></Link>
            <button type="button" className={styles.primaryButton} onClick={onClose}>Done</button>
          </footer>
        </aside>
      ) : null}
    </dialog>
  )
}

type MiniTrendPoint = { date: string; value: number }
type ChartCoordinate = GeoPilotTrendPoint & {
  timestamp: number
  x: number
  y: number
}

function trendTimestamp(date: string) {
  return Date.parse(date.length === 10 ? `${date}T00:00:00Z` : date)
}

function splitChartSegments(coordinates: ChartCoordinate[]) {
  const segments: ChartCoordinate[][] = []
  for (const coordinate of coordinates) {
    const current = segments.at(-1)
    const previous = current?.at(-1)
    if (!current || (previous && coordinate.timestamp - previous.timestamp > 36 * 60 * 60 * 1000)) {
      segments.push([coordinate])
    } else {
      current.push(coordinate)
    }
  }
  return segments
}

function MetricTrendChart({
  points,
  comparisonPoints = [],
  metricLabel,
  brandName,
  primaryLabel,
}: {
  points: GeoPilotTrendPoint[]
  comparisonPoints?: GeoPilotTrendPoint[]
  metricLabel: string
  brandName: string
  primaryLabel: string
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    setActiveIndex(null)
    setLocked(false)
  }, [points, comparisonPoints])

  const width = 720
  const top = 15
  const bottom = 215
  const { coordinates, comparisonCoordinates } = useMemo(() => {
    const timestamps = [...points, ...comparisonPoints]
      .map(point => trendTimestamp(point.date))
      .filter(Number.isFinite)
    const first = Math.min(...timestamps)
    const last = Math.max(...timestamps)
    const dateRange = last - first
    const position = (point: GeoPilotTrendPoint): ChartCoordinate => {
      const timestamp = trendTimestamp(point.date)
      const x = dateRange ? ((timestamp - first) / dateRange) * width : width / 2
      const y = top + ((100 - Math.max(0, Math.min(100, point.value))) / 100) * (bottom - top)
      return { ...point, timestamp, x, y }
    }
    return {
      coordinates: points.map(position),
      comparisonCoordinates: comparisonPoints.map(position),
    }
  }, [comparisonPoints, points])

  if (!points.length) {
    return (
      <div className={styles.chartEmpty}>
        <BarChart3 size={22} />
        <strong>No trend data yet</strong>
        <p>{metricLabel} history appears after a completed measurement run.</p>
      </div>
    )
  }

  const segments = splitChartSegments(coordinates)
  const comparisonSegments = splitChartSegments(comparisonCoordinates)
  const labelIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])]
  const activePoint = activeIndex == null ? null : coordinates[activeIndex] || null

  function activateNearest(clientX: number, element: HTMLDivElement) {
    const rect = element.getBoundingClientRect()
    if (!rect.width) return
    const pointerX = Math.max(0, Math.min(width, ((clientX - rect.left) / rect.width) * width))
    let nearestIndex = 0
    let nearestDistance = Number.POSITIVE_INFINITY
    for (const [index, coordinate] of coordinates.entries()) {
      const distance = Math.abs(coordinate.x - pointerX)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    }
    setActiveIndex(nearestIndex)
  }

  function moveActivePoint(direction: number) {
    setActiveIndex(current => {
      if (current == null) return direction > 0 ? 0 : coordinates.length - 1
      return Math.max(0, Math.min(coordinates.length - 1, current + direction))
    })
  }

  const activeSummary = activePoint
    ? `${new Date(activePoint.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, ${metricLabel} ${metric(activePoint.value)}, ${activePoint.successfulRuns} successful measurements`
    : ''

  return (
    <div className={styles.chartWrap}>
      <div className={styles.chartYAxis} aria-hidden="true">
        <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
      </div>
      <div className={styles.chartCanvas}>
        <div
          className={styles.chartPlot}
          role="group"
          tabIndex={0}
          aria-label={`${brandName} ${metricLabel.toLowerCase()} trend for ${primaryLabel}`}
          onFocus={() => setActiveIndex(current => current ?? coordinates.length - 1)}
          onBlur={() => { setActiveIndex(null); setLocked(false) }}
          onPointerMove={event => { if (!locked) activateNearest(event.clientX, event.currentTarget) }}
          onPointerDown={event => activateNearest(event.clientX, event.currentTarget)}
          onPointerLeave={() => { if (!locked) setActiveIndex(null) }}
          onClick={() => { if (activePoint) setLocked(current => !current) }}
          onKeyDown={event => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault()
              moveActivePoint(event.key === 'ArrowRight' ? 1 : -1)
            } else if (event.key === 'Home') {
              event.preventDefault()
              setActiveIndex(0)
            } else if (event.key === 'End') {
              event.preventDefault()
              setActiveIndex(coordinates.length - 1)
            } else if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setLocked(current => !current)
            } else if (event.key === 'Escape') {
              setActiveIndex(null)
              setLocked(false)
            }
          }}
        >
          <svg viewBox="0 0 720 230" aria-hidden="true">
            <g className={styles.gridLines}>
              {[15, 65, 115, 165, 215].map(y => <line key={y} x1="0" y1={y} x2="720" y2={y} />)}
            </g>
            {comparisonSegments.map((segment, index) => (
              <polyline key={`comparison-${index}`} className={styles.chartComparison} points={segment.map(point => `${point.x},${point.y}`).join(' ')} />
            ))}
            {segments.map((segment, index) => (
              <polyline key={`primary-${index}`} className={styles.chartPrimary} points={segment.map(point => `${point.x},${point.y}`).join(' ')} />
            ))}
            {coordinates.map((point, index) => (
              <circle key={`${point.date}-${index}`} className={styles.chartDot} cx={point.x} cy={point.y} r="2.5" />
            ))}
            {activePoint ? (
              <>
                <line className={styles.chartCursor} x1={activePoint.x} y1={top} x2={activePoint.x} y2={bottom} />
                <circle className={styles.chartPoint} cx={activePoint.x} cy={activePoint.y} r="5" />
              </>
            ) : null}
          </svg>
          {activePoint ? (
            <div
              className={styles.chartTooltip}
              style={{ left: `${Math.max(13, Math.min(87, (activePoint.x / width) * 100))}%` }}
            >
              <time>{new Date(activePoint.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</time>
              <strong>{metric(activePoint.value)}</strong>
              <span>{metricLabel}</span>
              <small>
                {activePoint.successfulRuns} successful
                {metricLabel === 'Visibility' ? `, ${activePoint.mentionedRuns} mentioned` : ''}
                {metricLabel === 'Owned citation coverage' ? `, ${activePoint.citedRuns} cited` : ''}
              </small>
              <small>{activePoint.methods.map(collectionMethodLabel).join(', ')}</small>
            </div>
          ) : null}
          <span className={styles.srOnly} aria-live="polite">{activeSummary}</span>
        </div>
        <div className={styles.chartXAxis} aria-hidden="true">
          {labelIndexes.map(index => (
            <span key={`${points[index].date}-${index}`}>
              {new Date(points[index].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function MiniMethodTrend({ api, consumerUi, label }: { api: MiniTrendPoint[]; consumerUi: MiniTrendPoint[]; label: string }) {
  const coordinates = (points: MiniTrendPoint[]) => points.slice(-14).map((point, index, values) => {
    const x = values.length === 1 ? 58 : (index / (values.length - 1)) * 116
    const y = 4 + ((100 - Math.max(0, Math.min(100, point.value))) / 100) * 28
    return `${x},${y}`
  }).join(' ')

  if (!api.length && !consumerUi.length) return <span className={styles.stateMuted}>No trend</span>

  return (
    <svg className={styles.methodSparkline} viewBox="0 0 116 36" role="img" aria-label={`${label} API and Consumer UI visibility trend`}>
      <line x1="0" y1="32" x2="116" y2="32" />
      {api.length ? <polyline className={styles.sparkApi} points={coordinates(api)} /> : null}
      {consumerUi.length ? <polyline className={styles.sparkConsumerUi} points={coordinates(consumerUi)} /> : null}
    </svg>
  )
}

function MethodComparison({
  rows,
}: {
  rows: Array<{
    surface: 'chatgpt' | 'gemini'
    api: SurfaceMetrics
    consumerUi: SurfaceMetrics
    apiTrend: MiniTrendPoint[]
    consumerUiTrend: MiniTrendPoint[]
  }>
}) {
  return (
    <section className={clsx(styles.panel, styles.methodComparisonPanel)}>
      <div className={styles.panelHeader}>
        <div>
          <h2>API vs Consumer UI</h2>
          <p>Consumer UI measurements remain separate from the primary API visibility score</p>
        </div>
        <div className={styles.methodLegend} aria-label="Trend legend">
          <span><i className={styles.sparkApiKey} /> API</span>
          <span><i className={styles.sparkUiKey} /> Consumer UI</span>
        </div>
      </div>
      <div className={styles.methodComparisonWrap}>
        <table className={styles.methodComparisonTable}>
          <thead>
            <tr><th>Engine</th><th>Model API</th><th>Consumer UI</th><th>Difference</th><th>Daily trend</th></tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const apiVisibility = row.api.visibility_score
              const uiVisibility = row.consumerUi.visibility_score
              const difference = apiVisibility != null && uiVisibility != null ? uiVisibility - apiVisibility : null
              return (
                <tr key={row.surface}>
                  <td><SurfaceMark surface={row.surface} /></td>
                  <td><strong>{metric(apiVisibility)}</strong><small>{row.api.successful_runs || 0} samples</small></td>
                  <td><strong>{metric(uiVisibility)}</strong><small>{row.consumerUi.successful_runs || 0} samples</small></td>
                  <td><strong>{difference == null ? '-' : `${difference > 0 ? '+' : ''}${difference.toFixed(1)} pp`}</strong></td>
                  <td><MiniMethodTrend api={row.apiTrend} consumerUi={row.consumerUiTrend} label={SURFACES[row.surface]} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ResultsTable({
  runs,
  total,
  ownedDomain,
  onInspect,
  onRetry,
  retryingRunId,
  retryDisabled,
}: {
  runs: Run[]
  total: number
  ownedDomain?: string
  onInspect: (run: Run) => void
  onRetry: (run: Run) => void
  retryingRunId?: string
  retryDisabled: boolean
}) {
  return (
    <>
      <div className={styles.tableWrap}>
        {runs.length ? (
          <table className={styles.resultsTable}>
            <thead>
              <tr>
                <th>Prompt</th>
                <th>Surface</th>
                <th>Mention</th>
                <th>Prominence</th>
                <th>Citations</th>
                <th>Checked</th>
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {runs.map(run => {
                const citations = run.citations || []
                const ownedCitations = citations.filter(citation => isOwnedDomain(citation.domain, ownedDomain)).length
                return (
                  <tr key={run.id}>
                    <td>
                      <button type="button" className={styles.promptButton} onClick={() => onInspect(run)}>
                        <strong>{run.request_snapshot?.prompt_text || 'Tracked prompt'}</strong>
                        <small>{run.observed_model || run.model_name || deliveryMethodLabel(run.method)}</small>
                      </button>
                    </td>
                    <td>
                      <span className={styles.methodCell}>
                        <SurfaceMark surface={run.surface} />
                        <small>{collectionMethodLabel(run.collection_method || PRIMARY_METHOD_BY_SURFACE[run.surface as keyof typeof PRIMARY_METHOD_BY_SURFACE])}</small>
                      </span>
                    </td>
                    <td>
                      {run.status === 'complete' ? (
                        <span className={run.brand_mentioned ? styles.mentionYes : styles.mentionNo}>
                          {run.brand_mentioned ? <Check size={12} /> : <X size={12} />}
                          <span className={styles.mentionLabel}>{run.brand_mentioned ? 'Mentioned' : 'Not found'}</span>
                        </span>
                      ) : (
                        <span className={clsx(styles.runState, statusClass(run.status))}>{sentenceCase(run.status)}</span>
                      )}
                    </td>
                    <td><span className={styles.cellMuted}>{run.prominence || '-'}</span></td>
                    <td>
                      <span className={styles.citationCell}>
                        {citations.length}
                        <small>{ownedCitations} owned</small>
                      </span>
                    </td>
                    <td><span className={styles.timeCell}><Clock3 size={13} /> {dateLabel(run.created_at)}</span></td>
                    <td>
                      <div className={styles.rowActions}>
                        {run.status === 'failed' ? (
                          <button
                            type="button"
                            className={clsx(styles.rowAction, styles.rowRetryAction)}
                            aria-label="Retry failed measurement"
                            title="Retry failed measurement"
                            onClick={() => onRetry(run)}
                            disabled={retryDisabled}
                          >
                            <RefreshCw size={14} className={retryingRunId === run.id ? styles.spinning : undefined} />
                          </button>
                        ) : null}
                        <button type="button" className={styles.rowAction} aria-label="Inspect measurement result" onClick={() => onInspect(run)}>
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className={styles.emptyState}>
            <Search size={21} />
            <strong>No matching measurements</strong>
            <p>Try a different prompt search or measurement source.</p>
          </div>
        )}
      </div>
      <footer className={styles.tableFooter}>
        <span>Showing {runs.length} of {total} loaded measurements</span>
      </footer>
    </>
  )
}

export default function GeoPilotProfilePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [accessToken, setAccessToken] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [dashboard, setDashboard] = useState<Dashboard>({})
  const [costs, setCosts] = useState<GeoPilotCostSummary>(EMPTY_COST_SUMMARY)
  const [capabilities, setCapabilities] = useState<GeoPilotCapabilities>(EMPTY_CAPABILITIES)
  const [costsUnavailable, setCostsUnavailable] = useState(false)
  const [runs, setRuns] = useState<Run[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [insights, setInsights] = useState<Insight[]>([])
  const [citationIntelligence, setCitationIntelligence] = useState<CitationIntelligence>(EMPTY_CITATION_INTELLIGENCE)
  const [providerAlerts, setProviderAlerts] = useState<ProviderAlert[]>([])
  const [sourceMonitors, setSourceMonitors] = useState<GeoPilotSourceMonitor[]>([])
  const [sourceChanges, setSourceChanges] = useState<GeoPilotSourceChange[]>([])
  const [contentGapBriefs, setContentGapBriefs] = useState<GeoPilotContentGapBrief[]>([])
  const [attribution, setAttribution] = useState<GeoPilotAttribution | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [tab, setTab] = useState<(typeof TABS)[number]>('Overview')
  const [days, setDays] = useState(30)
  const [surface, setSurface] = useState('')
  const [collectionMethod, setCollectionMethod] = useState('')
  const [resultOutcome, setResultOutcome] = useState<ResultOutcome>('')
  const [dashboardMetric, setDashboardMetric] = useState<GeoPilotDashboardMetric>('visibility_score')
  const [metricHelp, setMetricHelp] = useState<GeoPilotDashboardMetric | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState('')
  const [error, setError] = useState('')
  const [runTarget, setRunTarget] = useState<GeoPilotRunTarget | null>(null)
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null)
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)
  const [selectedRun, setSelectedRun] = useState<Run | null>(null)
  const [resultLoading, setResultLoading] = useState(false)
  const [resultError, setResultError] = useState('')
  const resultRequestId = useRef(0)
  const capabilitiesLoaded = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setAccessToken(session.access_token)
      const capabilityRequest = capabilitiesLoaded.current
        ? Promise.resolve<GeoPilotCapabilities | null>(null)
        : geopilotApi.capabilities(session.access_token).catch(() => null)
      capabilitiesLoaded.current = true
      const [
        profileData,
        dashboardData,
        costResult,
        runsData,
        insightsData,
        batchesData,
        citationData,
        alertsData,
        capabilityData,
        monitorsData,
        changesData,
        briefsData,
        attributionData,
      ] = await Promise.all([
        geopilotApi.getProfile(session.access_token, id),
        geopilotApi.dashboard(session.access_token, id, days),
        geopilotApi.costs(session.access_token, id, days)
          .then(data => ({ data, unavailable: false }))
          .catch(() => ({ data: { ...EMPTY_COST_SUMMARY, period_days: days }, unavailable: true })),
        geopilotApi.listRuns(session.access_token, id, days),
        geopilotApi.listInsights(session.access_token, id),
        geopilotApi.listBatches(session.access_token, id),
        geopilotApi.citationIntelligence(session.access_token, id, days).catch(() => EMPTY_CITATION_INTELLIGENCE),
        geopilotApi.providerAlerts(session.access_token, id, days).catch(() => ({ alerts: [] })),
        capabilityRequest,
        geopilotApi.sourceMonitors(session.access_token, id).catch(() => ({ monitors: [] })),
        geopilotApi.sourceChanges(session.access_token, id).catch(() => ({ changes: [] })),
        geopilotApi.contentGapBriefs(session.access_token, id).catch(() => ({ briefs: [] })),
        geopilotApi.attribution(session.access_token, id, days).catch(() => null),
      ])
      setProfile(profileData.profile)
      setDashboard(dashboardData)
      setCosts(costResult.data)
      setCostsUnavailable(costResult.unavailable)
      setRuns(runsData.runs || [])
      setInsights(insightsData.insights || [])
      setBatches(batchesData.batches || [])
      setCitationIntelligence(citationData)
      setProviderAlerts(alertsData.alerts || [])
      setSourceMonitors(monitorsData.monitors || [])
      setSourceChanges(changesData.changes || [])
      setContentGapBriefs(briefsData.briefs || [])
      setAttribution(attributionData)
      if (capabilityData) setCapabilities(capabilityData)
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load GEOPilot profile.')
    } finally {
      setLoading(false)
    }
  }, [days, id, router])

  useEffect(() => { void load() }, [load])

  const activeBatch = useMemo(() => {
    const candidates = [profile?.latest_batch, ...batches]
    return candidates.find((batch): batch is Batch => Boolean(batch && ACTIVE_BATCH_STATES.has(batch.status))) || null
  }, [batches, profile?.latest_batch])

  const retriedBatchIds = useMemo(() => new Set(
    batches
      .map(batch => batch.surface_selection?.retry?.source_batch_id)
      .filter((batchId): batchId is string => Boolean(batchId)),
  ), [batches])

  useEffect(() => {
    if (!activeBatch) return
    const timer = window.setInterval(() => void load(), 5000)
    return () => window.clearInterval(timer)
  }, [activeBatch, load])

  function openRun(collection?: Collection) {
    const collections = collection ? [collection] : profile?.collections || []
    const prompts = collections.flatMap(item => item.prompts || []).filter(prompt => prompt.active !== false)
    const promptCount = prompts.length || collections.reduce((sum, item) => sum + (item.prompt_count || 0), 0)
    const targetSurfaces = collection?.surfaces?.length ? [...collection.surfaces] : [...ALL_GEOPILOT_SURFACES]
    const averageCosts: Record<string, number | null> = {}
    for (const [surfaceKey, methods] of Object.entries(costs.by_method || {})) {
      for (const [method, item] of Object.entries(methods || {})) {
        averageCosts[measurementCostKey(surfaceKey, method)] = item?.average_usd ?? null
      }
    }
    for (const [surfaceKey, item] of Object.entries(costs.by_surface)) {
      const primaryMethod = PRIMARY_METHOD_BY_SURFACE[surfaceKey as keyof typeof PRIMARY_METHOD_BY_SURFACE]
      const key = primaryMethod ? measurementCostKey(surfaceKey, primaryMethod) : ''
      if (key && !(key in averageCosts)) averageCosts[key] = item?.average_usd ?? null
    }
    const fixedCosts: Record<string, number> = {}
    if (capabilities.consumer_ui.pricing_effective_date) {
      for (const surfaceKey of capabilities.consumer_ui.surfaces) {
        fixedCosts[measurementCostKey(surfaceKey, 'consumer_ui_organic')] = capabilities.consumer_ui.unit_cost_usd
      }
      fixedCosts[measurementCostKey('chatgpt_calibration', 'consumer_ui_forced_search')] = capabilities.consumer_ui.unit_cost_usd
    }
    const collectionCost = collection
      ? costs.by_collection.find(item => item.collection_id === collection.id)
      : undefined
    const profileBudgetWarnings = costs.by_collection.filter(item => item.budget_state === 'near' || item.budget_state === 'over').length
    setRunTarget({
      collectionId: collection?.id,
      label: collection?.name || profile?.name || 'profile',
      promptCount,
      calibrationCount: prompts.filter(prompt => prompt.calibration).length,
      surfaces: targetSurfaces,
      defaultMeasurementMethods: collection
        ? normalizeCollectionMeasurementMethods(targetSurfaces, collection.measurement_methods)
        : undefined,
      averageCosts,
      fixedCosts,
      consumerUi: {
        enabled: capabilities.consumer_ui.enabled,
        surfaces: capabilities.consumer_ui.surfaces,
      },
      budget: collectionCost?.monthly_budget_usd != null ? {
        monthlyBudgetUsd: collectionCost.monthly_budget_usd,
        monthActualUsd: collectionCost.month_actual_usd,
        state: collectionCost.budget_state === 'unset' ? 'ok' : collectionCost.budget_state,
      } : undefined,
      profileBudgetWarnings: collection ? 0 : profileBudgetWarnings,
    })
  }

  async function runNow(
    surfaces: GeoPilotPrimarySurface[],
    measurementMethods: GeoPilotMeasurementMethods,
    includeCalibration: boolean,
  ) {
    if (!accessToken || !runTarget) return
    setAction(runTarget.collectionId || 'profile')
    setError('')
    try {
      await geopilotApi.runProfile(accessToken, id, {
        collectionId: runTarget.collectionId,
        surfaces,
        measurementMethods,
        includeCalibration,
      })
      setRunTarget(null)
      await load()
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Failed to start run.')
    } finally {
      setAction('')
    }
  }

  async function cancel() {
    if (!accessToken || !activeBatch) return
    setAction('cancel')
    try {
      await geopilotApi.cancelBatch(accessToken, activeBatch.id)
      await load()
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Failed to cancel run.')
    } finally {
      setAction('')
    }
  }

  async function inspectRun(run: Run) {
    const requestId = ++resultRequestId.current
    setSelectedRun(run)
    setResultError('')

    if (!accessToken) {
      setResultLoading(false)
      setResultError('Result details are unavailable until your session is ready.')
      return
    }

    setResultLoading(true)
    try {
      const data = await geopilotApi.getRun(accessToken, run.id)
      if (resultRequestId.current === requestId) setSelectedRun(data.run)
    } catch {
      if (resultRequestId.current === requestId) {
        setResultError('Result details could not be loaded. Open the full result to try again.')
      }
    } finally {
      if (resultRequestId.current === requestId) setResultLoading(false)
    }
  }

  function closeResult() {
    resultRequestId.current += 1
    setSelectedRun(null)
    setResultLoading(false)
    setResultError('')
  }

  async function retryFailedBatch(batchId: string) {
    if (!accessToken) return
    const actionKey = `retry-batch-${batchId}`
    setAction(actionKey)
    setError('')
    try {
      await geopilotApi.retryFailedBatch(accessToken, batchId)
      await load()
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : 'Failed to retry measurements.')
    } finally {
      setAction('')
    }
  }

  async function retryFailedMeasurement(run: Run) {
    if (!accessToken || run.status !== 'failed') return
    const actionKey = `retry-run-${run.id}`
    setAction(actionKey)
    setError('')
    try {
      await geopilotApi.retryFailedRun(accessToken, run.id)
      closeResult()
      await load()
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : 'Failed to retry measurement.')
    } finally {
      setAction('')
    }
  }

  async function exportData(dataset: GeoPilotExportDataset) {
    if (!accessToken || !profile) return
    const actionKey = `export-${dataset}`
    setAction(actionKey)
    setError('')
    try {
      const safeName = profile.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'profile'
      const extension = dataset === 'all' ? 'zip' : 'csv'
      const suffix = dataset === 'all' ? 'all-data' : dataset.replaceAll('_', '-')
      await downloadGeoPilotExport(
        accessToken,
        id,
        days,
        dataset,
        `geopilot-${safeName}-${suffix}-${days}d.${extension}`,
      )
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Failed to export GEOPilot data.')
    } finally {
      setAction('')
    }
  }

  async function prepareExportTables() {
    if (!accessToken) return []
    const bundle = await fetchGeoPilotExportBundle(accessToken, id, days)
    return loadGeoPilotExportTables(async dataset => bundle[dataset] || '')
  }

  async function exportXlsx() {
    if (!accessToken || !profile) return
    setAction('export-xlsx')
    setError('')
    try {
      const safeName = profile.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'profile'
      const tables = await prepareExportTables()
      await downloadGeoPilotWorkbook(tables, `geopilot-${safeName}-all-data-${days}d.xlsx`)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Failed to export the GEOPilot workbook.')
    } finally {
      setAction('')
    }
  }

  async function exportGoogleSheets() {
    if (!accessToken || !profile) return
    setAction('export-google-sheets')
    setError('')
    try {
      const tables = await prepareExportTables()
      await exportRowsToGoogleSheets({
        title: `${profile.name} - GEOPilot (${days} days)`,
        sheets: tables.map(table => ({
          name: table.sheetName,
          headers: table.headers,
          rows: table.rows,
        })),
      })
    } catch (exportError) {
      setError(googleSheetsExportError(exportError))
    } finally {
      setAction('')
    }
  }

  async function sendGapToAio(gap: CitationGap) {
    if (!accessToken || !gap.run_id) return
    const actionKey = `aio-${gap.run_id}`
    setAction(actionKey)
    setError('')
    try {
      const data = await geopilotApi.createAioRecommendation(accessToken, id, gap.run_id)
      router.push(`/all-in-one/jobs/new?geopilot_recommendation=${encodeURIComponent(data.recommendation.id)}`)
    } catch (handoffError) {
      setError(handoffError instanceof Error ? handoffError.message : 'Failed to create the AIO recommendation.')
    } finally {
      setAction('')
    }
  }

  function updateEditingCollectionSchedule(schedule: 'manual' | 'daily') {
    setEditingCollection(current => {
      if (!current) return current
      const surfaces = current.surfaces?.length ? current.surfaces : [...ALL_GEOPILOT_SURFACES]
      return {
        ...current,
        schedule,
        measurement_methods: schedule === 'daily'
          ? buildMeasurementMethods(surfaces, {})
          : normalizeCollectionMeasurementMethods(surfaces, current.measurement_methods),
      }
    })
  }

  function updateEditingCollectionSurfaces(surfaces: GeoPilotPrimarySurface[]) {
    setEditingCollection(current => current ? {
      ...current,
      surfaces,
      measurement_methods: normalizeCollectionMeasurementMethods(surfaces, current.measurement_methods),
    } : current)
  }

  async function saveCollection() {
    if (!accessToken || !editingCollection) return
    setAction(`collection-${editingCollection.id}`)
    const selectedSurfaces = editingCollection.surfaces?.length ? editingCollection.surfaces : [...ALL_GEOPILOT_SURFACES]
    const payload: GeoPilotCollectionPayload = {
      name: editingCollection.name,
      objective: editingCollection.objective || '',
      funnel_stage: editingCollection.funnel_stage || null,
      schedule: editingCollection.schedule || 'daily',
      country_code: editingCollection.country_code || null,
      location_name: editingCollection.location_name || null,
      language_code: editingCollection.language_code || null,
      device: editingCollection.device || null,
      surfaces: selectedSurfaces,
      measurement_methods: normalizeCollectionMeasurementMethods(selectedSurfaces, editingCollection.measurement_methods),
      monthly_budget_usd: editingCollection.monthly_budget_usd || null,
      active: editingCollection.active !== false,
    }
    try {
      await geopilotApi.updateCollection(accessToken, editingCollection.id, payload)
      setEditingCollection(null)
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update collection.')
    } finally {
      setAction('')
    }
  }

  async function savePrompt() {
    if (!accessToken || !editingPrompt) return
    setAction(`prompt-${editingPrompt.id}`)
    const payload: GeoPilotPromptPayload = {
      prompt_text: editingPrompt.prompt_text,
      google_query: editingPrompt.google_query || '',
      category: editingPrompt.category || '',
      funnel_stage: editingPrompt.funnel_stage || null,
      calibration: Boolean(editingPrompt.calibration),
      source: editingPrompt.source || 'manual',
      active: editingPrompt.active !== false,
    }
    try {
      await geopilotApi.updatePrompt(accessToken, editingPrompt.id, payload)
      setEditingPrompt(null)
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update prompt.')
    } finally {
      setAction('')
    }
  }

  const collections = useMemo(() => profile?.collections || [], [profile?.collections])
  const promptCount = useMemo(() => collections.reduce((sum, collection) => {
    const activePrompts = collection.prompts?.filter(prompt => prompt.active !== false)
    return sum + (activePrompts?.length || collection.prompt_count || 0)
  }, 0), [collections])
  const latestRuns = useMemo(() => latestMeasurementRuns(runs), [runs])
  const displaySurfaces = useMemo(
    () => dashboard.display_surfaces || dashboard.surfaces || {},
    [dashboard.display_surfaces, dashboard.surfaces],
  )
  const displayMethods = useMemo(() => {
    const methods: Partial<Record<GeoPilotPrimarySurface, GeoPilotCollectionMethod>> = {}
    for (const surfaceKey of PRIMARY_SURFACES) {
      methods[surfaceKey] = displaySurfaces[surfaceKey]?.collection_method
        || PRIMARY_METHOD_BY_SURFACE[surfaceKey]
    }
    return methods
  }, [displaySurfaces])
  const displayLoadedRuns = useMemo(() => latestRuns.filter(run => {
    if (!PRIMARY_SURFACES.includes(run.surface as GeoPilotPrimarySurface)) return false
    const surfaceKey = run.surface as GeoPilotPrimarySurface
    const method = run.collection_method || PRIMARY_METHOD_BY_SURFACE[surfaceKey]
    return method === displayMethods[surfaceKey]
  }), [displayMethods, latestRuns])
  const citationDomains = useMemo(() => {
    const counts = new Map<string, number>()
    displayLoadedRuns.flatMap(run => run.citations || []).forEach(citation => {
      if (citation.domain) counts.set(citation.domain, (counts.get(citation.domain) || 0) + 1)
    })
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [displayLoadedRuns])
  const intelligenceDomains = citationIntelligence.top_domains.length
    ? citationIntelligence.top_domains.slice(0, 6)
    : citationDomains.slice(0, 6).map(([domain, count]) => ({
        domain,
        citation_count: count,
        classification: 'third_party' as const,
        page_types: [] as string[],
      }))
  const analysisSurface = PRIMARY_SURFACES.includes(surface as GeoPilotPrimarySurface)
    ? surface as GeoPilotPrimarySurface
    : undefined
  const surfaceMethods = useMemo(() => analysisSurface
    ? availableSurfaceMethods(dashboard.timeline || [], latestRuns, analysisSurface)
    : [], [analysisSurface, dashboard.timeline, latestRuns])
  const explicitAnalysisMethod = collectionMethod as GeoPilotCollectionMethod
  const analysisMethod = analysisSurface
    ? surfaceMethods.includes(explicitAnalysisMethod)
      ? explicitAnalysisMethod
      : displayMethods[analysisSurface] || PRIMARY_METHOD_BY_SURFACE[analysisSurface]
    : undefined
  const chartPoints = useMemo(() => buildDashboardTrend({
    timeline: dashboard.timeline || [],
    metric: dashboardMetric,
    surface: dashboardMetric === 'ai_overview_coverage' ? 'google_ai_overview' : analysisSurface,
    method: dashboardMetric === 'ai_overview_coverage' ? 'google_search_result' : analysisMethod,
    displayMethods,
  }), [analysisMethod, analysisSurface, dashboard.timeline, dashboardMetric, displayMethods])
  const comparisonPoints = useMemo(() => (
    analysisSurface && dashboardMetric !== 'ai_overview_coverage'
      ? buildDashboardTrend({
        timeline: dashboard.timeline || [],
        metric: dashboardMetric,
        displayMethods,
      })
      : []
  ), [analysisSurface, dashboard.timeline, dashboardMetric, displayMethods])
  const methodTrends = useMemo(() => {
    const grouped = new Map<string, Map<string, number[]>>()
    for (const row of dashboard.timeline || []) {
      const date = String(row.metric_date || '')
      const rowSurface = String(row.surface || '')
      const rowMethod = String(row.collection_method || PRIMARY_METHOD_BY_SURFACE[rowSurface as keyof typeof PRIMARY_METHOD_BY_SURFACE] || '')
      const value = Number(row.visibility_score)
      if (!date || !rowSurface || !rowMethod || !Number.isFinite(value)) continue
      const key = measurementCostKey(rowSurface, rowMethod)
      const dates = grouped.get(key) || new Map<string, number[]>()
      dates.set(date, [...(dates.get(date) || []), value])
      grouped.set(key, dates)
    }
    return new Map([...grouped].map(([key, dates]) => [
      key,
      [...dates].map(([date, values]) => ({
        date,
        value: values.reduce((sum, value) => sum + value, 0) / values.length,
      })).slice(-14),
    ]))
  }, [dashboard.timeline])
  const filteredRuns = useMemo(
    () => filterMeasurementRuns(runs, query, resultOutcome, surface, collectionMethod),
    [collectionMethod, query, resultOutcome, runs, surface],
  )
  const filteredLatestRuns = useMemo(
    () => filterMeasurementRuns(latestRuns, query, resultOutcome, surface, collectionMethod),
    [collectionMethod, latestRuns, query, resultOutcome, surface],
  )
  const totalSuccessfulRuns = Object.values(displaySurfaces)
    .reduce((sum, item) => sum + (item.successful_runs || 0), 0)
  const currentSuccessfulRuns = displayLoadedRuns.filter(run => run.status === 'complete')
  const currentBrandMentions = currentSuccessfulRuns.filter(run => run.brand_mentioned).length
  const currentEntityMentions = currentBrandMentions + currentSuccessfulRuns.reduce((sum, run) => (
    sum + new Set(run.competitors_mentioned || []).size
  ), 0)
  const currentShareOfVoice = percent(currentBrandMentions, currentEntityMentions)
  const currentCitedResponses = currentSuccessfulRuns.filter(run => (run.citations || []).length > 0)
  const ownedDomains = [profile?.primary_domain, ...(profile?.owned_domains || [])]
  const currentOwnedCitedResponses = currentCitedResponses.filter(run => (
    (run.citations || []).some(citation => isOwnedDomain(citation.domain, ownedDomains))
  ))
  const currentCitationCoverage = percent(currentOwnedCitedResponses.length, currentCitedResponses.length)
  const methodComparisonRows = (['chatgpt', 'gemini'] as const).map(surfaceKey => ({
    surface: surfaceKey,
    api: dashboard.method_comparison?.[surfaceKey]?.model_api || {},
    consumerUi: dashboard.method_comparison?.[surfaceKey]?.consumer_ui_organic || {},
    apiTrend: methodTrends.get(measurementCostKey(surfaceKey, 'model_api')) || [],
    consumerUiTrend: methodTrends.get(measurementCostKey(surfaceKey, 'consumer_ui_organic')) || [],
  }))
  const showMethodComparison = capabilities.consumer_ui.enabled || methodComparisonRows.some(row => (
    (row.consumerUi.successful_runs || 0) > 0 || row.consumerUiTrend.length > 0
  ))
  const latestBatch = batches[0] || profile?.latest_batch || null
  const retryingRunId = action.startsWith('retry-run-')
    ? action.slice('retry-run-'.length)
    : undefined
  const costByBatch = new Map(costs.by_batch.map(item => [item.batch_id, item]))
  const costByCollection = new Map(costs.by_collection.map(item => [item.collection_id, item]))
  const methodCostRows = Object.entries(costs.by_method || {}).flatMap(([surfaceKey, methods]) => (
    Object.entries(methods || {}).map(([method, item]) => ({ surface: surfaceKey, method, item }))
  ))
  if (!methodCostRows.length) {
    for (const [surfaceKey, item] of Object.entries(costs.by_surface || {})) {
      const method = PRIMARY_METHOD_BY_SURFACE[surfaceKey as keyof typeof PRIMARY_METHOD_BY_SURFACE]
      if (method) methodCostRows.push({ surface: surfaceKey, method, item })
    }
  }
  const profileDetails = [
    profile?.primary_domain,
    profile?.country_code,
    profile?.device ? sentenceCase(profile.device) : '',
    profile?.language_code?.toUpperCase(),
  ].filter(Boolean)
  const googleMetrics = displaySurfaces.google_ai_overview || {}
  const googleSuccessfulRuns = googleMetrics.successful_runs || 0
  const googleOverviewCount = googleMetrics.ai_overview_coverage == null
    ? 0
    : Math.round((googleMetrics.ai_overview_coverage / 100) * googleSuccessfulRuns)
  const chartMetricDefinition = DASHBOARD_METRIC_DEFINITIONS[dashboardMetric]
  const effectiveChartSurface = dashboardMetric === 'ai_overview_coverage'
    ? 'google_ai_overview'
    : analysisSurface
  const effectiveChartMethod = effectiveChartSurface === 'google_ai_overview'
    ? 'google_search_result'
    : analysisMethod
  const chartPrimaryLabel = effectiveChartSurface
    ? `${SURFACES[effectiveChartSurface]} via ${collectionMethodLabel(effectiveChartMethod)}`
    : 'Current measurement methods'
  const chartSubtitle = effectiveChartSurface
    ? `Daily ${chartMetricDefinition.label.toLowerCase()} for ${SURFACES[effectiveChartSurface]}`
    : `Daily surface average from the methods shown in By surface`
  const showMethodToggle = Boolean(
    analysisSurface
    && CONSUMER_UI_SURFACES.includes(analysisSurface)
    && surfaceMethods.includes('model_api')
    && surfaceMethods.includes('consumer_ui_organic'),
  )

  function selectDashboardMetric(nextMetric: GeoPilotDashboardMetric) {
    setDashboardMetric(nextMetric)
    setMetricHelp(null)
    if (nextMetric === 'ai_overview_coverage') {
      setSurface('google_ai_overview')
      setCollectionMethod('google_search_result')
    }
  }

  function selectDashboardSurface(nextSurface: string) {
    setSurface(nextSurface)
    if (!PRIMARY_SURFACES.includes(nextSurface as GeoPilotPrimarySurface)) {
      setCollectionMethod('')
      if (dashboardMetric === 'ai_overview_coverage') setDashboardMetric('visibility_score')
      return
    }
    const surfaceKey = nextSurface as GeoPilotPrimarySurface
    setCollectionMethod(displayMethods[surfaceKey] || PRIMARY_METHOD_BY_SURFACE[surfaceKey])
    if (dashboardMetric === 'ai_overview_coverage' && surfaceKey !== 'google_ai_overview') {
      setDashboardMetric('visibility_score')
    }
  }

  function toggleDashboardSurface(nextSurface: GeoPilotPrimarySurface) {
    selectDashboardSurface(surface === nextSurface ? '' : nextSurface)
  }

  function metricsForSurface(surfaceKey: GeoPilotPrimarySurface) {
    if (
      surfaceKey === analysisSurface
      && analysisMethod
      && (surfaceKey === 'chatgpt' || surfaceKey === 'gemini')
    ) {
      return dashboard.method_comparison?.[surfaceKey]?.[analysisMethod] || displaySurfaces[surfaceKey] || {}
    }
    return displaySurfaces[surfaceKey] || {}
  }

  const metrics = [
    {
      key: 'visibility_score' as const,
      label: DASHBOARD_METRIC_DEFINITIONS.visibility_score.label,
      value: metric(dashboard.display_overall_visibility ?? dashboard.overall_visibility),
      note: `${totalSuccessfulRuns} successful measurements across current methods`,
      icon: Target,
    },
    {
      key: 'share_of_voice' as const,
      label: DASHBOARD_METRIC_DEFINITIONS.share_of_voice.label,
      value: metric(currentShareOfVoice ?? dashboard.overall_share_of_voice),
      note: `${currentBrandMentions} brand mentions against ${profile?.competitors?.length || 0} competitors`,
      icon: BarChart3,
    },
    {
      key: 'citation_share' as const,
      label: DASHBOARD_METRIC_DEFINITIONS.citation_share.label,
      value: metric(currentCitationCoverage ?? dashboard.overall_citation_share),
      note: `${currentOwnedCitedResponses.length} of ${currentCitedResponses.length} cited responses include an owned domain`,
      icon: Link2,
    },
    {
      key: 'ai_overview_coverage' as const,
      label: DASHBOARD_METRIC_DEFINITIONS.ai_overview_coverage.label,
      value: metric(googleMetrics.ai_overview_coverage),
      note: `${googleOverviewCount} of ${googleSuccessfulRuns} Google searches showed an AI Overview`,
      icon: Sparkles,
    },
  ]

  return (
    <AppLayout title="GEOPilot">
      <div className={styles.liveProfile}>
        <section className={styles.profileHeader}>
          <div>
            <Link href="/geopilot" className={styles.backLink}><ArrowLeft size={14} /> All profiles</Link>
            <div className={styles.titleRow}>
              <span className={styles.clientMark}>{(profile?.brand_name || profile?.name || 'G').charAt(0).toUpperCase()}</span>
              <div>
                <div className={styles.profileTitleLine}>
                  <h1>{profile?.name || 'Client profile'}</h1>
                  {profile ? (
                    <span className={styles.statusBadge}>
                      <span /> {profile.active === false ? 'Paused' : 'Active'}
                    </span>
                  ) : null}
                </div>
                <p>
                  {profileDetails.length ? profileDetails.map((detail, index) => (
                    <span key={`${index}-${String(detail)}`} className={styles.profileDetail}>
                      {index ? <i>/</i> : null}{detail}
                    </span>
                  )) : 'Loading profile details'}
                </p>
              </div>
            </div>
          </div>
          <div className={styles.profileActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => void load()}
              disabled={loading}
              title="Refresh profile"
            >
              <RefreshCw size={15} className={loading ? styles.spinning : undefined} /> Refresh
            </button>
            {accessToken && profile ? (
              <button type="button" className={styles.secondaryButton} onClick={() => setShareOpen(true)}>
                <Share2 size={15} /> Share report
              </button>
            ) : null}
            {accessToken && profile ? (
              <ExportMenu
                downloadActions={[
                  {
                    label: action === 'export-xlsx' ? 'Preparing workbook...' : 'Excel workbook (.xlsx)',
                    description: 'All report datasets in separate tabs',
                    icon: <FileSpreadsheet size={15} />,
                    onClick: exportXlsx,
                    disabled: action.startsWith('export-'),
                  },
                  {
                    label: 'All data (.zip)',
                    description: 'Complete package of the six CSV datasets',
                    icon: <Download size={15} />,
                    onClick: () => exportData('all'),
                    disabled: action.startsWith('export-'),
                  },
                  ...GEOPILOT_EXPORT_DATASETS.map(dataset => ({
                    label: `${dataset.label} (.csv)`,
                    description: dataset.description,
                    icon: <Download size={15} />,
                    onClick: () => exportData(dataset.value),
                    disabled: action.startsWith('export-'),
                  })),
                ]}
                onGoogleSheets={exportGoogleSheets}
                sheetsLabel="Google Sheets workbook"
                sheetsLoading={action === 'export-google-sheets'}
              />
            ) : null}
            {profile ? (
              <Link className={styles.secondaryButton} href={`/geopilot/profiles/${id}/edit`}>
                <Pencil size={15} /> Edit profile
              </Link>
            ) : null}
            {activeBatch ? (
              <button
                type="button"
                className={clsx(styles.secondaryButton, styles.cancelButton)}
                onClick={() => void cancel()}
                disabled={action === 'cancel'}
              >
                <Square size={13} /> {action === 'cancel' ? 'Cancelling' : 'Cancel run'}
              </button>
            ) : (
              <button type="button" className={styles.primaryButton} onClick={() => openRun()} disabled={!profile}>
                <Play size={15} /> Run now
              </button>
            )}
          </div>
        </section>

        {error ? <div className={styles.errorNotice}>{error}</div> : null}
        {activeBatch ? (
          <div className={styles.runNotice}>
            <span className={styles.noticeIcon}><RefreshCw size={14} className={styles.spinning} /></span>
            <div>
              <strong>Measurement run {sentenceCase(activeBatch.status).toLowerCase()}</strong>
              <p>{activeBatch.completed_runs || 0} of {activeBatch.total_runs || 0} measurements complete. This page updates automatically.</p>
            </div>
          </div>
        ) : null}

        <nav className={styles.pageTabs} aria-label="GEOPilot profile views">
          {TABS.map(item => {
            const count = item === 'Prompts'
              ? promptCount
              : item === 'Results'
                ? runs.length
                : item === 'Opportunities'
                  ? citationIntelligence.summary.verified_gaps + contentGapBriefs.length
                  : item === 'Attribution'
                    ? attribution?.content_actions.length || 0
                    : 0
            return (
              <button
                key={item}
                type="button"
                className={tab === item ? styles.pageTabActive : undefined}
                onClick={() => setTab(item)}
              >
                {item} {item !== 'Overview' ? <span>{count}</span> : null}
              </button>
            )
          })}
        </nav>

        {loading && !profile ? (
          <div className={styles.loadingState}><RefreshCw size={20} className={styles.spinning} /> Loading profile</div>
        ) : null}

        {profile && tab === 'Overview' ? (
          <>
            <section className={styles.metricStrip}>
              {metrics.map(item => {
                const Icon = item.icon
                return (
                  <article
                    key={item.key}
                    className={clsx(styles.metricItem, dashboardMetric === item.key && styles.metricItemActive)}
                  >
                    <button
                      type="button"
                      className={styles.metricSelectButton}
                      aria-pressed={dashboardMetric === item.key}
                      aria-label={`Show ${item.label} trend`}
                      onClick={() => selectDashboardMetric(item.key)}
                    >
                      <div className={styles.metricLabelRow}>
                        <span className={styles.metricIcon}><Icon size={14} /></span>
                        <span className={styles.metricLabel}>{item.label}</span>
                      </div>
                      <div className={styles.metricValueRow}><strong>{item.value}</strong></div>
                      <p>{item.note}</p>
                    </button>
                    <button
                      type="button"
                      className={styles.metricHelpButton}
                      aria-label={`About ${item.label}`}
                      aria-expanded={metricHelp === item.key}
                      aria-controls={`metric-help-${item.key}`}
                      title={`About ${item.label}`}
                      onClick={() => setMetricHelp(current => current === item.key ? null : item.key)}
                      onKeyDown={event => {
                        if (event.key === 'Escape') setMetricHelp(null)
                      }}
                    >
                      <CircleHelp size={13} />
                    </button>
                    {metricHelp === item.key ? (
                      <div id={`metric-help-${item.key}`} className={styles.metricHelpPopover} role="tooltip">
                        <strong>{item.label}</strong>
                        <p>{DASHBOARD_METRIC_DEFINITIONS[item.key].description}</p>
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </section>

            <div className={styles.dashboardGrid}>
              <section className={clsx(styles.panel, styles.chartPanel)}>
                <div className={styles.panelHeader}>
                  <div>
                    <h2>{chartMetricDefinition.label} trend</h2>
                    <p>{chartSubtitle}</p>
                  </div>
                  <div className={styles.chartControls}>
                    {showMethodToggle ? (
                      <div className={clsx(styles.rangeControl, styles.methodControl)} aria-label={`${SURFACES[analysisSurface as string]} measurement method`}>
                        {(['model_api', 'consumer_ui_organic'] as GeoPilotCollectionMethod[]).map(method => (
                          <button
                            key={method}
                            type="button"
                            className={analysisMethod === method ? styles.segmentActive : undefined}
                            aria-pressed={analysisMethod === method}
                            onClick={() => setCollectionMethod(method)}
                          >
                            {method === 'model_api' ? 'API' : 'Consumer UI'}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <div className={styles.rangeControl} aria-label="Chart date range">
                      {[7, 30, 90].map(option => (
                        <button
                          key={option}
                          type="button"
                          className={days === option ? styles.segmentActive : undefined}
                          aria-pressed={days === option}
                          onClick={() => setDays(option)}
                        >
                          {option}d
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className={styles.chartLegend}>
                  <span><i className={styles.legendPrimary} /> {chartPrimaryLabel}</span>
                  {comparisonPoints.length ? <span><i className={styles.legendComparison} /> Overall current methods</span> : null}
                </div>
                <MetricTrendChart
                  points={chartPoints}
                  comparisonPoints={comparisonPoints}
                  metricLabel={chartMetricDefinition.label}
                  brandName={profile.brand_name || profile.name}
                  primaryLabel={chartPrimaryLabel}
                />
              </section>

              <section className={clsx(styles.panel, styles.surfacePanel)}>
                <div className={styles.panelHeader}>
                  <div>
                    <h2>By surface</h2>
                    <p>Current visibility from each surface&apos;s latest measured method</p>
                  </div>
                  {analysisSurface ? (
                    <button
                      type="button"
                      className={styles.surfaceReset}
                      aria-label="Show all surfaces"
                      title="Show all surfaces"
                      onClick={() => selectDashboardSurface('')}
                    >
                      <X size={14} />
                    </button>
                  ) : null}
                </div>
                <div className={styles.surfaceRail}>
                  {PRIMARY_SURFACES.map(key => {
                    const data = metricsForSurface(key)
                    const value = data?.visibility_score
                    const tone = surfaceTone(key)
                    const selected = analysisSurface === key
                    const method = selected && analysisMethod
                      ? analysisMethod
                      : data?.collection_method || displayMethods[key] || PRIMARY_METHOD_BY_SURFACE[key]
                    const successfulRuns = data?.successful_runs || 0
                    const mentionedRuns = data?.mentioned_runs || 0
                    return (
                      <button
                        key={key}
                        type="button"
                        className={clsx(styles.surfaceMetric, selected && styles.surfaceMetricActive)}
                        aria-pressed={selected}
                        aria-label={`${SURFACES[key]}, ${metric(value)}, ${mentionedRuns} of ${successfulRuns} mentioned via ${collectionMethodLabel(method)}`}
                        onClick={() => toggleDashboardSurface(key)}
                      >
                        <div className={styles.surfaceMetricTop}>
                          <span><i className={styles[`rail_${tone}`]} /> {SURFACES[key]}</span>
                          <strong>{metric(value)}</strong>
                        </div>
                        <div className={styles.progressTrack}>
                          <span className={styles[`bar_${tone}`]} style={{ width: `${Math.max(0, Math.min(100, value || 0))}%` }} />
                        </div>
                        <small className={styles.stateMuted}>
                          {successfulRuns
                            ? `${mentionedRuns} of ${successfulRuns} mentioned via ${collectionMethodLabel(method)}`
                            : `No successful measurements via ${collectionMethodLabel(method)}`}
                        </small>
                      </button>
                    )
                  })}
                </div>
                <div className={styles.lastRun}>
                  <span className={styles.runStatusIcon}>
                    {latestBatch && ACTIVE_BATCH_STATES.has(latestBatch.status) ? <Clock3 size={14} /> : <Check size={14} />}
                  </span>
                  <div>
                    <strong>{latestBatch ? `Latest run ${sentenceCase(latestBatch.status).toLowerCase()}` : 'No measurement runs yet'}</strong>
                    <small>{latestBatch ? `${latestBatch.completed_runs || 0} of ${latestBatch.total_runs || 0} measurements / ${dateLabel(latestBatch.created_at)}` : 'Start a run to collect visibility data'}</small>
                  </div>
                  {latestBatch ? (
                    <button type="button" aria-label="Open results" title="Open results" onClick={() => setTab('Results')}>
                      <ChevronRight size={16} />
                    </button>
                  ) : null}
                </div>
              </section>
            </div>

            {showMethodComparison ? <MethodComparison rows={methodComparisonRows} /> : null}

            <section className={clsx(styles.panel, styles.resultsPanel)}>
              <div className={styles.resultsHeader}>
                <div>
                  <h2>Latest measurements</h2>
                  <p>Deterministic brand matching across tracked prompts</p>
                </div>
                <button type="button" className={styles.textButton} onClick={() => setTab('Results')}>
                  <span>View all results</span><ChevronRight size={14} />
                </button>
              </div>
              <ResultToolbar
                query={query}
                setQuery={setQuery}
                surface={surface}
                setSurface={selectDashboardSurface}
                collectionMethod={collectionMethod}
                setCollectionMethod={setCollectionMethod}
                resultOutcome={resultOutcome}
                setResultOutcome={setResultOutcome}
              />
              <ResultsTable
                runs={filteredLatestRuns.slice(0, 8)}
                total={latestRuns.length}
                ownedDomain={profile.primary_domain}
                onInspect={run => void inspectRun(run)}
                onRetry={run => void retryFailedMeasurement(run)}
                retryingRunId={retryingRunId}
                retryDisabled={Boolean(activeBatch) || Boolean(action)}
              />
            </section>

            <div className={styles.supportGrid}>
              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div><h2>Run history</h2><p>Recent profile batches and completion status</p></div>
                </div>
                <div className={styles.compactList}>
                  {batches.slice(0, 6).map(batch => {
                    const hasBeenRetried = retriedBatchIds.has(batch.id)
                    return (
                      <div key={batch.id} className={styles.compactRow}>
                        <span className={clsx(styles.runState, statusClass(batch.status))}>{sentenceCase(batch.status)}</span>
                        <div><strong>{batch.completed_runs || 0} of {batch.total_runs || 0} measurements</strong><small>{dateLabel(batch.created_at)}</small></div>
                        {batch.failed_runs ? (
                          <button
                            type="button"
                            className={styles.retryButton}
                            onClick={() => void retryFailedBatch(batch.id)}
                            disabled={Boolean(activeBatch) || Boolean(action)}
                            title={activeBatch ? 'Wait for the active run to finish' : `Retry ${batch.failed_runs} failed measurements`}
                          >
                            <RefreshCw size={12} className={action === `retry-batch-${batch.id}` ? styles.spinning : undefined} />
                            {action === `retry-batch-${batch.id}` ? 'Starting' : hasBeenRetried ? `Retry again (${batch.failed_runs})` : `Retry failed (${batch.failed_runs})`}
                          </button>
                        ) : <strong>{formatUsd(costByBatch.get(batch.id)?.actual_usd)}</strong>}
                      </div>
                    )
                  })}
                  {!batches.length ? <p className={styles.compactEmpty}>No runs yet.</p> : null}
                </div>
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div><h2>Citation intelligence</h2><p>Source ownership and page types in the current measurement snapshot</p></div>
                </div>
                <div className={styles.sourceMix}>
                  <div><span>Owned</span><strong>{citationIntelligence.summary.owned}</strong></div>
                  <div><span>Competitor</span><strong>{citationIntelligence.summary.competitor}</strong></div>
                  <div><span>Third-party</span><strong>{citationIntelligence.summary.third_party}</strong></div>
                </div>
                <div className={styles.compactList}>
                  {intelligenceDomains.map(item => (
                    <div key={item.domain} className={styles.intelligenceDomainRow}>
                      <span><Link2 size={13} /> {item.domain}</span>
                      <div>
                        <small>{sentenceCase(item.classification)}{item.page_types[0] ? ` / ${sentenceCase(item.page_types[0])}` : ''}</small>
                        <strong>{item.citation_count}</strong>
                      </div>
                    </div>
                  ))}
                  {!intelligenceDomains.length ? <p className={styles.compactEmpty}>No citations collected in this period.</p> : null}
                  {citationIntelligence.page_types.length ? (
                    <p className={styles.costFootnote}>
                      Common formats: {citationIntelligence.page_types.slice(0, 3).map(item => `${sentenceCase(item.page_type)} (${item.citation_count})`).join(', ')}
                    </p>
                  ) : null}
                </div>
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div><h2>Cost control</h2><p>Recorded provider charges, excluding unpriced measurements</p></div>
                  <CircleDollarSign size={16} className={styles.stateGood} />
                </div>
                {costsUnavailable ? <p className={styles.compactEmpty}>Cost data is temporarily unavailable. Other profile data is still current.</p> : <>
                  <div className={styles.costStats}>
                    <div><span>{days}-day spend</span><strong>{formatUsd(costs.period_actual_usd)}</strong></div>
                    <div><span>This month</span><strong>{formatUsd(costs.month_actual_usd)}</strong></div>
                  </div>
                  <div className={styles.compactList}>
                    {methodCostRows.map(({ surface: surfaceKey, method, item }) => (
                      <div key={`${surfaceKey}-${method}`} className={styles.costSurfaceRow}>
                        <span>{surfaceMethodLabel(surfaceKey, method)}</span>
                        <div><strong>{formatUsd(item?.actual_usd)}</strong><small>{item?.priced_measurements || 0} priced</small></div>
                      </div>
                    ))}
                    {!methodCostRows.length ? <p className={styles.compactEmpty}>Cost history appears after provider-priced measurements.</p> : null}
                    {costs.unpriced_measurements ? <p className={styles.costFootnote}>{costs.unpriced_measurements} measurement{costs.unpriced_measurements === 1 ? '' : 's'} had no provider cost.</p> : null}
                  </div>
                </>}
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div><h2>Provider health</h2><p>Parser, model-catalog, and citation-change monitoring</p></div>
                  <Activity size={16} className={providerAlerts.length ? styles.stateWarning : styles.stateGood} />
                </div>
                <div className={styles.compactList}>
                  {providerAlerts.slice(0, 4).map(alert => (
                    <div key={alert.id} className={styles.providerAlertRow} data-severity={alert.severity}>
                      <div>
                        <strong>{alert.title}</strong>
                        <small>{alert.message}</small>
                      </div>
                      <time>{dateLabel(alert.last_seen_at)}</time>
                    </div>
                  ))}
                  {!providerAlerts.length ? (
                    <p className={styles.compactEmpty}>No provider-format or citation-change alerts in this period.</p>
                  ) : null}
                </div>
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div><h2>Prompt performance</h2><p>Visibility by tracked question</p></div>
                </div>
                <div className={styles.compactList}>
                  {dashboard.prompt_performance?.slice(0, 6).map(prompt => (
                    <div key={prompt.id} className={styles.performanceRow}>
                      <span>{prompt.prompt_text || 'Tracked prompt'}</span>
                      <strong>{metric(prompt.visibility_score)}</strong>
                    </div>
                  ))}
                  {!dashboard.prompt_performance?.length ? <p className={styles.compactEmpty}>Prompt performance appears after completed measurements.</p> : null}
                </div>
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div><h2>ChatGPT calibration</h2><p>Consumer result sample, kept separate from API visibility</p></div>
                </div>
                <div className={styles.calibrationStats}>
                  <div><span>Visibility</span><strong>{metric(dashboard.calibration?.visibility_score)}</strong></div>
                  <div><span>Samples</span><strong>{dashboard.calibration?.successful_runs || 0}</strong></div>
                </div>
              </section>
            </div>
          </>
        ) : null}

        {profile && tab === 'Prompts' ? (
          <section className={styles.tabSection}>
            <div className={styles.sectionHeading}>
              <div><h2>Prompt collections</h2><p>Manage scheduled questions and measurement sources for this client.</p></div>
              <Link className={styles.primaryButton} href={`/geopilot/profiles/${id}/collections/new`}><Plus size={15} /> New collection</Link>
            </div>
            <div className={styles.collectionGrid}>
              {collections.map(collection => {
                const collectionCost = costByCollection.get(collection.id)
                const selectedSurfaces = collection.surfaces?.length ? collection.surfaces : ALL_GEOPILOT_SURFACES
                const methodSummary = selectedSurfaces
                  .filter(surfaceKey => CONSUMER_UI_SURFACES.includes(surfaceKey))
                  .map(surfaceKey => `${SURFACES[surfaceKey]} ${collectionRunModeLabel(runModeForMeasurementMethods(surfaceKey, collection.measurement_methods))}`)
                return <article key={collection.id} className={styles.collectionCard}>
                  <header className={styles.collectionHeader}>
                    <div>
                      <div className={styles.collectionTitle}>
                        <h3>{collection.name}</h3>
                        <span className={collection.active === false ? styles.stateMuted : styles.stateGood}>
                          {collection.active === false ? 'Paused' : 'Active'}
                        </span>
                      </div>
                      <p>{collection.schedule === 'daily' ? 'Daily schedule' : 'Manual schedule'} / {collection.prompt_count || collection.prompts?.length || 0} prompts</p>
                      <small>{selectedSurfaces.map(item => GEOPILOT_SURFACES.find(option => option.value === item)?.label).filter(Boolean).join(' / ')}</small>
                      {methodSummary.length ? <small>{methodSummary.join(' / ')}</small> : null}
                      <small className={clsx(
                        styles.budgetLine,
                        collectionCost?.budget_state === 'near' && styles.stateWarning,
                        collectionCost?.budget_state === 'over' && styles.stateError,
                      )}>
                        Monthly spend {formatUsd(collectionCost?.month_actual_usd)}{collectionCost?.monthly_budget_usd != null ? ` of ${formatUsd(collectionCost.monthly_budget_usd)}` : ' / no budget set'}
                      </small>
                    </div>
                    <div className={styles.collectionActions}>
                      <button
                        type="button"
                        className={styles.iconButton}
                        title="Edit collection"
                        aria-label={`Edit ${collection.name}`}
                        onClick={() => {
                          const surfaces = collection.surfaces?.length ? collection.surfaces : [...ALL_GEOPILOT_SURFACES]
                          setEditingCollection({
                            ...collection,
                            surfaces,
                            measurement_methods: normalizeCollectionMeasurementMethods(surfaces, collection.measurement_methods),
                          })
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => openRun(collection)}
                        disabled={Boolean(activeBatch)}
                      >
                        <Play size={13} /> Run collection
                      </button>
                    </div>
                  </header>
                  {collection.objective ? <p className={styles.collectionObjective}>{collection.objective}</p> : null}
                  <div className={styles.promptList}>
                    {collection.prompts?.map(prompt => (
                      <div key={prompt.id} className={styles.promptRow}>
                        <div>
                          <span>{prompt.prompt_text}</span>
                          {prompt.google_query ? <small>Google: {prompt.google_query}</small> : null}
                        </div>
                        <div className={styles.promptMeta}>
                          {prompt.calibration ? <span>Calibration</span> : null}
                          <small>v{prompt.version || 1}</small>
                          <button type="button" className={styles.iconButton} title="Edit prompt" aria-label="Edit tracked prompt" onClick={() => setEditingPrompt({ ...prompt })}>
                            <Pencil size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {!collection.prompts?.length ? <p className={styles.compactEmpty}>No prompts in this collection.</p> : null}
                  </div>
                </article>
              })}
              {!collections.length ? (
                <div className={styles.sectionEmpty}>
                  <Target size={22} />
                  <strong>No prompt collections yet</strong>
                  <p>Create a collection to start measuring this client.</p>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {profile && tab === 'Results' ? (
          <section className={clsx(styles.panel, styles.resultsPanel, styles.tabResults)}>
            <div className={styles.resultsHeader}>
              <div><h2>Measurement results</h2><p>Raw provider checks and deterministic brand matching for the selected period</p></div>
              <div className={styles.rangeControl} aria-label="Result date range">
                {[7, 30, 90].map(option => (
                  <button key={option} type="button" className={days === option ? styles.segmentActive : undefined} onClick={() => setDays(option)}>{option}d</button>
                ))}
              </div>
            </div>
            <ResultToolbar
              query={query}
              setQuery={setQuery}
              surface={surface}
              setSurface={selectDashboardSurface}
              collectionMethod={collectionMethod}
              setCollectionMethod={setCollectionMethod}
              resultOutcome={resultOutcome}
              setResultOutcome={setResultOutcome}
            />
            <ResultsTable
              runs={filteredRuns}
              total={runs.length}
              ownedDomain={profile.primary_domain}
              onInspect={run => void inspectRun(run)}
              onRetry={run => void retryFailedMeasurement(run)}
              retryingRunId={retryingRunId}
              retryDisabled={Boolean(activeBatch) || Boolean(action)}
            />
          </section>
        ) : null}

        {profile && tab === 'Opportunities' ? (
          <section className={styles.tabSection}>
            <SourceMonitorPanel
              monitors={sourceMonitors}
              changes={sourceChanges}
              briefs={contentGapBriefs}
            />
            <div className={styles.sectionHeading}>
              <div><h2>Verified citation gaps</h2><p>Competitors were cited while the client was absent and no owned source appeared.</p></div>
              <span className={styles.opportunityCount}>{citationIntelligence.summary.verified_gaps}</span>
            </div>
            <div className={styles.opportunityList}>
              {citationIntelligence.gaps.map(gap => (
                <article key={gap.run_id} className={styles.opportunityItem}>
                  <header>
                    <span className={clsx(styles.runState, styles.stateReview)}>Deterministic gap</span>
                    <time>{dateLabel(gap.observed_at)}</time>
                  </header>
                  <div>
                    <h3>{gap.prompt || 'Tracked prompt'}</h3>
                    <p>
                      {gap.competitors?.length ? `${gap.competitors.join(', ')} cited` : 'A configured competitor was cited'} on {SURFACES[gap.surface || ''] || sentenceCase(gap.surface || 'unknown surface')}.
                    </p>
                    <strong>Suggested AIO format: {sentenceCase(gap.recommended_page_type || 'blog')}</strong>
                    {gap.citations?.length ? (
                      <div className={styles.evidenceLinks}>
                        {gap.citations.slice(0, 5).map(citation => {
                          const href = safeExternalUrl(citation.url || '')
                          if (!href) return null
                          return <a key={href} href={href} target="_blank" rel="noreferrer">{hostname(href)} <ExternalLink size={11} /></a>
                        })}
                      </div>
                    ) : null}
                    <div className={styles.opportunityActions}>
                      <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={() => void sendGapToAio(gap)}
                        disabled={Boolean(action)}
                      >
                        <Sparkles size={13} /> {action === `aio-${gap.run_id}` ? 'Preparing AIO draft' : 'Create AIO recommendation'}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
              {!citationIntelligence.gaps.length ? (
                <div className={styles.sectionEmpty}>
                  <Target size={22} />
                  <strong>No verified competitor-citation gaps</strong>
                  <p>A gap appears only when the client and owned sources are absent from a result that cites a configured competitor.</p>
                </div>
              ) : null}
            </div>

            <div className={clsx(styles.sectionHeading, styles.opportunitySubheading)}>
              <div><h2>Weekly citation opportunities</h2><p>Evidence-linked Parallel research, separate from visibility scoring.</p></div>
            </div>
            <div className={styles.opportunityList}>
              {insights.map(item => (
                <article key={item.id} className={styles.opportunityItem}>
                  <header>
                    <span className={clsx(styles.runState, statusClass(item.status))}>{sentenceCase(item.status)}</span>
                    <time>{dateLabel(item.generated_at)}</time>
                  </header>
                  {item.status === 'complete' ? (
                    <div>
                      <h3>{String(item.insight?.gap || 'Citation opportunity')}</h3>
                      {item.insight?.missing_content_asset ? <p>{String(item.insight.missing_content_asset)}</p> : null}
                      <strong>Recommended: {String(item.insight?.recommended_content_type || 'Review cited source patterns')}</strong>
                      {item.evidence_urls?.length ? (
                        <div className={styles.evidenceLinks}>
                          {item.evidence_urls.slice(0, 6).map(url => {
                            const href = safeExternalUrl(url)
                            if (!href) return null
                            return <a key={url} href={href} target="_blank" rel="noreferrer">{hostname(href)} <ExternalLink size={11} /></a>
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ))}
              {!insights.length ? (
                <div className={styles.sectionEmpty}>
                  <Sparkles size={22} />
                  <strong>No weekly opportunities yet</strong>
                  <p>Recommendations appear after citation data has been collected.</p>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {profile && accessToken ? (
          <ReportShareDialog
            open={shareOpen}
            token={accessToken}
            profileId={id}
            profileName={profile.name}
            collections={(profile.collections || []).map(item => ({ id: item.id, name: item.name }))}
            onClose={() => setShareOpen(false)}
          />
        ) : null}

        {profile && tab === 'Attribution' ? (
          <AttributionPanel
            token={accessToken}
            profileId={id}
            data={attribution}
            onRefresh={load}
          />
        ) : null}

        {runTarget ? (
          <RunSurfaceDialog
            target={runTarget}
            busy={action === (runTarget.collectionId || 'profile')}
            onClose={() => setRunTarget(null)}
            onRun={(surfaces, measurementMethods, includeCalibration) => void runNow(surfaces, measurementMethods, includeCalibration)}
          />
        ) : null}

        <ResultDrawer
          run={selectedRun}
          loading={resultLoading}
          error={resultError}
          ownedDomain={profile?.primary_domain}
          retrying={Boolean(selectedRun?.id && action === `retry-run-${selectedRun.id}`)}
          retryDisabled={Boolean(activeBatch) || Boolean(action)}
          onRetry={selectedRun?.status === 'failed' ? () => void retryFailedMeasurement(selectedRun) : undefined}
          onClose={closeResult}
        />

        {editingCollection ? (
          <div className={styles.modalBackdrop}>
            <div role="dialog" aria-modal="true" aria-label="Edit collection" className={styles.modalCard}>
              <div className={styles.modalHeader}>
                <div><h2>Edit collection</h2><p>Update its schedule, objective, and measured sources.</p></div>
                <button type="button" className={styles.iconButton} title="Close" onClick={() => setEditingCollection(null)}><X size={15} /></button>
              </div>
              <div className={styles.modalBody}>
                <label className={styles.fieldLabel}>Name<input className="input-base" value={editingCollection.name} onChange={event => setEditingCollection({ ...editingCollection, name: event.target.value })} /></label>
                <label className={styles.fieldLabel}>Objective<textarea className="input-base" rows={3} value={editingCollection.objective || ''} onChange={event => setEditingCollection({ ...editingCollection, objective: event.target.value })} /></label>
                <label className={styles.fieldLabel}>Schedule<CustomSelect ariaLabel="Collection schedule" value={editingCollection.schedule || 'daily'} onChange={value => updateEditingCollectionSchedule(value as 'daily' | 'manual')} options={COLLECTION_SCHEDULE_OPTIONS} /></label>
                <label className={styles.fieldLabel}>Monthly budget (USD)<input className="input-base" type="number" min="0.01" step="0.01" placeholder="No budget" value={editingCollection.monthly_budget_usd ?? ''} onChange={event => setEditingCollection({ ...editingCollection, monthly_budget_usd: event.target.value ? Number(event.target.value) : null })} /></label>
                <div><p className={styles.fieldLabel}>Tracked sources</p><SurfaceSelector selected={editingCollection.surfaces?.length ? editingCollection.surfaces : ALL_GEOPILOT_SURFACES} onChange={updateEditingCollectionSurfaces} /></div>
                <CollectionMethodSelector
                  surfaces={editingCollection.surfaces?.length ? editingCollection.surfaces : ALL_GEOPILOT_SURFACES}
                  measurementMethods={normalizeCollectionMeasurementMethods(editingCollection.surfaces?.length ? editingCollection.surfaces : ALL_GEOPILOT_SURFACES, editingCollection.measurement_methods)}
                  consumerUiEnabled={capabilities.consumer_ui.enabled}
                  consumerUiSurfaces={capabilities.consumer_ui.surfaces}
                  schedule={editingCollection.schedule || 'daily'}
                  onChange={measurementMethods => setEditingCollection({ ...editingCollection, measurement_methods: measurementMethods })}
                />
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.secondaryButton} onClick={() => setEditingCollection(null)}>Cancel</button>
                <button type="button" className={styles.primaryButton} onClick={() => void saveCollection()} disabled={action === `collection-${editingCollection.id}`}><Save size={14} /> Save</button>
              </div>
            </div>
          </div>
        ) : null}

        {editingPrompt ? (
          <div className={styles.modalBackdrop}>
            <div role="dialog" aria-modal="true" aria-label="Edit prompt" className={clsx(styles.modalCard, styles.modalWide)}>
              <div className={styles.modalHeader}>
                <div><h2>Edit tracked prompt</h2><p>Saving creates a new version when this prompt already has results.</p></div>
                <button type="button" className={styles.iconButton} title="Close" onClick={() => setEditingPrompt(null)}><X size={15} /></button>
              </div>
              <div className={styles.modalBody}>
                <label className={styles.fieldLabel}>LLM prompt<textarea className="input-base" rows={5} value={editingPrompt.prompt_text} onChange={event => setEditingPrompt({ ...editingPrompt, prompt_text: event.target.value })} /></label>
                <label className={styles.fieldLabel}>Google query override<textarea className="input-base" rows={3} value={editingPrompt.google_query || ''} onChange={event => setEditingPrompt({ ...editingPrompt, google_query: event.target.value })} /></label>
                <label className={styles.checkboxLabel}><input type="checkbox" checked={Boolean(editingPrompt.calibration)} onChange={event => setEditingPrompt({ ...editingPrompt, calibration: event.target.checked })} /> Use for ChatGPT consumer calibration</label>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.secondaryButton} onClick={() => setEditingPrompt(null)}>Cancel</button>
                <button type="button" className={styles.primaryButton} onClick={() => void savePrompt()} disabled={action === `prompt-${editingPrompt.id}`}><Save size={14} /> Save new version</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppLayout>
  )
}

function ResultToolbar({
  query,
  setQuery,
  surface,
  setSurface,
  collectionMethod,
  setCollectionMethod,
  resultOutcome,
  setResultOutcome,
}: {
  query: string
  setQuery: (value: string) => void
  surface: string
  setSurface: (value: string) => void
  collectionMethod: string
  setCollectionMethod: (value: string) => void
  resultOutcome: ResultOutcome
  setResultOutcome: (value: ResultOutcome) => void
}) {
  return (
    <div className={styles.tableToolbar}>
      <label className={styles.tableSearch}>
        <Search size={15} />
        <span className={styles.srOnly}>Search measurements</span>
        <input type="search" placeholder="Search prompts" value={query} onChange={event => setQuery(event.target.value)} />
        {query ? <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={14} /></button> : null}
      </label>
      <div className={styles.methodFilter}>
        <CustomSelect
          size="compact"
          ariaLabel="Filter by collection method"
          value={collectionMethod}
          onChange={setCollectionMethod}
          options={COLLECTION_METHOD_FILTER_OPTIONS}
        />
      </div>
      <div className={styles.outcomeFilter}>
        <CustomSelect
          size="compact"
          ariaLabel="Filter by result"
          value={resultOutcome}
          onChange={value => setResultOutcome(value as ResultOutcome)}
          options={RESULT_OUTCOME_FILTER_OPTIONS}
        />
      </div>
      <div className={styles.surfaceFilters} aria-label="Filter by surface">
        <button type="button" className={!surface ? styles.filterActive : undefined} aria-pressed={!surface} onClick={() => setSurface('')}>All</button>
        {Object.entries(SURFACES).map(([value, label]) => (
          <button key={value} type="button" className={surface === value ? styles.filterActive : undefined} aria-pressed={surface === value} onClick={() => setSurface(value)}>{label}</button>
        ))}
      </div>
    </div>
  )
}
