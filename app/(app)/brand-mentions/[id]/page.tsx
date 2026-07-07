'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Download, ExternalLink, RefreshCw, Settings } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import CustomSelect from '@/components/ui/CustomSelect'
import { JobLauncherShell, JobSection, JobSummaryBar, JobSummaryPills } from '@/components/ui/JobLauncher'
import { createClient } from '@/lib/supabase'
import { brandMentionsApi } from '@/lib/api/brand-mentions'

export const dynamic = 'force-dynamic'

type RecordValue = Record<string, unknown>

type BrandMentionAlert = {
  id: string
  label?: string | null
  keyword?: string | null
  alert_type?: string | null
  active?: boolean | null
  last_crawl?: string | null
  last_crawl_at?: string | null
  last_crawled_at?: string | null
  last_error?: string | null
  mention_count?: number | null
  total_mentions?: number | null
}

type BrandMention = RecordValue & {
  id?: string
  title?: string | null
  headline?: string | null
  url?: string | null
  link?: string | null
  domain?: string | null
  source?: string | null
  source_type?: string | null
  sentiment?: string | null
  relevance?: number | string | null
  relevance_score?: number | string | null
  domain_rank?: number | string | null
  published_at?: string | null
  published?: string | null
  discovered_at?: string | null
  created_at?: string | null
}

type CrawlRun = RecordValue & {
  id?: string
  status?: string | null
  trigger?: string | null
  trigger_type?: string | null
  new_mentions?: number | string | null
  updated_mentions?: number | string | null
  dfs_rows?: number | string | null
  dataforseo_rows?: number | string | null
  estimated_cost_usd?: number | string | null
  cost?: number | string | null
  cost_usd?: number | string | null
  started_at?: string | null
  created_at?: string | null
  error?: string | null
  last_error?: string | null
}

type FilterValue = 'all' | 'positive' | 'neutral' | 'negative' | 'unknown'
type SourceFilter = 'all' | 'news' | 'blogs' | 'forums' | 'organizations'

const SENTIMENT_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'All sentiment' },
  { value: 'positive', label: 'Positive' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'negative', label: 'Negative' },
  { value: 'unknown', label: 'Unknown' },
]

const SOURCE_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: 'all', label: 'All sources' },
  { value: 'news', label: 'News' },
  { value: 'blogs', label: 'Blogs' },
  { value: 'forums', label: 'Forums' },
  { value: 'organizations', label: 'Organizations' },
]

const CSV_HEADERS = ['Title', 'URL', 'Domain', 'Source', 'Sentiment', 'Relevance', 'Domain Rank', 'Published', 'Discovered']

function asRecord(value: unknown): RecordValue {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}
}

function extractList<T>(value: unknown, keys: string[]): T[] {
  if (Array.isArray(value)) return value as T[]
  const record = asRecord(value)
  const nestedData = asRecord(record.data)
  for (const key of keys) {
    const candidate = record[key]
    if (Array.isArray(candidate)) return candidate as T[]
    const nestedCandidate = nestedData[key]
    if (Array.isArray(nestedCandidate)) return nestedCandidate as T[]
  }
  return []
}

function extractAlert(value: unknown): BrandMentionAlert | null {
  const record = asRecord(value)
  const alert = asRecord(record.alert)
  if (typeof alert.id === 'string') return alert as BrandMentionAlert
  if (typeof record.id === 'string') return record as BrandMentionAlert
  return null
}

function stringField(record: RecordValue, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return fallback
}

function numberField(record: RecordValue, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function titleCase(value?: string | null) {
  if (!value) return '-'
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

function domainFromUrl(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function mentionTitle(mention: BrandMention) {
  return stringField(mention, ['title', 'headline', 'name'], 'Untitled mention')
}

function mentionUrl(mention: BrandMention) {
  return stringField(mention, ['url', 'link'])
}

function mentionDomain(mention: BrandMention) {
  return stringField(mention, ['domain']) || domainFromUrl(mentionUrl(mention))
}

function mentionSource(mention: BrandMention) {
  return stringField(mention, ['source_type', 'source'], 'unknown')
}

function mentionSentiment(mention: BrandMention) {
  return stringField(mention, ['sentiment'], 'unknown')
}

function mentionRelevance(mention: BrandMention) {
  if (typeof mention.relevance === 'string' && mention.relevance.trim()) return titleCase(mention.relevance)
  if (typeof mention.relevance === 'number' && Number.isFinite(mention.relevance)) return mention.relevance
  const relevance = numberField(mention, ['relevance_score', 'score'])
  return relevance === null ? '-' : relevance
}

function mentionDomainRank(mention: BrandMention) {
  const rank = numberField(mention, ['domain_rank', 'domain_rank_absolute', 'rank'])
  return rank === null ? '-' : rank
}

function mentionPublished(mention: BrandMention) {
  return stringField(mention, ['published_at', 'published', 'publication_date'])
}

function mentionDiscovered(mention: BrandMention) {
  return stringField(mention, ['discovered_at', 'created_at', 'discovered'])
}

function quoteCsv(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function buildMentionsCsv(mentions: BrandMention[]) {
  const rows = mentions.map(mention => [
    mentionTitle(mention),
    mentionUrl(mention),
    mentionDomain(mention),
    mentionSource(mention),
    mentionSentiment(mention),
    mentionRelevance(mention),
    mentionDomainRank(mention),
    mentionPublished(mention),
    mentionDiscovered(mention),
  ])
  return [
    CSV_HEADERS.join(','),
    ...rows.map(row => row.map(quoteCsv).join(',')),
  ].join('\n')
}

function safeFileName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'brand-mentions'
}

function buildMentionQuery(sentiment: FilterValue, sourceType: SourceFilter) {
  const params = new URLSearchParams()
  if (sentiment !== 'all') params.set('sentiment', sentiment)
  if (sourceType !== 'all') params.set('source_type', sourceType)
  return params.toString()
}

function parseSentiment(params: URLSearchParams): FilterValue {
  const value = params.get('sentiment')
  return SENTIMENT_OPTIONS.some(option => option.value === value) ? value as FilterValue : 'all'
}

function parseSourceType(params: URLSearchParams): SourceFilter {
  const value = params.get('source_type') || params.get('source')
  return SOURCE_OPTIONS.some(option => option.value === value) ? value as SourceFilter : 'all'
}

function isSettingsError(message: string) {
  return /409|conflict|credential|settings|missing/i.test(message)
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const normalized = sentiment.toLowerCase()
  const styles = normalized === 'negative'
    ? { background: 'rgba(198,41,41,0.10)', borderColor: 'rgba(198,41,41,0.24)', color: 'var(--error)' }
    : normalized === 'positive'
      ? { background: 'rgba(11,122,92,0.10)', borderColor: 'rgba(11,122,92,0.24)', color: 'var(--success)' }
      : { background: 'rgba(124,118,111,0.10)', borderColor: 'rgba(124,118,111,0.20)', color: 'var(--muted)' }
  return (
    <span className="inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold capitalize" style={styles}>
      {sentiment || 'unknown'}
    </span>
  )
}

async function getSessionToken() {
  const sb = createClient()
  const { data: { session } } = await sb.auth.getSession()
  return session?.access_token ?? null
}

export default function BrandMentionAlertDetailPage() {
  const params = useParams()
  const router = useRouter()
  const alertId = Array.isArray(params.id) ? params.id[0] : params.id as string
  const [sentiment, setSentiment] = useState<FilterValue>('all')
  const [sourceType, setSourceType] = useState<SourceFilter>('all')
  const [filtersReady, setFiltersReady] = useState(false)
  const [alert, setAlert] = useState<BrandMentionAlert | null>(null)
  const [mentions, setMentions] = useState<BrandMention[]>([])
  const [runs, setRuns] = useState<CrawlRun[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [crawling, setCrawling] = useState(false)
  const [crawlError, setCrawlError] = useState('')
  const [showSettingsCta, setShowSettingsCta] = useState(false)

  const mentionQuery = useMemo(() => buildMentionQuery(sentiment, sourceType), [sentiment, sourceType])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setSentiment(parseSentiment(params))
    setSourceType(parseSourceType(params))
    setFiltersReady(true)
  }, [])

  const load = useCallback(async () => {
    if (!filtersReady) return
    let shouldClearLoading = true
    setLoading(true)
    try {
      const token = await getSessionToken()
      if (!token) {
        shouldClearLoading = false
        router.push('/login')
        return
      }

      const [alertData, mentionsData, runsData] = await Promise.all([
        brandMentionsApi.getAlert(token, alertId),
        brandMentionsApi.listMentions(token, alertId, mentionQuery),
        brandMentionsApi.listRuns(token, alertId),
      ])

      setAlert(extractAlert(alertData))
      setMentions(extractList<BrandMention>(mentionsData, ['mentions', 'items', 'results', 'data']))
      setRuns(extractList<CrawlRun>(runsData, ['runs', 'items', 'results', 'data']))
      setLoadError('')
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load brand mention alert.')
    } finally {
      if (shouldClearLoading) setLoading(false)
    }
  }, [alertId, filtersReady, mentionQuery, router])

  useEffect(() => {
    if (!filtersReady) return
    const query = mentionQuery ? `?${mentionQuery}` : ''
    const nextPath = `/brand-mentions/${alertId}${query}`
    const currentPath = `${window.location.pathname}${window.location.search}`
    if (currentPath !== nextPath) router.replace(nextPath, { scroll: false })
  }, [alertId, filtersReady, mentionQuery, router])

  useEffect(() => { void load() }, [load])

  async function handleCrawl() {
    setCrawling(true)
    setCrawlError('')
    setShowSettingsCta(false)
    try {
      const token = await getSessionToken()
      if (!token) {
        router.push('/login')
        return
      }

      await brandMentionsApi.crawlAlert(token, alertId)
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Manual crawl failed.'
      setCrawlError(message)
      setShowSettingsCta(isSettingsError(message))
    } finally {
      setCrawling(false)
    }
  }

  function downloadCsv() {
    if (!mentions.length) return
    const csv = buildMentionsCsv(mentions)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${safeFileName(alert?.label || alertId)}-mentions.csv`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  const negativeCount = mentions.filter(mention => mentionSentiment(mention).toLowerCase() === 'negative').length
  const domains = new Set(mentions.map(mentionDomain).filter(Boolean)).size
  const lastCrawl = alert?.last_crawl_at || alert?.last_crawled_at || alert?.last_crawl

  return (
    <AppLayout title="Brand Mention Alert">
      <div className="max-w-full">
        <Link href="/brand-mentions" className="mb-4 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-text">
          <ArrowLeft size={16} /> Back to Brand Mentions
        </Link>

        <JobLauncherShell
          eyebrow="Brand mention alert"
          title={alert?.label || 'Brand mention alert'}
          description={alert ? `${alert.keyword || 'No keyword'} - ${titleCase(alert.alert_type)} alert` : 'Loading alert details.'}
          summary={
            <JobSummaryBar
              summaryItems={[
                { label: 'Loaded mentions', value: mentions.length },
                { label: 'Negative', value: negativeCount },
                { label: 'Domains', value: domains },
                { label: 'State', value: alert?.active === false ? 'Paused' : 'Active' },
              ]}
            />
          }
          actions={
            <div className="flex flex-wrap justify-end gap-2">
              <button onClick={() => void load()} disabled={loading || crawling} className="btn-ghost gap-2 text-sm">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
              <button onClick={downloadCsv} disabled={!mentions.length} className="btn-ghost gap-2 text-sm">
                <Download size={14} />
                Export CSV
              </button>
              <button onClick={() => void handleCrawl()} disabled={crawling} className="btn-primary gap-2 text-sm">
                <RefreshCw size={14} className={crawling ? 'animate-spin' : ''} />
                {crawling ? 'Crawling...' : 'Run Crawl'}
              </button>
            </div>
          }
        >
          {loadError && (
            <div className="rounded-lg border p-4" style={{ background: 'rgba(198,41,41,0.08)', borderColor: 'rgba(198,41,41,0.24)' }}>
              <p className="text-sm font-semibold text-error">Failed to load alert</p>
              <p className="mt-1 text-sm text-muted">{loadError}</p>
              <button onClick={() => void load()} className="btn-ghost mt-3 text-xs">Retry</button>
            </div>
          )}

          {crawlError && (
            <div className="rounded-lg border p-4" style={{ background: 'rgba(198,123,0,0.08)', borderColor: 'rgba(198,123,0,0.26)' }}>
              <p className="text-sm font-semibold text-warning">Manual crawl failed</p>
              <p className="mt-1 text-sm text-muted">{crawlError}</p>
              {showSettingsCta && (
                <Link href="/settings" className="btn-ghost mt-3 gap-2 text-xs">
                  <Settings size={13} />
                  Open Settings
                </Link>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <div className="card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Keyword</p>
              <p className="mt-2 break-words font-mono text-sm text-text">{alert?.keyword || '-'}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Type</p>
              <p className="mt-2 text-sm font-semibold text-text">{titleCase(alert?.alert_type)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Last crawl</p>
              <p className="mt-2 text-sm text-text">{formatDate(lastCrawl)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">API mentions</p>
              <p className="mt-2 text-sm font-semibold text-text">{alert?.mention_count ?? alert?.total_mentions ?? mentions.length}</p>
            </div>
          </div>

          <JobSection title="Mention filters" description="Filters reload the mention list and are reflected in the URL.">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">Sentiment</label>
                <CustomSelect
                  value={sentiment}
                  onChange={value => setSentiment(value as FilterValue)}
                  options={SENTIMENT_OPTIONS}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">Source type</label>
                <CustomSelect
                  value={sourceType}
                  onChange={value => setSourceType(value as SourceFilter)}
                  options={SOURCE_OPTIONS}
                />
              </div>
              <div className="flex items-end">
                <JobSummaryPills
                  items={[
                    { label: sentiment === 'all' ? 'All sentiment' : sentiment, tone: sentiment === 'negative' ? 'muted' : 'neutral' },
                    { label: sourceType === 'all' ? 'All sources' : sourceType, tone: 'accent' },
                  ]}
                />
              </div>
            </div>
          </JobSection>

          <JobSection title="Mentions" description="Currently loaded mentions for the active filters.">
            {loading ? (
              <div className="text-sm text-muted">Loading mentions...</div>
            ) : mentions.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted">No mentions match the current filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Title</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">URL</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Domain</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Source</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Sentiment</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Relevance</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Domain rank</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Discovered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mentions.map((mention, index) => {
                      const url = mentionUrl(mention)
                      const title = mentionTitle(mention)
                      return (
                        <tr key={mention.id || `${url}-${index}`} className="border-b border-border transition-colors last:border-0 hover:bg-bg">
                          <td className="max-w-sm px-4 py-3">
                            <div className="line-clamp-2 font-semibold text-text">{title}</div>
                          </td>
                          <td className="max-w-xs px-4 py-3">
                            {url ? (
                              <a href={url} target="_blank" rel="noreferrer" className="inline-flex max-w-xs items-center gap-1 truncate font-mono text-xs text-accent hover:underline">
                                <span className="truncate">{url}</span>
                                <ExternalLink size={11} />
                              </a>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted">{mentionDomain(mention) || '-'}</td>
                          <td className="px-4 py-3 text-xs capitalize text-muted">{titleCase(mentionSource(mention))}</td>
                          <td className="px-4 py-3"><SentimentBadge sentiment={mentionSentiment(mention)} /></td>
                          <td className="px-4 py-3 text-xs text-muted">{mentionRelevance(mention)}</td>
                          <td className="px-4 py-3 text-xs text-muted">{mentionDomainRank(mention)}</td>
                          <td className="px-4 py-3 text-xs text-muted">{formatDate(mentionDiscovered(mention))}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </JobSection>

          <JobSection title="Recent crawl runs" description="Operational history for this alert.">
            {runs.length === 0 ? (
              <div className="py-6 text-sm text-muted">No crawl runs recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Trigger</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">New</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Updated</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">DFS rows</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Cost</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Started</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run, index) => {
                      const cost = numberField(run, ['estimated_cost_usd', 'cost_usd', 'cost'])
                      const error = stringField(run, ['error', 'last_error'])
                      return (
                        <tr key={run.id || index} className="border-b border-border transition-colors last:border-0 hover:bg-bg">
                          <td className="px-4 py-3 text-xs font-semibold capitalize text-text">{titleCase(stringField(run, ['status'], 'unknown'))}</td>
                          <td className="px-4 py-3 text-xs capitalize text-muted">{titleCase(stringField(run, ['trigger', 'trigger_type'], 'manual'))}</td>
                          <td className="px-4 py-3 text-xs text-muted">{numberField(run, ['new_mentions', 'new_count']) ?? 0}</td>
                          <td className="px-4 py-3 text-xs text-muted">{numberField(run, ['updated_mentions', 'updated_count']) ?? 0}</td>
                          <td className="px-4 py-3 text-xs text-muted">{numberField(run, ['dfs_rows', 'dataforseo_rows', 'rows']) ?? 0}</td>
                          <td className="px-4 py-3 text-xs text-muted">{cost === null ? '-' : `$${cost.toFixed(4)}`}</td>
                          <td className="px-4 py-3 text-xs text-muted">{formatDate(stringField(run, ['started_at', 'created_at']))}</td>
                          <td className="max-w-xs px-4 py-3 text-xs text-muted">{error ? <span className="line-clamp-2 text-error">{error}</span> : '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </JobSection>
        </JobLauncherShell>
      </div>
    </AppLayout>
  )
}
