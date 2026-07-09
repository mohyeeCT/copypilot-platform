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
  crawl_frequency?: 'manual' | 'daily' | 'weekly'
  next_crawl_at?: string | null
  digest_enabled?: boolean
  digest_recipients?: string[]
  active: boolean
}

export type BrandMentionCrawlPayload = {
  max_results_per_crawl?: number
  pull_mode?: 'newest' | 'best_quality' | 'negative_watch' | 'one_per_domain'
  filters?: {
    country?: string
    language?: string
    provider_sentiment?: 'positive' | 'neutral' | 'negative'
    include_domain?: string
    exclude_domain?: string
    date_from?: string
  }
}

export type BrandMentionProfilePayload = {
  name: string
}

export type BrandMentionReviewPayload = {
  review_status?: 'unreviewed' | 'approved' | 'noise' | 'false_positive'
  favorite?: boolean
  review_note?: string | null
}

export type BrandMentionSuppressionPayload = {
  rule_type: 'domain' | 'url' | 'duplicate_key' | 'phrase'
  value: string
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
  getProfileReport: (token: string, id: string) => f(`/api/brand-mentions/profiles/${id}/report`, token),
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
  updateMentionReview: (token: string, mentionId: string, payload: BrandMentionReviewPayload) =>
    f(`/api/brand-mentions/mentions/${mentionId}/review`, token, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  listSuppressionRules: (token: string, id: string) =>
    f(`/api/brand-mentions/alerts/${id}/suppression-rules`, token),
  createSuppressionRule: (token: string, id: string, payload: BrandMentionSuppressionPayload) =>
    f(`/api/brand-mentions/alerts/${id}/suppression-rules`, token, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteSuppressionRule: (token: string, id: string) =>
    f(`/api/brand-mentions/suppression-rules/${id}`, token, { method: 'DELETE' }),
  getSummaryInsight: (token: string, id: string) =>
    f(`/api/brand-mentions/alerts/${id}/insights/summary`, token),
  refreshSummaryInsight: (token: string, id: string) =>
    f(`/api/brand-mentions/alerts/${id}/insights/summary`, token, {
      method: 'POST',
    }),
  getSentimentInsight: (token: string, id: string) =>
    f(`/api/brand-mentions/alerts/${id}/insights/sentiment`, token),
  refreshSentimentInsight: (token: string, id: string) =>
    f(`/api/brand-mentions/alerts/${id}/insights/sentiment`, token, {
      method: 'POST',
    }),
  crawlAlert: (token: string, id: string, payload?: BrandMentionCrawlPayload) =>
    f(`/api/brand-mentions/alerts/${id}/crawl`, token, {
      method: 'POST',
      body: payload ? JSON.stringify(payload) : undefined,
    }),
  listRuns: (token: string, id: string) => f(`/api/brand-mentions/alerts/${id}/runs`, token),
}
