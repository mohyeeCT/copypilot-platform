'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, X, Upload, ChevronDown, ChevronUp } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import ImportErrors from '@/components/ui/ImportErrors'
import NicheSelect from '@/components/ui/NicheSelect'
import { createCopyRowImportSchema, parseImportedRows, type RejectedImportRow } from '@/lib/import-rows'
import { createClient } from '@/lib/supabase'
import { metaApi } from '@/lib/api/meta'
import { getSettings, getProviderCredentials, listTemplates, saveTemplate, deleteTemplate, listBrandProfiles } from '@/lib/api/shared'

export const dynamic = 'force-dynamic'

const PROVIDERS = ['Claude', 'OpenAI', 'Gemini (free)', 'Mistral (free tier)', 'Groq (free tier)']
const BUSINESS_TYPES = ['b2b', 'b2c', 'ecommerce', 'service', 'local', 'general']
const PAGE_TYPES = ['general', 'category', 'product', 'service', 'location', 'blog', 'brand']

interface Row { url: string; keyword: string; page_type: string; h1: string }

export default function NewMetaJobPage() {
  const router = useRouter()

  // Settings
  const [provider, setProvider]         = useState('Claude')
  const [businessType, setBusinessType] = useState('general')
  const [brandName, setBrandName]       = useState('')
  const [fullBrandName, setFullBrandName] = useState('')
  const [includeBrand, setIncludeBrand] = useState(true)
  const [forbiddenPhrases, setForbiddenPhrases] = useState('')
  const [brandedTermsInput, setBrandedTermsInput] = useState('')
  const [locationCode, setLocationCode] = useState(2840)
  const [minVolume, setMinVolume]       = useState(10)
  const [useGsc, setUseGsc]             = useState(true)
  const [siteUrl, setSiteUrl]           = useState('')
  const [jobName, setJobName]           = useState('')
  const [brandProfileId, setBrandProfileId] = useState('')
  const [niche, setNiche] = useState('none')
  const [restrictedIndustry, setRestrictedIndustry] = useState(false)

  // Rows
  const [rows, setRows] = useState<Row[]>([{ url: '', keyword: '', page_type: 'general', h1: '' }])
  const [csvPaste, setCsvPaste]   = useState('')
  const [importErrors, setImportErrors] = useState<RejectedImportRow[]>([])
  const [inputMode, setInputMode] = useState<'manual' | 'csv'>('manual')

  // Auth / loading
  const [running, setRunning]           = useState(false)
  const [error, setError]               = useState('')
  const [templates, setTemplates]       = useState<{id: string; name: string; settings: Record<string, unknown>}[]>([])
  const [brandProfiles, setBrandProfiles] = useState<{id: string; name: string}[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  const load = useCallback(async () => {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { router.push('/login'); return }
    try {
      const [s, bp, tmpl] = await Promise.all([
        getSettings(session.access_token),
        listBrandProfiles(session.access_token),
        listTemplates(session.access_token, 'meta'),
      ])
      if (s) {
        setProvider(s.provider || 'Claude')
        setBusinessType(s.business_type || 'general')
        setBrandName(s.brand_name || '')
        setFullBrandName(s.full_brand_name || '')
        setIncludeBrand(s.include_brand ?? true)
      if (s.niche) setNiche(s.niche)
        setForbiddenPhrases(s.forbidden_phrases || '')
        setBrandedTermsInput(s.branded_terms_input || '')
        setLocationCode(s.location_code || 2840)
        setMinVolume(s.min_volume ?? 10)
        setUseGsc(s.use_gsc ?? true)
        setSiteUrl(s.site_url || '')
      }
      setBrandProfiles(Array.isArray(bp) ? bp : [])
      setTemplates(Array.isArray(tmpl) ? tmpl : [])
    } catch {}
    setSettingsLoaded(true)
  }, [router])

  useEffect(() => { load() }, [load])

  function applyTemplate(t: Record<string, unknown>) {
    if (t.provider)             setProvider(t.provider as string)
    if (t.business_type)        setBusinessType(t.business_type as string)
    if (t.brand_name)           setBrandName(t.brand_name as string)
    if (t.full_brand_name)      setFullBrandName(t.full_brand_name as string)
    if (t.include_brand != null) setIncludeBrand(Boolean(t.include_brand))
    if (t.forbidden_phrases)    setForbiddenPhrases(t.forbidden_phrases as string)
    if (t.branded_terms_input)  setBrandedTermsInput(t.branded_terms_input as string)
    if (t.location_code)        setLocationCode(Number(t.location_code))
    if (t.min_volume != null)   setMinVolume(Number(t.min_volume))
    if (t.use_gsc != null)           setUseGsc(Boolean(t.use_gsc))
    if (t.site_url)                  setSiteUrl(t.site_url as string)
    if (t.brand_profile_id)          setBrandProfileId(t.brand_profile_id as string)
    if (t.restricted_industry != null) setRestrictedIndustry(Boolean(t.restricted_industry))
  }

  function parseCsv() {
    const result = parseImportedRows(csvPaste, createCopyRowImportSchema({ page_type: 'general' }))
    const parsed = result.rows.map(({ url, keyword, page_type, h1 }) => ({ url, keyword, page_type, h1 }))
    setImportErrors(result.rejectedRows)
    if (parsed.length > 0) {
      setRows(parsed)
      setInputMode('manual')
      setCsvPaste('')
    }
  }

  async function handleRun() {
    const validRows = rows.filter(r => r.url.trim().startsWith('http'))
    if (!validRows.length) { setError('Add at least one valid URL (starting with http)'); return }
    setError('')
    setRunning(true)

    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { router.push('/login'); return }

    let apiKey = '', dfsLogin = '', dfsPassword = ''
    try {
      const creds = await getProviderCredentials(session.access_token)
      apiKey = creds?.api_key || ''
      dfsLogin = creds?.dfs_login || ''
      dfsPassword = creds?.dfs_password || ''
    } catch {}

    const payload = {
      name: jobName.trim() || `Meta job — ${validRows.length} URLs`,
      rows: validRows,
      settings: {
        provider, api_key: apiKey,
        dfs_login: dfsLogin,
        dfs_password: dfsPassword,
        business_type: businessType,
        brand_name: brandName,
        full_brand_name: fullBrandName,
        include_brand: includeBrand,
        forbidden_phrases: forbiddenPhrases,
        branded_terms_input: brandedTermsInput,
        location_code: locationCode,
        min_volume: minVolume,
        use_gsc: useGsc,
        site_url: siteUrl,
        brand_profile_id: brandProfileId,
        niche,
        restricted_industry: restrictedIndustry,
      },
    }

    try {
      const data = await metaApi.runJob(session.access_token, payload)
      router.push(`/meta/jobs/${data.job_id}`)
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to start job')
      setRunning(false)
    }
  }

  if (!settingsLoaded) return (
    <AppLayout title="New Meta Job">
      <div className="flex items-center justify-center h-48">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  )

  return (
    <AppLayout title="New Meta Job">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/meta/jobs" className="text-muted hover:text-text transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold">New Meta Copy Job</h1>
            <p className="text-muted text-sm">Generate title tags, meta descriptions, and H1s at scale</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Job name */}
          <div className="card p-5">
            <label className="block text-xs text-muted uppercase tracking-wider mb-2">Job Name (optional)</label>
            <input className="input-base" value={jobName} onChange={e => setJobName(e.target.value)} placeholder="e.g. Client X — Category Pages" />
          </div>

          {/* URLs */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">URLs</h2>
              <div className="flex gap-2">
                <button onClick={() => setInputMode(inputMode === 'csv' ? 'manual' : 'csv')}
                  className="text-xs text-muted hover:text-accent transition-colors flex items-center gap-1">
                  <Upload size={12} /> Paste CSV
                </button>
                <button onClick={() => setRows([...rows, { url: '', keyword: '', page_type: 'general', h1: '' }])}
                  className="btn-ghost text-xs flex items-center gap-1">
                  <Plus size={12} /> Add row
                </button>
              </div>
            </div>

            <ImportErrors rows={importErrors} />

            {inputMode === 'csv' ? (
              <div>
                <p className="text-xs text-muted mb-2">Paste CSV or spreadsheet rows: URL, Keyword (optional), Page Type (optional), H1 (optional)</p>
                <textarea className="input-base font-mono text-xs" rows={6} value={csvPaste}
                  onChange={e => setCsvPaste(e.target.value)} placeholder="https://example.com/page&#9;keyword&#9;category&#9;H1 text" />
                <button onClick={parseCsv} className="btn-primary mt-2 text-xs">Parse CSV</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-xs text-muted px-1 mb-1">
                  <span className="col-span-5">URL *</span>
                  <span className="col-span-3">Keyword</span>
                  <span className="col-span-2">Page Type</span>
                  <span className="col-span-2">H1</span>
                </div>
                {rows.map((row, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <input className="input-base col-span-5 text-xs" placeholder="https://..." value={row.url}
                      onChange={e => { const r = [...rows]; r[i] = {...r[i], url: e.target.value}; setRows(r) }} />
                    <input className="input-base col-span-3 text-xs" placeholder="keyword" value={row.keyword}
                      onChange={e => { const r = [...rows]; r[i] = {...r[i], keyword: e.target.value}; setRows(r) }} />
                    <select className="input-base col-span-2 text-xs" value={row.page_type}
                      onChange={e => { const r = [...rows]; r[i] = {...r[i], page_type: e.target.value}; setRows(r) }}>
                      {PAGE_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                    </select>
                    <div className="col-span-2 flex gap-1">
                      <input className="input-base text-xs flex-1" placeholder="H1" value={row.h1}
                        onChange={e => { const r = [...rows]; r[i] = {...r[i], h1: e.target.value}; setRows(r) }} />
                      {rows.length > 1 && (
                        <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="text-muted hover:text-error transition-colors shrink-0">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted mt-1">{rows.filter(r => r.url.startsWith('http')).length} valid URLs</p>
              </div>
            )}
          </div>

          {/* Copy Settings */}
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-sm">Copy Settings</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">AI Provider</label>
                <select className="input-base" value={provider} onChange={e => setProvider(e.target.value)}>
                  {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Business Type</label>
                <select className="input-base" value={businessType} onChange={e => setBusinessType(e.target.value)}>
                  {BUSINESS_TYPES.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                </select>
              </div>
              <NicheSelect
                value={niche}
                onChange={setNiche}
                businessType={businessType}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Brand Name</label>
                <input className="input-base" value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="Acme Inc." />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Brand Profile</label>
                <select className="input-base" value={brandProfileId} onChange={e => setBrandProfileId(e.target.value)}>
                  <option value="">No brand profile</option>
                  {brandProfiles.map(bp => <option key={bp.id} value={bp.id}>{bp.name}</option>)}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <div onClick={() => setIncludeBrand(!includeBrand)}
                className={`w-9 h-5 rounded-full transition-colors relative ${includeBrand ? 'bg-accent' : 'bg-border'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${includeBrand ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm">Include brand name in title and description</span>
            </label>
          </div>

          {/* GSC Settings */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">GSC Settings</h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => setUseGsc(!useGsc)}
                  className={`w-9 h-5 rounded-full transition-colors relative ${useGsc ? 'bg-accent' : 'bg-border'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${useGsc ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm text-muted">Use GSC</span>
              </label>
            </div>
            {useGsc && (
              <div>
                <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">GSC Property URL</label>
                <input className="input-base" value={siteUrl} onChange={e => setSiteUrl(e.target.value)} placeholder="https://example.com/" />
              </div>
            )}
          </div>

          {/* Advanced settings */}
          <div className="card overflow-hidden">
            <button onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium hover:bg-border/20 transition-colors">
              Advanced settings
              {showAdvanced ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
            </button>
            {showAdvanced && (
              <div className="px-5 pb-5 space-y-4 border-t border-border">
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div>
                    <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">DFS Location Code</label>
                    <input type="number" className="input-base" value={locationCode} onChange={e => setLocationCode(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Min Keyword Volume</label>
                    <input type="number" className="input-base" value={minVolume} onChange={e => setMinVolume(Number(e.target.value))} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Full Brand Name</label>
                  <input className="input-base" value={fullBrandName} onChange={e => setFullBrandName(e.target.value)} placeholder="Dayson Shalabi Burkert" />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Forbidden Phrases</label>
                  <textarea className="input-base text-xs" rows={3} value={forbiddenPhrases}
                    onChange={e => setForbiddenPhrases(e.target.value)} placeholder="best in class&#10;world-class" />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Branded Terms to Exclude</label>
                  <textarea className="input-base text-xs" rows={3} value={brandedTermsInput}
                    onChange={e => setBrandedTermsInput(e.target.value)} placeholder="acme&#10;acme inc" />
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                  <div onClick={() => setRestrictedIndustry(!restrictedIndustry)}
                    className={`w-9 h-5 rounded-full transition-colors relative ${restrictedIndustry ? 'bg-accent' : 'bg-border'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${restrictedIndustry ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                  <div>
                    <span className="text-sm">Restricted industry mode</span>
                    <p className="text-xs text-muted mt-0.5">Score keywords on GSC engagement only, ignoring DFS volume. Use for CBD, firearms, dispensaries, or adult industries where DataForSEO suppresses volume data.</p>
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* Templates */}
          {templates.length > 0 && (
            <div className="card p-5">
              <h2 className="font-semibold text-sm mb-3">Load Template</h2>
              <div className="flex flex-wrap gap-2">
                {templates.map(t => (
                  <button key={t.id} onClick={() => applyTemplate(t.settings)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-border hover:border-accent hover:text-accent transition-colors">
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Save template */}
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSaveTemplate(!showSaveTemplate)} className="btn-ghost text-xs">
              Save as template
            </button>
          </div>
          {showSaveTemplate && (
            <div className="card p-4 flex gap-2">
              <input className="input-base flex-1 text-xs" value={templateName}
                onChange={e => setTemplateName(e.target.value)} placeholder="Template name..." />
              <button disabled={!templateName.trim() || savingTemplate} className="btn-primary text-xs"
                onClick={async () => {
                  setSavingTemplate(true)
                  const sb = createClient()
                  const { data: { session } } = await sb.auth.getSession()
                  if (session) {
                    const tmpl = await saveTemplate(session.access_token, templateName.trim(), {
                      provider, business_type: businessType, brand_name: brandName,
                      full_brand_name: fullBrandName, include_brand: includeBrand,
                      forbidden_phrases: forbiddenPhrases, branded_terms_input: brandedTermsInput,
                      location_code: locationCode, min_volume: minVolume,
                      use_gsc: useGsc, site_url: siteUrl, brand_profile_id: brandProfileId,
                      niche, restricted_industry: restrictedIndustry,
                    }, 'meta')
                    if (tmpl?.id) setTemplates(prev => [tmpl, ...prev])
                  }
                  setSavingTemplate(false)
                  setShowSaveTemplate(false)
                  setTemplateName('')
                }}>
                {savingTemplate ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}

          {error && (
            <p className="text-error text-sm bg-error/10 border border-error/20 rounded-lg px-4 py-3">{error}</p>
          )}

          <button onClick={handleRun} disabled={running} className="btn-primary w-full py-3">
            {running ? 'Starting job...' : `Generate Meta Copy — ${rows.filter(r => r.url.startsWith('http')).length} URLs`}
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
