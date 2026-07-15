// Base fetch utility — all tool API files use this
const API_RETRY_DELAYS_MS = [500, 1500]
const RETRYABLE_STATUSES = new Set([502, 503, 504])

function isSafeRead(options: RequestInit) {
  return !options.method || options.method.toUpperCase() === 'GET'
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function apiFetch(baseUrl: string, path: string, token: string, options: RequestInit = {}) {
  const url = `${baseUrl.replace(/\/+$/, '')}${path}`
  for (let attempt = 0; attempt <= API_RETRY_DELAYS_MS.length; attempt += 1) {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    })
    if (res.ok) return res.json()

    const err = await res.json().catch(() => ({ detail: res.statusText }))
    if (
      res.status === 429 &&
      /(duplicate|rerun-row|rerun-rows|rerun-section)/.test(path) &&
      typeof window !== 'undefined'
    ) {
      window.dispatchEvent(new CustomEvent('api-rate-limit', { detail: err.detail || 'Too many requests. Please try again shortly.' }))
      throw new Error('Rate limit displayed')
    }

    if (isSafeRead(options) && RETRYABLE_STATUSES.has(res.status) && attempt < API_RETRY_DELAYS_MS.length) {
      await delay(API_RETRY_DELAYS_MS[attempt])
      continue
    }

    throw new Error(err.detail || 'Request failed')
  }
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
export async function getProviderMetadata(token: string) {
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

// GSC OAuth types and API wrappers
export type GscAuthMethod = 'service_account' | 'google_oauth'

export type GscProperty = {
  site_url: string
  permission_level: string
}

export type GscSettings = {
  active_method: GscAuthMethod
  service_account: { configured: boolean; client_email?: string }
  google_oauth: {
    configured: boolean
    email: string
    status: 'connected' | 'reconnect_required' | 'not_connected'
    has_indexing_scope?: boolean
    has_sheets_scope?: boolean
    has_docs_scope?: boolean
  }
  oauth_available: boolean
}

export type GoogleSheetExportPayload = {
  name: string
  headers: string[]
  rows: Record<string, unknown>[]
}

export type GoogleSheetsExportPayload = {
  title: string
  sheet_name?: string
  headers: string[]
  rows: Record<string, unknown>[]
  sheets?: never
} | {
  title: string
  sheets: GoogleSheetExportPayload[]
  sheet_name?: never
  headers?: never
  rows?: never
}

export type GoogleSheetsExportResult = {
  spreadsheet_id: string
  spreadsheet_url: string
}

export type GoogleDocsExportPayload = {
  title: string
  body: string
}

export type GoogleDocsExportResult = {
  document_id: string
  document_url: string
}

export async function startGscOAuth(token: string, activateOnSuccess: boolean): Promise<{ authorization_url: string }> {
  return sf('/api/settings/gsc/oauth/start', token, {
    method: 'POST',
    body: JSON.stringify({ activate_on_success: activateOnSuccess }),
  })
}

export async function listGscProperties(token: string): Promise<{ properties: GscProperty[] }> {
  return sf('/api/settings/gsc/oauth/properties', token)
}

export async function disconnectGscOAuth(token: string) {
  return sf('/api/settings/gsc/oauth', token, { method: 'DELETE' })
}

export async function setGscAuthMethod(token: string, method: GscAuthMethod) {
  return sf('/api/settings/gsc/method', token, {
    method: 'PUT',
    body: JSON.stringify({ method }),
  })
}

export async function exportToGoogleSheets(
  token: string,
  payload: GoogleSheetsExportPayload
): Promise<GoogleSheetsExportResult> {
  return sf('/api/settings/google-sheets/export', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function exportToGoogleDocs(
  token: string,
  payload: GoogleDocsExportPayload
): Promise<GoogleDocsExportResult> {
  return sf('/api/settings/google-docs/export', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
