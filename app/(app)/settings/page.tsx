'use client'
import { useEffect, useState } from 'react'
import { Activity, BadgeCheck, KeyRound, Upload, Trash2, CheckCircle, Server, Zap } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import settingsStyles from '@/components/settings/SettingsWorkspace.module.css'
import CustomSelect from '@/components/ui/CustomSelect'
import { JobLauncherShell, JobSection, JobSummaryBar, JobSummaryPills } from '@/components/ui/JobLauncher'
import { createClient } from '@/lib/supabase'
import { getSettings, saveSettings, deleteGscAccount, getProviderMetadata, saveProviderCredentials, deleteCredentials, listBrandProfiles, createBrandProfile, updateBrandProfile, deleteBrandProfile, startGscOAuth, listGscProperties, disconnectGscOAuth, setGscAuthMethod, type GscAuthMethod, type GscProperty, type GscSettings } from '@/lib/api/shared'
import BrandProfilesCard from '@/components/ui/BrandProfilesCard'

export const dynamic = 'force-dynamic'

const VERSION = 'v3.0'
const BACKENDS = [
  { label: 'FAQ Copy',    url: 'faq-saas-backend-production.up.railway.app' },
  { label: 'Page Intro',  url: 'intro-saas-backend-production.up.railway.app' },
  { label: 'Meta Copy',   url: 'meta-saas-backend-production.up.railway.app' },
  { label: 'All in One',  url: 'all-in-one-saas-backend-production.up.railway.app' },
  { label: 'Schema Generator', url: 'schema-saas-backend-production.up.railway.app' },
  { label: 'Indexer', url: 'indexer-backend-production.up.railway.app' },
  { label: 'Brand Pulse', url: 'brand-mentions-saas-backend-production.up.railway.app' },
  { label: 'GEOPilot', url: 'geopilot-backend-production.up.railway.app' },
]
const AI_PROVIDERS = ['Claude', 'OpenAI', 'Gemini (free)', 'Mistral (free tier)', 'Groq (free tier)']

export default function SettingsPage() {
  const [activeView, setActiveView] = useState<'connections' | 'profiles' | 'platform'>('connections')
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
  const [providerKeyStatus, setProviderKeyStatus] = useState<Record<string, boolean>>({})
  const [dfsConfigured, setDfsConfigured] = useState(false)
  const [jinaKeyConfigured, setJinaKeyConfigured] = useState(false)
  const [firecrawlKeyConfigured, setFirecrawlKeyConfigured] = useState(false)
  const [parallelKeyConfigured, setParallelKeyConfigured] = useState(false)
  const [credsSaving, setCredsSaving] = useState(false)
  const [credsDeleting, setCredsDeleting] = useState(false)
  const [credsSaved, setCredsSaved] = useState(false)
  const [credsError, setCredsError] = useState('')
  const [showCredsForm, setShowCredsForm] = useState(false)
  const [credsForm, setCredsForm] = useState({ provider: 'Claude', api_key: '', dfs_login: '', dfs_password: '', jina_api_key: '', firecrawl_api_key: '', parallel_api_key: '', site_url: '' })



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
    const missingExports = oauth.has_sheets_scope === false || oauth.has_docs_scope === false
    const missingAnalytics = oauth.has_analytics_scope === false
    if (oauth.status === 'connected' && oauth.has_indexing_scope === false && missingExports) {
      return 'Reconnect to enable Indexer submissions and Google exports.'
    }
    if (oauth.status === 'connected' && oauth.has_indexing_scope === false) return 'Reconnect to enable Indexer submissions.'
    if (oauth.status === 'connected' && missingExports) return 'Reconnect to enable Google Sheets and Docs exports.'
    if (oauth.status === 'connected' && missingAnalytics) return 'Reconnect to enable GEOPilot Analytics attribution.'
    if (oauth.status === 'reconnect_required') return 'Reconnect to restore Search Console data.'
    return 'Ready for Search Console, Indexer, Google exports, and GEOPilot Analytics attribution.'
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
        if (data.provider_settings) {
          const status = data.provider_settings.api_key_status || {}
          setProviderKeyStatus(status)
          const hasDfsCredentials = Boolean(data.provider_settings.dfs_login && data.provider_settings.has_dfs_password)
          const hasJinaKey = Boolean(data.provider_settings.has_jina_key)
          const hasFirecrawlKey = Boolean(data.provider_settings.has_firecrawl_key)
          const hasParallelKey = Boolean(data.provider_settings.has_parallel_key)
          setDfsConfigured(hasDfsCredentials)
          setJinaKeyConfigured(hasJinaKey)
          setFirecrawlKeyConfigured(hasFirecrawlKey)
          setParallelKeyConfigured(hasParallelKey)
          setCredsConfigured(Boolean(data.provider_settings.has_api_key || Object.values(status).some(Boolean) || hasDfsCredentials || hasJinaKey || hasFirecrawlKey || hasParallelKey))
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

  function needsGoogleScopeRefresh(settings: GscSettings | null): boolean {
    return Boolean(
      settings?.google_oauth.configured &&
      settings.google_oauth.status === 'connected' &&
      (
        settings.google_oauth.has_indexing_scope === false ||
        settings.google_oauth.has_sheets_scope === false ||
        settings.google_oauth.has_docs_scope === false ||
        settings.google_oauth.has_analytics_scope === false
      )
    )
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
      setProviderKeyStatus({})
      setDfsConfigured(false)
      setJinaKeyConfigured(false)
      setFirecrawlKeyConfigured(false)
      setParallelKeyConfigured(false)
      setShowCredsForm(false)
    } catch (e) {
      console.error('Failed to delete credentials:', e)
    }
    setCredsDeleting(false)
  }



  async function handleSaveCreds() {
    const selectedProviderHasKey = Boolean(providerKeyStatus[credsForm.provider])
    const isAddingDfsCredentials = Boolean(credsForm.dfs_login.trim() && credsForm.dfs_password)
    const isAddingJinaKey = Boolean(credsForm.jina_api_key.trim())
    const isAddingFirecrawlKey = Boolean(credsForm.firecrawl_api_key.trim())
    if (!selectedProviderHasKey && !credsForm.api_key.trim() && !credsForm.parallel_api_key.trim() && !jinaKeyConfigured && !isAddingJinaKey && !firecrawlKeyConfigured && !isAddingFirecrawlKey && !dfsConfigured && !isAddingDfsCredentials) {
      setCredsError('Add an AI, scraping, Parallel, or DataForSEO credential')
      return
    }
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) return
    setCredsSaving(true)
    setCredsError('')
    try {
      await saveProviderCredentials(session.access_token, credsForm)
      const nextStatus = credsForm.api_key.trim()
        ? { ...providerKeyStatus, [credsForm.provider]: true }
        : providerKeyStatus
      const hasDfsCredentials = dfsConfigured || isAddingDfsCredentials
      const hasJinaKey = jinaKeyConfigured || isAddingJinaKey
      const hasFirecrawlKey = firecrawlKeyConfigured || isAddingFirecrawlKey
      const hasParallelKey = parallelKeyConfigured || Boolean(credsForm.parallel_api_key.trim())
      setProviderKeyStatus(nextStatus)
      setDfsConfigured(hasDfsCredentials)
      setJinaKeyConfigured(hasJinaKey)
      setFirecrawlKeyConfigured(hasFirecrawlKey)
      setParallelKeyConfigured(hasParallelKey)
      setCredsConfigured(Object.values(nextStatus).some(Boolean) || hasDfsCredentials || hasJinaKey || hasFirecrawlKey || hasParallelKey)
      setCredsProvider(credsForm.provider)
      setCredsForm(f => ({ ...f, api_key: '', dfs_password: '', jina_api_key: '', firecrawl_api_key: '', parallel_api_key: '' }))
      setShowCredsForm(false)
      setCredsSaved(true)
      setTimeout(() => setCredsSaved(false), 2000)
    } catch { setCredsError('Failed to save credentials') }
    setCredsSaving(false)
  }

  const savedAiProviders = AI_PROVIDERS.filter(provider => providerKeyStatus[provider])
  const credentialSummary = [
    savedAiProviders.length
      ? `${savedAiProviders.join(', ')} API key${savedAiProviders.length === 1 ? '' : 's'}`
      : credsProvider
        ? `${credsProvider} API key`
        : '',
    parallelKeyConfigured ? 'Parallel API key' : '',
    jinaKeyConfigured ? 'Jina API key' : '',
    firecrawlKeyConfigured ? 'Firecrawl API key' : '',
    dfsConfigured ? 'DataForSEO' : '',
  ].filter(Boolean).join(' + ')

  return (
    <AppLayout>
      <div className={settingsStyles.settingsPage}>
      <JobLauncherShell
        compact
        eyebrow="Account settings"
        title="Settings"
        description="Manage saved credentials, Search Console access, brand profiles, and platform health."
        summary={
          <div className="space-y-3">
            <JobSummaryBar
              summaryItems={[
                {
                  label: 'AI keys',
                  value: savedAiProviders.length || (credsConfigured && !parallelKeyConfigured && !dfsConfigured && !jinaKeyConfigured && !firecrawlKeyConfigured ? 1 : 0),
                },
                {
                  label: 'Parallel',
                  value: parallelKeyConfigured ? 'Ready' : 'Not set',
                },
                {
                  label: 'GSC method',
                  value: gscSettings?.active_method === 'google_oauth'
                    ? 'Google'
                    : gscSettings?.active_method === 'service_account'
                      ? 'Service'
                      : 'None',
                },
                {
                  label: 'Backends',
                  value: `${Object.values(backendStatuses).filter(s => s === 'ok').length}/${BACKENDS.length}`,
                },
              ]}
            />
            <JobSummaryPills
              items={[
                { label: credsConfigured ? 'Credentials saved' : 'Credentials needed', tone: credsConfigured ? 'success' : 'muted' },
                { label: dfsConfigured ? 'DataForSEO ready' : 'DataForSEO not configured', tone: dfsConfigured ? 'success' : 'neutral' },
                { label: jinaKeyConfigured ? 'Jina ready' : 'Jina not configured', tone: jinaKeyConfigured ? 'success' : 'neutral' },
                { label: firecrawlKeyConfigured ? 'Firecrawl ready' : 'Firecrawl optional', tone: firecrawlKeyConfigured ? 'success' : 'neutral' },
                { label: parallelKeyConfigured ? 'Parallel ready' : 'Parallel not configured', tone: parallelKeyConfigured ? 'success' : 'neutral' },
                { label: gscSettings?.google_oauth.configured ? 'Google connected' : 'Google not connected', tone: gscSettings?.google_oauth.configured ? 'success' : 'muted' },
                { label: gscSettings?.service_account.configured ? 'Service account ready' : 'Service account optional', tone: gscSettings?.service_account.configured ? 'success' : 'neutral' },
              ]}
            />
          </div>
        }
      >

        {gscMessage && (
          <div
            role="status"
            aria-live="polite"
            className={`rounded-lg border px-4 py-3 text-xs ${gscIsError ? 'border-error/30 bg-error/5 text-error' : 'border-accent/25 bg-accent/5 text-accent'}`}
          >
            {gscMessage}
          </div>
        )}

        {/* Google Search Console — Google account */}
        <nav className={settingsStyles.sectionNav} aria-label="Settings sections">
          {([
            { value: 'connections', label: 'Connections', icon: KeyRound },
            { value: 'profiles', label: 'Brand profiles', icon: BadgeCheck },
            { value: 'platform', label: 'Platform', icon: Activity },
          ] as const).map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.value}
                type="button"
                data-active={activeView === item.value ? 'true' : 'false'}
                aria-pressed={activeView === item.value}
                onClick={() => setActiveView(item.value)}
              >
                <Icon size={14} /> {item.label}
              </button>
            )
          })}
        </nav>

        <div className={settingsStyles.viewPanel}>
          <div className={activeView === 'connections' ? settingsStyles.connectionsGrid : 'hidden'}>
        <div className={settingsStyles.primaryConnection}>
        <JobSection
          title="Google account"
          description="Preferred for Search Console, Indexer submissions, Google exports, and GEOPilot Analytics attribution."
          kicker="Search Console"
        >

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
              {(gscSettings.google_oauth.status === 'reconnect_required' || needsGoogleScopeRefresh(gscSettings)) && gscSettings.oauth_available && (
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

        </JobSection>

        {/* Google Search Console — Service account */}
        </div>
        <JobSection
          title="Service account"
          description="Service account remains available for fallback and legacy workflows."
          kicker="Search Console"
        >

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
            Google OAuth is preferred for Search Console copy tools and Indexer, with Google Sheets and Docs exports available from completed jobs. Service account support remains available for fallback and legacy workflows.
          </p>
        </JobSection>

        {/* Credentials */}
        <JobSection
          title="API credentials"
          description="Saved credentials are used securely by the backends and are never shown again."
          kicker="Access"
        >

          {credsConfigured && !showCredsForm ? (
            <div className="flex items-center justify-between bg-accent/5 border border-accent/20 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <CheckCircle size={15} className="text-accent shrink-0" />
                <div>
                  <p className="text-xs font-medium">Credentials saved</p>
                  <p className="text-xs text-muted mt-0.5">
                    {credentialSummary}{credsForm.site_url ? ` · ${credsForm.site_url}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={async () => {
                  const sb = createClient()
                  const { data: { session } } = await sb.auth.getSession()
                  if (session) {
                    try {
                      const creds = await getProviderMetadata(session.access_token)
                      if (creds) {
                        setProviderKeyStatus(creds.api_key_status || {})
                        setDfsConfigured(Boolean(creds.dfs_login && creds.has_dfs_password))
                        setJinaKeyConfigured(Boolean(creds.has_jina_key))
                        setFirecrawlKeyConfigured(Boolean(creds.has_firecrawl_key))
                        setParallelKeyConfigured(Boolean(creds.has_parallel_key))
                        setCredsForm({ provider: creds.provider || 'Claude', api_key: '', dfs_login: creds.dfs_login || '', dfs_password: '', jina_api_key: '', firecrawl_api_key: '', parallel_api_key: '', site_url: creds.site_url || '' })
                      }
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
                  <CustomSelect size="compact" value={credsForm.provider} onChange={value => setCredsForm(f => ({ ...f, provider: value, api_key: '' }))}
                    options={AI_PROVIDERS} className="w-full" />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">API Key</label>
                  <input type="password" value={credsForm.api_key} onChange={e => setCredsForm(f => ({ ...f, api_key: e.target.value }))} className="input-base text-xs w-full" placeholder={providerKeyStatus[credsForm.provider] ? `Leave blank to keep saved ${credsForm.provider} key` : 'sk-...'} />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {AI_PROVIDERS.map(provider => (
                  <span key={provider} className={`text-xs px-2 py-1 rounded border ${providerKeyStatus[provider] ? 'border-accent/30 bg-accent/5 text-text' : 'border-border text-muted'}`}>
                    {provider}: {providerKeyStatus[provider] ? 'saved' : 'not saved'}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted block mb-1">DataForSEO Login</label>
                  <input value={credsForm.dfs_login} onChange={e => setCredsForm(f => ({ ...f, dfs_login: e.target.value }))} className="input-base text-xs w-full" placeholder="email@example.com" />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">DataForSEO Password</label>
                  <input type="password" value={credsForm.dfs_password} onChange={e => setCredsForm(f => ({ ...f, dfs_password: e.target.value }))} className="input-base text-xs w-full" placeholder={dfsConfigured ? 'Leave blank to keep saved password' : ''} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Jina API Key <span className="text-muted/50">(optional)</span></label>
                <input type="password" value={credsForm.jina_api_key} onChange={e => setCredsForm(f => ({ ...f, jina_api_key: e.target.value }))} className="input-base text-xs w-full" placeholder={jinaKeyConfigured ? 'Leave blank to keep saved Jina key' : 'Add your Jina API key'} />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Firecrawl API Key <span className="text-muted/50">(FAQ fallback)</span></label>
                <input type="password" value={credsForm.firecrawl_api_key} onChange={e => setCredsForm(f => ({ ...f, firecrawl_api_key: e.target.value }))} className="input-base text-xs w-full" placeholder={firecrawlKeyConfigured ? 'Leave blank to keep saved Firecrawl key' : 'Add your Firecrawl API key'} />
                <p className="text-xs text-muted/70 mt-1">Optional advanced page scraping when Jina cannot extract the page.</p>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Parallel API Key <span className="text-muted/50">(GEOPilot)</span></label>
                <input type="password" value={credsForm.parallel_api_key} onChange={e => setCredsForm(f => ({ ...f, parallel_api_key: e.target.value }))} className="input-base text-xs w-full" placeholder={parallelKeyConfigured ? 'Leave blank to keep saved Parallel key' : 'Add your Parallel API key'} />
                <p className="text-xs text-muted/70 mt-1">Used for GEOPilot prompt discovery and weekly citation opportunities.</p>
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
        </JobSection>

          </div>

          <div className={activeView === 'platform' ? settingsStyles.platformPanel : 'hidden'}>
        <JobSection
          title="Platform health"
          description="Live status for the services that power CopyPilot tools."
          kicker="System"
        >
          <div className="mb-4 flex items-center justify-between rounded-lg border border-border bg-surface-raised px-4 py-3">
            <div className="flex items-center gap-3">
              <Zap size={14} className="text-accent shrink-0" />
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

          <div className="overflow-hidden rounded-lg border border-border divide-y divide-border">
            {BACKENDS.map(b => {
              const status = backendStatuses[b.url] ?? 'checking'
              return (
                <div key={b.url} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Server size={13} className="text-muted shrink-0" />
                    <div>
                      <p className="text-xs font-medium">{b.label}</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs ${status === 'ok' ? 'text-accent' : status === 'error' ? 'text-error' : 'text-muted'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${status === 'ok' ? 'bg-accent animate-pulse' : status === 'error' ? 'bg-error' : 'bg-muted animate-pulse'}`} />
                    {status === 'ok' ? 'Operational' : status === 'error' ? 'Needs attention' : 'Checking...'}
                  </div>
                </div>
              )
            })}
          </div>
        </JobSection>
          </div>

          <div className={activeView === 'profiles' ? settingsStyles.profilesPanel : 'hidden'}>
            <BrandProfilesCard
              listBrandProfiles={listBrandProfiles}
              createBrandProfile={createBrandProfile}
              updateBrandProfile={updateBrandProfile}
              deleteBrandProfile={deleteBrandProfile}
            />
          </div>
        </div>
      </JobLauncherShell>
      </div>
    </AppLayout>
  )
}
