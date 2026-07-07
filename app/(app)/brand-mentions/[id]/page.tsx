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
  snippet?: string | null
  source?: string | null
  source_type?: string | null
  sentiment?: string | null
  relevance?: number | string | null
  relevance_score?: number | string | null
  quality_label?: string | null
  quality_score?: number | string | null
  quality_reasons?: string[] | null
  mention_category?: string | null
  duplicate_key?: string | null
  duplicate_count?: number | string | null
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
type RelevanceFilter = 'all' | 'high' | 'medium' | 'low'
type QualityFilter = 'all' | 'strong' | 'useful' | 'low' | 'noise'
type CategoryFilter = 'all' | 'news' | 'blog' | 'forum' | 'organization' | 'directory' | 'jobs' | 'listicle' | 'profile' | 'other'
type ReviewMode = 'best' | 'review' | 'low-value' | 'noise' | 'all'

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

const RELEVANCE_OPTIONS: { value: RelevanceFilter; label: string }[] = [
  { value: 'all', label: 'All relevance' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const QUALITY_OPTIONS: { value: QualityFilter; label: string }[] = [
  { value: 'all', label: 'All quality' },
  { value: 'strong', label: 'Strong' },
  { value: 'useful', label: 'Useful' },
  { value: 'low', label: 'Low' },
  { value: 'noise', label: 'Noise' },
]

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All categories' },
  { value: 'news', label: 'News' },
  { value: 'blog', label: 'Blog' },
  { value: 'forum', label: 'Forum' },
  { value: 'organization', label: 'Organization' },
  { value: 'directory', label: 'Directory' },
  { value: 'jobs', label: 'Jobs' },
  { value: 'listicle', label: 'Listicle' },
  { value: 'profile', label: 'Profile' },
  { value: 'other', label: 'Other' },
]

const CATEGORY_OPTIONS_BY_SOURCE: Record<SourceFilter, CategoryFilter[]> = {
  all: CATEGORY_OPTIONS.map(option => option.value),
  news: ['all', 'news', 'directory', 'jobs', 'listicle', 'profile', 'other'],
  blogs: ['all', 'blog', 'directory', 'jobs', 'listicle', 'profile', 'other'],
  forums: ['all', 'forum', 'directory', 'jobs', 'listicle', 'profile', 'other'],
  organizations: ['all', 'organization', 'directory', 'jobs', 'listicle', 'profile', 'other'],
}

const REVIEW_MODE_OPTIONS: { value: ReviewMode; label: string }[] = [
  { value: 'best', label: 'Best mentions' },
  { value: 'review', label: 'Needs review' },
  { value: 'low-value', label: 'Low value' },
  { value: 'noise', label: 'Noise' },
  { value: 'all', label: 'All mentions' },
]

const CSV_HEADERS = ['Title', 'Snippet', 'URL', 'Domain', 'Category', 'Source', 'Sentiment', 'Quality', 'Quality Score', 'Quality Reasons', 'Relevance', 'Domain Rank', 'Published', 'Discovered']
const LOW_VALUE_MENTION_CATEGORIES = new Set(['directory', 'jobs', 'profile'])
const QUALITY_ORDER: Record<string, number> = { strong: 0, useful: 1, low: 2, noise: 3 }
const RELEVANCE_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }
const CATEGORY_ORDER: Record<string, number> = {
  news: 0,
  blog: 1,
  forum: 2,
  organization: 3,
  other: 4,
  listicle: 5,
  directory: 6,
  profile: 7,
  jobs: 8,
}

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

function mentionSnippet(mention: BrandMention) {
  return stringField(mention, ['snippet', 'description', 'excerpt'])
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

function mentionQualityLabel(mention: BrandMention) {
  return stringField(mention, ['quality_label'], 'unknown')
}

function mentionQualityScore(mention: BrandMention) {
  const score = numberField(mention, ['quality_score'])
  return score === null ? '-' : score
}

function mentionQualityScoreValue(mention: BrandMention) {
  return numberField(mention, ['quality_score']) ?? 0
}

function mentionQualityReasons(mention: BrandMention) {
  return Array.isArray(mention.quality_reasons)
    ? mention.quality_reasons.filter(reason => typeof reason === 'string' && reason.trim())
    : []
}

function mentionCategory(mention: BrandMention) {
  return stringField(mention, ['mention_category'], 'other')
}

function mentionDuplicateCount(mention: BrandMention) {
  return numberField(mention, ['duplicate_count']) ?? 1
}

function mentionRelevance(mention: BrandMention) {
  if (typeof mention.relevance === 'string' && mention.relevance.trim()) return titleCase(mention.relevance)
  if (typeof mention.relevance === 'number' && Number.isFinite(mention.relevance)) return mention.relevance
  const relevance = numberField(mention, ['relevance_score', 'score'])
  return relevance === null ? '-' : relevance
}

function mentionRelevanceLevel(mention: BrandMention) {
  if (typeof mention.relevance === 'string' && mention.relevance.trim()) {
    return mention.relevance.toLowerCase()
  }
  const relevance = numberField(mention, ['relevance_score', 'score'])
  if (relevance === null) return 'unknown'
  if (relevance >= 75) return 'high'
  if (relevance >= 45) return 'medium'
  return 'low'
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

function mentionTimeValue(mention: BrandMention) {
  const value = mentionDiscovered(mention)
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function isNoiseMention(mention: BrandMention) {
  return mentionQualityLabel(mention).toLowerCase() === 'noise'
}

function isHighValueMention(mention: BrandMention) {
  const quality = mentionQualityLabel(mention).toLowerCase()
  return mentionRelevanceLevel(mention) === 'high' && ['strong', 'useful'].includes(quality)
}

function isLowValueMention(mention: BrandMention) {
  const quality = mentionQualityLabel(mention).toLowerCase()
  const category = mentionCategory(mention).toLowerCase()
  return (
    mentionRelevanceLevel(mention) === 'low'
    || quality === 'low'
    || quality === 'noise'
    || LOW_VALUE_MENTION_CATEGORIES.has(category)
  )
}

function needsReviewMention(mention: BrandMention) {
  return (
    isHighValueMention(mention)
    || mentionSentiment(mention).toLowerCase() === 'negative'
    || (mentionRelevanceLevel(mention) === 'medium' && !isNoiseMention(mention))
  )
}

function sortMentionsByValue(mentions: BrandMention[]) {
  return [...mentions].sort((a, b) => {
    const highValueDelta = Number(!isHighValueMention(a)) - Number(!isHighValueMention(b))
    if (highValueDelta !== 0) return highValueDelta

    const negativeDelta = Number(mentionSentiment(b).toLowerCase() === 'negative') - Number(mentionSentiment(a).toLowerCase() === 'negative')
    if (negativeDelta !== 0) return negativeDelta

    const relevanceDelta = (RELEVANCE_ORDER[mentionRelevanceLevel(a)] ?? 9) - (RELEVANCE_ORDER[mentionRelevanceLevel(b)] ?? 9)
    if (relevanceDelta !== 0) return relevanceDelta

    const categoryDelta = (CATEGORY_ORDER[mentionCategory(a).toLowerCase()] ?? 9) - (CATEGORY_ORDER[mentionCategory(b).toLowerCase()] ?? 9)
    if (categoryDelta !== 0) return categoryDelta

    const qualityDelta = (QUALITY_ORDER[mentionQualityLabel(a).toLowerCase()] ?? 9) - (QUALITY_ORDER[mentionQualityLabel(b).toLowerCase()] ?? 9)
    if (qualityDelta !== 0) return qualityDelta

    const scoreDelta = mentionQualityScoreValue(b) - mentionQualityScoreValue(a)
    if (scoreDelta !== 0) return scoreDelta

    const duplicateDelta = mentionDuplicateCount(a) - mentionDuplicateCount(b)
    if (duplicateDelta !== 0) return duplicateDelta

    return mentionTimeValue(b) - mentionTimeValue(a)
  })
}

function filterMentionsByReviewMode(mentions: BrandMention[], reviewMode: ReviewMode) {
  if (reviewMode === 'best') return mentions.filter(isHighValueMention)
  if (reviewMode === 'review') return mentions.filter(needsReviewMention)
  if (reviewMode === 'low-value') return mentions.filter(mention => isLowValueMention(mention) && !isNoiseMention(mention))
  if (reviewMode === 'noise') return mentions.filter(isNoiseMention)
  return mentions
}

function reviewModeLabel(reviewMode: ReviewMode) {
  return REVIEW_MODE_OPTIONS.find(option => option.value === reviewMode)?.label || 'Best mentions'
}

function quoteCsv(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function buildMentionsCsv(mentions: BrandMention[]) {
  const rows = mentions.map(mention => [
    mentionTitle(mention),
    mentionSnippet(mention),
    mentionUrl(mention),
    mentionDomain(mention),
    mentionCategory(mention),
    mentionSource(mention),
    mentionSentiment(mention),
    mentionQualityLabel(mention),
    mentionQualityScore(mention),
    mentionQualityReasons(mention).join('; '),
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

function buildMentionQuery(
  sentiment: FilterValue,
  sourceType: SourceFilter,
  relevance: RelevanceFilter,
  quality: QualityFilter,
  category: CategoryFilter,
) {
  const params = new URLSearchParams()
  if (sentiment !== 'all') params.set('sentiment', sentiment)
  if (sourceType !== 'all') params.set('source_type', sourceType)
  if (relevance !== 'all') params.set('relevance', relevance)
  if (quality !== 'all') params.set('quality_label', quality)
  if (category !== 'all') params.set('mention_category', category)
  return params.toString()
}

function buildPageQuery(
  sentiment: FilterValue,
  sourceType: SourceFilter,
  relevance: RelevanceFilter,
  quality: QualityFilter,
  category: CategoryFilter,
  reviewMode: ReviewMode,
) {
  const params = new URLSearchParams(buildMentionQuery(sentiment, sourceType, relevance, quality, category))
  params.set('view', reviewMode)
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

function parseRelevance(params: URLSearchParams): RelevanceFilter {
  const value = params.get('relevance')
  return RELEVANCE_OPTIONS.some(option => option.value === value) ? value as RelevanceFilter : 'all'
}

function parseQuality(params: URLSearchParams): QualityFilter {
  const value = params.get('quality_label') || params.get('quality')
  return QUALITY_OPTIONS.some(option => option.value === value) ? value as QualityFilter : 'all'
}

function parseCategory(params: URLSearchParams): CategoryFilter {
  const value = params.get('mention_category') || params.get('category')
  return CATEGORY_OPTIONS.some(option => option.value === value) ? value as CategoryFilter : 'all'
}

function categoryOptionsForSource(sourceType: SourceFilter) {
  const allowed = new Set(CATEGORY_OPTIONS_BY_SOURCE[sourceType] || CATEGORY_OPTIONS_BY_SOURCE.all)
  return CATEGORY_OPTIONS.filter(option => allowed.has(option.value))
}

function parseReviewMode(params: URLSearchParams): ReviewMode {
  const value = params.get('view')
  return REVIEW_MODE_OPTIONS.some(option => option.value === value) ? value as ReviewMode : 'best'
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

function QualityBadge({ label, score }: { label: string; score: number | string }) {
  const normalized = label.toLowerCase()
  const styles = normalized === 'strong'
    ? { background: 'rgba(11,122,92,0.10)', borderColor: 'rgba(11,122,92,0.24)', color: 'var(--success)' }
    : normalized === 'useful'
      ? { background: 'rgba(0,119,102,0.08)', borderColor: 'rgba(0,119,102,0.18)', color: 'var(--accent)' }
      : normalized === 'noise'
        ? { background: 'rgba(198,41,41,0.08)', borderColor: 'rgba(198,41,41,0.20)', color: 'var(--error)' }
        : { background: 'rgba(124,118,111,0.10)', borderColor: 'rgba(124,118,111,0.20)', color: 'var(--muted)' }
  return (
    <span className="inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold capitalize" style={styles}>
      {label || 'unknown'}{score !== '-' ? ` ${score}` : ''}
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
  const [relevance, setRelevance] = useState<RelevanceFilter>('all')
  const [quality, setQuality] = useState<QualityFilter>('all')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [reviewMode, setReviewMode] = useState<ReviewMode>('best')
  const [filtersReady, setFiltersReady] = useState(false)
  const [alert, setAlert] = useState<BrandMentionAlert | null>(null)
  const [mentions, setMentions] = useState<BrandMention[]>([])
  const [runs, setRuns] = useState<CrawlRun[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [crawling, setCrawling] = useState(false)
  const [crawlError, setCrawlError] = useState('')
  const [showSettingsCta, setShowSettingsCta] = useState(false)
  const categoryOptions = useMemo(() => categoryOptionsForSource(sourceType), [sourceType])

  const apiMentionQuery = useMemo(
    () => buildMentionQuery(sentiment, sourceType, relevance, quality, category),
    [category, quality, relevance, sentiment, sourceType],
  )

  const pageQuery = useMemo(
    () => buildPageQuery(sentiment, sourceType, relevance, quality, category, reviewMode),
    [category, quality, relevance, reviewMode, sentiment, sourceType],
  )

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setSentiment(parseSentiment(params))
    setSourceType(parseSourceType(params))
    setRelevance(parseRelevance(params))
    setQuality(parseQuality(params))
    setCategory(parseCategory(params))
    setReviewMode(parseReviewMode(params))
    setFiltersReady(true)
  }, [])

  useEffect(() => {
    if (!filtersReady) return
    if (!categoryOptions.some(option => option.value === category)) {
      setCategory('all')
    }
  }, [category, categoryOptions, filtersReady])

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
        brandMentionsApi.listMentions(token, alertId, apiMentionQuery),
        brandMentionsApi.listRuns(token, alertId),
      ])

      setAlert(extractAlert(alertData))
      setMentions(extractList<BrandMention>(mentionsData, ['mentions', 'items', 'results', 'data']))
      setRuns(extractList<CrawlRun>(runsData, ['runs', 'items', 'results', 'data']))
      setLoadError('')
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load Brand Pulse alert.')
    } finally {
      if (shouldClearLoading) setLoading(false)
    }
  }, [alertId, apiMentionQuery, filtersReady, router])

  useEffect(() => {
    if (!filtersReady) return
    const query = pageQuery ? `?${pageQuery}` : ''
    const nextPath = `/brand-mentions/${alertId}${query}`
    const currentPath = `${window.location.pathname}${window.location.search}`
    if (currentPath !== nextPath) router.replace(nextPath, { scroll: false })
  }, [alertId, filtersReady, pageQuery, router])

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

  function handleSourceTypeChange(value: string) {
    const nextSourceType = value as SourceFilter
    const nextCategoryOptions = categoryOptionsForSource(nextSourceType)
    setSourceType(nextSourceType)
    if (!nextCategoryOptions.some(option => option.value === category)) {
      setCategory('all')
    }
  }

  function downloadCsv() {
    if (!displayedMentions.length) return
    const csv = buildMentionsCsv(displayedMentions)
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

  const sortedMentions = useMemo(() => sortMentionsByValue(mentions), [mentions])
  const displayedMentions = useMemo(
    () => filterMentionsByReviewMode(sortedMentions, reviewMode),
    [reviewMode, sortedMentions],
  )
  const negativeCount = mentions.filter(mention => mentionSentiment(mention).toLowerCase() === 'negative').length
  const highValueCount = mentions.filter(isHighValueMention).length
  const lowValueCount = mentions.filter(mention => isLowValueMention(mention) && !isNoiseMention(mention)).length
  const noiseCount = mentions.filter(isNoiseMention).length
  const lastCrawl = alert?.last_crawl_at || alert?.last_crawled_at || alert?.last_crawl

  return (
    <AppLayout title="Brand Pulse Alert">
      <div className="max-w-full">
        <Link href="/brand-mentions" className="mb-4 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-text">
          <ArrowLeft size={16} /> Back to Brand Pulse
        </Link>

        <JobLauncherShell
          compact
          eyebrow="Brand Pulse alert"
          title={alert?.label || 'Brand Pulse alert'}
          description={alert ? `${alert.keyword || 'No keyword'} - ${titleCase(alert.alert_type)} alert` : 'Loading alert details.'}
          summary={
            <JobSummaryBar
              summaryItems={[
                { label: 'Loaded mentions', value: mentions.length },
                { label: 'High value', value: highValueCount },
                { label: 'Low value', value: lowValueCount },
                { label: 'Noise', value: noiseCount },
                { label: 'Negative', value: negativeCount },
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
              <button onClick={downloadCsv} disabled={!displayedMentions.length} className="btn-ghost gap-2 text-sm">
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
            <div className="mb-4">
              <label className="mb-2 block text-xs font-semibold text-muted">Review mode</label>
              <div className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-bg p-1">
                {REVIEW_MODE_OPTIONS.map(option => {
                  const active = reviewMode === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setReviewMode(option.value)}
                      className="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                      style={active
                        ? { background: 'var(--accent)', color: 'white' }
                        : { color: 'var(--muted)' }}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
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
                  onChange={handleSourceTypeChange}
                  options={SOURCE_OPTIONS}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">Relevance</label>
                <CustomSelect
                  value={relevance}
                  onChange={value => setRelevance(value as RelevanceFilter)}
                  options={RELEVANCE_OPTIONS}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">Quality</label>
                <CustomSelect
                  value={quality}
                  onChange={value => setQuality(value as QualityFilter)}
                  options={QUALITY_OPTIONS}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">Mention category</label>
                <CustomSelect
                  value={category}
                  onChange={value => setCategory(value as CategoryFilter)}
                  options={categoryOptions}
                />
              </div>
              <div className="flex items-end">
                <JobSummaryPills
                  items={[
                    { label: reviewModeLabel(reviewMode), tone: reviewMode === 'noise' ? 'muted' : 'accent' },
                    { label: sentiment === 'all' ? 'All sentiment' : sentiment, tone: sentiment === 'negative' ? 'muted' : 'neutral' },
                    { label: sourceType === 'all' ? 'All sources' : sourceType, tone: 'accent' },
                    { label: relevance === 'all' ? 'All relevance' : relevance, tone: 'neutral' },
                    { label: quality === 'all' ? 'All quality' : quality, tone: quality === 'noise' ? 'muted' : 'accent' },
                    { label: category === 'all' ? 'All categories' : category, tone: 'neutral' },
                  ]}
                />
              </div>
            </div>
          </JobSection>

          <JobSection title="Mentions" description={`${reviewModeLabel(reviewMode)}: ${displayedMentions.length} of ${mentions.length} loaded mentions.`}>
            {loading ? (
              <div className="text-sm text-muted">Loading mentions...</div>
            ) : displayedMentions.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted">No mentions match the current review mode and filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Title</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">URL</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Domain</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Source</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Sentiment</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Quality</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Relevance</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Domain rank</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Discovered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedMentions.map((mention, index) => {
                      const url = mentionUrl(mention)
                      const title = mentionTitle(mention)
                      const snippet = mentionSnippet(mention)
                      const reasons = mentionQualityReasons(mention)
                      const duplicateCount = mentionDuplicateCount(mention)
                      return (
                        <tr key={mention.id || `${url}-${index}`} className="border-b border-border transition-colors last:border-0 hover:bg-bg">
                          <td className="max-w-sm px-4 py-3">
                            <div className="line-clamp-2 font-semibold text-text">{title}</div>
                            {snippet && (
                              <p className="mt-1 line-clamp-2 text-xs text-muted">
                                <span className="font-semibold">Snippet:</span> {snippet}
                              </p>
                            )}
                            {duplicateCount > 1 && (
                              <span className="mt-2 inline-flex rounded-full border border-border px-2 py-0.5 text-xs font-semibold text-muted">
                                {duplicateCount} similar
                              </span>
                            )}
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
                          <td className="px-4 py-3 text-xs capitalize text-muted">{titleCase(mentionCategory(mention))}</td>
                          <td className="px-4 py-3 text-xs capitalize text-muted">{titleCase(mentionSource(mention))}</td>
                          <td className="px-4 py-3"><SentimentBadge sentiment={mentionSentiment(mention)} /></td>
                          <td className="px-4 py-3">
                            <div className="flex max-w-xs flex-col gap-1">
                              <QualityBadge label={mentionQualityLabel(mention)} score={mentionQualityScore(mention)} />
                              {reasons.length > 0 && (
                                <span className="line-clamp-2 text-xs text-muted">{reasons.join('; ')}</span>
                              )}
                            </div>
                          </td>
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
