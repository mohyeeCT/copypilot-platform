import { apiFetch, clientScopedJobsPath, type ClientJobFilter } from './shared'

const BASE = (
  process.env.NEXT_PUBLIC_SCHEMA_API_URL || 'https://schema-saas-backend-production.up.railway.app'
).replace(/\/+$/, '')

const f = (path: string, token: string, opts?: RequestInit) => apiFetch(BASE, path, token, opts)

export const schemaApi = {
  runJob:    (token: string, payload: object) => f('/api/schema/run', token, { method: 'POST', body: JSON.stringify(payload) }),
  listJobs:  (token: string, clientProfileId?: ClientJobFilter) => f(clientScopedJobsPath(clientProfileId), token),
  getJob:    (token: string, id: string)      => f(`/api/jobs/${id}`, token),
  deleteJob: (token: string, id: string)      => f(`/api/jobs/${id}`, token, { method: 'DELETE' }),
  cancelJob: (token: string, id: string)      => f(`/api/jobs/${id}/cancel`, token, { method: 'POST' }),
  duplicateJob: (token: string, id: string)   => f(`/api/jobs/${id}/duplicate`, token, { method: 'POST' }),
  renameJob: (token: string, id: string, name: string) =>
    f(`/api/jobs/${id}/rename`, token, { method: 'PATCH', body: JSON.stringify({ name }) }),
}
