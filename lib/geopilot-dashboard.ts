import type {
  GeoPilotCollectionMethod,
  GeoPilotPrimarySurface,
} from './api/geopilot'

const DEFAULT_METHOD_BY_SURFACE: Partial<Record<GeoPilotPrimarySurface, GeoPilotCollectionMethod>> = {
  google_ai_overview: 'google_search_result',
  chatgpt: 'model_api',
  gemini: 'model_api',
  claude: 'model_api',
}

export type GeoPilotDashboardMetric =
  | 'visibility_score'
  | 'share_of_voice'
  | 'citation_share'
  | 'ai_overview_coverage'

export type GeoPilotTrendPoint = {
  date: string
  value: number
  successfulRuns: number
  mentionedRuns: number
  citedRuns: number
  methods: GeoPilotCollectionMethod[]
}

type TimelineRow = Record<string, unknown>
type RunMethodRow = {
  surface: string
  collection_method?: GeoPilotCollectionMethod
}

const METHOD_ORDER: GeoPilotCollectionMethod[] = [
  'google_search_result',
  'model_api',
  'consumer_ui_organic',
  'consumer_ui_forced_search',
]

function numericValue(value: unknown): number | null {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function collectionMethodForRow(
  row: TimelineRow | RunMethodRow,
): GeoPilotCollectionMethod | null {
  if (row.collection_method) return row.collection_method as GeoPilotCollectionMethod
  const surface = String(row.surface || '')
  return DEFAULT_METHOD_BY_SURFACE[surface as GeoPilotPrimarySurface] || null
}

export function availableSurfaceMethods(
  timeline: TimelineRow[],
  runs: RunMethodRow[],
  surface: GeoPilotPrimarySurface,
): GeoPilotCollectionMethod[] {
  const methods = new Set<GeoPilotCollectionMethod>()
  for (const row of [...timeline, ...runs]) {
    if (String(row.surface || '') !== surface) continue
    const method = collectionMethodForRow(row)
    if (method) methods.add(method)
  }
  return METHOD_ORDER.filter(method => methods.has(method))
}

export function buildDashboardTrend({
  timeline,
  metric,
  surface,
  method,
  displayMethods,
}: {
  timeline: TimelineRow[]
  metric: GeoPilotDashboardMetric
  surface?: GeoPilotPrimarySurface
  method?: GeoPilotCollectionMethod
  displayMethods: Partial<Record<GeoPilotPrimarySurface, GeoPilotCollectionMethod>>
}): GeoPilotTrendPoint[] {
  const grouped = new Map<string, Map<GeoPilotPrimarySurface, {
    weightedValue: number
    totalWeight: number
    successfulRuns: number
    mentionedRuns: number
    citedRuns: number
    methods: Set<GeoPilotCollectionMethod>
  }>>()

  for (const row of timeline) {
    const rowSurface = String(row.surface || '') as GeoPilotPrimarySurface
    if (!DEFAULT_METHOD_BY_SURFACE[rowSurface]) continue
    if (metric === 'ai_overview_coverage' && rowSurface !== 'google_ai_overview') continue
    if (surface && rowSurface !== surface) continue

    const rowMethod = collectionMethodForRow(row)
    if (!rowMethod) continue
    const expectedMethod = surface
      ? method || displayMethods[surface] || DEFAULT_METHOD_BY_SURFACE[surface]
      : displayMethods[rowSurface] || DEFAULT_METHOD_BY_SURFACE[rowSurface]
    if (rowMethod !== expectedMethod) continue

    const date = String(row.metric_date || '')
    const value = numericValue(row[metric])
    if (!date || value == null) continue

    const dateBucket = grouped.get(date) || new Map()
    const bucket = dateBucket.get(rowSurface) || {
      weightedValue: 0,
      totalWeight: 0,
      successfulRuns: 0,
      mentionedRuns: 0,
      citedRuns: 0,
      methods: new Set<GeoPilotCollectionMethod>(),
    }
    const successfulRuns = numericValue(row.successful_runs) || 0
    const citedRuns = numericValue(row.cited_runs) || 0
    const weight = metric === 'citation_share'
      ? citedRuns || successfulRuns || 1
      : successfulRuns || 1
    bucket.weightedValue += value * weight
    bucket.totalWeight += weight
    bucket.successfulRuns += successfulRuns
    bucket.mentionedRuns += numericValue(row.mentioned_runs) || 0
    bucket.citedRuns += citedRuns
    bucket.methods.add(rowMethod)
    dateBucket.set(rowSurface, bucket)
    grouped.set(date, dateBucket)
  }

  return [...grouped]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, surfaceBuckets]) => {
      const buckets = [...surfaceBuckets.values()]
      const surfaceValues = buckets.map(bucket => bucket.weightedValue / bucket.totalWeight)
      const methods = new Set(buckets.flatMap(bucket => [...bucket.methods]))
      return {
        date,
        value: surfaceValues.reduce((sum, value) => sum + value, 0) / surfaceValues.length,
        successfulRuns: buckets.reduce((sum, bucket) => sum + bucket.successfulRuns, 0),
        mentionedRuns: buckets.reduce((sum, bucket) => sum + bucket.mentionedRuns, 0),
        citedRuns: buckets.reduce((sum, bucket) => sum + bucket.citedRuns, 0),
        methods: METHOD_ORDER.filter(item => methods.has(item)),
      }
    })
}
