'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import styles from '@/components/meta/MetaCopyWorkspace.module.css'
import CustomSelect from '@/components/ui/CustomSelect'
import ImportErrors from '@/components/ui/ImportErrors'
import {
  cleanModelLabel,
  cleanProviderLabel,
  JobLauncherShell,
  JobSection,
  JobSummaryBar,
  JobSummaryPills,
} from '@/components/ui/JobLauncher'
import NicheSelect from '@/components/ui/NicheSelect'
import SegmentedControl from '@/components/ui/SegmentedControl'
import Switch from '@/components/ui/Switch'
import { faqApi } from '@/lib/api/faq'
import {
  deleteTemplate,
  getProviderMetadata,
  listBrandProfiles,
  listTemplates,
  saveTemplate,
} from '@/lib/api/shared'
import {
  createCopyRowImportSchema,
  parseImportedRows,
  type ImportNotice,
  type RejectedImportRow,
} from '@/lib/import-rows'
import { createClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type Row = { url: string; keyword: string; page_type: string; h1: string }
type SettingsTab = 'generation' | 'brand' | 'data'
type ScrapeProvider = 'jina' | 'firecrawl'
type Template = { id: string; name: string; settings: Record<string, unknown> }
type BrandProfile = { id: string; name: string; data: Record<string, string> }

const PAGE_TYPES = ['general', 'product', 'category', 'service', 'landing_page', 'blog', 'local']
const BIZ_TYPES = ['general', 'b2b', 'b2c', 'ecommerce', 'service', 'local']
const PROVIDERS = ['Claude', 'OpenAI', 'Gemini (free)', 'Mistral (free tier)', 'Groq (free tier)']
const FAQS_PER_PAGE_MIN = 1
const FAQS_PER_PAGE_MAX = 7
const PROCESSING_CHUNK_SIZE_MIN = 1
const PROCESSING_CHUNK_SIZE_MAX = 5
const SCRAPE_PROVIDERS: { value: ScrapeProvider; label: string }[] = [
  { value: 'jina', label: 'Jina' },
  { value: 'firecrawl', label: 'Firecrawl' },
]

const PROVIDER_MODELS: Record<string, { label: string; value: string }[]> = {
  Claude: [
    { label: 'Claude Sonnet 5 (default)', value: 'claude-sonnet-5' },
    { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
    { label: 'Claude Haiku 4.5', value: 'claude-haiku-4-5-20251001' },
  ],
  OpenAI: [
    { label: 'GPT-5.5 (latest)', value: 'gpt-5.5' },
    { label: 'GPT-5.4', value: 'gpt-5.4' },
    { label: 'GPT-5.4 mini', value: 'gpt-5.4-mini' },
    { label: 'GPT-5.4 nano', value: 'gpt-5.4-nano' },
  ],
  'Gemini (free)': [
    { label: 'Gemini 3.5 Flash (default)', value: 'gemini-3.5-flash' },
    { label: 'Gemini 3.1 Flash-Lite', value: 'gemini-3.1-flash-lite' },
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

function resolveProviderModel(provider: string, requestedModel?: string) {
  const options = PROVIDER_MODELS[provider] || []
  if (requestedModel && options.some(option => option.value === requestedModel)) return requestedModel
  return options[0]?.value || ''
}

const emptyRow = (): Row => ({ url: '', keyword: '', page_type: 'general', h1: '' })

function clampIntegerSetting(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.trunc(parsed), minimum), maximum)
}

function createFaqRowImportSchema() {
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

export default function NewFaqJobPage() {
  const router = useRouter()
  const [inputMode, setInputMode] = useState<'manual' | 'paste' | 'csv'>('manual')
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('generation')
  const [rows, setRows] = useState<Row[]>([emptyRow()])
  const [pasteText, setPasteText] = useState('')
  const [importErrors, setImportErrors] = useState<RejectedImportRow[]>([])
  const [importNotices, setImportNotices] = useState<ImportNotice[]>([])
  const [jobName, setJobName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [brandProfiles, setBrandProfiles] = useState<BrandProfile[]>([])
  const [selectedBrandProfileId, setSelectedBrandProfileId] = useState('')

  const [provider, setProvider] = useState('Claude')
  const [model, setModel] = useState(PROVIDER_MODELS.Claude[0].value)
  const [niche, setNiche] = useState('none')
  const [businessType, setBusinessType] = useState('general')
  const [brandName, setBrandName] = useState('')
  const [fullBrandName, setFullBrandName] = useState('')
  const [includeBrand, setIncludeBrand] = useState(false)
  const [numFaqs, setNumFaqs] = useState(5)
  const [dfsLogin, setDfsLogin] = useState('')
  const [useGsc, setUseGsc] = useState(true)
  const [siteUrl, setSiteUrl] = useState('')
  const [scrapePages, setScrapePages] = useState(true)
  const [scrapeProvider, setScrapeProvider] = useState<ScrapeProvider>('jina')
  const [firecrawlFallback, setFirecrawlFallback] = useState(false)
  const [firecrawlKeyConfigured, setFirecrawlKeyConfigured] = useState(false)
  const [batchSize, setBatchSize] = useState(1)
  const [forbiddenPhrases, setForbiddenPhrases] = useState('')
  const [brandedTermsInput, setBrandedTermsInput] = useState('')
  const [loadAsyncAiOverview, setLoadAsyncAiOverview] = useState(true)
  const [locationCode, setLocationCode] = useState(2840)
  const [minVolume, setMinVolume] = useState(10)
  const [restrictedIndustry, setRestrictedIndustry] = useState(false)

  const effectiveNumFaqs = clampIntegerSetting(numFaqs, FAQS_PER_PAGE_MIN, FAQS_PER_PAGE_MAX, 5)
  const effectiveBatchSize = clampIntegerSetting(batchSize, PROCESSING_CHUNK_SIZE_MIN, PROCESSING_CHUNK_SIZE_MAX, 1)

  function handleProviderChange(nextProvider: string) {
    setProvider(nextProvider)
    setModel(resolveProviderModel(nextProvider))
  }

  useEffect(() => {
    async function loadSettings() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      try {
        const [metadata, savedTemplates, profiles] = await Promise.all([
          getProviderMetadata(session.access_token),
          listTemplates(session.access_token, 'faq'),
          listBrandProfiles(session.access_token),
        ])
        if (metadata?.provider && PROVIDER_MODELS[metadata.provider]) {
          setProvider(metadata.provider)
          setModel(PROVIDER_MODELS[metadata.provider][0].value)
        }
        if (metadata?.dfs_login) setDfsLogin(metadata.dfs_login)
        if (metadata?.site_url) setSiteUrl(metadata.site_url)
        if (metadata?.brand_name) setBrandName(metadata.brand_name)
        setFirecrawlKeyConfigured(Boolean(metadata?.has_firecrawl_key))
        if (Array.isArray(savedTemplates)) setTemplates(savedTemplates)
        if (Array.isArray(profiles)) setBrandProfiles(profiles)
      } catch (loadError) {
        console.error('Failed to load FAQ settings:', loadError)
      }
    }
    void loadSettings()
  }, [])

  function applyImportedText(text: string) {
    const result = parseImportedRows(text, createFaqRowImportSchema())
    const parsed = result.rows.map(({ url, keyword, page_type, h1 }) => ({ url, keyword, page_type, h1 }))
    setImportErrors(result.rejectedRows)
    setImportNotices(result.notices)
    if (parsed.length) {
      setRows(parsed)
      setInputMode('manual')
    }
  }

  async function handleCsvUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      applyImportedText(await file.text())
    } catch {
      setError('Failed to read CSV file')
    }
  }

  function updateRow(index: number, update: Partial<Row>) {
    setRows(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...update } : row))
  }

  function applyTemplate(settings: Record<string, unknown>) {
    if (typeof settings.provider === 'string' && PROVIDER_MODELS[settings.provider]) {
      setProvider(settings.provider)
      setModel(resolveProviderModel(
        settings.provider,
        typeof settings.model === 'string' ? settings.model : undefined,
      ))
    }
    if (typeof settings.business_type === 'string') setBusinessType(settings.business_type)
    if (typeof settings.brand_name === 'string') setBrandName(settings.brand_name)
    if (typeof settings.full_brand_name === 'string') setFullBrandName(settings.full_brand_name)
    if (typeof settings.include_brand === 'boolean') setIncludeBrand(settings.include_brand)
    if (settings.num_faqs !== undefined) setNumFaqs(clampIntegerSetting(settings.num_faqs, FAQS_PER_PAGE_MIN, FAQS_PER_PAGE_MAX, 5))
    if (typeof settings.forbidden_phrases === 'string') setForbiddenPhrases(settings.forbidden_phrases)
    if (typeof settings.branded_terms_input === 'string') setBrandedTermsInput(settings.branded_terms_input)
    if (settings.batch_size !== undefined) setBatchSize(clampIntegerSetting(settings.batch_size, PROCESSING_CHUNK_SIZE_MIN, PROCESSING_CHUNK_SIZE_MAX, 1))
    if (typeof settings.use_gsc === 'boolean') setUseGsc(settings.use_gsc)
    if (typeof settings.scrape_pages === 'boolean') setScrapePages(settings.scrape_pages)
    setScrapeProvider(settings.scrape_provider === 'firecrawl' ? 'firecrawl' : 'jina')
    if (typeof settings.firecrawl_fallback === 'boolean') {
      setFirecrawlFallback(settings.firecrawl_fallback && firecrawlKeyConfigured)
    }
    if (typeof settings.site_url === 'string') setSiteUrl(settings.site_url)
  }

  async function handleDeleteTemplate(templateId: string) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await deleteTemplate(session.access_token, templateId)
    setTemplates(current => current.filter(template => template.id !== templateId))
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) return
    setSavingTemplate(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const template = await saveTemplate(session.access_token, templateName.trim(), {
        provider,
        model,
        business_type: businessType,
        brand_name: brandName,
        full_brand_name: fullBrandName,
        include_brand: includeBrand,
        num_faqs: effectiveNumFaqs,
        forbidden_phrases: forbiddenPhrases,
        branded_terms_input: brandedTermsInput,
        batch_size: effectiveBatchSize,
        use_gsc: useGsc,
        scrape_pages: scrapePages,
        scrape_provider: scrapeProvider,
        firecrawl_fallback: scrapePages && scrapeProvider === 'jina' && firecrawlFallback && firecrawlKeyConfigured,
        site_url: siteUrl,
      }, 'faq')
      if (template?.id) setTemplates(current => [template, ...current])
    }
    setSavingTemplate(false)
    setShowSaveTemplate(false)
    setTemplateName('')
  }

  async function handleRun() {
    setError('')
    const validRows = rows.filter(row => row.url.trim())
    if (!validRows.length) {
      setError('Add at least one URL')
      return
    }
    if (!dfsLogin.trim()) {
      setError('DataForSEO login is required')
      setSettingsTab('data')
      return
    }
    if (useGsc && !siteUrl.trim()) {
      setError('GSC is enabled but no site URL is provided. Enter the site URL or disable GSC.')
      setSettingsTab('data')
      return
    }
    if (scrapePages && scrapeProvider === 'firecrawl' && !firecrawlKeyConfigured) {
      setError('Add a Firecrawl API key in Settings before using Firecrawl as the primary scraper.')
      setSettingsTab('data')
      return
    }

    setSubmitting(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    try {
      const { job_id } = await faqApi.runJob(session.access_token, {
        name: jobName || `Job ${new Date().toLocaleDateString()}`,
        rows: validRows,
        settings: {
          provider,
          model,
          business_type: businessType,
          brand_name: brandName,
          full_brand_name: fullBrandName,
          brand_profile_id: selectedBrandProfileId,
          include_brand: includeBrand,
          num_faqs: effectiveNumFaqs,
          dfs_login: dfsLogin,
          location_code: locationCode,
          min_volume: minVolume,
          scrape_pages: scrapePages,
          scrape_provider: scrapeProvider,
          firecrawl_fallback: scrapePages && scrapeProvider === 'jina' && firecrawlFallback && firecrawlKeyConfigured,
          use_gsc: useGsc,
          restricted_industry: restrictedIndustry,
          site_url: siteUrl,
          batch_size: effectiveBatchSize,
          load_async_ai_overview: loadAsyncAiOverview,
          forbidden_phrases: forbiddenPhrases,
          branded_terms_input: brandedTermsInput,
          niche,
        },
      })
      router.push(`/faq/jobs/${job_id}`)
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Failed to start job')
      setSubmitting(false)
    }
  }

  const validUrlCount = rows.filter(row => row.url.trim().startsWith('http')).length
  const selectedProfile = brandProfiles.find(profile => profile.id === selectedBrandProfileId)

  return (
    <AppLayout title="New FAQ Job">
      <div className={`max-w-full ${styles.newPage}`}>
        <Link href="/faq/jobs" className={styles.backLink}>
          <ArrowLeft size={14} /> All FAQ jobs
        </Link>

        <JobLauncherShell
          compact
          eyebrow="FAQ Copy"
          title="New FAQ Copy job"
          description="Prepare URL rows and confirm the generation context before starting."
          summary={
            <JobSummaryBar
              summaryItems={[
                { label: 'URLs', value: validUrlCount },
                { label: 'FAQs/page', value: effectiveNumFaqs },
                {
                  label: 'AI',
                  value: <JobSummaryPills items={[
                    { label: cleanProviderLabel(provider), tone: 'accent' },
                    { label: cleanModelLabel(model, PROVIDER_MODELS[provider], provider) },
                  ]} />,
                },
                {
                  label: 'Context',
                  value: <JobSummaryPills items={[
                    { label: scrapePages ? (scrapeProvider === 'firecrawl' ? 'Firecrawl' : 'Jina') : 'No page context', tone: scrapePages ? 'success' : 'muted' },
                    ...(scrapePages && scrapeProvider === 'jina' && firecrawlFallback ? [{ label: 'Firecrawl fallback', tone: 'accent' as const }] : []),
                    ...(useGsc ? [{ label: 'GSC', tone: 'accent' as const }] : []),
                  ]} />,
                },
              ]}
            />
          }
          actions={
            <div className={styles.headerActions}>
              <button type="button" onClick={() => setShowSaveTemplate(value => !value)} className="btn-ghost text-xs">
                <Save size={14} /> Save template
              </button>
              <button type="button" onClick={() => void handleRun()} disabled={submitting || validUrlCount === 0} className="btn-primary text-sm">
                <Sparkles size={15} /> {submitting ? 'Starting job...' : 'Run Job'}
              </button>
            </div>
          }
        >
          <div className={`grid grid-cols-7 gap-6 ${styles.composerGrid}`}>
            <div className={`col-span-5 space-y-4 ${styles.composerMain}`}>
              <JobSection title="Inputs" description="Name this run and choose how URL rows are added.">
                <div className={styles.jobNameRow}>
                  <label className={styles.field}>
                    <span>Job name</span>
                    <input className="input-base" value={jobName} onChange={event => setJobName(event.target.value)} placeholder="Client - July FAQ refresh" />
                  </label>
                  <SegmentedControl
                    value={inputMode}
                    onChange={setInputMode}
                    ariaLabel="FAQ input mode"
                    options={[
                      { value: 'manual', label: 'Manual' },
                      { value: 'paste', label: 'Bulk paste' },
                      { value: 'csv', label: 'Upload CSV' },
                    ]}
                  />
                </div>
              </JobSection>

              <JobSection title="URL rows" description="URL is required. Keyword, page type, and existing H1 are optional.">
                <div className={styles.rowSectionTop}>
                  <span>{validUrlCount} valid / {rows.length} total</span>
                  <button type="button" className={styles.iconTextButton} onClick={() => { setRows(current => [...current, emptyRow()]); setInputMode('manual') }}>
                    <Plus size={13} /> Add row
                  </button>
                </div>

                <ImportErrors rows={importErrors} />
                {importNotices.length > 0 && (
                  <div role="status" aria-live="polite" className={styles.importNotice}>
                    <strong>Import adjusted column mapping</strong>
                    <ul>{importNotices.map(notice => <li key={`${notice.rowNumber}-${notice.message}`}>Row {notice.rowNumber}: {notice.message}</li>)}</ul>
                  </div>
                )}

                {inputMode === 'paste' && (
                  <div className={styles.pastePanel}>
                    <p>Paste tab-separated rows in this order: URL, keyword, page type, H1. Headers are supported.</p>
                    <textarea
                      className="input-base"
                      value={pasteText}
                      onChange={event => setPasteText(event.target.value)}
                      placeholder={'url\tkeyword\tpage type\th1\nhttps://example.com/page\t\tservice\tPage H1'}
                    />
                    <button type="button" onClick={() => applyImportedText(pasteText)} className="btn-ghost w-fit text-xs">Import rows</button>
                  </div>
                )}

                {inputMode === 'csv' && (
                  <div className={styles.uploadPanel}>
                    <p>CSV headers: url, keyword, page_type, h1.</p>
                    <label className="btn-ghost flex w-fit cursor-pointer items-center gap-2 text-xs">
                      <Upload size={13} /> Choose CSV
                      <input type="file" accept=".csv" className="hidden" onChange={event => void handleCsvUpload(event)} />
                    </label>
                  </div>
                )}

                {inputMode === 'manual' && (
                  <div className={styles.urlTable}>
                    <div className={styles.urlHeader} aria-hidden="true">
                      <span>#</span><span>URL</span><span>Keyword</span><span>Page type</span><span>Existing H1</span><span />
                    </div>
                    {rows.map((row, index) => (
                      <div key={index} className={styles.urlRow}>
                        <span className={styles.rowIndex}>{String(index + 1).padStart(2, '0')}</span>
                        <label><span className={styles.fieldCaption}>URL</span><input className="input-base" value={row.url} onChange={event => updateRow(index, { url: event.target.value })} placeholder="https://example.com/page" /></label>
                        <label><span className={styles.fieldCaption}>Keyword</span><input className="input-base" value={row.keyword} onChange={event => updateRow(index, { keyword: event.target.value })} placeholder="Optional keyword" /></label>
                        <div><span className={styles.fieldCaption}>Page type</span><CustomSelect size="compact" value={row.page_type} onChange={value => updateRow(index, { page_type: value })} options={PAGE_TYPES} /></div>
                        <label><span className={styles.fieldCaption}>Existing H1</span><input className="input-base" value={row.h1} onChange={event => updateRow(index, { h1: event.target.value })} placeholder="Optional H1" /></label>
                        <button type="button" className={styles.removeRowButton} aria-label={`Remove row ${index + 1}`} title="Remove row" disabled={rows.length === 1} onClick={() => setRows(current => current.filter((_, rowIndex) => rowIndex !== index))}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <button type="button" className={styles.addRowButton} onClick={() => setRows(current => [...current, emptyRow()])}>
                      <Plus size={13} /> Add URL row
                    </button>
                  </div>
                )}
              </JobSection>

              {templates.length > 0 && (
                <section className={styles.templatesPanel}>
                  <h2>Saved templates</h2>
                  <div className={styles.templateList}>
                    {templates.map(template => (
                      <span key={template.id} className="inline-flex items-center gap-1">
                        <button type="button" onClick={() => applyTemplate(template.settings)}>{template.name}</button>
                        <button type="button" aria-label={`Delete ${template.name} template`} title="Delete template" onClick={() => void handleDeleteTemplate(template.id)}><Trash2 size={11} /></button>
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {showSaveTemplate && (
                <section className={styles.saveTemplatePanel} aria-label="Save FAQ template">
                  <input autoFocus className="input-base text-xs" value={templateName} onChange={event => setTemplateName(event.target.value)} placeholder="Template name" />
                  <button type="button" disabled={!templateName.trim() || savingTemplate} className="btn-primary text-xs" onClick={() => void handleSaveTemplate()}>
                    <Save size={13} /> {savingTemplate ? 'Saving...' : 'Save'}
                  </button>
                </section>
              )}

              {error && <p className={styles.errorNotice}><AlertCircle size={14} /> {error}</p>}
            </div>

            <aside className={`col-span-2 space-y-4 ${styles.settingsRail}`}>
              <JobSection title="Configuration" description="Generation, brand, and search context for this run.">
                <div className={styles.settingsStatus}>
                  <span><strong>{validUrlCount ? 'Ready to generate' : 'Add a valid URL'}</strong><small>{cleanProviderLabel(provider)} / {cleanModelLabel(model, PROVIDER_MODELS[provider], provider)}</small></span>
                  <CheckCircle2 size={18} />
                </div>

                <div className={styles.settingsTabs} role="tablist" aria-label="FAQ run settings">
                  {([['generation', 'Generation'], ['brand', 'Brand'], ['data', 'Data']] as Array<[SettingsTab, string]>).map(([value, label]) => (
                    <button type="button" role="tab" key={value} aria-selected={settingsTab === value} data-active={settingsTab === value ? 'true' : 'false'} onClick={() => setSettingsTab(value)}>{label}</button>
                  ))}
                </div>

                {settingsTab === 'generation' && (
                  <div className={styles.settingsBody}>
                    <div className={styles.settingsGrid}>
                      <div className={styles.settingsField}><span>AI provider</span><CustomSelect value={provider} onChange={handleProviderChange} options={PROVIDERS} /></div>
                      <div className={styles.settingsField}><span>Model</span><CustomSelect value={model} onChange={setModel} options={PROVIDER_MODELS[provider] || []} /></div>
                      <div className={styles.settingsField}><span>Business type</span><CustomSelect value={businessType} onChange={setBusinessType} options={BIZ_TYPES} /></div>
                      <NicheSelect value={niche} onChange={setNiche} businessType={businessType} />
                      <label className={styles.settingsField}><span>FAQs per page</span><input type="number" className="input-base" min={FAQS_PER_PAGE_MIN} max={FAQS_PER_PAGE_MAX} value={effectiveNumFaqs} onChange={event => setNumFaqs(clampIntegerSetting(event.target.value, FAQS_PER_PAGE_MIN, FAQS_PER_PAGE_MAX, 5))} /></label>
                      <label className={styles.settingsField}><span>Processing chunk size</span><input type="number" className="input-base" min={PROCESSING_CHUNK_SIZE_MIN} max={PROCESSING_CHUNK_SIZE_MAX} value={effectiveBatchSize} onChange={event => setBatchSize(clampIntegerSetting(event.target.value, PROCESSING_CHUNK_SIZE_MIN, PROCESSING_CHUNK_SIZE_MAX, 1))} /></label>
                    </div>
                  </div>
                )}

                {settingsTab === 'brand' && (
                  <div className={styles.settingsBody}>
                    <div className={styles.settingsGridSingle}>
                      <div className={styles.settingsField}>
                        <span>Brand profile</span>
                        <CustomSelect
                          value={selectedBrandProfileId}
                          onChange={value => {
                            setSelectedBrandProfileId(value)
                            const profile = brandProfiles.find(p => p.id === value)
                            if (profile?.data?.brand_name) setBrandName(profile.data.brand_name)
                          }}
                          options={[{ value: '', label: 'No brand profile' }, ...brandProfiles.map(profile => ({ value: profile.id, label: profile.name }))]}
                        />
                      </div>
                      <label className={styles.settingsField}><span>Brand name</span><input className="input-base" value={brandName} onChange={event => setBrandName(event.target.value)} placeholder="Acme Inc." /></label>
                      <label className={styles.settingsField}><span>Full brand name</span><input className="input-base" value={fullBrandName} onChange={event => setFullBrandName(event.target.value)} placeholder="Full preferred brand name" /></label>
                    </div>
                    <div className={styles.toggleRow}>
                      <span className={styles.toggleCopy}><strong>Include brand in FAQ copy</strong><small>Allow natural brand mentions in questions or answers.</small></span>
                      <Switch ariaLabel="Include brand in FAQ copy" checked={includeBrand} onChange={setIncludeBrand} />
                    </div>
                    <div className={styles.settingsGridSingle}>
                      <label className={styles.settingsField}><span>Forbidden phrases</span><textarea className="input-base text-xs" value={forbiddenPhrases} onChange={event => setForbiddenPhrases(event.target.value)} placeholder={'best in class\nworld-class'} /></label>
                      <label className={styles.settingsField}><span>Branded terms to exclude</span><textarea className="input-base text-xs" value={brandedTermsInput} onChange={event => setBrandedTermsInput(event.target.value)} placeholder={'acme\nacme inc'} /></label>
                    </div>
                  </div>
                )}

                {settingsTab === 'data' && (
                  <div className={styles.settingsBody}>
                    <div className={styles.toggleRow}><span className={styles.toggleCopy}><strong>Scrape pages for context</strong><small>Read current page content before generation.</small></span><Switch ariaLabel="Scrape pages for context" checked={scrapePages} onChange={checked => { setScrapePages(checked); if (!checked) setFirecrawlFallback(false) }} /></div>
                    {scrapePages && (
                      <div className={styles.settingsField}>
                        <span>Primary scraper</span>
                        <SegmentedControl value={scrapeProvider} onChange={setScrapeProvider} options={SCRAPE_PROVIDERS} ariaLabel="Primary page scraper" />
                        <small className="text-xs text-muted">
                          {scrapeProvider === 'firecrawl'
                            ? (firecrawlKeyConfigured ? 'Use Firecrawl immediately for every URL in this job.' : <>Add a Firecrawl key in <Link href="/settings" className="text-accent">Settings</Link> before running.</>)
                            : 'Use Jina first for every URL in this job.'}
                        </small>
                      </div>
                    )}
                    {scrapePages && scrapeProvider === 'jina' && (
                      <div className={styles.toggleRow}>
                        <span className={styles.toggleCopy}>
                          <strong>Allow Firecrawl fallback</strong>
                          <small>{firecrawlKeyConfigured ? 'Use Firecrawl only when Jina fails.' : <>Add a Firecrawl key in <Link href="/settings" className="text-accent">Settings</Link> to enable.</>}</small>
                        </span>
                        <Switch ariaLabel="Allow Firecrawl fallback" checked={firecrawlFallback} onChange={setFirecrawlFallback} disabled={!firecrawlKeyConfigured} />
                      </div>
                    )}
                    <div className={styles.toggleRow}><span className={styles.toggleCopy}><strong>Use Search Console</strong><small>Add query and engagement context.</small></span><Switch ariaLabel="Use Google Search Console" checked={useGsc} onChange={setUseGsc} /></div>
                    {useGsc && <label className={styles.settingsField}><span>GSC property URL</span><input className="input-base" value={siteUrl} onChange={event => setSiteUrl(event.target.value)} placeholder="https://example.com/" /></label>}
                    <div className={styles.toggleRow}><span className={styles.toggleCopy}><strong>Load AI Overview context</strong><small>Include asynchronously loaded Google AI Overview data.</small></span><Switch ariaLabel="Load AI Overview context" checked={loadAsyncAiOverview} onChange={setLoadAsyncAiOverview} /></div>
                    <div className={styles.settingsGrid}>
                      <label className={styles.settingsField}><span>DataForSEO login</span><input className="input-base" value={dfsLogin} onChange={event => setDfsLogin(event.target.value)} placeholder="you@example.com" /></label>
                      <label className={styles.settingsField}><span>Location code</span><input type="number" className="input-base" value={locationCode} onChange={event => setLocationCode(Number(event.target.value))} /></label>
                      <label className={styles.settingsField}><span>Minimum volume</span><input type="number" className="input-base" value={minVolume} onChange={event => setMinVolume(Number(event.target.value))} /></label>
                    </div>
                    <div className={styles.toggleRow}><span className={styles.toggleCopy}><strong>Restricted industry mode</strong><small>Use GSC signals when keyword volume is suppressed.</small></span><Switch ariaLabel="Restricted industry mode" checked={restrictedIndustry} onChange={setRestrictedIndustry} /></div>
                  </div>
                )}

                <div className={styles.readinessList}>
                  <div><CheckCircle2 size={13} /><span>{validUrlCount} valid URL{validUrlCount === 1 ? '' : 's'}</span></div>
                  <div><CheckCircle2 size={13} /><span>{cleanProviderLabel(provider)} model selected</span></div>
                  <div><CheckCircle2 size={13} /><span>{selectedProfile?.name || brandName || 'No brand profile selected'}</span></div>
                  <div><CheckCircle2 size={13} /><span>{useGsc ? (siteUrl ? 'GSC property selected' : 'GSC needs a property') : 'GSC disabled'}</span></div>
                </div>
              </JobSection>
            </aside>
          </div>
        </JobLauncherShell>
      </div>
    </AppLayout>
  )
}
