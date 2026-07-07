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
  label: string
  keyword: string
  alert_type: 'brand' | 'competitor' | 'keyword'
  sources: Array<'news' | 'blogs' | 'forums' | 'organizations'>
  exclusion_words: string[]
  max_results_per_crawl: number
  active: boolean
}

export const brandMentionsApi = {
  overview: (token: string) => f('/api/brand-mentions/overview', token),
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
  crawlAlert: (token: string, id: string) =>
    f(`/api/brand-mentions/alerts/${id}/crawl`, token, { method: 'POST' }),
  listRuns: (token: string, id: string) => f(`/api/brand-mentions/alerts/${id}/runs`, token),
}
