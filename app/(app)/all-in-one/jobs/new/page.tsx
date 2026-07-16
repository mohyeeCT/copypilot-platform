'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, CheckCircle2, Plus, X, ChevronDown, ChevronUp } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import styles from '@/components/meta/MetaCopyWorkspace.module.css'
import CustomSelect from '@/components/ui/CustomSelect'
import ImportErrors from '@/components/ui/ImportErrors'
import { cleanModelLabel, cleanProviderLabel, JobLauncherShell, JobSection, JobSummaryBar, JobSummaryPills } from '@/components/ui/JobLauncher'
import NicheSelect from '@/components/ui/NicheSelect'
import ScraperControls, { type ScrapeProvider } from '@/components/ui/ScraperControls'
import SegmentedControl from '@/components/ui/SegmentedControl'
import StyledCheckbox from '@/components/ui/StyledCheckbox'
import Switch from '@/components/ui/Switch'
import { createCopyRowImportSchema, parseImportedRows, type ImportNotice, type RejectedImportRow } from '@/lib/import-rows'
import { toDisplayOptions } from '@/lib/option-labels'
import { createClient } from '@/lib/supabase'
import { aioApi } from '@/lib/api/all-in-one'
import { geopilotApi } from '@/lib/api/geopilot'
import { getSettings, getProviderMetadata, listBrandProfiles } from '@/lib/api/shared'

export const dynamic = 'force-dynamic'

const PROVIDERS  = ['Claude', 'OpenAI', 'Gemini (free)', 'Mistral (free tier)', 'Groq (free tier)']
const PROVIDER_MODELS: Record<string, { label: string; value: string }[]> = {
  'Claude': [
    { label: 'Claude Sonnet 5 (default)', value: 'claude-sonnet-5' },
    { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
    { label: 'Claude Haiku 4.5', value: 'claude-haiku-4-5-20251001' },
  ],
  'OpenAI': [
    { label: 'GPT-5.5 (latest)', value: 'gpt-5.5' },
    { label: 'GPT-5.4', value: 'gpt-5.4' },
    { label: 'GPT-5.4 mini', value: 'gpt-5.4-mini' },
    { label: 'GPT-5.4 nano', value: 'gpt-5.4-nano' },
  ],
  'Gemini (free)': [
    { label: 'Gemini 3.5 Flash (default)', value: 'gemini-3.5-flash' },
    { label: 'Gemini 3.1 Flash-Lite', value: 'gemini-3.1-flash-lite' },
  ],
  'Mistral (free tier)': [{ label: 'Mistral Small Latest', value: 'mistral-small-latest' }],
  'Groq (free tier)': [{ label: 'Llama 3.3 70B Versatile', value: 'llama-3.3-70b-versatile' }],
}

function resolveProviderModel(provider: string, savedModel?: string | null) {
  const options = PROVIDER_MODELS[provider] ?? []
  return options.some(option => option.value === savedModel)
    ? savedModel || ''
    : options[0]?.value || ''
}
const BIZ_TYPES  = ['general', 'b2b', 'b2c', 'ecommerce', 'service', 'local']
const PAGE_TYPES = ['blog', 'case_study', 'glossary', 'homepage', 'landing_page', 'service', 'local', 'about', 'contact', 'product', 'collection']
const PAGE_LABELS: Record<string, string> = {
  blog: 'Blog', case_study: 'Case Study', glossary: 'Glossary',
  homepage: 'Homepage', landing_page: 'Landing Page', service: 'Service Page', local: 'Local Service Page',
  about: 'About Us', contact: 'Contact Us', product: 'Product Page', collection: 'Collection / Category',
}

function createAioRowImportSchema(defaultPageType: string) {
  return createCopyRowImportSchema(
    { page_type: defaultPageType },
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
          notice: 'Page type column was omitted; used the selected default page type.',
        },
      ],
    },
  )
}

interface Row { url: string; keyword: string; page_type: string; h1: string; gen_page_copy: boolean; gen_meta: boolean; gen_faqs: boolean }

type BrandProfile = {
  id: string
  name: string
  data?: {
    brand_name?: string
    full_brand_name?: string
  }
}

export default function NewAIOJob() {
  const router = useRouter()

  // Core settings
  const [provider, setProvider]       = useState('Claude')
  const [model, setModel]             = useState(PROVIDER_MODELS['Claude'][0].value)
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
  const [scrapePages, setScrapePages] = useState(true)
  const [scrapeProvider, setScrapeProvider] = useState<ScrapeProvider>('jina')
  const [firecrawlFallback, setFirecrawlFallback] = useState(false)
  const [firecrawlKeyConfigured, setFirecrawlKeyConfigured] = useState(false)

  // Rows
  const [rows, setRows]               = useState<Row[]>([{ url: '', keyword: '', page_type: 'service', h1: '', gen_page_copy: true, gen_meta: true, gen_faqs: true }])
  const [csvPaste, setCsvPaste]       = useState('')
  const [importErrors, setImportErrors] = useState<RejectedImportRow[]>([])
  const [importNotices, setImportNotices] = useState<ImportNotice[]>([])
  const [inputMode, setInputMode]     = useState<'manual' | 'csv'>('manual')

  const [templates, setTemplates]     = useState<Record<string, {key: string; name: string}[]>>({})
  const [brandProfiles, setBrandProfiles] = useState<BrandProfile[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [running, setRunning]         = useState(false)
  const [error, setError]             = useState('')
  const [handoffNotice, setHandoffNotice] = useState('')
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  const load = useCallback(async () => {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { router.push('/login'); return }
    try {
      const recommendationId = new URLSearchParams(window.location.search).get('geopilot_recommendation') || ''
      const requestedProfileId = new URLSearchParams(window.location.search).get('client_profile_id') || ''
      const recommendationRequest = recommendationId
        ? geopilotApi.getAioRecommendation(session.access_token, recommendationId)
            .then(data => ({ data, error: '' }))
            .catch(loadError => ({ data: null, error: loadError instanceof Error ? loadError.message : 'Recommendation unavailable' }))
        : Promise.resolve({ data: null, error: '' })
      const [s, metadata, bp, tmpl, recommendationResult] = await Promise.all([
        getSettings(session.access_token),
        getProviderMetadata(session.access_token).catch(() => null),
        listBrandProfiles(session.access_token),
        aioApi.getTemplates(session.access_token),
        recommendationRequest,
      ])
      if (s) {
        const savedProvider = s.provider || 'Claude'
        setProvider(savedProvider)
        setModel(resolveProviderModel(savedProvider, s.model || null))
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
        setScrapePages(s.scrape_pages ?? true)
        setScrapeProvider(s.scrape_provider === 'firecrawl' ? 'firecrawl' : 'jina')
        setFirecrawlFallback(Boolean(s.firecrawl_fallback) && Boolean(metadata?.has_firecrawl_key))
        if (s.niche) setNiche(s.niche)
      }
      setFirecrawlKeyConfigured(Boolean(metadata?.has_firecrawl_key))
      setBrandProfiles(Array.isArray(bp) ? bp : [])
      const requestedProfile = Array.isArray(bp) ? bp.find(item => item.id === requestedProfileId) : null
      if (requestedProfile) {
        setBrandProfileId(requestedProfileId)
        const profileBrandName = requestedProfile.data?.brand_name?.trim() || requestedProfile.name.trim()
        if (profileBrandName) setBrandName(profileBrandName)
        const profileFullBrandName = requestedProfile.data?.full_brand_name?.trim()
        if (profileFullBrandName) setFullBrand(profileFullBrandName)
      }
      if (tmpl && typeof tmpl === 'object') setTemplates(tmpl)
      const draft = recommendationResult.data?.recommendation?.draft
      if (draft) {
        const recommendedPageType = PAGE_TYPES.includes(draft.page_type) ? draft.page_type : 'blog'
        setJobName(String(draft.job_name || 'GEOPilot content opportunity'))
        setBrandName(String(draft.brand_name || ''))
        setClientBrief(String(draft.client_brief || ''))
        setPageType(recommendedPageType)
        setRows(current => current.map(row => ({ ...row, page_type: recommendedPageType })))
        if (draft.brand_profile_id && Array.isArray(bp) && bp.some(item => item.id === draft.brand_profile_id)) {
          setBrandProfileId(draft.brand_profile_id)
        }
        setHandoffNotice('GEOPilot prepared this draft from a verified competitor-citation gap. Confirm the destination URL and keyword before running it.')
      } else if (recommendationResult.error) {
        setError(`GEOPilot recommendation could not be loaded: ${recommendationResult.error}`)
      }
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

  function handleProviderChange(value: string) {
    setProvider(value)
    setModel(PROVIDER_MODELS[value]?.[0]?.value || '')
  }

  function applyBrandProfile(value: string) {
    setBrandProfileId(value)
    const profile = brandProfiles.find(item => item.id === value)
    if (!profile) return

    const profileBrandName = profile.data?.brand_name?.trim() || profile.name.trim()
    if (profileBrandName) setBrandName(profileBrandName)

    const profileFullBrandName = profile.data?.full_brand_name?.trim()
    if (profileFullBrandName) setFullBrand(profileFullBrandName)
  }

  function parseCsv() {
    const result = parseImportedRows(csvPaste, createAioRowImportSchema(pageType))
    const parsed = result.rows.map(({ url, keyword, page_type, h1 }) => ({
      url, keyword, page_type, h1,
      gen_page_copy: genPageCopy,
      gen_meta: genMeta,
      gen_faqs: genFaqs,
    }))
    setImportErrors(result.rejectedRows)
    setImportNotices(result.notices)
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

    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { router.push('/login'); return }

    let dfsLogin = ''
    try {
      const creds = await getProviderMetadata(session.access_token)
      dfsLogin = creds?.dfs_login || ''
      const hasFirecrawlKey = Boolean(creds?.has_firecrawl_key)
      setFirecrawlKeyConfigured(hasFirecrawlKey)
      if (scrapePages && scrapeProvider === 'firecrawl' && !hasFirecrawlKey) {
        setError('Add a Firecrawl API key in Settings before using Firecrawl as the primary scraper.')
        return
      }
    } catch (e) {
      console.error('Failed to fetch credentials at submit time:', e)
      setError('Failed to load credentials. Please try again.')
      setRunning(false)
      return
    }

    setRunning(true)

    const payload = {
      name: jobName.trim() || `All in One — ${validRows.length} URLs`,
      rows: validRows.map(r => ({ ...r, page_type: r.page_type || pageType })),
      settings: {
        niche, provider, model, dfs_login: dfsLogin,
        business_type: bizType, brand_name: brandName, full_brand_name: fullBrand,
        branded_terms_input: brandTerms, include_brand: includeBrand,
        forbidden_phrases: forbiddenPhrases, location_code: locationCode, min_volume: minVolume,
        client_brief: clientBrief, page_type: pageType,
        template_key: templateMode === 'predefined' ? templateKey : '',
        custom_template_text: templateMode === 'custom' ? customTemplate : '',
        use_gsc: useGsc, site_url: siteUrl, brand_profile_id: brandProfileId,
        scrape_pages: scrapePages, scrape_provider: scrapeProvider,
        firecrawl_fallback: scrapePages && scrapeProvider === 'jina' && firecrawlFallback && firecrawlKeyConfigured,
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

  const validUrlCount = rows.filter(r => r.url.startsWith('http')).length
  const enabledOutputs = [
    genPageCopy ? 'Page Copy' : '',
    genMeta ? 'Meta' : '',
    genFaqs ? 'FAQs' : '',
  ].filter(Boolean).join(', ') || 'None'
  const populatedRows = rows.filter(row => row.url.trim())
  const h1Coverage = populatedRows.filter(row => row.h1.trim()).length
  const readinessItems = [
    {
      label: 'Valid URLs',
      value: `${validUrlCount}/${populatedRows.length || 0}`,
      ready: validUrlCount > 0 && validUrlCount === populatedRows.length,
    },
    {
      label: 'Brand context',
      value: brandProfileId ? 'Profile selected' : clientBrief.trim() || brandName.trim() ? 'Manual context' : 'Not provided',
      ready: Boolean(brandProfileId || clientBrief.trim() || brandName.trim()),
    },
    {
      label: 'Current H1s',
      value: `${h1Coverage}/${populatedRows.length || 0}`,
      ready: populatedRows.length > 0 && h1Coverage === populatedRows.length,
    },
    {
      label: 'GSC property',
      value: useGsc ? (siteUrl.trim() ? 'Ready' : 'Missing') : 'Not enabled',
      ready: !useGsc || Boolean(siteUrl.trim()),
    },
  ]

  return (
    <AppLayout title="All in One">
      <div className={`max-w-full ${styles.newPage}`}>
        <Link href="/all-in-one/jobs" className={styles.backLink}>
          <ArrowLeft size={16} /> Back to All in One jobs
        </Link>
        {handoffNotice ? (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-accent/25 bg-accent/5 px-4 py-3 text-sm text-foreground">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-accent" />
            <div><strong className="block text-xs">GEOPilot recommendation</strong><span className="text-xs text-muted">{handoffNotice}</span></div>
          </div>
        ) : null}
        <JobLauncherShell
          eyebrow="All in One"
          title="New All in One Job"
          description="Create meta copy, FAQs, and page copy from one coordinated run while keeping every output control visible."
          summary={
            <JobSummaryBar
              summaryItems={[
                { label: 'URLs', value: validUrlCount },
                { label: 'Outputs', value: enabledOutputs },
                { label: 'AI', value: <JobSummaryPills items={[
                  { label: cleanProviderLabel(provider), tone: 'accent' },
                  { label: cleanModelLabel(model, PROVIDER_MODELS[provider], provider) },
                ]} /> },
                { label: 'Data', value: <JobSummaryPills items={[
                  { label: scrapePages ? (scrapeProvider === 'firecrawl' ? 'Firecrawl' : 'Jina') : 'No scrape', tone: scrapePages ? 'success' : 'muted' },
                  ...(scrapePages && scrapeProvider === 'jina' && firecrawlFallback ? [{ label: 'Firecrawl fallback', tone: 'accent' as const }] : []),
                  ...(useGsc ? [{ label: 'GSC', tone: 'accent' as const }] : [{ label: 'No GSC', tone: 'muted' as const }]),
                ]} /> },
              ]}
            />
          }
          actions={
            <button onClick={handleRun} disabled={running} className="btn-primary text-sm px-4 py-2">
              {running ? 'Starting job...' : 'Run Job'}
            </button>
          }
        >
          <div className={`grid grid-cols-7 gap-6 ${styles.composerGrid}`}>
            <div className={`col-span-5 space-y-4 ${styles.composerMain}`}>
          {/* Job name */}
          <JobSection title="Inputs" description="Name the run before adding URL rows. All defaults and row behavior are unchanged.">
            <label className="block text-xs text-muted uppercase tracking-wider mb-2">Job Name (optional)</label>
            <input className="input-base" value={jobName} onChange={e => setJobName(e.target.value)} placeholder="e.g. Client X — Service Pages" />
          </JobSection>

          {/* Output toggles */}
          <JobSection title="Outputs" description="Choose which deliverables this run should create.">
            <h2 className="font-semibold text-sm mb-4">What to generate</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Page Copy', desc: 'Full page copy — sections, headings, body', value: genPageCopy, set: setGenPageCopy },
                { label: 'Meta Copy', desc: 'Title tag, meta description, H1', value: genMeta, set: setGenMeta },
                { label: 'FAQs', desc: 'FAQ section with Schema.org JSON-LD', value: genFaqs, set: setGenFaqs },
              ].map(({ label, desc, value, set }) => (
                <button key={label} type="button" aria-pressed={value} onClick={() => set(!value)}
                  className={`p-3 rounded-lg border text-left transition-colors ${value ? 'border-accent bg-accent/8' : 'border-border hover:border-accent/40'}`}>
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
          </JobSection>

          {/* Template (only if page copy enabled) */}
          {genPageCopy && (
            <JobSection title="Page copy plan" description="Template selection is only shown when page copy is enabled." className="space-y-4">
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
                      <input type="radio" checked={templateKey === t.key} onChange={() => setTemplateKey(t.key)} style={{ accentColor: 'var(--accent)' }} />
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
            </JobSection>
          )}

          {/* URLs */}
          <JobSection title="URL rows" description="Paste or manually edit rows. Per-row output toggles stay attached to each URL.">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">URLs</h2>
              <div className="flex gap-2">
                <SegmentedControl
                  value={inputMode}
                  onChange={setInputMode}
                  ariaLabel="All in One input mode"
                  options={[
                    { value: 'manual', label: 'Manual' },
                    { value: 'csv', label: 'Paste CSV' },
                  ]}
                />
                <button onClick={() => setRows([...rows, { url: '', keyword: '', page_type: pageType, h1: '', gen_page_copy: genPageCopy, gen_meta: genMeta, gen_faqs: genFaqs }])}
                  className="btn-ghost text-xs flex items-center gap-1">
                  <Plus size={12} /> Add row
                </button>
              </div>
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

            {inputMode === 'csv' ? (
              <div>
                <p className="text-xs text-muted mb-2">Paste CSV or spreadsheet rows: URL, Keyword (optional), Page Type (optional), H1 (optional). Headers are supported.</p>
                <textarea className="input-base font-mono text-xs" rows={5} value={csvPaste} onChange={e => setCsvPaste(e.target.value)} />
                <button onClick={parseCsv} className="btn-primary mt-2 text-xs">Parse CSV</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="hidden sm:grid grid-cols-12 gap-2 text-xs text-muted px-1 mb-1">
                  <span className="col-span-5">URL *</span>
                  <span className="col-span-3">Keyword</span>
                  <span className="col-span-2">Page Type</span>
                  <span className="col-span-2">H1</span>
                </div>
                {rows.map((row, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <input aria-label={`URL for row ${i + 1}`} className="input-base sm:col-span-5 text-xs" placeholder="https://..." value={row.url}
                        onChange={e => { const r = [...rows]; r[i] = {...r[i], url: e.target.value}; setRows(r) }} />
                      <input aria-label={`Keyword for row ${i + 1}`} className="input-base sm:col-span-3 text-xs" placeholder="Keyword (optional)" value={row.keyword}
                        onChange={e => { const r = [...rows]; r[i] = {...r[i], keyword: e.target.value}; setRows(r) }} />
                      <CustomSelect size="compact" className="sm:col-span-2" value={row.page_type}
                        onChange={value => { const r = [...rows]; r[i] = {...r[i], page_type: value}; setRows(r) }}
                        options={PAGE_TYPES.map(pt => ({ value: pt, label: PAGE_LABELS[pt] }))} />
                      <div className="sm:col-span-2 flex gap-1">
                        <input aria-label={`H1 for row ${i + 1}`} className="input-base text-xs flex-1" placeholder="Current H1 (optional)" value={row.h1}
                          onChange={e => { const r = [...rows]; r[i] = {...r[i], h1: e.target.value}; setRows(r) }} />
                        {rows.length > 1 && (
                          <button type="button" aria-label={`Remove row ${i + 1}`} title="Remove row" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="text-muted hover:text-error shrink-0"><X size={14} /></button>
                        )}
                      </div>
                    </div>
                    {/* Per-row output toggles */}
                    <div className="flex gap-3 pl-1">
                      {(['gen_page_copy', 'gen_meta', 'gen_faqs'] as const).map(field => {
                        const labels = { gen_page_copy: 'Page Copy', gen_meta: 'Meta', gen_faqs: 'FAQs' }
                        return (
                          <label key={field} className="flex items-center gap-1.5 cursor-pointer">
                            <StyledCheckbox
                              ariaLabel={`${labels[field]} for row ${i + 1}`}
                              checked={row[field]}
                              onChange={() => toggleRow(i, field)}
                            />
                            <span className="text-xs text-muted">{labels[field]}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted mt-1">{validUrlCount} valid URLs</p>
              </div>
            )}
          </JobSection>
            </div>

            <div className={`col-span-2 space-y-4 ${styles.settingsRail} ${styles.aioSettingsRail}`}>

          <JobSection title="Run readiness" description="Input coverage before research and generation begin." className="space-y-2">
            {readinessItems.map(item => (
              <div key={item.label} className="flex items-center justify-between gap-3 text-xs">
                <span className="flex items-center gap-2 text-muted">
                  {item.ready
                    ? <CheckCircle2 size={13} className="text-success shrink-0" />
                    : <AlertTriangle size={13} className="text-warning shrink-0" />}
                  {item.label}
                </span>
                <span className="font-mono text-text text-right">{item.value}</span>
              </div>
            ))}
            <p className="text-xs text-muted pt-2 border-t border-border">Owned-page evidence is verified during the run and reported with each result.</p>
          </JobSection>

          {/* Copy Settings */}
          <JobSection title="Configuration" description="AI, business, brand, and client brief controls." className="space-y-4">
            <h2 className="font-semibold text-sm">Copy Settings</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">AI Provider</label>
                <CustomSelect value={provider} onChange={handleProviderChange} options={PROVIDERS} />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">AI Model</label>
                <CustomSelect value={model} onChange={setModel} options={PROVIDER_MODELS[provider] ?? []} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Business Type</label>
                <CustomSelect value={bizType} onChange={setBizType}
                  options={toDisplayOptions(BIZ_TYPES)} />
                <NicheSelect value={niche} onChange={setNiche} businessType={bizType} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Brand Name</label>
                <input className="input-base" value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="Acme Inc." />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Client profile</label>
                <CustomSelect value={brandProfileId} onChange={applyBrandProfile}
                  options={[
                    { value: '', label: 'Unassigned' },
                    ...brandProfiles.map(bp => ({ value: bp.id, label: bp.name })),
                  ]} />
              </div>
            </div>
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm">Include brand name in meta copy</span>
              <Switch ariaLabel="Include brand name in meta copy" checked={includeBrand} onChange={setIncludeBrand} />
            </label>
            <div>
              <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Client Brief</label>
              <textarea className="input-base text-xs" rows={4} value={clientBrief} onChange={e => setClientBrief(e.target.value)}
                placeholder="Key differentiators, tone, claims to include, USPs..." />
              <p className="text-xs text-muted mt-1">Injected into every prompt across all outputs.</p>
            </div>
          </JobSection>

          {/* GSC */}
          <JobSection title="Data & context" description="Optional Search Console context remains explicit." className="space-y-4">
            <ScraperControls
              enabled={scrapePages}
              onEnabledChange={setScrapePages}
              provider={scrapeProvider}
              onProviderChange={setScrapeProvider}
              firecrawlFallback={firecrawlFallback}
              onFirecrawlFallbackChange={setFirecrawlFallback}
              firecrawlKeyConfigured={firecrawlKeyConfigured}
            />
            <div className="border-t border-border" />
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">GSC (optional)</h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch ariaLabel="Use Search Console data" checked={useGsc} onChange={setUseGsc} />
                <span className="text-sm text-muted">Use GSC data</span>
              </label>
            </div>
            {useGsc && (
              <div>
                <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">GSC Property URL</label>
                <input className="input-base" value={siteUrl} onChange={e => setSiteUrl(e.target.value)} placeholder="https://example.com/" />
              </div>
            )}
          </JobSection>

          {/* Advanced */}
          <div className="card overflow-hidden">
            <button onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium hover:bg-border/20 transition-colors">
              Advanced settings
              {showAdvanced ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
            </button>
            {showAdvanced && (
              <div className="px-5 pb-5 space-y-4 border-t border-border">
                <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
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

            </div>

          </div>

          <div className={`space-y-4 ${styles.composerFooter}`}>
            {error && <p className="text-error text-sm bg-error/10 border border-error/20 rounded-lg px-4 py-3">{error}</p>}

            <div className="card p-4 bg-warning/5 border-warning/20">
              <p className="text-xs text-muted">
                <span className="text-warning font-medium">Note:</span> All in One jobs are the longest-running jobs in the platform. A single URL with all three outputs enabled can take 5-15 minutes. For a 10-URL job, budget 1-2 hours. Run overnight for large batches.
              </p>
            </div>
          </div>
        </JobLauncherShell>
      </div>
    </AppLayout>
  )
}
