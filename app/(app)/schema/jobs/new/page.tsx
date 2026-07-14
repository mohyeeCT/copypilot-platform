'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import workspaceStyles from '@/components/meta/MetaCopyWorkspace.module.css'
import CustomSelect from '@/components/ui/CustomSelect'
import { cleanModelLabel, cleanProviderLabel, JobLauncherShell, JobSection, JobSummaryBar, JobSummaryPills } from '@/components/ui/JobLauncher'
import Switch from '@/components/ui/Switch'
import { createClient } from '@/lib/supabase'
import { schemaApi } from '@/lib/api/schema'
import { getProviderMetadata } from '@/lib/api/shared'

export const dynamic = 'force-dynamic'

const SCHEMA_TYPES = [
  { value: 'LocalBusiness', label: 'Local Business', group: 'Local Business' },
  { value: 'Restaurant', label: 'Restaurant', group: 'Local Business' },
  { value: 'MedicalBusiness', label: 'Medical', group: 'Local Business' },
  { value: 'Dentist', label: 'Dentist', group: 'Local Business' },
  { value: 'LegalService', label: 'Legal Service', group: 'Local Business' },
  { value: 'HomeAndConstructionBusiness', label: 'Home & Construction', group: 'Local Business' },
  { value: 'FinancialService', label: 'Financial Service', group: 'Local Business' },
  { value: 'Store', label: 'Retail Store', group: 'Local Business' },
  { value: 'LodgingBusiness', label: 'Hotel / Lodging', group: 'Local Business' },
  { value: 'AutoDealer', label: 'Auto Dealer', group: 'Local Business' },
  { value: 'RealEstateAgent', label: 'Real Estate', group: 'Local Business' },
  { value: 'BeautySalon', label: 'Beauty Salon', group: 'Local Business' },
  { value: 'FitnessCenter', label: 'Fitness', group: 'Local Business' },
  { value: 'Organization', label: 'Organization', group: 'Organization' },
  { value: 'Corporation', label: 'Corporation', group: 'Organization' },
  { value: 'EducationalOrganization', label: 'Educational', group: 'Organization' },
  { value: 'NonProfit', label: 'Non-Profit', group: 'Organization' },
  { value: 'FAQPage', label: 'FAQ Page', group: 'Content' },
  { value: 'Article', label: 'Article', group: 'Content' },
  { value: 'BlogPosting', label: 'Blog Post', group: 'Content' },
  { value: 'HowTo', label: 'How-To', group: 'Content' },
  { value: 'Recipe', label: 'Recipe', group: 'Content' },
  { value: 'NewsArticle', label: 'News Article', group: 'Content' },
  { value: 'Product', label: 'Product', group: 'E-commerce' },
  { value: 'ItemList', label: 'Item List', group: 'E-commerce' },
  { value: 'Person', label: 'Person', group: 'People & Events' },
  { value: 'Event', label: 'Event', group: 'People & Events' },
  { value: 'Service', label: 'Service', group: 'People & Events' },
  { value: 'WebSite', label: 'Website + Search', group: 'Technical' },
  { value: 'BreadcrumbList', label: 'Breadcrumb', group: 'Technical' },
  { value: 'SoftwareApplication', label: 'Software / App', group: 'Technical' },
  { value: 'VideoObject', label: 'Video', group: 'Technical' },
]

const PROVIDERS = ['Claude']
const PROVIDER_MODELS: Record<string, { label: string; value: string }[]> = {
  Claude: [
    { label: 'Claude Sonnet 5 (default)', value: 'claude-sonnet-5' },
    { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
    { label: 'Claude Haiku 4.5', value: 'claude-haiku-4-5-20251001' },
  ],
}

export default function NewSchemaJobPage() {
  const router = useRouter()
  const [jobName, setJobName] = useState('')
  const [url, setUrl] = useState('')
  const [provider, setProvider] = useState('Claude')
  const [model, setModel] = useState(PROVIDER_MODELS.Claude[0].value)
  const [schemaType, setSchemaType] = useState('LocalBusiness')
  const [dfsLogin, setDfsLogin] = useState('')
  const [scrapeTarget, setScrapeTarget] = useState(true)
  const [scrapeHomepage, setScrapeHomepage] = useState(true)
  const [deepScrape, setDeepScrape] = useState(false)
  const [serpCheck, setSerpCheck] = useState(false)
  const [includeScriptTag, setIncludeScriptTag] = useState(true)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) { router.push('/login'); return }
      try {
        const creds = await getProviderMetadata(session.access_token).catch(() => null)
        if (creds?.provider === 'Claude') setProvider('Claude')
        if (creds?.dfs_login) setDfsLogin(creds.dfs_login)
      } finally {
        setSettingsLoaded(true)
      }
    }
    load()
  }, [router])

  function handleProviderChange(value: string) {
    setProvider(value)
    setModel(PROVIDER_MODELS[value]?.[0]?.value ?? '')
  }

  async function handleRun() {
    if (!url.trim().startsWith('http')) { setError('Add a valid URL starting with http'); return }
    setError('')
    setRunning(true)

    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { router.push('/login'); return }

    try {
      const data = await schemaApi.runJob(session.access_token, {
        name: jobName.trim() || 'Schema Generator Job',
        rows: [{ url: url.trim() }],
        settings: {
          provider,
          model,
          schema_type: schemaType,
          dfs_login: dfsLogin,
          scrape_target: scrapeTarget,
          scrape_homepage: scrapeHomepage,
          deep_scrape: deepScrape,
          serp_check: serpCheck,
          include_script_tag: includeScriptTag,
        },
      })
      router.push(`/schema/jobs/${data.job_id}`)
    } catch (e) {
      setError((e as Error).message || 'Failed to start schema job')
      setRunning(false)
    }
  }

  if (!settingsLoaded) return (
    <AppLayout title="New Schema Generator Job">
      <div className="flex items-center justify-center h-48">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  )

  const schemaTypeLabel = SCHEMA_TYPES.find(type => type.value === schemaType)?.label ?? schemaType

  return (
    <AppLayout title="New Schema Generator Job">
      <div className={`max-w-full ${workspaceStyles.newPage}`}>
        <Link href="/schema/jobs" className={workspaceStyles.backLink}>
          <ArrowLeft size={16} /> Back to Schema jobs
        </Link>
        <JobLauncherShell
          eyebrow="Schema"
          title="New Schema Job"
          description="Generate deployable schema.org JSON-LD from a target URL while keeping schema type, AI, and source controls visible."
          summary={
            <JobSummaryBar
              summaryItems={[
                { label: 'URLs', value: url.trim().startsWith('http') ? 1 : 0 },
                { label: 'Schema', value: schemaTypeLabel },
                { label: 'AI', value: <JobSummaryPills items={[
                  { label: cleanProviderLabel(provider), tone: 'accent' },
                  { label: cleanModelLabel(model, PROVIDER_MODELS[provider], provider) },
                ]} /> },
                { label: 'Context', value: <JobSummaryPills items={[
                  { label: scrapeTarget ? 'Page scrape' : 'No page scrape', tone: scrapeTarget ? 'success' : 'muted' },
                  ...(scrapeHomepage ? [{ label: 'Homepage', tone: 'success' as const }] : []),
                  ...(deepScrape ? [{ label: 'About/Contact', tone: 'accent' as const }] : []),
                  ...(serpCheck ? [{ label: 'SERP', tone: 'accent' as const }] : []),
                  ...(includeScriptTag ? [{ label: 'Script tag', tone: 'muted' as const }] : []),
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
          <div className={`grid grid-cols-7 gap-6 ${workspaceStyles.composerGrid}`}>
            <div className={`col-span-5 space-y-4 ${workspaceStyles.composerMain}`}>
              <JobSection title="Inputs" description="Name the run and provide the page that should receive generated schema markup.">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-muted uppercase tracking-wider mb-2">Job Name</label>
                    <input className="input-base" value={jobName} onChange={e => setJobName(e.target.value)} placeholder="e.g. LocalBusiness schema" />
                  </div>
                  <div>
                    <label className="block text-xs text-muted uppercase tracking-wider mb-2">Target URL</label>
                    <input className="input-base font-mono text-sm" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/page" />
                  </div>
                </div>
              </JobSection>

              {error && (
                <p className="text-error text-sm bg-error/10 border border-error/20 rounded-lg px-4 py-3">{error}</p>
              )}
            </div>

            <div className={`col-span-2 space-y-4 ${workspaceStyles.settingsRail}`}>
              <JobSection title="Configuration" description="Schema type and AI settings for this generated JSON-LD.">
                <div className={workspaceStyles.settingsBody}>
                  <div>
                    <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Schema type</label>
                    <CustomSelect value={schemaType} onChange={setSchemaType} options={SCHEMA_TYPES} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Provider</label>
                    <CustomSelect value={provider} onChange={handleProviderChange} options={PROVIDERS} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Model</label>
                    <CustomSelect value={model} onChange={setModel} options={PROVIDER_MODELS[provider] ?? []} />
                  </div>
                </div>
              </JobSection>

              <JobSection title="Data & context" description="Choose which page and search signals should guide the schema.">
                <div className={workspaceStyles.settingsBody}>
                  {[
                    { label: 'Scrape target page', description: 'Reads content from the URL you entered.', value: scrapeTarget, setter: setScrapeTarget },
                    { label: 'Scrape homepage', description: 'Adds business-wide details from the website homepage.', value: scrapeHomepage, setter: setScrapeHomepage },
                    { label: 'Deep scrape About/Contact', description: 'Checks About and Contact pages for company and location details.', value: deepScrape, setter: setDeepScrape },
                    { label: 'SERP context', description: 'Uses DataForSEO search results. Requires saved credentials.', value: serpCheck, setter: setSerpCheck },
                    { label: 'Include script tag', description: 'Wraps the JSON-LD in a ready-to-paste <script> tag.', value: includeScriptTag, setter: setIncludeScriptTag },
                  ].map(({ label, description, value, setter }) => (
                    <label key={label} className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-0">
                      <span className="min-w-0">
                        <span className="block text-sm">{label}</span>
                        <span className="block text-xs text-muted mt-0.5">{description}</span>
                      </span>
                      <Switch ariaLabel={label} checked={value} onChange={setter} />
                    </label>
                  ))}
                </div>
              </JobSection>
            </div>
          </div>
        </JobLauncherShell>
      </div>
    </AppLayout>
  )
}
