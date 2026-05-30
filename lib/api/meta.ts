import { apiFetch } from './shared'

const BASE = (
  process.env.NEXT_PUBLIC_META_API_URL || 'https://meta-saas-backend-production.up.railway.app'
).replace(/\/+$/, '')

const f = (path: string, token: string, opts?: RequestInit) => apiFetch(BASE, path, token, opts)

export const metaApi = {
  runJob:    (token: string, payload: object) => f('/api/meta/run', token, { method: 'POST', body: JSON.stringify(payload) }),
  listJobs:  (token: string)                  => f('/api/jobs', token),
  getJob:    (token: string, id: string)      => f(`/api/jobs/${id}`, token),
  deleteJob: (token: string, id: string)      => f(`/api/jobs/${id}`, token, { method: 'DELETE' }),

  rerunRow: (token: string, id: string, index: number, kwOverride?: string) =>
    f(`/api/jobs/${id}/rerun-row/${index}`, token, {
      method: 'POST',
      body: JSON.stringify({ keyword_override: kwOverride || '' }),
    }),

  rerunRows: (token: string, id: string, indices: number[]) =>
    f(`/api/jobs/${id}/rerun-rows`, token, {
      method: 'POST',
      body: JSON.stringify({ row_indices: indices }),
    }),

  cancelJob:    (token: string, id: string)               => f(`/api/jobs/${id}/cancel`, token, { method: 'POST' }),
  duplicateJob: (token: string, id: string)               => f(`/api/jobs/${id}/duplicate`, token, { method: 'POST' }),
  renameJob:    (token: string, id: string, name: string) =>
    f(`/api/jobs/${id}/rename`, token, { method: 'PATCH', body: JSON.stringify({ name }) }),
}
