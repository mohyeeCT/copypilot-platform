'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
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
import { metaApi } from '@/lib/api/meta'
import {
  getProviderMetadata,
  getSettings,
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

const PROVIDERS = ['Claude', 'OpenAI', 'Gemini (free)', 'Mistral (free tier)', 'Groq (free tier)']
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

function resolveProviderModel(provider: string, savedModel?: string | null) {
  const options = PROVIDER_MODELS[provider] ?? []
  return options.some(option => option.value === savedModel)
    ? savedModel || ''
    : options[0]?.value || ''
}

const BUSINESS_TYPES = ['general', 'b2b', 'b2c', 'ecommerce', 'service', 'local']
const PAGE_TYPES = ['general', 'category', 'product', 'service', 'landing_page', 'location', 'blog', 'brand']
const INPUT_MODES = (['manual', 'paste', 'csv'] as const)
type InputMode = typeof INPUT_MODES[number]
type SettingsTab = 'generation' | 'brand' | 'data'

const INPUT_MODE_LABELS: Record<InputMode, string> = {
  manual: 'Manual entry',
  paste: 'Paste from sheet',
  csv: 'Upload CSV',
}

interface Row {
  url: string
  keyword: string
  page_type: string
  h1: string
}

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

  const [provider, setProvider] = useState('Claude')
  const [model, setModel] = useState(PROVIDER_MODELS.Claude[0].value)
  const [businessType, setBusinessType] = useState('general')
  const [brandName, setBrandName] = useState('')
  const [fullBrandName, setFullBrandName] = useState('')
  const [includeBrand, setIncludeBrand] = useState(true)
  const [forbiddenPhrases, setForbiddenPhrases] = useState('')
  const [brandedTermsInput, setBrandedTermsInput] = useState('')
  const [dfsLogin, setDfsLogin] = useState('')
  const [locationCode, setLocationCode] = useState(2840)
  const [minVolume, setMinVolume] = useState(10)
  const [useGsc, setUseGsc] = useState(true)
  const [siteUrl, setSiteUrl] = useState('')
  const [scrapePages, setScrapePages] = useState(true)
  const [jobName, setJobName] = useState('')
  const [brandProfileId, setBrandProfileId] = useState('')
  const [niche, setNiche] = useState('none')
  const [restrictedIndustry, setRestrictedIndustry] = useState(false)

  const [rows, setRows] = useState<Row[]>([{ url: '', keyword: '', page_type: 'general', h1: '' }])
  const [pasteText, setPasteText] = useState('')
  const [importErrors, setImportErrors] = useState<RejectedImportRow[]>([])
  const [importNotices, setImportNotices] = useState<ImportNotice[]>([])
  const [inputMode, setInputMode] = useState<InputMode>('manual')

  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [templates, setTemplates] = useState<{ id: string; name: string; settings: Record<string, unknown> }[]>([])
  const [brandProfiles, setBrandProfiles] = useState<{ id: string; name: string; data: Record<string, string> }[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('generation')

  const load = useCallback(async () => {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }
    try {
      const [settings, profiles, savedTemplates, credentials] = await Promise.all([
        getSettings(session.access_token),
        listBrandProfiles(session.access_token),
        listTemplates(session.access_token, 'meta'),
        getProviderMetadata(session.access_token).catch(() => null),
      ])
      if (settings) {
        setProvider(settings.provider || 'Claude')
        setBusinessType(settings.business_type || 'general')
        setBrandName(settings.brand_name || '')
        setFullBrandName(settings.full_brand_name || '')
        setIncludeBrand(settings.include_brand ?? true)
        if (settings.niche) setNiche(settings.niche)
        setForbiddenPhrases(settings.forbidden_phrases || '')
        setBrandedTermsInput(settings.branded_terms_input || '')
        setLocationCode(settings.location_code || 2840)
        setMinVolume(settings.min_volume ?? 10)
        setUseGsc(settings.use_gsc ?? true)
        setSiteUrl(settings.site_url || '')
        setScrapePages(settings.scrape_pages ?? true)
      }
      if (credentials) setDfsLogin(credentials.dfs_login || '')
      setBrandProfiles(Array.isArray(profiles) ? profiles : [])
      setTemplates(Array.isArray(savedTemplates) ? savedTemplates : [])
    } catch (loadError) {
      console.error('Failed to load settings/credentials on mount:', loadError)
    }
    setSettingsLoaded(true)
  }, [router])

  useEffect(() => { void load() }, [load])

  function applyTemplate(template: Record<string, unknown>) {
    const nextProvider = (template.provider as string) || provider
    if (template.provider) setProvider(nextProvider)
    if (template.model || template.provider) setModel(resolveProviderModel(nextProvider, template.model as string | undefined))
    if (template.business_type) setBusinessType(template.business_type as string)
    if (template.brand_name) setBrandName(template.brand_name as string)
    if (template.full_brand_name) setFullBrandName(template.full_brand_name as string)
    if (template.include_brand != null) setIncludeBrand(Boolean(template.include_brand))
    if (template.forbidden_phrases) setForbiddenPhrases(template.forbidden_phrases as string)
    if (template.branded_terms_input) setBrandedTermsInput(template.branded_terms_input as string)
    if (template.location_code) setLocationCode(Number(template.location_code))
    if (template.min_volume != null) setMinVolume(Number(template.min_volume))
    if (template.use_gsc != null) setUseGsc(Boolean(template.use_gsc))
    if (template.site_url) setSiteUrl(template.site_url as string)
    if (template.scrape_pages != null) setScrapePages(Boolean(template.scrape_pages))
    if (template.brand_profile_id) setBrandProfileId(template.brand_profile_id as string)
    if (template.restricted_industry != null) setRestrictedIndustry(Boolean(template.restricted_industry))
  }

  function handleProviderChange(nextProvider: string) {
    setProvider(nextProvider)
    setModel(PROVIDER_MODELS[nextProvider]?.[0]?.value ?? '')
  }

  function applyBrandProfile(value: string) {
    setBrandProfileId(value)
    const profile = brandProfiles.find(p => p.id === value)
    if (profile?.data?.brand_name) setBrandName(profile.data.brand_name)
    if (profile?.data?.full_brand_name) setFullBrandName(profile.data.full_brand_name)
  }

  function handleIncludeBrandToggle() {
    const next = !includeBrand
    setIncludeBrand(next)
    if (!next || brandName.trim()) return
    const profile = brandProfiles.find(p => p.id === brandProfileId)
    if (profile?.data?.brand_name) setBrandName(profile.data.brand_name)
    if (profile?.data?.full_brand_name) setFullBrandName(profile.data.full_brand_name)
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

  function updateRow(index: number, patch: Partial<Row>) {
    setRows(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row))
  }

  async function handleRun() {
    const validRows = rows.filter(row => row.url.trim().startsWith('http'))
    if (!validRows.length) {
      setError('Add at least one valid URL starting with http.')
      return
    }
    setError('')
    setRunning(true)

    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    const payload = {
      name: jobName.trim() || `Meta job \u2014 ${validRows.length} URLs`,
      rows: validRows,
      settings: {
        provider,
        model,
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
        scrape_pages: scrapePages,
        brand_profile_id: brandProfileId,
        niche,
        restricted_industry: restrictedIndustry,
      },
    }

    try {
      const data = await metaApi.runJob(session.access_token, payload)
      router.push(`/meta/jobs/${data.job_id}`)
    } catch (runError: unknown) {
      setError((runError as Error).message || 'Failed to start job')
      setRunning(false)
    }
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) return
    setSavingTemplate(true)
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (session) {
      const template = await saveTemplate(session.access_token, templateName.trim(), {
        provider,
        model,
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
        scrape_pages: scrapePages,
        brand_profile_id: brandProfileId,
        niche,
        restricted_industry: restrictedIndustry,
      }, 'meta')
      if (template?.id) setTemplates(current => [template, ...current])
    }
    setSavingTemplate(false)
    setShowSaveTemplate(false)
    setTemplateName('')
  }

  if (!settingsLoaded) {
    return (
      <AppLayout title="New Meta Job">
        <div className="flex h-48 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </AppLayout>
    )
  }

  const validUrlCount = rows.filter(row => row.url.startsWith('http')).length
  const selectedProfile = brandProfiles.find(profile => profile.id === brandProfileId)

  return (
    <AppLayout title="New Meta Job">
      <div className={`max-w-full ${styles.newPage}`}>
        <Link href="/meta/jobs" className={styles.backLink}>
          <ArrowLeft size={14} /> All Meta jobs
        </Link>

        <JobLauncherShell
          compact
          eyebrow="Meta Copy"
          title="New Meta Copy job"
          description="Prepare URL rows and confirm the generation context before starting."
          summary={
            <JobSummaryBar
              summaryItems={[
                { label: 'URLs', value: validUrlCount },
                {
                  label: 'AI',
                  value: <JobSummaryPills items={[
                    { label: cleanProviderLabel(provider), tone: 'accent' },
                    { label: cleanModelLabel(model, PROVIDER_MODELS[provider], provider) },
                  ]} />,
                },
                { label: 'Business', value: businessType },
                {
                  label: 'Context',
                  value: <JobSummaryPills items={[
                    { label: scrapePages ? 'Page context' : 'No page context', tone: scrapePages ? 'success' : 'muted' },
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
              <button type="button" onClick={() => void handleRun()} disabled={running || validUrlCount === 0} className="btn-primary text-sm">
                <Sparkles size={15} /> {running ? 'Starting job...' : 'Run Job'}
              </button>
            </div>
          }
        >
          <div className={`grid grid-cols-7 gap-6 ${styles.composerGrid}`}>
            <div className={`col-span-5 space-y-4 ${styles.composerMain}`}>
              <JobSection
                title="Inputs"
                description="Name this run and choose how URL rows are added."
              >
                <div className={styles.jobNameRow}>
                  <label className={styles.field}>
                    <span>Job name</span>
                    <input
                      className="input-base"
                      value={jobName}
                      onChange={event => setJobName(event.target.value)}
                      placeholder="Client - July Meta refresh"
                    />
                  </label>
                  <SegmentedControl
                    value={inputMode}
                    onChange={setInputMode}
                    ariaLabel="Meta input mode"
                    options={INPUT_MODES.map(value => ({ value, label: INPUT_MODE_LABELS[value] }))}
                  />
                </div>
              </JobSection>

              <JobSection
                title="URL rows"
                description="URL is required. Keyword, page type, and existing H1 remain optional."
              >
                <div className={styles.rowSectionTop}>
                  <span>{validUrlCount} valid / {rows.length} total</span>
                  <button
                    type="button"
                    className={styles.iconTextButton}
                    onClick={() => {
                      setRows(current => [...current, { url: '', keyword: '', page_type: 'general', h1: '' }])
                      setInputMode('manual')
                    }}
                  >
                    <Plus size={13} /> Add row
                  </button>
                </div>

                <ImportErrors rows={importErrors} />

                {importNotices.length > 0 && (
                  <div role="status" aria-live="polite" className={styles.importNotice}>
                    <strong>Import adjusted column mapping</strong>
                    <ul>
                      {importNotices.map(notice => (
                        <li key={`${notice.rowNumber}-${notice.message}`}>Row {notice.rowNumber}: {notice.message}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {inputMode === 'paste' && (
                  <div className={styles.pastePanel}>
                    <p>Paste tab-separated rows in this order: URL, keyword, page type, H1. Headers are supported.</p>
                    <textarea
                      className="input-base"
                      value={pasteText}
                      onChange={event => setPasteText(event.target.value)}
                      placeholder={'url\tkeyword\tpage type\th1\nhttps://example.com/page\t\tcategory\tPage H1'}
                    />
                    <button type="button" onClick={parsePaste} className="btn-ghost w-fit text-xs">Import rows</button>
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
                        <label>
                          <span className={styles.fieldCaption}>URL</span>
                          <input className="input-base" value={row.url} placeholder="https://example.com/page" onChange={event => updateRow(index, { url: event.target.value })} />
                        </label>
                        <label>
                          <span className={styles.fieldCaption}>Keyword</span>
                          <input className="input-base" value={row.keyword} placeholder="Optional keyword" onChange={event => updateRow(index, { keyword: event.target.value })} />
                        </label>
                        <div>
                          <span className={styles.fieldCaption}>Page type</span>
                          <CustomSelect value={row.page_type} onChange={value => updateRow(index, { page_type: value })} options={PAGE_TYPES} />
                        </div>
                        <label>
                          <span className={styles.fieldCaption}>Existing H1</span>
                          <input className="input-base" value={row.h1} placeholder="Optional H1" onChange={event => updateRow(index, { h1: event.target.value })} />
                        </label>
                        <button
                          type="button"
                          className={styles.removeRowButton}
                          aria-label={`Remove row ${index + 1}`}
                          title="Remove row"
                          disabled={rows.length === 1}
                          onClick={() => setRows(current => current.filter((_, rowIndex) => rowIndex !== index))}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className={styles.addRowButton}
                      onClick={() => setRows(current => [...current, { url: '', keyword: '', page_type: 'general', h1: '' }])}
                    >
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
                      <button type="button" key={template.id} onClick={() => applyTemplate(template.settings)}>
                        <RotateCcw size={12} /> {template.name}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {showSaveTemplate && (
                <section className={styles.saveTemplatePanel} aria-label="Save Meta template">
                  <input
                    autoFocus
                    className="input-base text-xs"
                    value={templateName}
                    onChange={event => setTemplateName(event.target.value)}
                    placeholder="Template name"
                  />
                  <button type="button" disabled={!templateName.trim() || savingTemplate} className="btn-primary text-xs" onClick={() => void handleSaveTemplate()}>
                    <Save size={13} /> {savingTemplate ? 'Saving...' : 'Save'}
                  </button>
                </section>
              )}

              {error && <p className={styles.errorNotice}>{error}</p>}
            </div>

            <aside className={`col-span-2 space-y-4 ${styles.settingsRail}`}>
              <JobSection
                title="Configuration"
                description="Generation, brand, and search context for this run."
              >
                <div className={styles.settingsStatus}>
                  <span><strong>{validUrlCount ? 'Ready to generate' : 'Add a valid URL'}</strong><small>{cleanProviderLabel(provider)} / {cleanModelLabel(model, PROVIDER_MODELS[provider], provider)}</small></span>
                  <CheckCircle2 size={18} />
                </div>

                <div className={styles.settingsTabs} role="tablist" aria-label="Meta run settings">
                  {([
                    ['generation', 'Generation'],
                    ['brand', 'Brand'],
                    ['data', 'Data'],
                  ] as Array<[SettingsTab, string]>).map(([value, label]) => (
                    <button
                      type="button"
                      role="tab"
                      key={value}
                      aria-selected={settingsTab === value}
                      data-active={settingsTab === value ? 'true' : 'false'}
                      onClick={() => setSettingsTab(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {settingsTab === 'generation' && (
                  <div className={styles.settingsBody}>
                    <div className={styles.settingsGrid}>
                      <div className={styles.settingsField}>
                        <span>AI provider</span>
                        <CustomSelect value={provider} onChange={handleProviderChange} options={PROVIDERS} />
                      </div>
                      <div className={styles.settingsField}>
                        <span>Model</span>
                        <CustomSelect value={model} onChange={setModel} options={PROVIDER_MODELS[provider] ?? []} />
                      </div>
                      <div className={styles.settingsField}>
                        <span>Business type</span>
                        <CustomSelect value={businessType} onChange={setBusinessType} options={BUSINESS_TYPES} />
                      </div>
                      <NicheSelect value={niche} onChange={setNiche} businessType={businessType} />
                    </div>
                  </div>
                )}

                {settingsTab === 'brand' && (
                  <div className={styles.settingsBody}>
                    <div className={styles.settingsGridSingle}>
                      <div className={styles.settingsField}>
                        <span>Brand profile</span>
                        <CustomSelect
                          value={brandProfileId} onChange={applyBrandProfile}
                          options={[
                            { value: '', label: 'No brand profile' },
                            ...brandProfiles.map(profile => ({ value: profile.id, label: profile.name })),
                          ]}
                        />
                      </div>
                      <label className={styles.settingsField}>
                        <span>Brand name</span>
                        <input className="input-base" value={brandName} onChange={event => setBrandName(event.target.value)} placeholder="Acme Inc." />
                      </label>
                    </div>
                    <div className={styles.toggleRow}>
                      <span className={styles.toggleCopy}><strong>Include brand in copy</strong><small>Use the brand in title and description where appropriate.</small></span>
                      <Switch ariaLabel="Include brand in Meta copy" checked={includeBrand} onChange={handleIncludeBrandToggle} />
                    </div>
                    <button type="button" className={styles.advancedButton} onClick={() => setShowAdvanced(value => !value)}>
                      Copy rules {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {showAdvanced && (
                      <div className={styles.settingsGridSingle}>
                        <label className={styles.settingsField}>
                          <span>Full brand name</span>
                          <input className="input-base" value={fullBrandName} onChange={event => setFullBrandName(event.target.value)} placeholder="Full legal or preferred brand name" />
                        </label>
                        <label className={styles.settingsField}>
                          <span>Forbidden phrases</span>
                          <textarea className="input-base text-xs" value={forbiddenPhrases} onChange={event => setForbiddenPhrases(event.target.value)} placeholder={'best in class\nworld-class'} />
                        </label>
                        <label className={styles.settingsField}>
                          <span>Branded terms to exclude</span>
                          <textarea className="input-base text-xs" value={brandedTermsInput} onChange={event => setBrandedTermsInput(event.target.value)} placeholder={'acme\nacme inc'} />
                        </label>
                      </div>
                    )}
                  </div>
                )}

                {settingsTab === 'data' && (
                  <div className={styles.settingsBody}>
                    <div className={styles.toggleRow}>
                      <span className={styles.toggleCopy}><strong>Use Search Console</strong><small>Add query and engagement context.</small></span>
                      <Switch ariaLabel="Use Google Search Console" checked={useGsc} onChange={setUseGsc} />
                    </div>
                    {useGsc && (
                      <label className={styles.settingsField}>
                        <span>GSC property URL</span>
                        <input className="input-base" value={siteUrl} onChange={event => setSiteUrl(event.target.value)} placeholder="https://example.com/" />
                      </label>
                    )}
                    <div className={styles.toggleRow}>
                      <span className={styles.toggleCopy}><strong>Scrape pages for context</strong><small>Read current page content before generation.</small></span>
                      <Switch ariaLabel="Scrape pages for context" checked={scrapePages} onChange={setScrapePages} />
                    </div>
                    <div className={styles.settingsGrid}>
                      <label className={styles.settingsField}>
                        <span>DataForSEO login</span>
                        <input className="input-base" value={dfsLogin} onChange={event => setDfsLogin(event.target.value)} placeholder="you@example.com" />
                      </label>
                      <label className={styles.settingsField}>
                        <span>Location code</span>
                        <input type="number" className="input-base" value={locationCode} onChange={event => setLocationCode(Number(event.target.value))} />
                      </label>
                      <label className={styles.settingsField}>
                        <span>Minimum volume</span>
                        <input type="number" className="input-base" value={minVolume} onChange={event => setMinVolume(Number(event.target.value))} />
                      </label>
                    </div>
                    <div className={styles.toggleRow}>
                      <span className={styles.toggleCopy}><strong>Restricted industry mode</strong><small>Use GSC engagement without DataForSEO volume scoring.</small></span>
                      <Switch ariaLabel="Restricted industry mode" checked={restrictedIndustry} onChange={setRestrictedIndustry} />
                    </div>
                  </div>
                )}

                <div className={styles.readinessList}>
                  <div><CheckCircle2 size={13} /><span>{validUrlCount} valid URL{validUrlCount === 1 ? '' : 's'}</span></div>
                  <div><CheckCircle2 size={13} /><span>{cleanProviderLabel(provider)} model selected</span></div>
                  <div><CheckCircle2 size={13} /><span>{selectedProfile?.name || brandName || 'No brand profile selected'}</span></div>
                  <div><CheckCircle2 size={13} /><span>{useGsc ? (siteUrl ? 'GSC property selected' : 'GSC enabled') : 'GSC disabled'}</span></div>
                </div>
              </JobSection>
            </aside>
          </div>
        </JobLauncherShell>
      </div>
    </AppLayout>
  )
}
