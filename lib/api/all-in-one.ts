import { apiFetch } from './shared'

const BASE = (
  process.env.NEXT_PUBLIC_AIO_API_URL || 'https://all-in-one-saas-backend-production.up.railway.app'
).replace(/\/+$/, '')

const f = (path: string, token: string, opts?: RequestInit) => apiFetch(BASE, path, token, opts)

export const aioApi = {
  runJob:       (token: string, payload: object) => f('/api/all-in-one/run', token, { method: 'POST', body: JSON.stringify(payload) }),
  listJobs:     (token: string)                  => f('/api/jobs', token),
  getJob:       (token: string, id: string)      => f(`/api/jobs/${id}`, token),
  deleteJob:    (token: string, id: string)      => f(`/api/jobs/${id}`, token, { method: 'DELETE' }),
  getTemplates: (token: string)                  => f('/api/all-in-one/templates', token),
  rerunRow:     (token: string, id: string, index: number, scraperOverride?: 'firecrawl') =>
    f(`/api/jobs/${id}/rerun-row/${index}`, token, {
      method: 'POST',
      body: JSON.stringify({ scraper_override: scraperOverride || '' }),
    }),
  rerunRows:    (token: string, id: string, indices: number[]) =>
    f(`/api/jobs/${id}/rerun-rows`, token, { method: 'POST', body: JSON.stringify({ row_indices: indices }) }),
  rerunSection: (token: string, id: string, rowIndex: number, sectionName: string, reviewerInstruction = '') =>
    f(`/api/jobs/${id}/rerun-section`, token, { method: 'POST', body: JSON.stringify({ row_index: rowIndex, section_name: sectionName, reviewer_instruction: reviewerInstruction }) }),
  cancelJob:    (token: string, id: string)               => f(`/api/jobs/${id}/cancel`, token, { method: 'POST' }),
  duplicateJob: (token: string, id: string)               => f(`/api/jobs/${id}/duplicate`, token, { method: 'POST' }),
  renameJob:    (token: string, id: string, name: string) =>
    f(`/api/jobs/${id}/rename`, token, { method: 'PATCH', body: JSON.stringify({ name }) }),
}
