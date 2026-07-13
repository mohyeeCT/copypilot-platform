import { apiFetch } from './shared'

const BASE = (
  process.env.NEXT_PUBLIC_GEOPILOT_API_URL || 'https://geopilot-backend-production.up.railway.app'
).replace(/\/+$/, '')

const f = (path: string, token: string, options?: RequestInit) => apiFetch(BASE, path, token, options)

export type GeoPilotSurface = 'google_ai_overview' | 'chatgpt' | 'gemini' | 'claude' | 'chatgpt_calibration'

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
  active: boolean
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

export const geopilotApi = {
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
  runProfile: (token: string, profileId: string, collectionId?: string) =>
    f(`/api/geopilot/profiles/${profileId}/runs`, token, {
      method: 'POST',
      body: JSON.stringify(collectionId ? { scope: 'collection', collection_id: collectionId } : { scope: 'profile' }),
    }),
  listBatches: (token: string, profileId: string) => f(`/api/geopilot/profiles/${profileId}/batches`, token),
  getBatch: (token: string, id: string) => f(`/api/geopilot/batches/${id}`, token),
  cancelBatch: (token: string, id: string) => f(`/api/geopilot/batches/${id}/cancel`, token, { method: 'POST' }),
  dashboard: (token: string, profileId: string, days: number) => f(`/api/geopilot/profiles/${profileId}/dashboard?days=${days}`, token),
  listRuns: (token: string, profileId: string, days: number, surface = '') =>
    f(`/api/geopilot/profiles/${profileId}/runs?days=${days}${surface ? `&surface=${encodeURIComponent(surface)}` : ''}`, token),
  getRun: (token: string, id: string) => f(`/api/geopilot/runs/${id}`, token),
  listInsights: (token: string, profileId: string) => f(`/api/geopilot/profiles/${profileId}/insights`, token),
  exportUrl: (profileId: string, days: number) => `${BASE}/api/geopilot/profiles/${profileId}/export.csv?days=${days}`,
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
