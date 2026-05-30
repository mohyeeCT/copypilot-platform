// Base fetch utility — all tool API files use this
export async function apiFetch(baseUrl: string, path: string, token: string, options: RequestInit = {}) {
  const url = `${baseUrl.replace(/\/+$/, '')}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

// Settings and brand profiles are shared across all tools.
// They use any tool's backend since they hit the same Supabase instance.
// We use the FAQ backend as the canonical settings endpoint.
const SETTINGS_BASE = (
  process.env.NEXT_PUBLIC_FAQ_API_URL || 'https://faq-saas-backend-production.up.railway.app'
).replace(/\/+$/, '')

function sf(path: string, token: string, options?: RequestInit) {
  return apiFetch(SETTINGS_BASE, path, token, options)
}

export async function getSettings(token: string) {
  return sf('/api/settings', token)
}
export async function saveSettings(token: string, payload: object) {
  return sf('/api/settings', token, { method: 'PUT', body: JSON.stringify(payload) })
}
export async function deleteGscAccount(token: string) {
  return sf('/api/settings/gsc', token, { method: 'DELETE' })
}
export async function getProviderCredentials(token: string) {
  return sf('/api/settings/provider-credentials', token)
}
export async function saveProviderCredentials(token: string, payload: object) {
  return sf('/api/settings', token, { method: 'PUT', body: JSON.stringify({ provider_settings: payload }) })
}
export async function deleteCredentials(token: string) {
  return sf('/api/settings/credentials', token, { method: 'DELETE' })
}
export async function listBrandProfiles(token: string) {
  return sf('/api/settings/brand-profiles', token)
}
export async function createBrandProfile(token: string, name: string, data: object) {
  return sf('/api/settings/brand-profiles', token, { method: 'POST', body: JSON.stringify({ name, data }) })
}
export async function updateBrandProfile(token: string, id: string, name: string, data: object) {
  return sf(`/api/settings/brand-profiles/${id}`, token, { method: 'PUT', body: JSON.stringify({ name, data }) })
}
export async function deleteBrandProfile(token: string, id: string) {
  return sf(`/api/settings/brand-profiles/${id}`, token, { method: 'DELETE' })
}
export async function listTemplates(token: string, tool: string) {
  return sf(`/api/settings/templates?tool=${tool}`, token)
}
export async function saveTemplate(token: string, name: string, settings: object, tool: string) {
  return sf('/api/settings/templates', token, { method: 'POST', body: JSON.stringify({ name, tool, settings }) })
}
export async function deleteTemplate(token: string, templateId: string) {
  return sf(`/api/settings/templates/${templateId}`, token, { method: 'DELETE' })
}
