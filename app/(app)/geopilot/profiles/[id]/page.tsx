'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  BarChart3,
  Check,
  ChevronRight,
  Clock3,
  CircleDollarSign,
  Download,
  ExternalLink,
  Link2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Square,
  Target,
  X,
} from 'lucide-react'
import clsx from 'clsx'
import AppLayout from '@/components/layout/AppLayout'
import RunSurfaceDialog, { type GeoPilotRunTarget } from '@/components/geopilot/RunSurfaceDialog'
import SurfaceSelector, { ALL_GEOPILOT_SURFACES, GEOPILOT_SURFACES } from '@/components/geopilot/SurfaceSelector'
import { createClient } from '@/lib/supabase'
import {
  downloadGeoPilotCsv,
  geopilotApi,
  type GeoPilotCapabilities,
  type GeoPilotCollectionMethod,
  type GeoPilotCollectionPayload,
  type GeoPilotCostSummary,
  type GeoPilotMeasurementMethods,
  type GeoPilotPrimarySurface,
  type GeoPilotPromptPayload,
} from '@/lib/api/geopilot'
import { formatUsd } from '@/lib/geopilot-costs'
import {
  collectionMethodLabel,
  deliveryMethodLabel,
  isPrimaryCollectionMethod,
  measurementCostKey,
  PRIMARY_METHOD_BY_SURFACE,
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
}
type Citation = {
  id?: string
  domain?: string
  url?: string
  title?: string
  excerpt?: string
  classification?: string
  position?: number
}
type Run = {
  id: string
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
  response_text?: string
  raw_response?: unknown
  brand_mentioned?: boolean
  prominence?: string
  sentiment?: string
  summary?: string
  web_search_requested?: boolean
  web_search_used?: boolean | null
  cost_usd?: number
  created_at?: string
  request_snapshot?: { prompt_text?: string; google_query?: string }
  citations?: Citation[]
}
type SurfaceMetrics = {
  visibility_score?: number | null
  share_of_voice?: number | null
  prominence_score?: number | null
  sentiment_score?: number | null
  citation_share?: number | null
  ai_overview_coverage?: number | null
  successful_runs?: number
}
type Dashboard = {
  overall_visibility?: number | null
  overall_share_of_voice?: number | null
  overall_citation_share?: number | null
  measured_surfaces?: GeoPilotPrimarySurface[]
  surfaces?: Record<string, SurfaceMetrics>
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

const ACTIVE_BATCH_STATES = new Set(['queued', 'submitting', 'collecting', 'classifying', 'enriching'])
const PRIMARY_SURFACES: GeoPilotPrimarySurface[] = ['google_ai_overview', 'chatgpt', 'gemini', 'claude']
const SURFACES: Record<string, string> = {
  google_ai_overview: 'Google AI Overview',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  claude: 'Claude',
  chatgpt_calibration: 'ChatGPT calibration',
}
const TABS = ['Overview', 'Prompts', 'Results', 'Opportunities'] as const

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

function isOwnedDomain(domain: string | undefined, ownedDomain: string | undefined) {
  const candidate = normalizeDomain(domain)
  const owned = normalizeDomain(ownedDomain)
  return Boolean(candidate && owned && (candidate === owned || candidate.endsWith(`.${owned}`)))
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
  onClose,
}: {
  run: Run | null
  loading: boolean
  error: string
  ownedDomain?: string
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
            <Link href={`/geopilot/runs/${run.id}`} className={styles.secondaryButton}>View full result <ExternalLink size={13} /></Link>
            <button type="button" className={styles.primaryButton} onClick={onClose}>Done</button>
          </footer>
        </aside>
      ) : null}
    </dialog>
  )
}

type TrendPoint = { date: string; value: number }

function VisibilityChart({ points, brandName }: { points: TrendPoint[]; brandName: string }) {
  if (!points.length) {
    return (
      <div className={styles.chartEmpty}>
        <BarChart3 size={22} />
        <strong>No trend data yet</strong>
        <p>Visibility history appears after a completed measurement run.</p>
      </div>
    )
  }

  const width = 720
  const top = 15
  const bottom = 215
  const coordinates = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width
    const y = top + ((100 - Math.max(0, Math.min(100, point.value))) / 100) * (bottom - top)
    return { ...point, x, y }
  })
  const labelIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])]

  return (
    <div className={styles.chartWrap}>
      <div className={styles.chartYAxis} aria-hidden="true">
        <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
      </div>
      <div className={styles.chartCanvas}>
        <svg viewBox="0 0 720 230" role="img" aria-label={`${brandName} visibility trend over the selected period`}>
          <g className={styles.gridLines}>
            {[15, 65, 115, 165, 215].map(y => <line key={y} x1="0" y1={y} x2="720" y2={y} />)}
          </g>
          <polyline className={styles.chartPrimary} points={coordinates.map(point => `${point.x},${point.y}`).join(' ')} />
          <circle className={styles.chartPoint} cx={coordinates.at(-1)?.x} cy={coordinates.at(-1)?.y} r="5" />
        </svg>
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

function MiniMethodTrend({ api, consumerUi, label }: { api: TrendPoint[]; consumerUi: TrendPoint[]; label: string }) {
  const coordinates = (points: TrendPoint[]) => points.slice(-14).map((point, index, values) => {
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
    apiTrend: TrendPoint[]
    consumerUiTrend: TrendPoint[]
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
}: {
  runs: Run[]
  total: number
  ownedDomain?: string
  onInspect: (run: Run) => void
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
                      <button type="button" className={styles.rowAction} aria-label="Inspect measurement result" onClick={() => onInspect(run)}>
                        <ChevronRight size={16} />
                      </button>
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
  const [tab, setTab] = useState<(typeof TABS)[number]>('Overview')
  const [days, setDays] = useState(30)
  const [surface, setSurface] = useState('')
  const [collectionMethod, setCollectionMethod] = useState('')
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
      const [profileData, dashboardData, costResult, runsData, insightsData, batchesData, capabilityData] = await Promise.all([
        geopilotApi.getProfile(session.access_token, id),
        geopilotApi.dashboard(session.access_token, id, days),
        geopilotApi.costs(session.access_token, id, days)
          .then(data => ({ data, unavailable: false }))
          .catch(() => ({ data: { ...EMPTY_COST_SUMMARY, period_days: days }, unavailable: true })),
        geopilotApi.listRuns(session.access_token, id, days, surface, collectionMethod),
        geopilotApi.listInsights(session.access_token, id),
        geopilotApi.listBatches(session.access_token, id),
        capabilityRequest,
      ])
      setProfile(profileData.profile)
      setDashboard(dashboardData)
      setCosts(costResult.data)
      setCostsUnavailable(costResult.unavailable)
      setRuns(runsData.runs || [])
      setInsights(insightsData.insights || [])
      setBatches(batchesData.batches || [])
      if (capabilityData) setCapabilities(capabilityData)
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load GEOPilot profile.')
    } finally {
      setLoading(false)
    }
  }, [collectionMethod, days, id, router, surface])

  useEffect(() => { void load() }, [load])

  const activeBatch = useMemo(() => {
    const candidates = [profile?.latest_batch, ...batches]
    return candidates.find((batch): batch is Batch => Boolean(batch && ACTIVE_BATCH_STATES.has(batch.status))) || null
  }, [batches, profile?.latest_batch])

  useEffect(() => {
    if (!activeBatch) return
    const timer = window.setInterval(() => void load(), 5000)
    return () => window.clearInterval(timer)
  }, [activeBatch, load])

  function openRun(collection?: Collection) {
    const collections = collection ? [collection] : profile?.collections || []
    const prompts = collections.flatMap(item => item.prompts || []).filter(prompt => prompt.active !== false)
    const promptCount = prompts.length || collections.reduce((sum, item) => sum + (item.prompt_count || 0), 0)
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
      surfaces: collection?.surfaces?.length ? [...collection.surfaces] : [...ALL_GEOPILOT_SURFACES],
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

  async function saveCollection() {
    if (!accessToken || !editingCollection) return
    setAction(`collection-${editingCollection.id}`)
    const payload: GeoPilotCollectionPayload = {
      name: editingCollection.name,
      objective: editingCollection.objective || '',
      funnel_stage: editingCollection.funnel_stage || null,
      schedule: editingCollection.schedule || 'daily',
      country_code: editingCollection.country_code || null,
      location_name: editingCollection.location_name || null,
      language_code: editingCollection.language_code || null,
      device: editingCollection.device || null,
      surfaces: editingCollection.surfaces?.length ? editingCollection.surfaces : [...ALL_GEOPILOT_SURFACES],
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
  const primaryLoadedRuns = useMemo(
    () => runs.filter(run => (
      PRIMARY_SURFACES.includes(run.surface as GeoPilotPrimarySurface)
      && isPrimaryCollectionMethod(run.surface, run.collection_method)
    )),
    [runs],
  )
  const citationDomains = useMemo(() => {
    const counts = new Map<string, number>()
    primaryLoadedRuns.flatMap(run => run.citations || []).forEach(citation => {
      if (citation.domain) counts.set(citation.domain, (counts.get(citation.domain) || 0) + 1)
    })
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [primaryLoadedRuns])
  const dailyTrend = useMemo(() => {
    const grouped = new Map<string, number[]>()
    for (const row of dashboard.timeline || []) {
      const date = String(row.metric_date || '')
      const rowSurface = String(row.surface || '')
      const rowMethod = row.collection_method ? String(row.collection_method) : undefined
      const value = Number(row.visibility_score)
      if (
        !date
        || !Number.isFinite(value)
        || !PRIMARY_SURFACES.includes(rowSurface as GeoPilotPrimarySurface)
        || !isPrimaryCollectionMethod(rowSurface, rowMethod)
      ) continue
      grouped.set(date, [...(grouped.get(date) || []), value])
    }
    return [...grouped]
      .map(([date, values]) => ({ date, value: values.reduce((sum, value) => sum + value, 0) / values.length }))
      .slice(-14)
  }, [dashboard.timeline])
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
  const filteredRuns = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return runs
    return runs.filter(run => {
      const prompt = run.request_snapshot?.prompt_text || ''
      const label = SURFACES[run.surface] || run.surface
      return prompt.toLowerCase().includes(normalized) || label.toLowerCase().includes(normalized)
    })
  }, [query, runs])
  const totalSuccessfulRuns = Object.values(dashboard.surfaces || {})
    .reduce((sum, item) => sum + (item.successful_runs || 0), 0)
  const totalCitations = primaryLoadedRuns.reduce((sum, run) => sum + (run.citations?.length || 0), 0)
  const ownedCitations = primaryLoadedRuns.reduce((sum, run) => (
    sum + (run.citations || []).filter(citation => isOwnedDomain(citation.domain, profile?.primary_domain)).length
  ), 0)
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

  const metrics = [
    {
      label: 'Visibility',
      value: metric(dashboard.overall_visibility),
      note: `${totalSuccessfulRuns} successful measurements`,
      icon: Target,
    },
    {
      label: 'Share of voice',
      value: metric(dashboard.overall_share_of_voice),
      note: `${profile?.competitors?.length || 0} configured competitors`,
      icon: BarChart3,
    },
    {
      label: 'Owned citations',
      value: metric(dashboard.overall_citation_share),
      note: `${ownedCitations} of ${totalCitations} loaded citations`,
      icon: Link2,
    },
    {
      label: 'AI Overview coverage',
      value: metric(dashboard.surfaces?.google_ai_overview?.ai_overview_coverage),
      note: `${dashboard.surfaces?.google_ai_overview?.successful_runs || 0} Google measurements`,
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
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => void downloadGeoPilotCsv(accessToken, id, days, `geopilot-${profile.name}-${days}d.csv`)}
              >
                <Download size={15} /> Export CSV
              </button>
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
            const count = item === 'Prompts' ? promptCount : item === 'Results' ? runs.length : item === 'Opportunities' ? insights.length : 0
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
                  <article key={item.label} className={styles.metricItem}>
                    <div className={styles.metricLabelRow}>
                      <span className={styles.metricIcon}><Icon size={14} /></span>
                      <span className={styles.metricLabel}>{item.label}</span>
                    </div>
                    <div className={styles.metricValueRow}><strong>{item.value}</strong></div>
                    <p>{item.note}</p>
                  </article>
                )
              })}
            </section>

            <div className={styles.dashboardGrid}>
              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <h2>Visibility trend</h2>
                    <p>Primary API baseline for prompts that mention {profile.brand_name || profile.name}</p>
                  </div>
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
                <div className={styles.chartLegend}>
                  <span><i className={styles.legendPrimary} /> Primary measurement methods</span>
                </div>
                <VisibilityChart points={dailyTrend} brandName={profile.brand_name || profile.name} />
              </section>

              <section className={clsx(styles.panel, styles.surfacePanel)}>
                <div className={styles.panelHeader}>
                  <div>
                    <h2>By surface</h2>
                    <p>Visibility across primary measurement sources</p>
                  </div>
                </div>
                <div className={styles.surfaceRail}>
                  {PRIMARY_SURFACES.map(key => {
                    const data = dashboard.surfaces?.[key]
                    const value = data?.visibility_score
                    const tone = surfaceTone(key)
                    return (
                      <div key={key} className={styles.surfaceMetric}>
                        <div className={styles.surfaceMetricTop}>
                          <span><i className={styles[`rail_${tone}`]} /> {SURFACES[key]}</span>
                          <strong>{metric(value)}</strong>
                        </div>
                        <div className={styles.progressTrack}>
                          <span className={styles[`bar_${tone}`]} style={{ width: `${Math.max(0, Math.min(100, value || 0))}%` }} />
                        </div>
                        <small className={styles.stateMuted}>{data?.successful_runs || 0} successful measurements</small>
                      </div>
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
                setSurface={setSurface}
                collectionMethod={collectionMethod}
                setCollectionMethod={setCollectionMethod}
              />
              <ResultsTable runs={filteredRuns.slice(0, 8)} total={runs.length} ownedDomain={profile.primary_domain} onInspect={run => void inspectRun(run)} />
            </section>

            <div className={styles.supportGrid}>
              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div><h2>Run history</h2><p>Recent profile batches and completion status</p></div>
                </div>
                <div className={styles.compactList}>
                  {batches.slice(0, 6).map(batch => (
                    <div key={batch.id} className={styles.compactRow}>
                      <span className={clsx(styles.runState, statusClass(batch.status))}>{sentenceCase(batch.status)}</span>
                      <div><strong>{batch.completed_runs || 0} of {batch.total_runs || 0} measurements</strong><small>{dateLabel(batch.created_at)}</small></div>
                      {batch.failed_runs ? <span className={styles.stateError}>{batch.failed_runs} failed</span> : <strong>{formatUsd(costByBatch.get(batch.id)?.actual_usd)}</strong>}
                    </div>
                  ))}
                  {!batches.length ? <p className={styles.compactEmpty}>No runs yet.</p> : null}
                </div>
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div><h2>Top citation domains</h2><p>Most frequently cited sources in this period</p></div>
                </div>
                <div className={styles.compactList}>
                  {citationDomains.map(([domain, count]) => (
                    <div key={domain} className={styles.domainRow}>
                      <span><Link2 size={13} /> {domain}</span>
                      <strong>{count}</strong>
                    </div>
                  ))}
                  {!citationDomains.length ? <p className={styles.compactEmpty}>No citations collected in this period.</p> : null}
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
                      <small>{(collection.surfaces?.length ? collection.surfaces : ALL_GEOPILOT_SURFACES).map(item => GEOPILOT_SURFACES.find(option => option.value === item)?.label).filter(Boolean).join(' / ')}</small>
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
                        onClick={() => setEditingCollection({
                          ...collection,
                          surfaces: collection.surfaces?.length ? collection.surfaces : [...ALL_GEOPILOT_SURFACES],
                        })}
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
              setSurface={setSurface}
              collectionMethod={collectionMethod}
              setCollectionMethod={setCollectionMethod}
            />
            <ResultsTable runs={filteredRuns} total={runs.length} ownedDomain={profile.primary_domain} onInspect={run => void inspectRun(run)} />
          </section>
        ) : null}

        {profile && tab === 'Opportunities' ? (
          <section className={styles.tabSection}>
            <div className={styles.sectionHeading}>
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
                <label className={styles.fieldLabel}>Schedule<select className="input-base" value={editingCollection.schedule || 'daily'} onChange={event => setEditingCollection({ ...editingCollection, schedule: event.target.value as 'daily' | 'manual' })}><option value="daily">Daily</option><option value="manual">Manual only</option></select></label>
                <label className={styles.fieldLabel}>Monthly budget (USD)<input className="input-base" type="number" min="0.01" step="0.01" placeholder="No budget" value={editingCollection.monthly_budget_usd ?? ''} onChange={event => setEditingCollection({ ...editingCollection, monthly_budget_usd: event.target.value ? Number(event.target.value) : null })} /></label>
                <div><p className={styles.fieldLabel}>Tracked sources</p><SurfaceSelector selected={editingCollection.surfaces?.length ? editingCollection.surfaces : ALL_GEOPILOT_SURFACES} onChange={surfaces => setEditingCollection({ ...editingCollection, surfaces })} /></div>
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
}: {
  query: string
  setQuery: (value: string) => void
  surface: string
  setSurface: (value: string) => void
  collectionMethod: string
  setCollectionMethod: (value: string) => void
}) {
  return (
    <div className={styles.tableToolbar}>
      <label className={styles.tableSearch}>
        <Search size={15} />
        <span className={styles.srOnly}>Search measurements</span>
        <input type="search" placeholder="Search prompts" value={query} onChange={event => setQuery(event.target.value)} />
        {query ? <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={14} /></button> : null}
      </label>
      <label className={styles.methodFilter}>
        <span className={styles.srOnly}>Filter by collection method</span>
        <select value={collectionMethod} onChange={event => setCollectionMethod(event.target.value)}>
          <option value="">All methods</option>
          <option value="model_api">Model API</option>
          <option value="consumer_ui_organic">Consumer UI</option>
          <option value="google_search_result">Google search result</option>
          <option value="consumer_ui_forced_search">Consumer calibration</option>
        </select>
      </label>
      <div className={styles.surfaceFilters} aria-label="Filter by surface">
        <button type="button" className={!surface ? styles.filterActive : undefined} aria-pressed={!surface} onClick={() => setSurface('')}>All</button>
        {Object.entries(SURFACES).map(([value, label]) => (
          <button key={value} type="button" className={surface === value ? styles.filterActive : undefined} aria-pressed={surface === value} onClick={() => setSurface(value)}>{label}</button>
        ))}
      </div>
    </div>
  )
}
