'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Upload, Trash2, CheckCircle, ExternalLink, Github, Server, Tag, Zap, KeyRound, Key, Globe, Cpu, Info } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import AppLayout from '@/components/layout/AppLayout'
import CustomSelect from '@/components/ui/CustomSelect'
import { createClient } from '@/lib/supabase'
import { getSettings, saveSettings, deleteGscAccount, getProviderMetadata, saveProviderCredentials, deleteCredentials, listBrandProfiles, createBrandProfile, updateBrandProfile, deleteBrandProfile, startGscOAuth, listGscProperties, disconnectGscOAuth, setGscAuthMethod, type GscAuthMethod, type GscProperty, type GscSettings } from '@/lib/api/shared'
import BrandProfilesCard from '@/components/ui/BrandProfilesCard'

export const dynamic = 'force-dynamic'

const VERSION = 'v3.0'
const FRONTEND_URL = 'copypilot.app'
const BACKEND_REPO = 'https://github.com/mohyeeCT/copypilot-platform'
const FRONTEND_REPO = 'https://github.com/mohyeeCT/copypilot-platform'
const BACKENDS = [
  { label: 'FAQ Copy',    url: 'faq-saas-backend-production.up.railway.app' },
  { label: 'Page Intro',  url: 'intro-saas-backend-production.up.railway.app' },
  { label: 'Meta Copy',   url: 'meta-saas-backend-production.up.railway.app' },
  { label: 'All in One',  url: 'all-in-one-saas-backend-production.up.railway.app' },
  { label: 'Schema Generator', url: 'schema-saas-backend-production.up.railway.app' },
]

function SearchConsoleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="9" y="12" width="30" height="27" rx="4" fill="#F1F5F9" />
      <rect x="9" y="12" width="30" height="8" rx="4" fill="#CBD5E1" />
      <rect x="14" y="7" width="20" height="9" rx="3" fill="#E2E8F0" />
      <rect x="18" y="9" width="12" height="3" rx="1.5" fill="#94A3B8" />
      <path d="M17 30h4.5l3-5 3.2 8 3.1-5H36" fill="none" stroke="#4285F4" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="25" r="3.5" fill="#34A853" />
      <path d="M31 33l5 5" stroke="#4285F4" strokeWidth="3" strokeLinecap="round" />
      <circle cx="29.5" cy="31.5" r="5" fill="none" stroke="#4285F4" strokeWidth="2.6" />
    </svg>
  )
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'credentials' | 'gsc' | 'brand' | 'about'>('credentials')
  const toast = useToast()
  const [gscSettings, setGscSettings] = useState<GscSettings | null>(null)
  const [gscProperties, setGscProperties] = useState<GscProperty[]>([])
  const [gscPropertiesExpanded, setGscPropertiesExpanded] = useState(false)
  const [gscBusy, setGscBusy] = useState<'connect' | 'disconnect' | 'method' | 'properties' | null>(null)
  const [gscMessage, setGscMessage] = useState('')
  const [gscIsError, setGscIsError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [backendStatuses, setBackendStatuses] = useState<Record<string, 'checking' | 'ok' | 'error'>>(
    Object.fromEntries(BACKENDS.map(b => [b.url, 'checking' as const]))
  )

  // Credentials state
  const [credsConfigured, setCredsConfigured] = useState(false)
  const [credsProvider, setCredsProvider] = useState('')
  const [credsSaving, setCredsSaving] = useState(false)
  const [credsDeleting, setCredsDeleting] = useState(false)
  const [credsSaved, setCredsSaved] = useState(false)
  const [credsError, setCredsError] = useState('')
  const [showCredsForm, setShowCredsForm] = useState(false)
  const [credsForm, setCredsForm] = useState({ provider: 'Claude', api_key: '', dfs_login: '', dfs_password: '', jina_api_key: '', site_url: '' })



  function showGscMessage(message: string, isError = false) {
    setGscMessage(message)
    setGscIsError(isError)
  }

  function clearGscMessage() {
    setGscMessage('')
    setGscIsError(false)
  }

  function gscStatusText(settings: GscSettings | null): string {
    const oauth = settings?.google_oauth
    if (!oauth?.configured) return 'Connect Google to use Search Console data.'
    if (oauth.status === 'reconnect_required') return 'Reconnect to restore Search Console data.'
    return 'Ready for Search Console keyword data.'
  }

  async function loadGscSettings(): Promise<boolean> {
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) return false
      const data = await getSettings(session.access_token)
      if (data.gsc) {
        setGscSettings(data.gsc as GscSettings)
      } else if (data.gsc_service_account?.configured) {
        setGscSettings({
          active_method: 'service_account',
          service_account: { configured: true, client_email: data.gsc_service_account.client_email },
          google_oauth: { configured: false, email: '', status: 'not_connected' },
          oauth_available: false,
        })
      } else {
        setGscSettings(null)
      }
      return true
    } catch (e) {
      console.error('Failed to load GSC settings:', e)
      return false
    }
  }

  useEffect(() => {
    async function load() {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) return
      try {
        const data = await getSettings(session.access_token)
        if (data.gsc) {
          setGscSettings(data.gsc as GscSettings)
        } else if (data.gsc_service_account?.configured) {
          setGscSettings({
            active_method: 'service_account',
            service_account: { configured: true, client_email: data.gsc_service_account.client_email },
            google_oauth: { configured: false, email: '', status: 'not_connected' },
            oauth_available: false,
          })
        }
        if (data.provider_settings?.has_api_key) {
          setCredsConfigured(true)
          setCredsProvider(data.provider_settings.provider || '')
        }
      } catch (e) {
        console.error('Failed to load settings on mount:', e)
      }
    }
    async function checkBackends() {
      await Promise.all(BACKENDS.map(async b => {
        try {
          const res = await fetch(`https://${b.url}/health`)
          setBackendStatuses(prev => ({ ...prev, [b.url]: res.ok ? 'ok' : 'error' }))
        } catch {
          setBackendStatuses(prev => ({ ...prev, [b.url]: 'error' }))
        }
      }))
    }
    load()
    checkBackends()
  }, [])

  useEffect(() => {
    const callbackUrl = new URL(window.location.href)
    const gscStatus = callbackUrl.searchParams.get('gsc')
    if (!gscStatus) return
    const messages: Record<string, { text: string; isError: boolean }> = {
      connected: { text: 'Google account connected successfully.', isError: false },
      cancelled: { text: 'Google account connection was cancelled.', isError: false },
      state_invalid: { text: 'Connection could not be verified. Please try again.', isError: true },
      token_failed: { text: 'Could not retrieve access credentials. Please try again.', isError: true },
      identity_failed: { text: 'Could not verify Google account identity. Please try again.', isError: true },
      failed: { text: 'Google account connection failed. Please try again.', isError: true },
    }
    const msg = messages[gscStatus]
    if (msg) showGscMessage(msg.text, msg.isError)
    if (gscStatus === 'connected') void loadGscSettings()
    callbackUrl.searchParams.delete('gsc')
    window.history.replaceState({}, '', `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`)
  }, [])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) return
      setSaving(true)
      await saveSettings(session.access_token, { gsc_service_account: json })
      setGscSettings(prev => prev
        ? { ...prev, service_account: { configured: true, client_email: json.client_email || '' } }
        : { active_method: 'service_account', service_account: { configured: true, client_email: json.client_email || '' }, google_oauth: { configured: false, email: '', status: 'not_connected' }, oauth_available: false }
      )
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('Invalid service account JSON file')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) return
    setDeleting(true)
    try {
      await deleteGscAccount(session.access_token)
      const refreshed = await loadGscSettings()
      if (!refreshed) {
        setGscSettings(prev => prev ? { ...prev, service_account: { configured: false } } : null)
        showGscMessage('Service account removed. Could not refresh settings; please reload.', true)
      } else {
        showGscMessage('Service account removed.')
      }
    } catch (e) {
      console.error('Failed to delete GSC account:', e)
      showGscMessage('Failed to remove service account. Please try again.', true)
    } finally {
      setDeleting(false)
    }
  }

  async function handleConnectGoogle() {
    setGscBusy('connect')
    clearGscMessage()
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) {
        showGscMessage('Your session has expired. Please sign in again.', true)
        return
      }
      const result = await startGscOAuth(session.access_token, true)
      const url = new URL(result.authorization_url)
      if (url.protocol !== 'https:' || url.hostname !== 'accounts.google.com') {
        throw new Error('Invalid authorization URL')
      }
      window.location.href = result.authorization_url
    } catch {
      showGscMessage('Failed to start Google connection. Please try again.', true)
    } finally {
      setGscBusy(null)
    }
  }

  async function handleDisconnectGoogle() {
    setGscBusy('disconnect')
    clearGscMessage()
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) {
        showGscMessage('Your session has expired. Please sign in again.', true)
        return
      }
      await disconnectGscOAuth(session.access_token)
    } catch {
      showGscMessage('Failed to disconnect Google account. Please try again.', true)
      setGscBusy(null)
      return
    }

    const refreshed = await loadGscSettings()
    if (!refreshed) {
      setGscSettings(prev => prev ? {
        ...prev,
        google_oauth: { configured: false, email: '', status: 'not_connected' },
      } : null)
      showGscMessage('Google account disconnected. Could not refresh settings; please reload.', true)
    } else {
      showGscMessage('Google account disconnected.')
    }
    setGscProperties([])
    setGscBusy(null)
  }

  async function handleSetMethod(method: GscAuthMethod) {
    setGscBusy('method')
    clearGscMessage()
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) return
      await setGscAuthMethod(session.access_token, method)
      setGscSettings(prev => prev ? { ...prev, active_method: method } : prev)
    } catch {
      showGscMessage('Failed to update active method. Please try again.', true)
    } finally {
      setGscBusy(null)
    }
  }

  async function handleLoadProperties() {
    if (gscPropertiesExpanded) {
      setGscPropertiesExpanded(false)
      return
    }
    if (gscProperties.length > 0) {
      setGscPropertiesExpanded(true)
      return
    }
    setGscBusy('properties')
    clearGscMessage()
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) return
      const result = await listGscProperties(session.access_token)
      setGscProperties(result.properties || [])
      setGscPropertiesExpanded(true)
    } catch {
      showGscMessage('Failed to load Search Console properties.', true)
    } finally {
      setGscBusy(null)
    }
  }

  async function handleDeleteCreds() {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) return
    setCredsDeleting(true)
    try {
      await deleteCredentials(session.access_token)
      setCredsConfigured(false)
      setCredsProvider('')
      setShowCredsForm(false)
    } catch (e) {
      console.error('Failed to delete credentials:', e)
    }
    setCredsDeleting(false)
  }



  async function handleSaveCreds() {
    if (!credsConfigured && !credsForm.api_key.trim()) { setCredsError('API key is required'); return }
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) return
    setCredsSaving(true)
    setCredsError('')
    try {
      await saveProviderCredentials(session.access_token, credsForm)
      setCredsConfigured(true)
      setCredsProvider(credsForm.provider)
      setShowCredsForm(false)
      setCredsSaved(true)
      setTimeout(() => setCredsSaved(false), 2000)
    } catch { setCredsError('Failed to save credentials') }
    setCredsSaving(false)
  }

  return (
    <AppLayout>
      <div className="max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted text-sm mt-1">Configure integrations for your account</p>
        </div>

        {gscMessage && (
          <p
            role="status"
            aria-live="polite"
            className={`text-xs mb-4 ${gscIsError ? 'text-error' : 'text-accent'}`}
          >
            {gscMessage}
          </p>
        )}

        {/* Google Search Console — Google account */}
        <div className="card p-6 mb-4">
          <div className="flex items-start gap-4 mb-5">
            <SearchConsoleIcon className="w-11 h-11 shrink-0" />
            <div>
              <h2 className="font-semibold text-sm">Google account</h2>
              <p className="text-muted text-xs mt-0.5">Preferred for FAQ, Intro, Meta, and All-in-One Search Console data.</p>
            </div>
          </div>

          {gscSettings && gscSettings.google_oauth.configured ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-accent/5 border border-accent/20 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <CheckCircle size={15} className="text-accent shrink-0" />
                  <div>
                    <p className="text-xs font-medium">
                      Connected as {gscSettings.google_oauth.email}
                    </p>
                    <p
                      className="text-xs mt-0.5"
                      style={gscSettings.google_oauth.status === 'reconnect_required' ? { color: 'rgb(251 191 36)' } : undefined}
                    >
                      {gscStatusText(gscSettings)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {gscSettings.active_method === 'google_oauth' ? (
                    <span className="text-xs text-accent font-medium">Active</span>
                  ) : (
                    <button
                      onClick={() => handleSetMethod('google_oauth')}
                      disabled={!!gscBusy}
                      className="text-xs text-muted hover:text-accent transition-colors disabled:opacity-50"
                    >
                      Use Google account
                    </button>
                  )}
                  <button
                    onClick={handleDisconnectGoogle}
                    disabled={!!gscBusy}
                    className="flex items-center gap-1.5 text-xs text-muted hover:text-error transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                    {gscBusy === 'disconnect' ? 'Disconnecting...' : 'Disconnect'}
                  </button>
                </div>
              </div>
              {gscSettings.google_oauth.status === 'reconnect_required' && gscSettings.oauth_available && (
                <button
                  onClick={handleConnectGoogle}
                  disabled={!!gscBusy}
                  className="btn-primary text-xs px-4 py-2"
                >
                  {gscBusy === 'connect' ? 'Connecting...' : 'Reconnect Google'}
                </button>
              )}
              <div>
                <button
                  onClick={handleLoadProperties}
                  disabled={!!gscBusy}
                  className="text-xs text-muted hover:text-accent transition-colors disabled:opacity-50"
                >
                  {gscBusy === 'properties' ? 'Loading...' : gscPropertiesExpanded ? 'Hide accessible properties' : 'View accessible properties'}
                </button>
                {gscPropertiesExpanded && gscProperties.length > 0 && (
                  <div className="mt-2 space-y-1 border border-border rounded-lg p-3">
                    {gscProperties.map(p => (
                      <div key={p.site_url} className="flex items-center justify-between">
                        <span className="text-xs font-mono text-text">{p.site_url}</span>
                        <span className="text-xs text-muted">{p.permission_level}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : gscSettings && gscSettings.oauth_available ? (
            <div className="space-y-3">
              <p className="text-xs text-muted">{gscStatusText(gscSettings)}</p>
              <button
                onClick={handleConnectGoogle}
                disabled={gscBusy === 'connect'}
                className="btn-primary text-xs px-4 py-2"
              >
                {gscBusy === 'connect' ? 'Connecting...' : 'Connect Google'}
              </button>
            </div>
          ) : null}

        </div>

        {/* Google Search Console — Service account */}
        <div className="card p-6 mb-4">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-sm">Service account</h2>
              <p className="text-muted text-xs mt-0.5">Service account remains available for fallback, legacy workflows, and Indexer.</p>
            </div>
          </div>

          {gscSettings && gscSettings.service_account.configured ? (
            <div className="flex items-center justify-between bg-accent/5 border border-accent/20 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <CheckCircle size={15} className="text-accent shrink-0" />
                <div>
                  <p className="text-xs font-medium">Service account connected</p>
                  <p className="text-xs text-muted font-mono mt-0.5">{gscSettings.service_account.client_email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {gscSettings.active_method === 'service_account' ? (
                  <span className="text-xs text-accent font-medium">Active</span>
                ) : (
                  <button
                    onClick={() => handleSetMethod('service_account')}
                    disabled={!!gscBusy}
                    className="text-xs text-muted hover:text-accent transition-colors disabled:opacity-50"
                  >
                    Use service account
                  </button>
                )}
                <button onClick={handleDelete} disabled={!!gscBusy || deleting}
                  className="flex items-center gap-1.5 text-xs text-muted hover:text-error transition-colors disabled:opacity-50">
                  <Trash2 size={12} />
                  {deleting ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-border/50 group-hover:bg-accent/10 flex items-center justify-center mb-3 transition-colors">
                <Upload size={18} className="text-muted group-hover:text-accent transition-colors" />
              </div>
              <span className="text-sm font-medium text-muted group-hover:text-text transition-colors">
                {saving ? 'Saving...' : 'Upload service account JSON'}
              </span>
              <span className="text-xs text-muted/50 mt-1">From Google Cloud Console &gt; Service Accounts</span>
              <input type="file" accept=".json" className="hidden" onChange={handleUpload} disabled={saving} />
            </label>
          )}

          {saved && <p className="text-accent text-xs mt-3 flex items-center gap-1.5"><CheckCircle size={11} /> Saved successfully</p>}
          {error && <p className="text-error text-xs mt-3">{error}</p>}

          <p className="text-xs text-muted mt-4">
            Keep a service account if you use Indexer. Google OAuth is preferred for Search Console copy tools; service account remains available. Google account connection currently covers Search Console data only.
          </p>
        </div>

        {/* Credentials */}
        <div className="card p-6 mb-4">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
              <KeyRound size={15} className="text-purple-400" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">API Credentials</h2>
              <p className="text-muted text-xs mt-0.5">Saved credentials are used securely by the backends and are never shown again.</p>
            </div>
          </div>

          {credsConfigured && !showCredsForm ? (
            <div className="flex items-center justify-between bg-accent/5 border border-accent/20 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <CheckCircle size={15} className="text-accent shrink-0" />
                <div>
                  <p className="text-xs font-medium">Credentials saved</p>
                  <p className="text-xs text-muted mt-0.5">{credsProvider} API key + DataForSEO{credsForm.site_url ? ` · ${credsForm.site_url}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={async () => {
                  const sb = createClient()
                  const { data: { session } } = await sb.auth.getSession()
                  if (session) {
                    try {
                      const creds = await getProviderMetadata(session.access_token)
                      if (creds) setCredsForm({ provider: creds.provider || 'Claude', api_key: creds.api_key || '', dfs_login: creds.dfs_login || '', dfs_password: creds.dfs_password || '', jina_api_key: creds.jina_api_key || '', site_url: creds.site_url || '' })
                    } catch (e) {
                      console.error('Failed to pre-fill credentials form:', e)
                    }
                  }
                  setShowCredsForm(true)
                }} className="text-xs text-muted hover:text-accent transition-colors">Update</button>
                <button onClick={handleDeleteCreds} disabled={credsDeleting} className="flex items-center gap-1.5 text-xs text-muted hover:text-error transition-colors">
                  <Trash2 size={12} />{credsDeleting ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted block mb-1">AI Provider</label>
                  <CustomSelect value={credsForm.provider} onChange={value => setCredsForm(f => ({ ...f, provider: value }))}
                    options={['Claude', 'OpenAI', 'Gemini (free)', 'Mistral (free tier)', 'Groq (free tier)']} className="text-xs w-full" />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">API Key</label>
                  <input type="password" value={credsForm.api_key} onChange={e => setCredsForm(f => ({ ...f, api_key: e.target.value }))} className="input-base text-xs w-full" placeholder={credsConfigured ? 'Leave blank to keep saved key' : 'sk-...'} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted block mb-1">DataForSEO Login</label>
                  <input value={credsForm.dfs_login} onChange={e => setCredsForm(f => ({ ...f, dfs_login: e.target.value }))} className="input-base text-xs w-full" placeholder="email@example.com" />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">DataForSEO Password</label>
                  <input type="password" value={credsForm.dfs_password} onChange={e => setCredsForm(f => ({ ...f, dfs_password: e.target.value }))} className="input-base text-xs w-full" placeholder={credsConfigured ? 'Leave blank to keep saved password' : ''} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Jina API Key <span className="text-muted/50">(optional)</span></label>
                <input type="password" value={credsForm.jina_api_key} onChange={e => setCredsForm(f => ({ ...f, jina_api_key: e.target.value }))} className="input-base text-xs w-full" placeholder={credsConfigured ? 'Leave blank to keep saved key' : ''} />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">GSC Site URL <span className="text-muted/50">(pre-fills on every new job)</span></label>
                <input value={credsForm.site_url} onChange={e => setCredsForm(f => ({ ...f, site_url: e.target.value }))} className="input-base text-xs w-full font-mono" placeholder="https://yoursite.com" />
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button onClick={handleSaveCreds} disabled={credsSaving} className="btn-primary text-xs px-4 py-2">
                  {credsSaving ? 'Saving...' : 'Save credentials'}
                </button>
                {credsConfigured && <button onClick={() => setShowCredsForm(false)} className="text-xs text-muted hover:text-text transition-colors">Cancel</button>}
              </div>
              {credsSaved && <p className="text-accent text-xs flex items-center gap-1.5"><CheckCircle size={11} /> Saved</p>}
              {credsError && <p className="text-error text-xs">{credsError}</p>}
            </div>
          )}
        </div>

        {/* Brand Profiles */}
        <BrandProfilesCard
          listBrandProfiles={listBrandProfiles}
          createBrandProfile={createBrandProfile}
          updateBrandProfile={updateBrandProfile}
          deleteBrandProfile={deleteBrandProfile}
        />

        <div className="card overflow-hidden">
          <div className="px-6 py-5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image src="/favicon-32x32.png" alt="FAQ Production" width={24} height={24} className="w-6 h-6" />
              <div>
                <p className="font-semibold text-sm">CopyPilot</p>
                <p className="text-xs text-muted">AI-powered SEO copy production platform</p>
              </div>
            </div>
            <a
              href="https://copypilot.app/changelog"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-mono bg-accent/10 text-accent border border-accent/20 px-2.5 py-1 rounded-full hover:bg-accent/20 transition-colors"
            >
              {VERSION}
            </a>
          </div>

          <div className="divide-y divide-border">
            {BACKENDS.map(b => {
              const status = backendStatuses[b.url] ?? 'checking'
              return (
                <div key={b.url} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Server size={13} className="text-muted shrink-0" />
                    <div>
                      <p className="text-xs font-medium">{b.label}</p>
                      <p className="text-xs text-muted font-mono mt-0.5">{b.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-1.5 text-xs ${status === 'ok' ? 'text-accent' : status === 'error' ? 'text-error' : 'text-muted'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${status === 'ok' ? 'bg-accent animate-pulse' : status === 'error' ? 'bg-error' : 'bg-muted animate-pulse'}`} />
                      {status === 'ok' ? 'Operational' : status === 'error' ? 'Unreachable' : 'Checking...'}
                    </div>
                    <a href={`https://${b.url}/health`} target="_blank" rel="noreferrer" className="text-muted hover:text-accent transition-colors">
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              )
            })}

            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap size={14} className="text-muted shrink-0" />
                <div>
                  <p className="text-xs font-medium">Frontend</p>
                  <p className="text-xs text-muted font-mono mt-0.5">{FRONTEND_URL}</p>
                </div>
              </div>
              <a href={`https://${FRONTEND_URL}`} target="_blank" rel="noreferrer" className="text-muted hover:text-accent transition-colors">
                <ExternalLink size={12} />
              </a>
            </div>

            <div className="px-6 py-4 flex items-center gap-8">
              <div className="flex items-center gap-2 text-xs text-muted shrink-0">
                <Github size={13} />
                <span>Repos</span>
              </div>
              <div className="flex items-center gap-4">
                <a href={BACKEND_REPO} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors font-mono">
                  Railway backends <ExternalLink size={10} />
                </a>
                <a href={FRONTEND_REPO} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors font-mono">
                  copypilot-platform <ExternalLink size={10} />
                </a>
              </div>
            </div>

            <div className="px-6 py-4">
              <div className="flex items-center gap-2 text-xs text-muted mb-3">
                <Tag size={13} />
                <span>Stack</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {['FastAPI', 'Next.js 14', 'Supabase', 'Railway', 'Vercel', 'DataForSEO', 'Jina Reader', 'Claude', 'OpenAI', 'Gemini', 'Mistral', 'Groq'].map(t => (
                  <span key={t} className="text-xs font-mono bg-border/60 text-muted px-2 py-0.5 rounded">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
