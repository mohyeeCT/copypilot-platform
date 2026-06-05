'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, X, Upload, ChevronDown, ChevronUp } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import NicheSelect from '@/components/ui/NicheSelect'
import { createClient } from '@/lib/supabase'
import { pageCopyApi } from '@/lib/api/page-copy'
import { getSettings, getProviderCredentials, listBrandProfiles } from '@/lib/api/shared'

export const dynamic = 'force-dynamic'

const PROVIDERS    = ['Claude', 'OpenAI', 'Gemini (free)', 'Mistral (free tier)', 'Groq (free tier)']
const BIZ_TYPES    = ['b2b', 'b2c', 'ecommerce', 'service', 'local', 'general']
const PAGE_TYPES   = ['blog', 'case_study', 'glossary', 'homepage', 'service', 'local', 'about', 'contact', 'product', 'collection']
const PAGE_LABELS: Record<string, string> = {
  blog: 'Blog', case_study: 'Case Study', glossary: 'Glossary',
  homepage: 'Homepage', service: 'Service Page', local: 'Local Service Page',
  about: 'About Us', contact: 'Contact Us', product: 'Product Page', collection: 'Collection / Category',
}

interface Row { url: string; keyword: string; page_type: string; h1: string; template_key: string }
interface Template { key: string; name: string; description: string }

export default function NewPageCopyJob() {
  const router = useRouter()

  const [provider, setProvider]       = useState('Claude')
  const [bizType, setBizType]         = useState('general')
  const [brandName, setBrandName]     = useState('')
  const [fullBrand, setFullBrand]     = useState('')
  const [brandTerms, setBrandTerms]   = useState('')
  const [locationCode, setLocationCode] = useState(2840)
  const [minVolume, setMinVolume]     = useState(10)
  const [clientBrief, setClientBrief] = useState('')
  const [pageType, setPageType]       = useState('blog')
  const [templateKey, setTemplateKey] = useState('blog_standard')
  const [customTemplate, setCustomTemplate] = useState('')
  const [templateMode, setTemplateMode] = useState<'predefined' | 'custom'>('predefined')
  const [jobName, setJobName]         = useState('')
  const [brandProfileId, setBrandProfileId] = useState('')
  const [niche, setNiche] = useState('none')
  const [includeBrand, setIncludeBrand] = useState(true)
  const [forbiddenPhrases, setForbiddenPhrases] = useState('')
  const [brandProfiles, setBrandProfiles]   = useState<{id: string; name: string}[]>([])

  const [rows, setRows]               = useState<Row[]>([{ url: '', keyword: '', page_type: 'blog', h1: '', template_key: '' }])
  const [csvPaste, setCsvPaste]       = useState('')
  const [inputMode, setInputMode]     = useState<'manual' | 'csv'>('manual')

  const [templates, setTemplates]     = useState<Record<string, Template[]>>({})
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
        pageCopyApi.getTemplates(session.access_token),
      ])
      if (s) {
        setProvider(s.provider || 'Claude')
        setBizType(s.business_type || 'general')
        setBrandName(s.brand_name || '')
        setFullBrand(s.full_brand_name || '')
        setBrandTerms(s.branded_terms_input || '')
        setLocationCode(s.location_code || 2840)
        setMinVolume(s.min_volume ?? 10)
      if (s.niche) setNiche(s.niche)
      }
      setBrandProfiles(Array.isArray(bp) ? bp : [])
      if (tmpl && typeof tmpl === 'object') setTemplates(tmpl)
    } catch {}
    setSettingsLoaded(true)
  }, [router])

  useEffect(() => { load() }, [load])

  // Update template key when page type changes
  useEffect(() => {
    const available = templates[pageType] || []
    if (available.length > 0 && !available.find(t => t.key === templateKey)) {
      setTemplateKey(available[0].key)
    }
  }, [pageType, templates, templateKey])

  function parseCsv() {
    const parsed: Row[] = csvPaste.trim().split('\n').filter(l => l.trim()).map(line => {
      const parts = line.split('\t').map(p => p.trim())
      return {
        url: parts[0] || '', keyword: parts[1] || '',
        page_type: parts[2] || pageType, h1: parts[3] || '', template_key: parts[4] || '',
      }
    }).filter(r => r.url)
    if (parsed.length) { setRows(parsed); setInputMode('manual'); setCsvPaste('') }
  }

  async function handleRun() {
    const validRows = rows.filter(r => r.url.trim().startsWith('http'))
    if (!validRows.length) { setError('Add at least one valid URL'); return }
    if (templateMode === 'custom' && !customTemplate.trim()) { setError('Enter at least one section in the custom template'); return }
    setError('')
    setRunning(true)

    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { router.push('/login'); return }

    let apiKey = '', dfsLogin = '', dfsPassword = ''
    try {
      const creds = await getProviderCredentials(session.access_token)
      const ps = (creds?.provider_settings as Record<string, string>) || {}
      apiKey = ps.api_key || ''
      dfsLogin = ps.dfs_login || ''
      dfsPassword = ps.dfs_password || ''
    } catch {}

    const payload = {
      name: jobName.trim() || `Page Copy — ${validRows.length} URLs`,
      rows: validRows.map(r => ({
        ...r,
        page_type: r.page_type || pageType,
        template_key: r.template_key || (templateMode === 'predefined' ? templateKey : ''),
      })),
      settings: {
        provider, api_key: apiKey, dfs_login: dfsLogin, dfs_password: dfsPassword,
        business_type: bizType, brand_name: brandName, full_brand_name: fullBrand,
        branded_terms_input: brandTerms, location_code: locationCode, min_volume: minVolume,
        page_type: pageType, template_key: templateMode === 'predefined' ? templateKey : '',
        custom_template_text: templateMode === 'custom' ? customTemplate : '',
        client_brief: clientBrief, brand_profile_id: brandProfileId,
        niche, include_brand: includeBrand, forbidden_phrases: forbiddenPhrases,
      },
    }

    try {
      const data = await pageCopyApi.runJob(session.access_token, payload)
      router.push(`/page-copy/jobs/${data.job_id}`)
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to start job')
      setRunning(false)
    }
  }

  const availableTemplates = templates[pageType] || []

  if (!settingsLoaded) return (
    <AppLayout title="New Page Copy Job">
      <div className="flex items-center justify-center h-48">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  )

  return (
    <AppLayout title="New Page Copy Job">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/page-copy/jobs" className="text-muted hover:text-text transition-colors"><ArrowLeft size={18} /></Link>
          <div>
            <h1 className="text-xl font-bold">New Page Copy Job</h1>
            <p className="text-muted text-sm">Full-page copy — blogs, case studies, glossary pages</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Job name */}
          <div className="card p-5">
            <label className="block text-xs text-muted uppercase tracking-wider mb-2">Job Name (optional)</label>
            <input className="input-base" value={jobName} onChange={e => setJobName(e.target.value)} placeholder="e.g. Client X Blog Q2" />
          </div>

          {/* Template selection */}
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-sm">Template</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Page Type</label>
                <select className="input-base" value={pageType} onChange={e => setPageType(e.target.value)}>
                  {PAGE_TYPES.map(pt => <option key={pt} value={pt}>{PAGE_LABELS[pt] || pt}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Template Mode</label>
                <select className="input-base" value={templateMode} onChange={e => setTemplateMode(e.target.value as 'predefined' | 'custom')}>
                  <option value="predefined">Predefined template</option>
                  <option value="custom">Custom sections</option>
                </select>
              </div>
            </div>

            {templateMode === 'predefined' && availableTemplates.length > 0 && (
              <div>
                <label className="block text-xs text-muted mb-2 uppercase tracking-wider">Template</label>
                <div className="space-y-2">
                  {availableTemplates.map(t => (
                    <label key={t.key} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${templateKey === t.key ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'}`}>
                      <input type="radio" className="mt-0.5 accent-[var(--accent)]" checked={templateKey === t.key} onChange={() => setTemplateKey(t.key)} />
                      <div>
                        <p className="text-sm font-medium">{t.name}</p>
                        {t.description && <p className="text-xs text-muted mt-0.5">{t.description}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {templateMode === 'custom' && (
              <div>
                <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Custom Sections (one per line: Section Name | min-max words)</label>
                <textarea className="input-base font-mono text-xs" rows={5} value={customTemplate}
                  onChange={e => setCustomTemplate(e.target.value)}
                  placeholder="Introduction | 100-160&#10;How It Works | 200-300&#10;FAQ | 150-250&#10;Next Steps | 60-100" />
              </div>
            )}
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
                <button onClick={() => setRows([...rows, { url: '', keyword: '', page_type: pageType, h1: '', template_key: '' }])}
                  className="btn-ghost text-xs flex items-center gap-1">
                  <Plus size={12} /> Add row
                </button>
              </div>
            </div>

            {inputMode === 'csv' ? (
              <div>
                <p className="text-xs text-muted mb-2">Tab-separated: URL, Keyword (optional), Page Type (optional), H1 (optional), Template Key (optional)</p>
                <textarea className="input-base font-mono text-xs" rows={6} value={csvPaste}
                  onChange={e => setCsvPaste(e.target.value)} placeholder="https://example.com/blog/post&#9;main keyword&#9;blog" />
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
                      {PAGE_TYPES.map(pt => <option key={pt} value={pt}>{PAGE_LABELS[pt]}</option>)}
                    </select>
                    <div className="col-span-2 flex gap-1">
                      <input className="input-base text-xs flex-1" placeholder="H1" value={row.h1}
                        onChange={e => { const r = [...rows]; r[i] = {...r[i], h1: e.target.value}; setRows(r) }} />
                      {rows.length > 1 && (
                        <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="text-muted hover:text-error shrink-0"><X size={14} /></button>
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
                <select className="input-base" value={bizType} onChange={e => setBizType(e.target.value)}>
                  {BIZ_TYPES.map(bt => <option key={bt} value={bt}>{bt.toUpperCase()}</option>)}
                </select>
              </div>
              <NicheSelect
                value={niche}
                onChange={setNiche}
                businessType={bizType}
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
            <div>
              <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Client Brief (optional)</label>
              <textarea className="input-base text-xs" rows={4} value={clientBrief}
                onChange={e => setClientBrief(e.target.value)}
                placeholder="Client specialises in X. Key differentiators: Y, Z. Tone: confident but not boastful. Key claims to include: ..." />
              <p className="text-xs text-muted mt-1">Injected into every section prompt. Include tone notes, key claims, USPs, or anything the AI should know.</p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div onClick={() => setIncludeBrand(v => !v)}
                style={{ width: 36, height: 20, borderRadius: 99, position: 'relative', cursor: 'pointer',
                  background: includeBrand ? 'var(--accent)' : 'var(--border)', transition: 'background .15s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 2, left: includeBrand ? 18 : 2, width: 16, height: 16,
                  background: '#fff', borderRadius: '50%', boxShadow: 'var(--shadow-xs)', transition: 'left .15s' }} />
              </div>
              <span className="text-sm">Include brand name in copy</span>
            </label>
            <div>
              <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Forbidden Phrases (optional)</label>
              <textarea className="input-base text-xs" rows={2} value={forbiddenPhrases}
                onChange={e => setForbiddenPhrases(e.target.value)}
                placeholder="one phrase per line" />
              <p className="text-xs text-muted mt-1">Phrases the AI must never use. Applied to every section.</p>
            </div>
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
                  <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Branded Terms to Exclude</label>
                  <textarea className="input-base text-xs" rows={3} value={brandTerms} onChange={e => setBrandTerms(e.target.value)} placeholder="acme&#10;acme inc" />
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-error text-sm bg-error/10 border border-error/20 rounded-lg px-4 py-3">{error}</p>}

          <button onClick={handleRun} disabled={running} className="btn-primary w-full py-3">
            {running ? 'Starting job...' : `Generate Page Copy — ${rows.filter(r => r.url.startsWith('http')).length} URLs`}
          </button>

          <div className="card p-4 bg-warning/5 border-warning/20">
            <p className="text-xs text-muted"><span className="text-warning font-medium">Note:</span> Page copy jobs take significantly longer than FAQ or meta — each URL requires 6–8 AI calls (one per section) plus competitor scraping. A 10-URL job can take 15–30 minutes depending on the provider.</p>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
