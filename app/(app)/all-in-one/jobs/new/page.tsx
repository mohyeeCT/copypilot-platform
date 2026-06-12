'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, X, Upload, ChevronDown, ChevronUp } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import CustomSelect from '@/components/ui/CustomSelect'
import ImportErrors from '@/components/ui/ImportErrors'
import NicheSelect from '@/components/ui/NicheSelect'
import { createCopyRowImportSchema, parseImportedRows, type RejectedImportRow } from '@/lib/import-rows'
import { createClient } from '@/lib/supabase'
import { aioApi } from '@/lib/api/all-in-one'
import { getSettings, getProviderCredentials, listBrandProfiles } from '@/lib/api/shared'

export const dynamic = 'force-dynamic'

const PROVIDERS  = ['Claude', 'OpenAI', 'Gemini (free)', 'Mistral (free tier)', 'Groq (free tier)']
const BIZ_TYPES  = ['b2b', 'b2c', 'ecommerce', 'service', 'local', 'general']
const PAGE_TYPES = ['blog', 'case_study', 'glossary', 'homepage', 'service', 'local', 'about', 'contact', 'product', 'collection']
const PAGE_LABELS: Record<string, string> = {
  blog: 'Blog', case_study: 'Case Study', glossary: 'Glossary',
  homepage: 'Homepage', service: 'Service Page', local: 'Local Service Page',
  about: 'About Us', contact: 'Contact Us', product: 'Product Page', collection: 'Collection / Category',
}

interface Row { url: string; keyword: string; page_type: string; h1: string; gen_page_copy: boolean; gen_meta: boolean; gen_faqs: boolean }

export default function NewAIOJob() {
  const router = useRouter()

  // Core settings
  const [provider, setProvider]       = useState('Claude')
  const [bizType, setBizType]         = useState('general')
  const [niche, setNiche]             = useState('none')
  const [brandName, setBrandName]     = useState('')
  const [fullBrand, setFullBrand]     = useState('')
  const [brandTerms, setBrandTerms]   = useState('')
  const [includeBrand, setIncludeBrand] = useState(true)
  const [forbiddenPhrases, setForbiddenPhrases] = useState('')
  const [locationCode, setLocationCode] = useState(2840)
  const [minVolume, setMinVolume]     = useState(10)
  const [clientBrief, setClientBrief] = useState('')
  const [pageType, setPageType]       = useState('service')
  const [templateKey, setTemplateKey] = useState('service_page')
  const [customTemplate, setCustomTemplate] = useState('')
  const [templateMode, setTemplateMode] = useState<'predefined' | 'custom'>('predefined')
  const [jobName, setJobName]         = useState('')
  const [brandProfileId, setBrandProfileId] = useState('')

  // Output toggles (job-level defaults)
  const [genPageCopy, setGenPageCopy] = useState(true)
  const [genMeta, setGenMeta]         = useState(true)
  const [genFaqs, setGenFaqs]         = useState(true)
  const [numFaqs, setNumFaqs]         = useState(5)

  // GSC
  const [useGsc, setUseGsc]           = useState(false)
  const [siteUrl, setSiteUrl]         = useState('')

  // Rows
  const [rows, setRows]               = useState<Row[]>([{ url: '', keyword: '', page_type: 'service', h1: '', gen_page_copy: true, gen_meta: true, gen_faqs: true }])
  const [csvPaste, setCsvPaste]       = useState('')
  const [importErrors, setImportErrors] = useState<RejectedImportRow[]>([])
  const [inputMode, setInputMode]     = useState<'manual' | 'csv'>('manual')

  const [templates, setTemplates]     = useState<Record<string, {key: string; name: string}[]>>({})
  const [brandProfiles, setBrandProfiles] = useState<{id: string; name: string}[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [running, setRunning]         = useState(false)
  const [error, setError]             = useState('')
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  const load = useCallback(async () => {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { router.push('/login'); return }
    try {
      const [s, bp, tmpl] = await Promise.all([
        getSettings(session.access_token),
        listBrandProfiles(session.access_token),
        aioApi.getTemplates(session.access_token),
      ])
      if (s) {
        setProvider(s.provider || 'Claude')
        setBizType(s.business_type || 'general')
        setBrandName(s.brand_name || '')
        setFullBrand(s.full_brand_name || '')
        setBrandTerms(s.branded_terms_input || '')
        setIncludeBrand(s.include_brand ?? true)
        setForbiddenPhrases(s.forbidden_phrases || '')
        setLocationCode(s.location_code || 2840)
        setMinVolume(s.min_volume ?? 10)
        setUseGsc(s.use_gsc ?? false)
        setSiteUrl(s.site_url || '')
        if (s.niche) setNiche(s.niche)
      }
      setBrandProfiles(Array.isArray(bp) ? bp : [])
      if (tmpl && typeof tmpl === 'object') setTemplates(tmpl)
    } catch (e) {
      console.error('Failed to load settings on mount:', e)
    }
    setSettingsLoaded(true)
  }, [router])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const available = templates[pageType] || []
    if (available.length > 0 && !available.find(t => t.key === templateKey)) {
      setTemplateKey(available[0].key)
    }
  }, [pageType, templates, templateKey])

  function toggleRow(i: number, field: 'gen_page_copy' | 'gen_meta' | 'gen_faqs') {
    const r = [...rows]
    r[i] = { ...r[i], [field]: !r[i][field] }
    setRows(r)
  }

  function parseCsv() {
    const result = parseImportedRows(csvPaste, createCopyRowImportSchema({ page_type: pageType }))
    const parsed = result.rows.map(({ url, keyword, page_type, h1 }) => ({
      url, keyword, page_type, h1,
      gen_page_copy: genPageCopy,
      gen_meta: genMeta,
      gen_faqs: genFaqs,
    }))
    setImportErrors(result.rejectedRows)
    if (parsed.length) {
      setRows(parsed)
      setInputMode('manual')
      setCsvPaste('')
    }
  }

  async function handleRun() {
    const validRows = rows.filter(r => r.url.startsWith('http'))
    if (!validRows.length) { setError('Add at least one valid URL'); return }
    if (!genPageCopy && !genMeta && !genFaqs) { setError('Enable at least one output type'); return }
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
    } catch (e) {
      console.error('Failed to fetch credentials at submit time:', e)
      setError('Failed to load credentials. Please try again.')
      setRunning(false)
      return
    }

    const payload = {
      name: jobName.trim() || `All in One — ${validRows.length} URLs`,
      rows: validRows.map(r => ({ ...r, page_type: r.page_type || pageType })),
      settings: {
        niche, provider, api_key: apiKey, dfs_login: dfsLogin, dfs_password: dfsPassword,
        business_type: bizType, brand_name: brandName, full_brand_name: fullBrand,
        branded_terms_input: brandTerms, include_brand: includeBrand,
        forbidden_phrases: forbiddenPhrases, location_code: locationCode, min_volume: minVolume,
        client_brief: clientBrief, page_type: pageType,
        template_key: templateMode === 'predefined' ? templateKey : '',
        custom_template_text: templateMode === 'custom' ? customTemplate : '',
        use_gsc: useGsc, site_url: siteUrl, brand_profile_id: brandProfileId,
        gen_page_copy: genPageCopy, gen_meta: genMeta, gen_faqs: genFaqs, num_faqs: numFaqs,
      },
    }

    try {
      const data = await aioApi.runJob(session.access_token, payload)
      router.push(`/all-in-one/jobs/${data.job_id}`)
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to start job')
      setRunning(false)
    }
  }

  const availableTemplates = templates[pageType] || []

  if (!settingsLoaded) return (
    <AppLayout title="All in One">
      <div className="flex items-center justify-center h-48">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  )

  return (
    <AppLayout title="All in One">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/all-in-one/jobs" className="text-muted hover:text-text transition-colors"><ArrowLeft size={18} /></Link>
          <div>
            <h1 className="text-xl font-bold">New All in One Job</h1>
            <p className="text-muted text-sm">Meta copy, FAQs, and full page copy in a single pipeline per URL</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Job name */}
          <div className="card p-5">
            <label className="block text-xs text-muted uppercase tracking-wider mb-2">Job Name (optional)</label>
            <input className="input-base" value={jobName} onChange={e => setJobName(e.target.value)} placeholder="e.g. Client X — Service Pages" />
          </div>

          {/* Output toggles */}
          <div className="card p-5">
            <h2 className="font-semibold text-sm mb-4">What to generate</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Page Copy', desc: 'Full page copy — sections, headings, body', value: genPageCopy, set: setGenPageCopy },
                { label: 'Meta Copy', desc: 'Title tag, meta description, H1', value: genMeta, set: setGenMeta },
                { label: 'FAQs', desc: 'FAQ section with Schema.org JSON-LD', value: genFaqs, set: setGenFaqs },
              ].map(({ label, desc, value, set }) => (
                <button key={label} onClick={() => set(!value)}
                  className={`p-3 rounded-xl border text-left transition-all ${value ? 'border-accent bg-accent/8' : 'border-border hover:border-accent/40'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-colors ${value ? 'bg-accent border-accent' : 'border-border'}`}>
                      {value && <div className="w-1.5 h-1.5 bg-white rounded-sm" />}
                    </div>
                    <span className="text-xs font-semibold">{label}</span>
                  </div>
                  <p className="text-xs text-muted leading-tight">{desc}</p>
                </button>
              ))}
            </div>
            {genFaqs && (
              <div className="mt-3 flex items-center gap-3">
                <label className="text-xs text-muted">FAQs per URL:</label>
                <input type="number" min={1} max={10} className="input-base w-20 text-sm py-1" value={numFaqs} onChange={e => setNumFaqs(Number(e.target.value))} />
              </div>
            )}
            <p className="text-xs text-muted mt-3">All outputs share a single DFS, SERP, and competitor scrape per URL — no redundant API calls.</p>
          </div>

          {/* Template (only if page copy enabled) */}
          {genPageCopy && (
            <div className="card p-5 space-y-4">
              <h2 className="font-semibold text-sm">Page Copy Template</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Page Type</label>
                  <CustomSelect value={pageType} onChange={setPageType}
                    options={PAGE_TYPES.map(pt => ({ value: pt, label: PAGE_LABELS[pt] || pt }))} />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Template Mode</label>
                  <CustomSelect value={templateMode} onChange={value => setTemplateMode(value as 'predefined' | 'custom')}
                    options={[
                      { value: 'predefined', label: 'Predefined' },
                      { value: 'custom', label: 'Custom sections' },
                    ]} />
                </div>
              </div>
              {templateMode === 'predefined' && availableTemplates.length > 0 && (
                <div className="space-y-2">
                  {availableTemplates.map(t => (
                    <label key={t.key} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${templateKey === t.key ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'}`}>
                      <input type="radio" className="accent-[var(--accent)]" checked={templateKey === t.key} onChange={() => setTemplateKey(t.key)} />
                      <span className="text-sm font-medium">{t.name}</span>
                    </label>
                  ))}
                </div>
              )}
              {templateMode === 'custom' && (
                <div>
                  <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Custom Sections (Name | min-max words)</label>
                  <textarea className="input-base font-mono text-xs" rows={4} value={customTemplate} onChange={e => setCustomTemplate(e.target.value)} placeholder="Introduction | 100-160&#10;How It Works | 200-300&#10;FAQ | 150-250" />
                </div>
              )}
            </div>
          )}

          {/* URLs */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">URLs</h2>
              <div className="flex gap-2">
                <button onClick={() => setInputMode(inputMode === 'csv' ? 'manual' : 'csv')} className="text-xs text-muted hover:text-accent flex items-center gap-1">
                  <Upload size={12} /> Paste CSV
                </button>
                <button onClick={() => setRows([...rows, { url: '', keyword: '', page_type: pageType, h1: '', gen_page_copy: genPageCopy, gen_meta: genMeta, gen_faqs: genFaqs }])}
                  className="btn-ghost text-xs flex items-center gap-1">
                  <Plus size={12} /> Add row
                </button>
              </div>
            </div>

            <ImportErrors rows={importErrors} />

            {inputMode === 'csv' ? (
              <div>
                <p className="text-xs text-muted mb-2">Paste CSV or spreadsheet rows: URL, Keyword (optional), Page Type (optional), H1 (optional)</p>
                <textarea className="input-base font-mono text-xs" rows={5} value={csvPaste} onChange={e => setCsvPaste(e.target.value)} />
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
                  <div key={i} className="space-y-1.5">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <input className="input-base col-span-5 text-xs" placeholder="https://..." value={row.url}
                        onChange={e => { const r = [...rows]; r[i] = {...r[i], url: e.target.value}; setRows(r) }} />
                      <input className="input-base col-span-3 text-xs" placeholder="keyword" value={row.keyword}
                        onChange={e => { const r = [...rows]; r[i] = {...r[i], keyword: e.target.value}; setRows(r) }} />
                      <CustomSelect className="col-span-2 text-xs" value={row.page_type}
                        onChange={value => { const r = [...rows]; r[i] = {...r[i], page_type: value}; setRows(r) }}
                        options={PAGE_TYPES.map(pt => ({ value: pt, label: PAGE_LABELS[pt] }))} />
                      <div className="col-span-2 flex gap-1">
                        <input className="input-base text-xs flex-1" placeholder="H1" value={row.h1}
                          onChange={e => { const r = [...rows]; r[i] = {...r[i], h1: e.target.value}; setRows(r) }} />
                        {rows.length > 1 && (
                          <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="text-muted hover:text-error shrink-0"><X size={14} /></button>
                        )}
                      </div>
                    </div>
                    {/* Per-row output toggles */}
                    <div className="flex gap-3 pl-1">
                      {(['gen_page_copy', 'gen_meta', 'gen_faqs'] as const).map(field => {
                        const labels = { gen_page_copy: 'Page Copy', gen_meta: 'Meta', gen_faqs: 'FAQs' }
                        return (
                          <label key={field} className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" className="accent-[var(--accent)] w-3 h-3" checked={row[field]}
                              onChange={() => toggleRow(i, field)} />
                            <span className="text-xs text-muted">{labels[field]}</span>
                          </label>
                        )
                      })}
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
                <CustomSelect value={provider} onChange={setProvider} options={PROVIDERS} />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Business Type</label>
                <CustomSelect value={bizType} onChange={setBizType}
                  options={BIZ_TYPES.map(bt => ({ value: bt, label: bt.toUpperCase() }))} />
                <NicheSelect value={niche} onChange={setNiche} businessType={bizType} />
              </div>
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
              <span className="text-sm">Include brand name in meta copy</span>
            </label>
            <div>
              <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Client Brief</label>
              <textarea className="input-base text-xs" rows={4} value={clientBrief} onChange={e => setClientBrief(e.target.value)}
                placeholder="Key differentiators, tone, claims to include, USPs..." />
              <p className="text-xs text-muted mt-1">Injected into every prompt across all outputs.</p>
            </div>
          </div>

          {/* GSC */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">GSC (optional)</h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => setUseGsc(!useGsc)}
                  className={`w-9 h-5 rounded-full transition-colors relative ${useGsc ? 'bg-accent' : 'bg-border'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${useGsc ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm text-muted">Use GSC data</span>
              </label>
            </div>
            {useGsc && (
              <div>
                <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">GSC Property URL</label>
                <input className="input-base" value={siteUrl} onChange={e => setSiteUrl(e.target.value)} placeholder="https://example.com/" />
              </div>
            )}
          </div>

          {/* Advanced */}
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
                  <input className="input-base" value={fullBrand} onChange={e => setFullBrand(e.target.value)} placeholder="Dayson Shalabi Burkert" />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Forbidden Phrases</label>
                  <textarea className="input-base text-xs" rows={3} value={forbiddenPhrases} onChange={e => setForbiddenPhrases(e.target.value)} placeholder="best in class&#10;world-class" />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Branded Terms to Exclude</label>
                  <textarea className="input-base text-xs" rows={2} value={brandTerms} onChange={e => setBrandTerms(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-error text-sm bg-error/10 border border-error/20 rounded-lg px-4 py-3">{error}</p>}

          <button onClick={handleRun} disabled={running} className="btn-primary w-full py-3">
            {running ? 'Starting job...' : `Run All in One — ${rows.filter(r => r.url.startsWith('http')).length} URLs`}
          </button>

          <div className="card p-4 bg-warning/5 border-warning/20">
            <p className="text-xs text-muted">
              <span className="text-warning font-medium">Note:</span> All in One jobs are the longest-running jobs in the platform. A single URL with all three outputs enabled can take 5-15 minutes. For a 10-URL job, budget 1-2 hours. Run overnight for large batches.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
