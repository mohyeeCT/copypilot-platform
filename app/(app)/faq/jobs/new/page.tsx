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
import { createCopyRowImportSchema, parseImportedRows, type ImportNotice, type RejectedImportRow } from '@/lib/import-rows'
import { createClient } from '@/lib/supabase'

import { Upload, Plus, Trash2, AlertCircle, BookmarkPlus, ChevronDown } from 'lucide-react'
import { getProviderMetadata, listBrandProfiles, listTemplates, saveTemplate, deleteTemplate } from '@/lib/api/shared'
import { faqApi } from '@/lib/api/faq'

export const dynamic = 'force-dynamic'

type Row = { url: string; keyword: string; page_type: string; h1: string }
const emptyRow = (): Row => ({ url: '', keyword: '', page_type: 'general', h1: '' })
const PAGE_TYPES = ['general', 'product', 'category', 'service', 'blog', 'local']

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

const BIZ_TYPES = ['general', 'b2b', 'b2c', 'ecommerce', 'service', 'local']
const PROVIDERS = ['Claude', 'OpenAI', 'Gemini (free)', 'Mistral (free tier)', 'Groq (free tier)']
const FAQS_PER_PAGE_MIN = 1
const FAQS_PER_PAGE_MAX = 7
const PROCESSING_CHUNK_SIZE_MIN = 1
const PROCESSING_CHUNK_SIZE_MAX = 5

function clampIntegerSetting(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.trunc(parsed), minimum), maximum)
}

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

export default function NewJobPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'manual' | 'paste' | 'csv'>('manual')
  const [rows, setRows] = useState<Row[]>([emptyRow()])
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [colWidths, setColWidths] = useState({ url: 300, keyword: 200, type: 120, h1: 200 })
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

  // Settings
  const [provider, setProvider] = useState('Claude')
  const [niche, setNiche] = useState('none')
  const [model, setModel] = useState(PROVIDER_MODELS['Claude'][0].value)

  function handleProviderChange(p: string) {
    setProvider(p)
    setModel(PROVIDER_MODELS[p][0].value)
  }
  const [businessType, setBusinessType] = useState('general')
  const [brandName, setBrandName] = useState('')
  const [fullBrandName, setFullBrandName] = useState('')
  const [numFaqs, setNumFaqs] = useState(5)
  const [dfsLogin, setDfsLogin] = useState('')
  const [useGsc, setUseGsc] = useState(true)
  const [siteUrl, setSiteUrl] = useState('')
  const [scrapePages, setScrapePages] = useState(true)
  const [batchSize, setBatchSize] = useState(1)
  const [forbiddenPhrases, setForbiddenPhrases] = useState('')
  const [brandedTermsInput, setBrandedTermsInput] = useState('')
  const [loadAsyncAiOverview, setLoadAsyncAiOverview] = useState(true)
  const [locationCode, setLocationCode] = useState(2840)
  const [minVolume, setMinVolume] = useState(10)
  const [restrictedIndustry, setRestrictedIndustry] = useState(false)
  const effectiveNumFaqs = clampIntegerSetting(numFaqs, FAQS_PER_PAGE_MIN, FAQS_PER_PAGE_MAX, 5)
  const effectiveBatchSize = clampIntegerSetting(batchSize, PROCESSING_CHUNK_SIZE_MIN, PROCESSING_CHUNK_SIZE_MAX, 1)

  // Load saved credentials on mount
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
        // Pre-fill brand name from brand profile if not already set
        if (creds?.brand_name) setBrandName(creds.brand_name)

        // Load saved templates
        const tmpl = await listTemplates(session.access_token, 'faq')
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
    const result = parseImportedRows(text, createFaqRowImportSchema())
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

  function updateRow(i: number, field: keyof Row, val: string) {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row))
  }

  async function handleRun() {
    setError('')
    const validRows = rows.filter(r => r.url.trim())
    if (!validRows.length) { setError('Add at least one URL'); return }
    if (!dfsLogin.trim()) { setError('DataForSEO login is required'); return }
    if (useGsc && !siteUrl.trim()) { setError('GSC is enabled but no site URL provided. Enter your site URL or disable GSC.'); return }

    setSubmitting(true)
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { router.push('/login'); return }

    try {
      const { job_id } = await faqApi.runJob(session.access_token, {
        name: jobName || `Job ${new Date().toLocaleDateString()}`,
        rows: validRows,
        settings: {
          provider, model, business_type: businessType,
          brand_name: brandName, full_brand_name: fullBrandName, brand_profile_id: selectedBrandProfileId, num_faqs: effectiveNumFaqs,
          dfs_login: dfsLogin,
          location_code: locationCode, min_volume: minVolume,
          scrape_pages: scrapePages, use_gsc: useGsc,
          restricted_industry: restrictedIndustry,
          site_url: siteUrl, batch_size: effectiveBatchSize,
          load_async_ai_overview: loadAsyncAiOverview,
          forbidden_phrases: forbiddenPhrases,
          branded_terms_input: brandedTermsInput,
          niche,
        }
      })
      router.push(`/faq/jobs/${job_id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start job')
      setSubmitting(false)
    }
  }

  const validUrlCount = rows.filter(r => r.url).length

  return (
    <AppLayout title="New FAQ Job">
      <div className="max-w-full">
        <JobLauncherShell
          eyebrow="FAQ"
          title="New FAQ Job"
          description="Add URLs, choose FAQ generation settings, and keep data/source controls visible for this run."
          summary={
            <JobSummaryBar
              summaryItems={[
                { label: 'URLs', value: validUrlCount },
                { label: 'FAQs/page', value: effectiveNumFaqs },
                { label: 'AI', value: `${provider} / ${model || 'default'}` },
                { label: 'Context', value: `${scrapePages ? 'Scraping on' : 'Scraping off'}${useGsc ? ' + GSC' : ''}` },
              ]}
            />
          }
        >
        <div className="grid grid-cols-7 gap-6">
          {/* Left: URL input */}
          <div className="col-span-5 space-y-4">
            <JobSection title="Inputs" description="Paste, upload, or manually edit URL rows. Existing URL-only behavior and import mapping stay unchanged.">
            <div className="card p-4">
              {/* Template bar */}
              {templates.length > 0 && (
                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border">
                  <span className="text-xs text-muted shrink-0">Templates:</span>
                  <div className="relative flex-1">
                    <button
                      onClick={() => setShowTemplates(!showTemplates)}
                      className="flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors"
                    >
                      Load template <ChevronDown size={11} />
                    </button>
                    {showTemplates && (
                      <div className="absolute top-6 left-0 z-20 bg-surface border border-border rounded-lg shadow-lg min-w-52 py-1">
                        {templates.map(t => (
                          <div key={t.id} className="flex items-center justify-between px-3 py-2 hover:bg-border/30 group">
                            <button
                              className="text-xs text-left flex-1 hover:text-accent transition-colors"
                              onClick={async () => {
                                const s = t.settings as Record<string, unknown>
                                if (s.provider) setProvider(s.provider as string)
                                if (s.business_type) setBusinessType(s.business_type as string)
                                if (s.brand_name) setBrandName(s.brand_name as string)
                                if (s.full_brand_name) setFullBrandName(s.full_brand_name as string)
                                if (s.num_faqs) setNumFaqs(clampIntegerSetting(s.num_faqs as number, FAQS_PER_PAGE_MIN, FAQS_PER_PAGE_MAX, 5))
                                if (s.forbidden_phrases) setForbiddenPhrases(s.forbidden_phrases as string)
                                if (s.branded_terms_input) setBrandedTermsInput(s.branded_terms_input as string)
                                if (s.batch_size) setBatchSize(clampIntegerSetting(s.batch_size as number, PROCESSING_CHUNK_SIZE_MIN, PROCESSING_CHUNK_SIZE_MAX, 1))
                                if (s.use_gsc !== undefined) setUseGsc(s.use_gsc as boolean)
                                if (s.scrape_pages !== undefined) setScrapePages(s.scrape_pages as boolean)
                                if (s.site_url) setSiteUrl(s.site_url as string)
                                setShowTemplates(false)
                              }}
                            >
                              {t.name}
                            </button>
                            <button
                              onClick={async () => {
                                const sb = createClient()
                                const { data: { session } } = await sb.auth.getSession()
                                if (!session) return
                                await deleteTemplate(session.access_token, t.id)
                                setTemplates(prev => prev.filter(x => x.id !== t.id))
                              }}
                              className="opacity-0 group-hover:opacity-100 text-muted hover:text-error transition-all ml-2"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Job name</label>
                <input value={jobName} onChange={e => setJobName(e.target.value)}
                  className="input-base" placeholder="e.g. Client A - Product Pages" />
              </div>

              {/* Tabs */}
              <SegmentedControl
                value={tab}
                onChange={setTab}
                ariaLabel="FAQ input mode"
                className="mb-4 w-full"
                options={[
                  { value: 'manual', label: 'Manual' },
                  { value: 'paste', label: 'Bulk Paste' },
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

                {tab === 'csv' && (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:border-accent/50 transition-colors">
                  <Upload size={20} className="text-muted mb-2" />
                  <span className="text-sm text-muted">Drop CSV or click to upload</span>
                  <span className="text-xs text-muted/60 mt-1">Columns: url, keyword, type (or page_type), h1</span>
                  <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
                </label>
              )}

                {tab === 'paste' && (
                  <div>
                    <p className="text-xs text-muted mb-2">Paste URLs or rows ordered as URL, Keyword, Page Type, H1. Headers are supported.</p>
                    <textarea
                      value={pasteText}
                      onChange={e => setPasteText(e.target.value)}
                      className="input-base h-40 resize-none"
                      placeholder={"Paste URLs one per line, or copy from Sheets:\n\nurl [tab] keyword [tab] page type [tab] h1\nhttps://example.com/page [tab] [tab] service [tab] Page H1"}
                    />
                  <button onClick={parsePaste} className="btn-primary mt-2 text-xs px-3 py-1.5">
                    Parse URLs
                  </button>
                </div>
              )}

              {tab === 'manual' && (
                <div>
                  {/* Resizable column headers */}
                  <div className="flex items-center gap-1 mb-1 px-1 select-none">
                    <div className="w-6 shrink-0 flex items-center justify-center">
                      <StyledCheckbox
                        ariaLabel="Select all FAQ rows"
                        checked={rows.length > 0 && selectedRows.size === rows.length}
                        onChange={checked => setSelectedRows(checked ? new Set(rows.map((_, i) => i)) : new Set())}
                      />
                    </div>
                    {(['url', 'keyword', 'type', 'h1'] as const).map((col) => (
                      <div key={col} className="relative flex items-center shrink-0" style={{ width: colWidths[col] }}>
                        <span className="text-xs text-muted uppercase tracking-wider truncate pr-4">
                          {col === 'url' ? 'URL' : col === 'h1' ? 'H1' : col.charAt(0).toUpperCase() + col.slice(1)}
                        </span>
                        <div
                          onMouseDown={e => onResizeStart(col, e)}
                          className="absolute right-0 top-0 bottom-0 w-4 flex items-center justify-center cursor-col-resize group z-10"
                        >
                          <div className="w-px h-3 bg-border group-hover:bg-accent group-hover:h-full transition-all" />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Rows */}
                  <div className="space-y-1 max-h-96 overflow-y-auto overflow-x-auto pr-1">
                    {rows.map((row, i) => (
                      <div key={i} className={`flex items-center gap-1 rounded ${selectedRows.has(i) ? 'bg-accent/5' : ''}`}>
                        <div className="w-6 shrink-0 flex items-center justify-center">
                          <StyledCheckbox
                            ariaLabel={`Select FAQ row ${i + 1}`}
                            checked={selectedRows.has(i)}
                            onChange={checked => {
                              const s = new Set(selectedRows)
                              checked ? s.add(i) : s.delete(i)
                              setSelectedRows(s)
                            }}
                          />
                        </div>
                        <input value={row.url} onChange={e => updateRow(i, 'url', e.target.value)}
                          className="input-base text-xs py-1.5 shrink-0" style={{ width: colWidths.url }} placeholder="https://..." />
                        <input value={row.keyword} onChange={e => updateRow(i, 'keyword', e.target.value)}
                          className="input-base text-xs py-1.5 shrink-0" style={{ width: colWidths.keyword }} placeholder="optional" />
                        <div className="shrink-0" style={{ width: colWidths.type }}>
                          <CustomSelect value={row.page_type} onChange={value => updateRow(i, 'page_type', value)}
                            options={PAGE_TYPES} className="text-xs" />
                        </div>
                        <input value={row.h1} onChange={e => updateRow(i, 'h1', e.target.value)}
                          className="input-base text-xs py-1.5 shrink-0" style={{ width: colWidths.h1 }} placeholder="H1 text" />
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <button onClick={() => setRows(r => [...r, emptyRow()])}
                      className="flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors">
                      <Plus size={12} /> Add row
                    </button>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted font-mono">{rows.filter(r => r.url).length} URL{rows.filter(r => r.url).length !== 1 ? 's' : ''}</span>
                      {selectedRows.size > 0 && (
                        <button
                          onClick={() => {
                            setRows(r => r.filter((_, i) => !selectedRows.has(i)).length === 0 ? [emptyRow()] : r.filter((_, i) => !selectedRows.has(i)))
                            setSelectedRows(new Set())
                          }}
                          className="text-xs text-error hover:text-error/80 transition-colors flex items-center gap-1"
                        >
                          <Trash2 size={11} /> Delete {selectedRows.size} selected
                        </button>
                      )}
                      {rows.length > 1 && selectedRows.size === 0 && (
                        <button onClick={() => { setRows([emptyRow()]); setSelectedRows(new Set()) }}
                          className="text-xs text-muted hover:text-error transition-colors">
                          Clear all
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            </JobSection>

            {error && (
              <div className="flex items-start gap-2 text-error text-xs bg-error/5 border border-error/20 rounded-lg px-3 py-2">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <button onClick={handleRun} disabled={submitting} className="btn-primary w-full py-3">
              {submitting ? 'Starting job...' : `Run ${rows.filter(r => r.url).length} URL${rows.filter(r => r.url).length !== 1 ? 's' : ''}`}
            </button>

            {/* Save as template */}
            {!showSaveTemplate ? (
              <button
                onClick={() => setShowSaveTemplate(true)}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors w-full justify-center py-1"
              >
                <BookmarkPlus size={11} /> Save current settings as template
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  className="input-base text-xs flex-1 py-1.5"
                  placeholder="Template name..."
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
                        provider, business_type: businessType, brand_name: brandName,
                        full_brand_name: fullBrandName, num_faqs: effectiveNumFaqs,
                        forbidden_phrases: forbiddenPhrases, branded_terms_input: brandedTermsInput,
                        batch_size: effectiveBatchSize, use_gsc: useGsc, scrape_pages: scrapePages,
                        site_url: siteUrl,
                      }, 'faq')
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
                <button onClick={() => { setShowSaveTemplate(false); setTemplateName('') }} className="text-muted hover:text-error transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Right: Settings */}
          <div className="col-span-2 space-y-4">
            <JobSection title="Configuration" description="Generation, brand, data, and context controls for the FAQ run.">
            <div className="card p-4 space-y-3">
              <h3 className="text-xs text-muted uppercase tracking-wider font-normal">AI Provider</h3>
              <CustomSelect value={provider} onChange={handleProviderChange} options={PROVIDERS} className="text-xs" />
              <CustomSelect value={model} onChange={setModel} options={PROVIDER_MODELS[provider]} className="text-xs" />
              <p className="text-xs text-muted/70">Saved API credentials are loaded securely from Settings.</p>
            </div>

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
              {brandProfiles.length > 0 && (
                <div>
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
              <div>
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
              <div>
                <label className="text-xs text-muted block mb-1">Number of FAQs per page</label>
                <input type="number" value={effectiveNumFaqs} onChange={e => setNumFaqs(clampIntegerSetting(+e.target.value, FAQS_PER_PAGE_MIN, FAQS_PER_PAGE_MAX, 5))}
                  className="input-base text-xs" min={FAQS_PER_PAGE_MIN} max={FAQS_PER_PAGE_MAX} />
                <p className="text-xs text-muted/50 mt-1">Max {FAQS_PER_PAGE_MAX} FAQs per page.</p>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Forbidden phrases <span className="text-muted/50">(one per line)</span></label>
                <textarea value={forbiddenPhrases} onChange={e => setForbiddenPhrases(e.target.value)}
                  className="input-base text-xs resize-none h-16"
                  placeholder={"best in class\nworld-class\namazing"} />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Branded terms to exclude <span className="text-muted/50">(one per line)</span></label>
                <textarea value={brandedTermsInput} onChange={e => setBrandedTermsInput(e.target.value)}
                  className="input-base text-xs resize-none h-16"
                  placeholder={"acme\nacme inc"} />
              </div>
            </div>

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
                  <span className="text-xs text-muted">Load async AI Overview</span>
                  <p className="text-xs text-muted/50 mt-0.5">Doubles DFS cost (~$0.001/kw). Disable on large runs.</p>
                </div>
                <Switch ariaLabel="Load async AI Overview" checked={loadAsyncAiOverview} onChange={setLoadAsyncAiOverview} />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs text-muted">Use GSC data</span>
                <Switch ariaLabel="Use GSC data" checked={useGsc} onChange={setUseGsc} />
              </label>
              {useGsc && (
                <input value={siteUrl} onChange={e => setSiteUrl(e.target.value)}
                  className="input-base text-xs" placeholder="https://yoursite.com" />
              )}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-muted">Processing chunk size</label>
                  <span className="text-xs font-mono text-accent">{effectiveBatchSize === 1 ? 'Off' : effectiveBatchSize}</span>
                </div>
                <input
                  type="range" min={PROCESSING_CHUNK_SIZE_MIN} max={PROCESSING_CHUNK_SIZE_MAX} value={effectiveBatchSize}
                  onChange={e => setBatchSize(clampIntegerSetting(+e.target.value, PROCESSING_CHUNK_SIZE_MIN, PROCESSING_CHUNK_SIZE_MAX, 1))}
                  className="w-full"
                  style={{ accentColor: 'var(--accent)' }}
                />
                <p className="text-xs text-muted mt-1.5 leading-relaxed">
                  {effectiveBatchSize === 1
                    ? 'Each URL is processed in a separate AI call.'
                    : `${effectiveBatchSize} URLs sent to AI in one call. Max ${PROCESSING_CHUNK_SIZE_MAX}. Best for similar pages.`
                  }
                </p>
              </div>
            </div>
            </JobSection>
          </div>
        </div>
        </JobLauncherShell>
      </div>
    </AppLayout>
  )
}
