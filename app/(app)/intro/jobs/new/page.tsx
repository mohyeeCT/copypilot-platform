'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import CustomSelect from '@/components/ui/CustomSelect'
import ImportErrors from '@/components/ui/ImportErrors'
import { JobLauncherShell, JobSection, JobSummaryBar } from '@/components/ui/JobLauncher'
import NicheSelect from '@/components/ui/NicheSelect'
import SegmentedControl from '@/components/ui/SegmentedControl'
import StyledCheckbox from '@/components/ui/StyledCheckbox'
import Switch from '@/components/ui/Switch'
import { createClient } from '@/lib/supabase'
import { createCopyRowImportSchema, parseImportedRows, type ImportNotice, type RejectedImportRow } from '@/lib/import-rows'
import { introApi } from '@/lib/api/intro'
import { getProviderMetadata, listTemplates, saveTemplate, deleteTemplate, listBrandProfiles } from '@/lib/api/shared'
import { Upload, Plus, Trash2, AlertCircle, BookmarkPlus, ChevronDown } from 'lucide-react'

export const dynamic = 'force-dynamic'

type Row = { url: string; keyword: string; page_type: string; h1: string }
const emptyRow = (): Row => ({ url: '', keyword: '', page_type: 'service_lp', h1: '' })

const PAGE_TEMPLATES = [
  { value: 'service_lp', label: 'Service / Landing Page' },
  { value: 'category', label: 'Category (Ecommerce)' },
  { value: 'product', label: 'Product Page' },
  { value: 'location', label: 'Location Page' },
  { value: 'blog', label: 'Blog / Editorial' },
  { value: 'brand', label: 'Brand / About' },
]
const PAGE_TEMPLATE_VALUES = PAGE_TEMPLATES.map(template => template.value)

function createIntroRowImportSchema(defaultPageType: string) {
  return createCopyRowImportSchema(
    { page_type: defaultPageType },
    false,
    {
      pageTypeValues: PAGE_TEMPLATE_VALUES,
      positionalLayouts: [
        {
          keys: ['url', 'page_type', 'h1'],
          match: [{ index: 1, columnKey: 'page_type' }],
          notice: 'Keyword column was omitted; mapped the second column as page template.',
        },
        {
          keys: ['url', 'keyword', 'h1'],
          notice: 'Page template column was omitted; used the selected default template.',
        },
      ],
    },
  )
}

const BIZ_TYPES = ['general', 'b2b', 'b2c', 'ecommerce', 'service', 'local']
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

const WORD_COUNT_OPTIONS = [60, 80, 100, 120, 150, 180]

export default function NewJobPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'manual' | 'paste' | 'csv'>('manual')
  const [rows, setRows] = useState<Row[]>([emptyRow()])
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [colWidths, setColWidths] = useState({ url: 300, keyword: 200, type: 160, h1: 200 })
  const resizingCol = useRef<string | null>(null)
  const resizeStartX = useRef(0)
  const resizeStartW = useRef(0)

  const onResizeStart = useCallback((col: string, e: React.MouseEvent) => {
    e.preventDefault()
    resizingCol.current = col
    resizeStartX.current = e.clientX
    resizeStartW.current = colWidths[col as keyof typeof colWidths]
    const onMove = (ev: MouseEvent) => {
      if (!resizingCol.current) return
      const delta = ev.clientX - resizeStartX.current
      setColWidths(w => ({ ...w, [resizingCol.current!]: Math.max(80, resizeStartW.current + delta) }))
    }
    const onUp = () => {
      resizingCol.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [colWidths])

  const [pasteText, setPasteText] = useState('')
  const [importErrors, setImportErrors] = useState<RejectedImportRow[]>([])
  const [importNotices, setImportNotices] = useState<ImportNotice[]>([])
  const [jobName, setJobName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [templates, setTemplates] = useState<{id: string; name: string; settings: Record<string, unknown>}[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [brandProfiles, setBrandProfiles] = useState<{id: string; name: string; data: Record<string, string>}[]>([])
  const [selectedBrandProfileId, setSelectedBrandProfileId] = useState('')

  // AI provider
  const [provider, setProvider] = useState('Claude')
  const [niche, setNiche] = useState('none')
  const [model, setModel] = useState(PROVIDER_MODELS['Claude'][0].value)
  function handleProviderChange(p: string) {
    setProvider(p)
    setModel(PROVIDER_MODELS[p][0].value)
  }

  // Copy settings
  const [businessType, setBusinessType] = useState('general')
  const [pageTemplate, setPageTemplate] = useState('service_lp')
  const [wordCount, setWordCount] = useState(100)
  const [paragraphCount, setParagraphCount] = useState(1)
  const [maxSupportingKeywords, setMaxSupportingKeywords] = useState(5)
  const [brandName, setBrandName] = useState('')
  const [fullBrandName, setFullBrandName] = useState('')
  const [includeBrand, setIncludeBrand] = useState(false)
  const [forbiddenPhrases, setForbiddenPhrases] = useState('')
  const [brandedTermsInput, setBrandedTermsInput] = useState('')

  // DataForSEO
  const [dfsLogin, setDfsLogin] = useState('')
  const [locationCode, setLocationCode] = useState(2840)
  const [minVolume, setMinVolume] = useState(10)
  const [restrictedIndustry, setRestrictedIndustry] = useState(false)

  // Options
  const [scrapePages, setScrapePages] = useState(true)
  const [includeAiOverviewContext, setIncludeAiOverviewContext] = useState(true)
  const [useGsc, setUseGsc] = useState(true)
  const [siteUrl, setSiteUrl] = useState('')

  useEffect(() => {
    async function loadCreds() {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) return
      try {
        const creds = await getProviderMetadata(session.access_token)
        if (creds?.provider) setProvider(creds.provider)
        if (creds?.dfs_login) setDfsLogin(creds.dfs_login)
        if (creds?.site_url) setSiteUrl(creds.site_url)
        if (creds?.brand_name) setBrandName(creds.brand_name)
        const tmpl = await listTemplates(session.access_token, 'intro')
        if (Array.isArray(tmpl)) setTemplates(tmpl)

        // Load brand profiles
        const bp = await listBrandProfiles(session.access_token)
        if (Array.isArray(bp)) setBrandProfiles(bp)
      } catch (e) {
        console.error('Failed to load credentials/templates on mount:', e)
      }
    }
    loadCreds()
  }, [])

  function applyImportedText(text: string) {
    const result = parseImportedRows(text, createIntroRowImportSchema(pageTemplate))
    const parsed = result.rows.map(({ url, keyword, page_type, h1 }) => ({ url, keyword, page_type, h1 }))
    setImportErrors(result.rejectedRows)
    setImportNotices(result.notices)
    if (parsed.length) {
      setRows(parsed)
      setTab('manual')
      setSelectedRows(new Set())
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

  function applyTemplate(t: {settings: Record<string, unknown>}) {
    const s = t.settings
    if (s.provider) { setProvider(s.provider as string); setModel(PROVIDER_MODELS[s.provider as string]?.[0]?.value || '') }
    if (s.business_type) setBusinessType(s.business_type as string)
    if (s.page_template) setPageTemplate(s.page_template as string)
    if (s.word_count) setWordCount(s.word_count as number)
    if (s.paragraph_count) setParagraphCount(s.paragraph_count as number)
    if (s.max_supporting_keywords) setMaxSupportingKeywords(s.max_supporting_keywords as number)
    if (s.brand_name) setBrandName(s.brand_name as string)
    if (s.full_brand_name) setFullBrandName(s.full_brand_name as string)
    if (typeof s.include_brand === 'boolean') setIncludeBrand(s.include_brand)
    if (s.forbidden_phrases) setForbiddenPhrases(s.forbidden_phrases as string)
    if (s.branded_terms_input) setBrandedTermsInput(s.branded_terms_input as string)
    if (typeof s.use_gsc === 'boolean') setUseGsc(s.use_gsc)
    if (typeof s.scrape_pages === 'boolean') setScrapePages(s.scrape_pages)
    if (typeof s.include_ai_overview_context === 'boolean') setIncludeAiOverviewContext(s.include_ai_overview_context)
    if (s.site_url) setSiteUrl(s.site_url as string)
    setShowTemplates(false)
  }

  async function handleSubmit() {
    setError('')
    const validRows = rows.filter(r => r.url.trim())
    if (!validRows.length) { setError('Add at least one URL.'); return }
    if (!dfsLogin) { setError('DataForSEO login is required.'); return }

    setSubmitting(true)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const payload = {
        name: jobName.trim() || `Intro job ${new Date().toLocaleString('en-GB')}`,
        rows: validRows.map(r => ({
          url: r.url.trim(),
          keyword: r.keyword.trim(),
          page_type: r.page_type || 'service_lp',
          h1: r.h1.trim(),
        })),
        settings: {
          provider,
          model,
          business_type: businessType,
          page_template: pageTemplate,
          word_count: wordCount,
          paragraph_count: paragraphCount,
          max_supporting_keywords: maxSupportingKeywords,
          brand_name: brandName, brand_profile_id: selectedBrandProfileId,
          full_brand_name: fullBrandName,
          include_brand: includeBrand,
          forbidden_phrases: forbiddenPhrases,
          branded_terms_input: brandedTermsInput,
          dfs_login: dfsLogin,
          location_code: locationCode,
          min_volume: minVolume,
          restricted_industry: restrictedIndustry,
          scrape_pages: scrapePages,
          include_ai_overview_context: includeAiOverviewContext,
          use_gsc: useGsc,
          site_url: siteUrl,
          niche,
        },
      }

      const result = await introApi.runJob(session.access_token, payload)
      router.push(`/intro/jobs/${result.job_id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  const validUrlCount = rows.filter(r => r.url).length

  return (
    <AppLayout title="New Intro Job">
      <div className="max-w-full">
        <JobLauncherShell
          eyebrow="Intro"
          title="New intro job"
          description="Generate SEO-optimised intro paragraphs at scale while keeping template, word count, and context controls in view."
          summary={
            <JobSummaryBar
              summaryItems={[
                { label: 'URLs', value: validUrlCount },
                { label: 'Target', value: `${wordCount} words / ${paragraphCount}p` },
                { label: 'Template', value: pageTemplate },
                { label: 'Context', value: `${scrapePages ? 'Scraping on' : 'Scraping off'}${includeAiOverviewContext ? ' + AIO' : ''}` },
              ]}
            />
          }
          actions={
            <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Templates */}
            <div className="relative">
              <button onClick={() => setShowTemplates(v => !v)}
                className="btn-secondary text-xs flex items-center gap-1.5">
                <ChevronDown size={12} /> Templates
              </button>
              {showTemplates && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-surface border border-border rounded-lg shadow-lg z-10 py-1">
                  {templates.length === 0 && (
                    <p className="text-xs text-muted px-3 py-2">No saved templates</p>
                  )}
                  {templates.map(t => (
                    <div key={t.id} className="flex items-center group px-2 py-1">
                      <button onClick={() => applyTemplate(t)}
                        className="flex-1 text-left text-xs px-1 py-1 hover:text-accent transition-colors truncate">
                        {t.name}
                      </button>
                      <button onClick={async () => {
                        const sb = createClient()
                        const { data: { session } } = await sb.auth.getSession()
                        if (session) { await deleteTemplate(session.access_token, t.id); setTemplates(prev => prev.filter(x => x.id !== t.id)) }
                      }} className="opacity-0 group-hover:opacity-100 text-muted hover:text-error transition-all p-1">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Save template */}
            <div className="relative">
              <button onClick={() => setShowSaveTemplate(v => !v)}
                className="btn-secondary text-xs flex items-center gap-1.5">
                <BookmarkPlus size={12} /> Save template
              </button>
              {showSaveTemplate && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-surface border border-border rounded-lg shadow-lg z-10 p-2 flex items-center gap-2">
                  <input
                    autoFocus
                    className="input-base text-xs flex-1"
                    placeholder="Template name"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') { setShowSaveTemplate(false); setTemplateName('') } }}
                  />
                  <button
                    disabled={savingTemplate || !templateName.trim()}
                    onClick={async () => {
                      if (!templateName.trim()) return
                      setSavingTemplate(true)
                      const sb = createClient()
                      const { data: { session } } = await sb.auth.getSession()
                      if (session) {
                        const tmpl = await saveTemplate(session.access_token, templateName.trim(), {
                          provider, business_type: businessType, page_template: pageTemplate,
                          word_count: wordCount, paragraph_count: paragraphCount,
                          max_supporting_keywords: maxSupportingKeywords,
                          brand_name: brandName, brand_profile_id: selectedBrandProfileId, full_brand_name: fullBrandName,
                          include_brand: includeBrand, forbidden_phrases: forbiddenPhrases,
                          branded_terms_input: brandedTermsInput,
                          use_gsc: useGsc, scrape_pages: scrapePages,
                          include_ai_overview_context: includeAiOverviewContext,
                          site_url: siteUrl,
                        }, 'intro')
                        if (tmpl?.id) setTemplates(prev => [tmpl, ...prev])
                      }
                      setSavingTemplate(false)
                      setShowSaveTemplate(false)
                      setTemplateName('')
                    }}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    {savingTemplate ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            {!dfsLogin && (
              <span className="text-xs text-error">
                Missing: DFS login. Saved secret credentials are loaded securely from Settings.
              </span>
            )}
            <button onClick={handleSubmit} disabled={submitting || !dfsLogin} className="btn-primary text-sm px-4 py-2">
              {submitting ? 'Starting...' : 'Run job'}
            </button>
          </div>
          }
        >

        {error && (
          <div className="flex items-center gap-2 text-error text-sm bg-error/10 border border-error/20 rounded-lg px-4 py-3 mb-4">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div className="grid grid-cols-7 gap-4">
          {/* Left: rows + job name */}
          <div className="col-span-5 space-y-4">
            <JobSection title="Inputs" description="Add URL rows and optional keyword seeds. Paste, CSV, and manual entry keep the same parsing rules.">
            <div className="card p-4 space-y-3">
              <div>
                <label className="text-xs text-muted block mb-1">Job name</label>
                <input value={jobName} onChange={e => setJobName(e.target.value)}
                  className="input-base text-sm" placeholder="e.g. Client X — service pages" />
              </div>

              {/* Tab bar */}
              <SegmentedControl
                value={tab}
                onChange={setTab}
                ariaLabel="Intro input mode"
                options={[
                  { value: 'manual', label: 'Manual entry' },
                  { value: 'paste', label: 'Paste from sheet' },
                  { value: 'csv', label: 'Upload CSV' },
                ]}
              />

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

              {tab === 'paste' && (
                <div className="space-y-2">
                  <p className="text-xs text-muted">Paste tab-separated rows: URL | Keyword seeds (optional) | Page template (optional) | H1. Headers are supported.</p>
                  <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
                    className="input-base text-xs font-mono resize-none h-32 w-full"
                    placeholder={"url\tkeyword\tpage template\th1\nhttps://example.com/service\t\tservice_lp\tOur Main Service"} />
                  <button onClick={parsePaste} className="btn-secondary text-xs">Import rows</button>
                </div>
              )}

              {tab === 'csv' && (
                <div className="space-y-2">
                  <p className="text-xs text-muted">CSV must have headers: url, keyword (optional), page_type, h1</p>
                  <label className="flex items-center gap-2 btn-secondary text-xs cursor-pointer w-fit">
                    <Upload size={12} /> Choose CSV file
                    <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
                  </label>
                </div>
              )}

              {/* Row table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-2 text-muted font-normal w-6">
                        <StyledCheckbox
                          ariaLabel="Select all intro rows"
                          checked={selectedRows.size === rows.length && rows.length > 0}
                          onChange={checked => setSelectedRows(checked ? new Set(rows.map((_, i) => i)) : new Set())}
                        />
                      </th>
                      {[
                        { key: 'url', label: 'URL' },
                        { key: 'keyword', label: 'Keyword seeds (optional, comma-separated)' },
                        { key: 'type', label: 'Template' },
                        { key: 'h1', label: 'H1' },
                      ].map(col => (
                        <th key={col.key} className="relative text-left py-2 pr-2 text-muted font-normal select-none"
                          style={{ width: colWidths[col.key as keyof typeof colWidths] }}>
                          {col.label}
                          <span
                            onMouseDown={e => onResizeStart(col.key, e)}
                            className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-accent/30 transition-colors"
                          />
                        </th>
                      ))}
                      <th className="w-6" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-b border-border/50 group">
                        <td className="py-1 pr-2">
                          <StyledCheckbox
                            ariaLabel={`Select intro row ${i + 1}`}
                            checked={selectedRows.has(i)}
                            onChange={checked => {
                              const next = new Set(selectedRows)
                              checked ? next.add(i) : next.delete(i)
                              setSelectedRows(next)
                            }}
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input value={row.url} onChange={e => setRows(rows.map((r, j) => j === i ? {...r, url: e.target.value} : r))}
                            className="input-base text-xs w-full" placeholder="https://example.com/page" />
                        </td>
                        <td className="py-1 pr-2">
                          <input value={row.keyword} onChange={e => setRows(rows.map((r, j) => j === i ? {...r, keyword: e.target.value} : r))}
                            className="input-base text-xs w-full" placeholder="industrial pumps, centrifugal pump" />
                        </td>
                        <td className="py-1 pr-2">
                          <CustomSelect value={row.page_type}
                            onChange={value => setRows(rows.map((r, j) => j === i ? {...r, page_type: value} : r))}
                            options={PAGE_TEMPLATES} className="text-xs w-full" />
                        </td>
                        <td className="py-1 pr-2">
                          <input value={row.h1} onChange={e => setRows(rows.map((r, j) => j === i ? {...r, h1: e.target.value} : r))}
                            className="input-base text-xs w-full" placeholder="Page H1" />
                        </td>
                        <td className="py-1">
                          <button onClick={() => setRows(rows.filter((_, j) => j !== i))}
                            className="opacity-0 group-hover:opacity-100 text-muted hover:text-error transition-all p-1">
                            <Trash2 size={10} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => setRows([...rows, emptyRow()])}
                  className="btn-secondary text-xs flex items-center gap-1.5">
                  <Plus size={12} /> Add row
                </button>
                {selectedRows.size > 0 && (
                  <button onClick={() => { setRows(rows.filter((_, i) => !selectedRows.has(i))); setSelectedRows(new Set()) }}
                    className="text-xs text-error hover:opacity-70 transition-opacity flex items-center gap-1">
                    <Trash2 size={10} /> Delete {selectedRows.size} selected
                  </button>
                )}
                <span className="text-xs text-muted ml-auto">{rows.filter(r => r.url).length} URLs</span>
              </div>
            </div>
            </JobSection>
          </div>

          {/* Right: settings */}
          <div className="col-span-2 space-y-4">
            <JobSection title="Configuration" description="Intro-specific output controls stay visible because they directly shape the generated copy.">
            {/* AI Provider */}
            <div className="card p-4 space-y-3">
              <h3 className="text-xs text-muted uppercase tracking-wider font-normal">AI Provider</h3>
              <CustomSelect value={provider} onChange={handleProviderChange} options={PROVIDERS} className="text-xs" />
              <CustomSelect value={model} onChange={setModel} options={PROVIDER_MODELS[provider]} className="text-xs" />
              <p className="text-xs text-muted/70">Saved API credentials are loaded securely from Settings.</p>
            </div>

            {/* Copy Settings */}
            <div className="card p-4 space-y-3">
              <h3 className="text-xs text-muted uppercase tracking-wider font-normal">Copy Settings</h3>
              <div>
                <label className="text-xs text-muted block mb-1">Business type</label>
                <CustomSelect value={businessType} onChange={setBusinessType} options={BIZ_TYPES} className="text-xs" />
              </div>
                <NicheSelect
                  value={niche}
                  onChange={setNiche}
                  businessType={businessType}
                />
              <div>
                <label className="text-xs text-muted block mb-1">Default page template</label>
                <CustomSelect value={pageTemplate} onChange={setPageTemplate} options={PAGE_TEMPLATES} className="text-xs" />
                <p className="text-xs text-muted/50 mt-1">Per-row template overrides this</p>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Word count target</label>
                <CustomSelect value={String(wordCount)} onChange={value => setWordCount(+value)}
                  options={WORD_COUNT_OPTIONS.map(n => ({ value: String(n), label: `${n} words` }))} className="text-xs" />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Paragraph count</label>
                <CustomSelect value={String(paragraphCount)} onChange={value => setParagraphCount(+value)}
                  options={[
                    { value: '1', label: '1 paragraph' },
                    { value: '2', label: '2 paragraphs' },
                  ]} className="text-xs" />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Max supporting keywords</label>
                <input type="number" value={maxSupportingKeywords} min={2} max={8}
                  onChange={e => setMaxSupportingKeywords(+e.target.value)} className="input-base text-xs" />
              </div>
              <div>
                {brandProfiles.length > 0 && (
                  <div className="mb-3">
                    <label className="text-xs text-muted block mb-1">Brand profile</label>
                    <CustomSelect
                      value={selectedBrandProfileId}
                      onChange={value => {
                        setSelectedBrandProfileId(value)
                        const profile = brandProfiles.find(p => p.id === value)
                        if (profile?.data?.brand_name) setBrandName(profile.data.brand_name)
                      }}
                      options={[
                        { value: '', label: 'No profile selected' },
                        ...brandProfiles.map(p => ({ value: p.id, label: p.name })),
                      ]}
                      className="text-xs w-full"
                    />
                  </div>
                )}
                <label className="text-xs text-muted block mb-1">
                  Brand name {brandProfiles.length > 0 && <span className="text-muted/50">(auto-filled from profile)</span>}
                </label>
                <input value={brandName} onChange={e => setBrandName(e.target.value)}
                  className="input-base text-xs" placeholder="Acme Corp" />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Full brand name <span className="text-muted/50">(optional)</span></label>
                <input value={fullBrandName} onChange={e => setFullBrandName(e.target.value)}
                  className="input-base text-xs" placeholder="e.g. Dayson Shalabi Burkert for DSB" />
              </div>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs text-muted">Include brand in copy</span>
                <Switch ariaLabel="Include brand in copy" checked={includeBrand} onChange={setIncludeBrand} />
              </label>
              <div>
                <label className="text-xs text-muted block mb-1">Forbidden phrases <span className="text-muted/50">(one per line)</span></label>
                <textarea value={forbiddenPhrases} onChange={e => setForbiddenPhrases(e.target.value)}
                  className="input-base text-xs resize-none h-14"
                  placeholder={"best in class\nworld-class"} />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Branded terms to exclude <span className="text-muted/50">(one per line)</span></label>
                <textarea value={brandedTermsInput} onChange={e => setBrandedTermsInput(e.target.value)}
                  className="input-base text-xs resize-none h-14"
                  placeholder={"acme\nacme corp"} />
              </div>
            </div>

            {/* DataForSEO */}
            <div className="card p-4 space-y-3">
              <h3 className="text-xs text-muted uppercase tracking-wider font-normal">DataForSEO</h3>
              <input value={dfsLogin} onChange={e => setDfsLogin(e.target.value)}
                className="input-base text-xs" placeholder="Login email" />
              <div>
                <label className="text-xs text-muted block mb-1">Location code</label>
                <input type="number" value={locationCode} onChange={e => setLocationCode(+e.target.value)}
                  className="input-base text-xs" placeholder="2840 = US" />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Min keyword volume</label>
                <input type="number" value={minVolume} onChange={e => setMinVolume(+e.target.value)}
                  className="input-base text-xs" min={0} step={10} />
              </div>
            </div>

            {/* Options */}
            <div className="card p-4 space-y-3">
              <h3 className="text-xs text-muted uppercase tracking-wider font-normal">Options</h3>
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-xs">Restricted industry</span>
                  <p className="text-xs text-muted mt-0.5">Score on GSC signals only — for industries where DFS suppresses volume (CBD, guns, adult)</p>
                </div>
                <Switch ariaLabel="Restricted industry" checked={restrictedIndustry} onChange={setRestrictedIndustry} className="ml-3" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs text-muted">Scrape pages (Jina)</span>
                <Switch ariaLabel="Scrape pages" checked={scrapePages} onChange={setScrapePages} />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-xs text-muted">Use AI Overview context</span>
                  <p className="text-xs text-muted mt-0.5">Adds search intent context; disable for faster jobs</p>
                </div>
                <Switch ariaLabel="Use AI Overview context" checked={includeAiOverviewContext} onChange={setIncludeAiOverviewContext} className="ml-3" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs text-muted">Use GSC data</span>
                <Switch ariaLabel="Use GSC data" checked={useGsc} onChange={setUseGsc} />
              </label>
              {useGsc && (
                <input value={siteUrl} onChange={e => setSiteUrl(e.target.value)}
                  className="input-base text-xs" placeholder="https://yoursite.com" />
              )}
            </div>
            </JobSection>
          </div>
        </div>
        </JobLauncherShell>
      </div>
    </AppLayout>
  )
}
