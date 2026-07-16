import { apiFetch, clientScopedJobsPath, type ClientJobFilter } from './shared'

const BASE = (
  process.env.NEXT_PUBLIC_INDEXER_API_URL || 'https://indexer-backend-production.up.railway.app'
).replace(/\/+$/, '')

const f = (path: string, token: string, opts?: RequestInit) => apiFetch(BASE, path, token, opts)

export const indexerApi = {
  getQuota: (token: string) => f('/api/indexer/quota', token),
  submitUrls: (token: string, urls: string[], name?: string, clientProfileId?: string) =>
    f('/api/indexer/submit', token, {
      method: 'POST',
      body: JSON.stringify({ urls, name, client_profile_id: clientProfileId || null }),
    }),
  previewSitemap: (token: string, sitemapUrl: string) =>
    f('/api/indexer/preview-sitemap', token, {
      method: 'POST',
      body: JSON.stringify({ sitemap_url: sitemapUrl }),
    }),
  submitSitemap: (token: string, sitemapUrl: string, name?: string, clientProfileId?: string) =>
    f('/api/indexer/submit-sitemap', token, {
      method: 'POST',
      body: JSON.stringify({ sitemap_url: sitemapUrl, name, client_profile_id: clientProfileId || null }),
    }),
  resubmitUrls: (token: string, urls: string[], name?: string, clientProfileId?: string) =>
    f('/api/indexer/resubmit', token, {
      method: 'POST',
      body: JSON.stringify({ urls, name, client_profile_id: clientProfileId || null }),
    }),
  listJobs: (token: string, clientProfileId?: ClientJobFilter) => f(clientScopedJobsPath(clientProfileId), token),
  getJob: (token: string, id: string) => f(`/api/jobs/${id}`, token),
  deleteJob: (token: string, id: string) => f(`/api/jobs/${id}`, token, { method: 'DELETE' }),
}
