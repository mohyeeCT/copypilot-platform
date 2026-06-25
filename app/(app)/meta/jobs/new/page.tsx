'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, X, Upload, ChevronDown, ChevronUp } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import CustomSelect from '@/components/ui/CustomSelect'
import ImportErrors from '@/components/ui/ImportErrors'
import NicheSelect from '@/components/ui/NicheSelect'
import { createCopyRowImportSchema, parseImportedRows, type ImportNotice, type RejectedImportRow } from '@/lib/import-rows'
import { createClient } from '@/lib/supabase'
import { metaApi } from '@/lib/api/meta'
import { getSettings, getProviderMetadata, listTemplates, saveTemplate, deleteTemplate, listBrandProfiles } from '@/lib/api/shared'

export const dynamic = 'force-dynamic'

const PROVIDERS = ['Claude', 'OpenAI', 'Gemini (free)', 'Mistral (free tier)', 'Groq (free tier)']
const PROVIDER_MODELS: Record<string, { label: string; value: string }[]> = {
  'Claude': [
    { label: 'Claude Sonnet 4.6 (default)', value: 'claude-sonnet-4-6' },
    { label: 'Claude Sonnet 4.5', value: 'claude-sonnet-4-5-20251001' },
    { label: 'Claude Haiku 4.5', value: 'claude-haiku-4-5-20251001' },
  ],
  'OpenAI': [
    { label: 'GPT-5.5 (latest)', value: 'gpt-5.5' },
    { label: 'GPT-5.4', value: 'gpt-5.4' },
    { label: 'GPT-5.4 mini', value: 'gpt-5.4-mini' },
    { label: 'GPT-5.4 nano', value: 'gpt-5.4-nano' },
  ],
  'Gemini (free)': [
    { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
  ],
  'Mistral (free tier)': [
    { label: 'Mistral Small (default)', value: 'mistral-small-latest' },
    { label: 'Mistral Large', value: 'mistral-large-latest' },
  ],
  'Groq (free tier)': [
    { label: 'Llama 3 70B (default)', value: 'llama3-70b-8192' },
    { label: 'Llama 3.1 8B', value: 'llama-3.1-8b-instant' },
    { label: 'Llama 3.3 70B', value: 'llama-3.3-70b-versatile' },
  ],
}
const BUSINESS_TYPES = ['b2b', 'b2c', 'ecommerce', 'service', 'local', 'general']
const PAGE_TYPES = ['general', 'category', 'product', 'service', 'location', 'blog', 'brand']

interface Row { url: string; keyword: string; page_type: string; h1: string }

function createMetaRowImportSchema() {
  return createCopyRowImportSchema(
    { page_type: 'general' },
    false,
    {
      pageTypeValues: PAGE_TYPES,
      positionalLayouts: [
        {
          keys: ['url', 'page_type', 'h1'],
          match: [{ index: 1, columnKey: 'page_type' }],
          notice: 'Keyword column was omitted; mapped the second column as page type.',
        },
        {
          keys: ['url', 'keyword', 'h1'],
          notice: 'Page type column was omitted; used the default page type.',
        },
      ],
    },
  )
}

export default function NewMetaJobPage() {
  const router = useRouter()

  // Settings
  const [provider, setProvider]         = useState('Claude')
  const [model, setModel]               = useState(PROVIDER_MODELS['Claude'][0].value)
  const [businessType, setBusinessType] = useState('general')
  const [brandName, setBrandName]       = useState('')
  const [fullBrandName, setFullBrandName] = useState('')
  const [includeBrand, setIncludeBrand] = useState(true)
  const [forbiddenPhrases, setForbiddenPhrases] = useState('')
  const [brandedTermsInput, setBrandedTermsInput] = useState('')
  const [dfsLogin, setDfsLogin]         = useState('')
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
  const [pasteText, setPasteText] = useState('')
  const [importErrors, setImportErrors] = useState<RejectedImportRow[]>([])
  const [importNotices, setImportNotices] = useState<ImportNotice[]>([])
  const [inputMode, setInputMode] = useState<'manual' | 'paste' | 'csv'>('manual')

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
      const [s, bp, tmpl, creds] = await Promise.all([
        getSettings(session.access_token),
        listBrandProfiles(session.access_token),
        listTemplates(session.access_token, 'meta'),
        getProviderMetadata(session.access_token).catch(() => null),
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
      if (creds) {
        setDfsLogin(creds.dfs_login || '')
      }
      setBrandProfiles(Array.isArray(bp) ? bp : [])
      setTemplates(Array.isArray(tmpl) ? tmpl : [])
    } catch (e) {
      console.error('Failed to load settings/credentials on mount:', e)
    }
    setSettingsLoaded(true)
  }, [router])

  useEffect(() => { load() }, [load])

  function applyTemplate(t: Record<string, unknown>) {
    if (t.provider)             setProvider(t.provider as string)
    if (t.model)                setModel(t.model as string)
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

  function handleProviderChange(p: string) {
    setProvider(p)
    setModel(PROVIDER_MODELS[p]?.[0]?.value ?? '')
  }

  function applyImportedText(text: string) {
    const result = parseImportedRows(text, createMetaRowImportSchema())
    const parsed = result.rows.map(({ url, keyword, page_type, h1 }) => ({ url, keyword, page_type, h1 }))
    setImportErrors(result.rejectedRows)
    setImportNotices(result.notices)
    if (parsed.length > 0) {
      setRows(parsed)
      setInputMode('manual')
    }
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      applyImportedText(await file.text())
    } catch {
      setError('Failed to read CSV file')
    }
  }

  function parsePaste() {
    applyImportedText(pasteText)
  }

  async function handleRun() {
    const validRows = rows.filter(r => r.url.trim().startsWith('http'))
    if (!validRows.length) { setError('Add at least one valid URL (starting with http)'); return }
    setError('')
    setRunning(true)

    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { router.push('/login'); return }

    const payload = {
      name: jobName.trim() || `Meta job — ${validRows.length} URLs`,
      rows: validRows,
      settings: {
        provider, model,
        dfs_login: dfsLogin,
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
              <button onClick={() => setRows([...rows, { url: '', keyword: '', page_type: 'general', h1: '' }])}
                className="btn-ghost text-xs flex items-center gap-1">
                <Plus size={12} /> Add row
              </button>
            </div>

            <div className="flex items-center gap-1 border-b border-border mb-3">
              {(['manual', 'paste', 'csv'] as const).map(t => (
                <button key={t} onClick={() => setInputMode(t)}
                  className={`text-xs px-3 py-2 transition-colors border-b-2 -mb-px ${inputMode === t ? 'border-accent text-text' : 'border-transparent text-muted hover:text-text'}`}>
                  {t === 'manual' ? 'Manual entry' : t === 'paste' ? 'Paste from sheet' : 'Upload CSV'}
                </button>
              ))}
            </div>

              <ImportErrors rows={importErrors} />

            {importNotices.length > 0 && (
              <div role="status" aria-live="polite" className="my-3 border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-muted">
                <p className="font-medium mb-1 text-text">Import adjusted column mapping</p>
                <ul className="space-y-0.5 max-h-28 overflow-y-auto">
                  {importNotices.map(notice => (
                    <li key={`${notice.rowNumber}-${notice.message}`}>
                      Row {notice.rowNumber}: {notice.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {inputMode === 'paste' && (
              <div className="space-y-2 mb-3">
                <p className="text-xs text-muted">Paste tab-separated rows: URL | Keyword (optional) | Page Type (optional) | H1. Headers are supported.</p>
                <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
                  className="input-base text-xs font-mono resize-none h-32 w-full"
                  placeholder={"url\tkeyword\tpage type\th1\nhttps://example.com/page\t\tcategory\tPage H1"} />
                <button onClick={parsePaste} className="btn-secondary text-xs">Import rows</button>
              </div>
            )}

            {inputMode === 'csv' && (
              <div className="space-y-2 mb-3">
                <p className="text-xs text-muted">CSV must have headers: url, keyword (optional), page_type, h1</p>
                <label className="flex items-center gap-2 btn-secondary text-xs cursor-pointer w-fit">
                  <Upload size={12} /> Choose CSV file
                  <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
                </label>
              </div>
            )}

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
                  <CustomSelect className="col-span-2 text-xs" value={row.page_type}
                    onChange={value => { const r = [...rows]; r[i] = {...r[i], page_type: value}; setRows(r) }}
                    options={PAGE_TYPES} />
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
          </div>

          {/* Copy Settings */}
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-sm">Copy Settings</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">AI Provider</label>
                <CustomSelect value={provider} onChange={handleProviderChange} options={PROVIDERS} />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Business Type</label>
                <CustomSelect value={businessType} onChange={setBusinessType} options={BUSINESS_TYPES} />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Model</label>
                <CustomSelect value={model} onChange={setModel} options={PROVIDER_MODELS[provider] ?? []} />
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
                <CustomSelect value={brandProfileId} onChange={setBrandProfileId}
                  options={[
                    { value: '', label: 'No brand profile' },
                    ...brandProfiles.map(bp => ({ value: bp.id, label: bp.name })),
                  ]} />
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

          {/* DataForSEO */}
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-sm">DataForSEO</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Login Email</label>
                <input className="input-base" value={dfsLogin} onChange={e => setDfsLogin(e.target.value)} placeholder="you@example.com" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Location Code</label>
                <input type="number" className="input-base" value={locationCode} onChange={e => setLocationCode(Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Min Keyword Volume</label>
                <input type="number" className="input-base" value={minVolume} onChange={e => setMinVolume(Number(e.target.value))} />
              </div>
            </div>
          </div>

          {/* Advanced settings */}
          <div className="card overflow-hidden">
            <button onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium hover:bg-border/20 transition-colors">
              Advanced settings
              {showAdvanced ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
            </button>
            {showAdvanced && (
              <div className="px-5 pb-5 pt-4 space-y-4 border-t border-border">
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
                      provider, model, business_type: businessType, brand_name: brandName,
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
