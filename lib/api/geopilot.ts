import { apiFetch } from './shared'

const BASE = (
  process.env.NEXT_PUBLIC_GEOPILOT_API_URL || 'https://geopilot-backend-production.up.railway.app'
).replace(/\/+$/, '')
export const GEOPILOT_API_BASE = BASE

const f = (path: string, token: string, options?: RequestInit) => apiFetch(BASE, path, token, options)

export type GeoPilotSurface = 'google_ai_overview' | 'chatgpt' | 'gemini' | 'claude' | 'chatgpt_calibration'
export type GeoPilotPrimarySurface = Exclude<GeoPilotSurface, 'chatgpt_calibration'>
export type GeoPilotCollectionMethod =
  | 'model_api'
  | 'consumer_ui_organic'
  | 'consumer_ui_forced_search'
  | 'google_search_result'
export type GeoPilotMeasurementMethods = Partial<Record<GeoPilotPrimarySurface, GeoPilotCollectionMethod[]>>
export type GeoPilotExportDataset =
  | 'all'
  | 'prompt_history'
  | 'trends'
  | 'method_comparison'
  | 'citations'
  | 'costs'
  | 'citation_gaps'

export type GeoPilotCapabilities = {
  consumer_ui: {
    enabled: boolean
    surfaces: GeoPilotPrimarySurface[]
    manual_only: boolean
    delivery_method: 'live'
    provider_device: 'desktop'
    personalization_mode: 'anonymous'
    unit_cost_usd: number
    pricing_effective_date: string
  }
  primary_methods: Record<GeoPilotPrimarySurface, GeoPilotCollectionMethod>
  supported_methods: Record<GeoPilotPrimarySurface, GeoPilotCollectionMethod[]>
}

export type GeoPilotCompetitor = {
  id?: string
  name: string
  domain: string
  aliases: string[]
}

export type GeoPilotProfilePayload = {
  name: string
  brand_name: string
  primary_domain: string
  owned_domains: string[]
  brand_aliases: string[]
  description: string
  category: string
  country_code: string
  location_name: string
  language_code: string
  timezone: string
  device: 'desktop' | 'mobile'
  source_brand_profile_id?: string | null
  competitors: GeoPilotCompetitor[]
  active: boolean
}

export type GeoPilotCollectionPayload = {
  name: string
  objective: string
  funnel_stage?: 'awareness' | 'consideration' | 'decision' | null
  schedule: 'manual' | 'daily'
  country_code?: string | null
  location_name?: string | null
  language_code?: string | null
  device?: 'desktop' | 'mobile' | null
  surfaces: GeoPilotPrimarySurface[]
  measurement_methods: GeoPilotMeasurementMethods
  monthly_budget_usd?: number | null
  active: boolean
}

export type GeoPilotCostSurface = {
  actual_usd: number
  average_usd: number | null
  priced_measurements: number
  unpriced_measurements: number
}

export type GeoPilotCollectionCost = {
  collection_id: string
  name: string
  monthly_budget_usd: number | null
  month_actual_usd: number
  remaining_usd: number | null
  utilization_percent: number | null
  budget_state: 'unset' | 'ok' | 'near' | 'over'
}

export type GeoPilotCostSummary = {
  period_days: number
  period_actual_usd: number
  month_actual_usd: number
  priced_measurements: number
  unpriced_measurements: number
  by_surface: Partial<Record<GeoPilotSurface, GeoPilotCostSurface>>
  by_method: Partial<Record<GeoPilotSurface, Partial<Record<GeoPilotCollectionMethod, GeoPilotCostSurface>>>>
  by_collection: GeoPilotCollectionCost[]
  by_batch: Array<{ batch_id: string; actual_usd: number; priced_measurements: number }>
  estimate_basis_days: number
}

export type GeoPilotPromptPayload = {
  prompt_text: string
  google_query: string
  category: string
  funnel_stage?: 'awareness' | 'consideration' | 'decision' | null
  calibration: boolean
  source: 'manual' | 'parallel'
  active: boolean
}

export type GeoPilotReportSections = {
  overview: boolean
  trends: boolean
  surfaces: boolean
  prompts: boolean
  citations: boolean
  opportunities: boolean
  costs: boolean
}

export type GeoPilotReportLink = {
  id: string
  profile_id: string
  name: string
  period_days: number
  sections: GeoPilotReportSections
  collection_ids: string[]
  surfaces: GeoPilotPrimarySurface[]
  active: boolean
  expires_at?: string | null
  revoked_at?: string | null
  access_count: number
  last_accessed_at?: string | null
  created_at?: string
  passcode_protected: boolean
  token_prefix: string
}

export type GeoPilotReportLinkPayload = {
  name: string
  period_days: number
  sections: GeoPilotReportSections
  collection_ids: string[]
  surfaces: GeoPilotPrimarySurface[]
  expires_in_days: number | null
  passcode?: string
}

export type GeoPilotSourceMonitor = {
  id: string
  collection_id?: string | null
  url: string
  domain: string
  citation_classification: 'owned' | 'competitor' | 'third_party'
  citation_count: number
  priority_score: number
  status: string
  frequency: string
  last_event_at?: string | null
  last_checked_at?: string | null
  last_error?: string | null
}

export type GeoPilotSourceChange = {
  id: string
  monitor_id: string
  detected_at: string
  changed_output: Record<string, unknown>
  previous_output: Record<string, unknown>
  evidence_urls: string[]
  status: string
}

export type GeoPilotContentGapBrief = {
  id: string
  collection_id?: string | null
  source_type: 'weekly' | 'monitor_change'
  status: string
  brief: Record<string, unknown>
  evidence: Record<string, unknown>
  error?: string | null
  generated_at?: string | null
  created_at?: string
}

export type GeoPilotGoogleIntegration = {
  id: string
  profile_id: string
  auth_method: 'google_oauth' | 'service_account'
  gsc_site_url?: string | null
  ga4_property_id?: string | null
  ga4_property_name?: string | null
  status: 'connected' | 'reconnect_required' | 'error' | 'disabled'
  active: boolean
  last_synced_at?: string | null
  next_sync_at?: string | null
  last_error?: string | null
}

export type GeoPilotGoogleProperties = {
  connection_method: 'google_oauth' | 'service_account'
  google_email?: string | null
  search_console: Array<{ site_url: string; permission_level: string }>
  analytics: Array<{ property_id: string; display_name: string; account_name: string }>
  analytics_reconnect_required: boolean
  analytics_error?: string | null
}

export type GeoPilotAttribution = {
  integration: GeoPilotGoogleIntegration | null
  period_days: number
  totals: {
    gsc_clicks: number
    gsc_impressions: number
    gsc_ctr: number | null
    gsc_average_position: number | null
    ga4_sessions: number
    ga4_active_users: number
    ga4_engaged_sessions: number
    ga4_key_events: number
    ga4_revenue: number
    ai_referral_sessions: number
  }
  timeline: Array<Record<string, number | string>>
  content_actions: Array<Record<string, unknown>>
  methodology: string
}

export const geopilotApi = {
  capabilities: (token: string) => f('/api/geopilot/capabilities', token) as Promise<GeoPilotCapabilities>,
  listProfiles: (token: string) => f('/api/geopilot/profiles', token),
  listBrandProfiles: (token: string) => f('/api/geopilot/brand-profiles', token),
  createProfile: (token: string, payload: GeoPilotProfilePayload) =>
    f('/api/geopilot/profiles', token, { method: 'POST', body: JSON.stringify(payload) }),
  getProfile: (token: string, id: string) => f(`/api/geopilot/profiles/${id}`, token),
  updateProfile: (token: string, id: string, payload: GeoPilotProfilePayload) =>
    f(`/api/geopilot/profiles/${id}`, token, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteProfile: (token: string, id: string) => f(`/api/geopilot/profiles/${id}`, token, { method: 'DELETE' }),
  createCollection: (token: string, profileId: string, payload: GeoPilotCollectionPayload) =>
    f(`/api/geopilot/profiles/${profileId}/collections`, token, { method: 'POST', body: JSON.stringify(payload) }),
  updateCollection: (token: string, id: string, payload: GeoPilotCollectionPayload) =>
    f(`/api/geopilot/collections/${id}`, token, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteCollection: (token: string, id: string) => f(`/api/geopilot/collections/${id}`, token, { method: 'DELETE' }),
  createPrompt: (token: string, collectionId: string, payload: GeoPilotPromptPayload) =>
    f(`/api/geopilot/collections/${collectionId}/prompts`, token, { method: 'POST', body: JSON.stringify(payload) }),
  updatePrompt: (token: string, id: string, payload: GeoPilotPromptPayload) =>
    f(`/api/geopilot/prompts/${id}`, token, { method: 'PUT', body: JSON.stringify(payload) }),
  retirePrompt: (token: string, id: string) => f(`/api/geopilot/prompts/${id}`, token, { method: 'DELETE' }),
  suggestPrompts: (token: string, collectionId: string, objective: string, limit = 20) =>
    f(`/api/geopilot/collections/${collectionId}/suggest-prompts`, token, {
      method: 'POST', body: JSON.stringify({ objective, limit }),
    }),
  runProfile: (
    token: string,
    profileId: string,
    options: {
      collectionId?: string
      surfaces: GeoPilotPrimarySurface[]
      measurementMethods: GeoPilotMeasurementMethods
      includeCalibration: boolean
    },
  ) =>
    f(`/api/geopilot/profiles/${profileId}/runs`, token, {
      method: 'POST',
      body: JSON.stringify({
        scope: options.collectionId ? 'collection' : 'profile',
        collection_id: options.collectionId,
        surfaces: options.surfaces,
        measurement_methods: options.measurementMethods,
        include_calibration: options.includeCalibration,
      }),
    }),
  listBatches: (token: string, profileId: string) => f(`/api/geopilot/profiles/${profileId}/batches`, token),
  getBatch: (token: string, id: string) => f(`/api/geopilot/batches/${id}`, token),
  cancelBatch: (token: string, id: string) => f(`/api/geopilot/batches/${id}/cancel`, token, { method: 'POST' }),
  retryFailedBatch: (token: string, id: string) =>
    f(`/api/geopilot/batches/${id}/retry-failed`, token, { method: 'POST' }),
  retryFailedRun: (token: string, id: string) =>
    f(`/api/geopilot/runs/${id}/retry`, token, { method: 'POST' }),
  dashboard: (token: string, profileId: string, days: number) => f(`/api/geopilot/profiles/${profileId}/dashboard?days=${days}`, token),
  costs: (token: string, profileId: string, days: number) => f(`/api/geopilot/profiles/${profileId}/costs?days=${days}`, token),
  listRuns: (token: string, profileId: string, days: number, surface = '', collectionMethod = '') =>
    f(`/api/geopilot/profiles/${profileId}/runs?days=${days}${surface ? `&surface=${encodeURIComponent(surface)}` : ''}${collectionMethod ? `&collection_method=${encodeURIComponent(collectionMethod)}` : ''}`, token),
  getRun: (token: string, id: string) => f(`/api/geopilot/runs/${id}`, token),
  listInsights: (token: string, profileId: string) => f(`/api/geopilot/profiles/${profileId}/insights`, token),
  citationIntelligence: (token: string, profileId: string, days: number) =>
    f(`/api/geopilot/profiles/${profileId}/citation-intelligence?days=${days}`, token),
  providerAlerts: (token: string, profileId: string, days: number) =>
    f(`/api/geopilot/profiles/${profileId}/provider-alerts?days=${days}`, token),
  createAioRecommendation: (token: string, profileId: string, runId: string) =>
    f(`/api/geopilot/profiles/${profileId}/aio-recommendations`, token, {
      method: 'POST', body: JSON.stringify({ run_id: runId }),
    }),
  getAioRecommendation: (token: string, id: string) => f(`/api/geopilot/aio-recommendations/${id}`, token),
  listReportLinks: (token: string, profileId: string) =>
    f(`/api/geopilot/profiles/${profileId}/report-links`, token) as Promise<{ report_links: GeoPilotReportLink[] }>,
  createReportLink: (token: string, profileId: string, payload: GeoPilotReportLinkPayload) =>
    f(`/api/geopilot/profiles/${profileId}/report-links`, token, {
      method: 'POST', body: JSON.stringify(payload),
    }) as Promise<{ report_link: GeoPilotReportLink; token: string }>,
  revokeReportLink: (token: string, linkId: string) =>
    f(`/api/geopilot/report-links/${linkId}/revoke`, token, { method: 'POST' }),
  sourceMonitors: (token: string, profileId: string) =>
    f(`/api/geopilot/profiles/${profileId}/source-monitors`, token) as Promise<{ monitors: GeoPilotSourceMonitor[] }>,
  sourceChanges: (token: string, profileId: string) =>
    f(`/api/geopilot/profiles/${profileId}/source-changes`, token) as Promise<{ changes: GeoPilotSourceChange[] }>,
  contentGapBriefs: (token: string, profileId: string) =>
    f(`/api/geopilot/profiles/${profileId}/content-gap-briefs`, token) as Promise<{ briefs: GeoPilotContentGapBrief[] }>,
  googleProperties: (token: string, method?: 'google_oauth' | 'service_account') =>
    f(`/api/geopilot/google/properties${method ? `?method=${method}` : ''}`, token) as Promise<GeoPilotGoogleProperties>,
  googleIntegration: (token: string, profileId: string) =>
    f(`/api/geopilot/profiles/${profileId}/google-integration`, token) as Promise<{ integration: GeoPilotGoogleIntegration | null }>,
  saveGoogleIntegration: (
    token: string,
    profileId: string,
    payload: {
      auth_method: 'google_oauth' | 'service_account'
      gsc_site_url: string | null
      ga4_property_id: string | null
      ga4_property_name: string | null
      active: boolean
    },
  ) => f(`/api/geopilot/profiles/${profileId}/google-integration`, token, {
    method: 'PUT', body: JSON.stringify(payload),
  }) as Promise<{ integration: GeoPilotGoogleIntegration }>,
  deleteGoogleIntegration: (token: string, profileId: string) =>
    f(`/api/geopilot/profiles/${profileId}/google-integration`, token, { method: 'DELETE' }),
  syncAttribution: (token: string, profileId: string, days: number) =>
    f(`/api/geopilot/profiles/${profileId}/google-integration/sync`, token, {
      method: 'POST', body: JSON.stringify({ days }),
    }),
  attribution: (token: string, profileId: string, days: number) =>
    f(`/api/geopilot/profiles/${profileId}/attribution?days=${days}`, token) as Promise<GeoPilotAttribution>,
  createContentAction: (token: string, profileId: string, payload: {
    title: string
    target_url: string
    published_at: string
    status: 'planned' | 'published'
    notes: string
    recommendation_id?: string
    source_run_id?: string
  }) => f(`/api/geopilot/profiles/${profileId}/content-actions`, token, {
    method: 'POST', body: JSON.stringify(payload),
  }),
  archiveContentAction: (token: string, actionId: string) =>
    f(`/api/geopilot/content-actions/${actionId}`, token, { method: 'DELETE' }),
  exportUrl: (profileId: string, days: number) => `${BASE}/api/geopilot/profiles/${profileId}/export.csv?days=${days}`,
  exportBundleUrl: (profileId: string, days: number) => `${BASE}/api/geopilot/profiles/${profileId}/export-bundle.json?days=${days}`,
  expandedExportUrl: (profileId: string, days: number, dataset: GeoPilotExportDataset) => dataset === 'all'
    ? `${BASE}/api/geopilot/profiles/${profileId}/export.zip?days=${days}`
    : `${BASE}/api/geopilot/profiles/${profileId}/exports/${dataset}.csv?days=${days}`,
}

export async function downloadGeoPilotCsv(token: string, profileId: string, days: number, filename: string) {
  const response = await fetch(geopilotApi.exportUrl(profileId, days), { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Export failed' }))
    throw new Error(error.detail || 'Export failed')
  }
  const link = document.createElement('a')
  link.href = URL.createObjectURL(await response.blob())
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

export async function downloadGeoPilotExport(
  token: string,
  profileId: string,
  days: number,
  dataset: GeoPilotExportDataset,
  filename: string,
) {
  const response = await fetchGeoPilotExport(token, profileId, days, dataset)
  const objectUrl = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  link.click()
  URL.revokeObjectURL(objectUrl)
}

async function fetchGeoPilotExport(
  token: string,
  profileId: string,
  days: number,
  dataset: GeoPilotExportDataset,
) {
  const response = await fetch(geopilotApi.expandedExportUrl(profileId, days, dataset), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Export failed' }))
    throw new Error(error.detail || 'Export failed')
  }
  return response
}

export async function fetchGeoPilotExportBundle(
  token: string,
  profileId: string,
  days: number,
): Promise<Record<Exclude<GeoPilotExportDataset, 'all'>, string>> {
  const response = await fetch(geopilotApi.exportBundleUrl(profileId, days), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Export failed' }))
    throw new Error(error.detail || 'Export failed')
  }
  const payload = await response.json()
  if (!payload?.datasets || typeof payload.datasets !== 'object') {
    throw new Error('GEOPilot report data is unavailable.')
  }
  return payload.datasets
}
