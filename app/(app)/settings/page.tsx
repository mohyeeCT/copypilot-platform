'use client'
import { useEffect, useState } from 'react'
import { Upload, Trash2, CheckCircle, ExternalLink, Github, Server, Tag, Zap, KeyRound, Key, Globe, Cpu, Info } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import AppLayout from '@/components/layout/AppLayout'
import { createClient } from '@/lib/supabase'
import { getSettings, saveSettings, deleteGscAccount, getProviderCredentials, saveProviderCredentials, deleteCredentials, listBrandProfiles, createBrandProfile, updateBrandProfile, deleteBrandProfile } from '@/lib/api/shared'
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
  { label: 'Page Copy',   url: 'page-copy-saas-backend-production.up.railway.app' },
  { label: 'All in One',  url: 'all-in-one-saas-backend-production.up.railway.app' },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'credentials' | 'gsc' | 'brand' | 'about'>('credentials')
  const toast = useToast()
  const [gscConfigured, setGscConfigured] = useState(false)
  const [gscEmail, setGscEmail] = useState('')
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



  useEffect(() => {
    async function load() {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) return
      try {
        const data = await getSettings(session.access_token)
        if (data.gsc_service_account?.configured) {
          setGscConfigured(true)
          setGscEmail(data.gsc_service_account.client_email || '')
        }
        if (data.provider_settings?.has_api_key) {
          setCredsConfigured(true)
          setCredsProvider(data.provider_settings.provider || '')
        }

      } catch {}
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
      setGscConfigured(true)
      setGscEmail(json.client_email || '')
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
      setGscConfigured(false)
      setGscEmail('')
    } catch {}
    setDeleting(false)
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
    } catch {}
    setCredsDeleting(false)
  }



  async function handleSaveCreds() {
    if (!credsForm.api_key.trim()) { setCredsError('API key is required'); return }
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

        <div className="card p-6 mb-4">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-sm">Google Search Console</h2>
              <p className="text-muted text-xs mt-0.5">Upload your service account JSON to enable GSC-powered keyword selection.</p>
            </div>
          </div>

          {gscConfigured ? (
            <div className="flex items-center justify-between bg-accent/5 border border-accent/20 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <CheckCircle size={15} className="text-accent shrink-0" />
                <div>
                  <p className="text-xs font-medium">Service account connected</p>
                  <p className="text-xs text-muted font-mono mt-0.5">{gscEmail}</p>
                </div>
              </div>
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-error transition-colors">
                <Trash2 size={12} />
                {deleting ? 'Removing...' : 'Remove'}
              </button>
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
        </div>

        {/* Credentials */}
        <div className="card p-6 mb-4">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
              <KeyRound size={15} className="text-purple-400" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">API Credentials</h2>
              <p className="text-muted text-xs mt-0.5">Save your AI provider key and DataForSEO credentials so they pre-fill on every new job.</p>
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
                      const creds = await getProviderCredentials(session.access_token)
                      if (creds) setCredsForm({ provider: creds.provider || 'Claude', api_key: creds.api_key || '', dfs_login: creds.dfs_login || '', dfs_password: creds.dfs_password || '', jina_api_key: creds.jina_api_key || '', site_url: creds.site_url || '' })
                    } catch {}
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
                  <select value={credsForm.provider} onChange={e => setCredsForm(f => ({ ...f, provider: e.target.value }))} className="input-base text-xs w-full">
                    {['Claude', 'OpenAI', 'Gemini (free)', 'Mistral (free tier)', 'Groq (free tier)'].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">API Key</label>
                  <input type="password" value={credsForm.api_key} onChange={e => setCredsForm(f => ({ ...f, api_key: e.target.value }))} className="input-base text-xs w-full" placeholder="sk-..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted block mb-1">DataForSEO Login</label>
                  <input value={credsForm.dfs_login} onChange={e => setCredsForm(f => ({ ...f, dfs_login: e.target.value }))} className="input-base text-xs w-full" placeholder="email@example.com" />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">DataForSEO Password</label>
                  <input type="password" value={credsForm.dfs_password} onChange={e => setCredsForm(f => ({ ...f, dfs_password: e.target.value }))} className="input-base text-xs w-full" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Jina API Key <span className="text-muted/50">(optional)</span></label>
                <input type="password" value={credsForm.jina_api_key} onChange={e => setCredsForm(f => ({ ...f, jina_api_key: e.target.value }))} className="input-base text-xs w-full" />
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
              <img src="/favicon-32x32.png" alt="FAQ Production" className="w-6 h-6" />
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
