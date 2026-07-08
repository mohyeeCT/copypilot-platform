import { apiFetch } from './shared'

const BASE = (
  process.env.NEXT_PUBLIC_BRAND_MENTIONS_API_URL || 'https://brand-mentions-saas-backend-production.up.railway.app'
).replace(/\/+$/, '')

const f = (path: string, token: string, opts?: RequestInit) => apiFetch(BASE, path, token, opts)

const q = (params: string) => {
  const trimmed = params.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('?') ? trimmed : `?${trimmed}`
}

export type BrandMentionAlertPayload = {
  profile_id?: string
  label: string
  keyword: string
  alert_type: 'brand' | 'competitor' | 'keyword'
  sources: Array<'news' | 'blogs' | 'forums' | 'organizations'>
  exclusion_words: string[]
  max_results_per_crawl: number
  active: boolean
}

export type BrandMentionCrawlPayload = {
  max_results_per_crawl?: number
}

export type BrandMentionProfilePayload = {
  name: string
}

export const brandMentionsApi = {
  overview: (token: string) => f('/api/brand-mentions/overview', token),
  listProfiles: (token: string) => f('/api/brand-mentions/profiles', token),
  createProfile: (token: string, payload: BrandMentionProfilePayload) =>
    f('/api/brand-mentions/profiles', token, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getProfile: (token: string, id: string) => f(`/api/brand-mentions/profiles/${id}`, token),
  updateProfile: (token: string, id: string, payload: Partial<BrandMentionProfilePayload>) =>
    f(`/api/brand-mentions/profiles/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  createProfileAlert: (token: string, profileId: string, payload: BrandMentionAlertPayload) =>
    f(`/api/brand-mentions/profiles/${profileId}/alerts`, token, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listAlerts: (token: string) => f('/api/brand-mentions/alerts', token),
  createAlert: (token: string, payload: BrandMentionAlertPayload) =>
    f('/api/brand-mentions/alerts', token, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getAlert: (token: string, id: string) => f(`/api/brand-mentions/alerts/${id}`, token),
  updateAlert: (token: string, id: string, payload: Partial<BrandMentionAlertPayload>) =>
    f(`/api/brand-mentions/alerts/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteAlert: (token: string, id: string) => f(`/api/brand-mentions/alerts/${id}`, token, { method: 'DELETE' }),
  listMentions: (token: string, id: string, params = '') =>
    f(`/api/brand-mentions/alerts/${id}/mentions${q(params)}`, token),
  crawlAlert: (token: string, id: string, payload?: BrandMentionCrawlPayload) =>
    f(`/api/brand-mentions/alerts/${id}/crawl`, token, {
      method: 'POST',
      body: payload ? JSON.stringify(payload) : undefined,
    }),
  listRuns: (token: string, id: string) => f(`/api/brand-mentions/alerts/${id}/runs`, token),
}
