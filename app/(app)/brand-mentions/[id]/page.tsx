'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { ArrowLeft, Ban, CheckCircle2, ChevronDown, ChevronUp, ExternalLink, RefreshCw, Settings, Star, XCircle } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import ExportMenu from '@/components/ui/ExportMenu'
import CustomSelect from '@/components/ui/CustomSelect'
import { JobLauncherShell, JobSection, JobSummaryBar, JobSummaryPills } from '@/components/ui/JobLauncher'
import { createClient } from '@/lib/supabase'
import { brandMentionsApi, type BrandMentionCrawlPayload } from '@/lib/api/brand-mentions'
import { exportRowsToGoogleSheets, googleSheetsExportError } from '@/lib/export/googleSheets'

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
  provider_sentiment?: string | null
  provider_sentiment_score?: number | string | null
  provider_positive_score?: number | string | null
  provider_neutral_score?: number | string | null
  provider_negative_score?: number | string | null
  relevance?: number | string | null
  relevance_score?: number | string | null
  quality_label?: string | null
  quality_score?: number | string | null
  quality_reasons?: string[] | null
  mention_category?: string | null
  duplicate_key?: string | null
  duplicate_count?: number | string | null
  review_status?: string | null
  favorite?: boolean | null
  review_note?: string | null
  reviewed_at?: string | null
  domain_rank?: number | string | null
  latest_crawl_status?: string | null
  latest_crawl_change_summary?: string[] | null
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
  seen_mentions?: number | string | null
  dfs_rows?: number | string | null
  requested_rows?: number | string | null
  dfs_total_count?: number | string | null
  dataforseo_rows?: number | string | null
  pull_mode?: string | null
  crawl_filters?: RecordValue | null
  estimated_cost_usd?: number | string | null
  cost?: number | string | null
  cost_usd?: number | string | null
  started_at?: string | null
  created_at?: string | null
  error?: string | null
  last_error?: string | null
}

type InsightCountItem = RecordValue & {
  count?: number | string | null
  code?: string | null
  type?: string | null
  domain?: string | null
}

type BrandPulseSummaryPayload = RecordValue & {
  total_count?: number | string | null
  rank?: number | string | null
  top_domains?: InsightCountItem[] | null
  page_types?: InsightCountItem[] | null
  countries?: InsightCountItem[] | null
  languages?: InsightCountItem[] | null
  connotation_types?: Record<string, number | string | null> | null
  sentiment_connotations?: Record<string, number | string | null> | null
}

type BrandMentionSummaryInsight = RecordValue & {
  id?: string
  alert_id?: string
  insight_type?: string | null
  keyword?: string | null
  payload?: BrandPulseSummaryPayload | null
  total_count?: number | string | null
  estimated_cost_usd?: number | string | null
  refreshed_at?: string | null
}

type BrandMentionSentimentInsight = BrandMentionSummaryInsight

type FilterValue = 'all' | 'positive' | 'neutral' | 'negative' | 'unknown'
type SourceFilter = 'all' | 'news' | 'blogs' | 'forums' | 'organizations'
type RelevanceFilter = 'all' | 'high' | 'medium' | 'low'
type QualityFilter = 'all' | 'strong' | 'useful' | 'low' | 'noise'
type CategoryFilter = 'all' | 'news' | 'blog' | 'forum' | 'organization' | 'directory' | 'jobs' | 'listicle' | 'profile' | 'other'
type CrawlStatusFilter = 'all' | 'new' | 'updated' | 'seen'
type ReviewMode = 'best' | 'review' | 'low-value' | 'noise' | 'all'
type DfsPullMode = 'newest' | 'best_quality' | 'negative_watch' | 'one_per_domain'
type DfsProviderSentimentFilter = 'all' | 'positive' | 'neutral' | 'negative'
type ReviewStatusValue = 'unreviewed' | 'approved' | 'noise' | 'false_positive'

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

const CRAWL_STATUS_OPTIONS: { value: CrawlStatusFilter; label: string }[] = [
  { value: 'all', label: 'All crawl status' },
  { value: 'new', label: 'New' },
  { value: 'updated', label: 'Updated' },
  { value: 'seen', label: 'Seen again' },
]

const REVIEW_MODE_OPTIONS: { value: ReviewMode; label: string }[] = [
  { value: 'best', label: 'Best mentions' },
  { value: 'review', label: 'Needs review' },
  { value: 'low-value', label: 'Low value' },
  { value: 'noise', label: 'Noise' },
  { value: 'all', label: 'All mentions' },
]

const CSV_HEADERS = ['Title', 'Snippet', 'URL', 'Domain', 'Category', 'Source', 'Sentiment', 'Provider sentiment', 'Provider sentiment score', 'Provider positive score', 'Provider neutral score', 'Provider negative score', 'Latest crawl status', 'Latest crawl changes', 'Quality', 'Quality Score', 'Quality Reasons', 'Relevance', 'Domain Rank', 'Published', 'Discovered']
const CRAWL_CHANGE_LABELS: Record<string, string> = {
  title: 'Title',
  snippet: 'Snippet text',
  source_type: 'Source type',
  sentiment_score: 'Sentiment score',
  provider_sentiment: 'Provider sentiment',
  provider_sentiment_score: 'Provider sentiment score',
  provider_positive_score: 'Provider positive score',
  provider_neutral_score: 'Provider neutral score',
  provider_negative_score: 'Provider negative score',
}
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
const DFS_ROW_PRESETS = [50, 100, 250, 500, 1000]
const DEFAULT_DFS_ROWS_PER_CRAWL = 50
const DEFAULT_DFS_PULL_MODE: DfsPullMode = 'newest'
const MENTION_PAGE_SIZE_OPTIONS = [50, 100, 250]
const DEFAULT_MENTION_PAGE_SIZE = 50
const CAUTION_DFS_ROW_THRESHOLD = 250
const HIGH_DFS_ROW_CONFIRMATION_THRESHOLD = 500
const DFS_REQUEST_BASE_COST_USD = 0.024
const DFS_ROW_COST_USD = 0.000036
const INTEGER_FORMAT = new Intl.NumberFormat('en-US')
const DFS_PULL_MODE_OPTIONS: { value: DfsPullMode; label: string }[] = [
  { value: 'newest', label: 'Newest mentions' },
  { value: 'best_quality', label: 'Best quality' },
  { value: 'negative_watch', label: 'Negative watch' },
  { value: 'one_per_domain', label: 'One per domain' },
]
const DFS_PROVIDER_SENTIMENT_OPTIONS: { value: DfsProviderSentimentFilter; label: string }[] = [
  { value: 'all', label: 'Any sentiment' },
  { value: 'positive', label: 'Positive' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'negative', label: 'Negative' },
]

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

function extractInsight(value: unknown, insightType: 'summary' | 'sentiment'): BrandMentionSummaryInsight | null {
  const record = asRecord(value)
  if (record.payload !== undefined || record.insight_type === insightType) {
    return record as BrandMentionSummaryInsight
  }
  const nested = asRecord(record.data)
  if (nested.payload !== undefined || nested.insight_type === insightType) {
    return nested as BrandMentionSummaryInsight
  }
  return null
}

function extractSummaryInsight(value: unknown): BrandMentionSummaryInsight | null {
  return extractInsight(value, 'summary')
}

function extractSentimentInsight(value: unknown): BrandMentionSentimentInsight | null {
  return extractInsight(value, 'sentiment')
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

function mentionProviderSentiment(mention: BrandMention) {
  return stringField(mention, ['provider_sentiment'])
}

function mentionLocalSentiment(mention: BrandMention) {
  return stringField(mention, ['sentiment'])
}

function mentionSentiment(mention: BrandMention) {
  return stringField(mention, ['provider_sentiment', 'sentiment'], 'unknown')
}

function mentionProviderSentimentScore(mention: BrandMention) {
  return numberField(mention, ['provider_sentiment_score'])
}

function mentionProviderPositiveScore(mention: BrandMention) {
  return numberField(mention, ['provider_positive_score'])
}

function mentionProviderNeutralScore(mention: BrandMention) {
  return numberField(mention, ['provider_neutral_score'])
}

function mentionProviderNegativeScore(mention: BrandMention) {
  return numberField(mention, ['provider_negative_score'])
}

function formatProviderScore(value: number | null) {
  return value === null ? '-' : value.toFixed(3)
}

function mentionSentimentConfidence(mention: BrandMention) {
  const providerScore = mentionProviderSentimentScore(mention)
  return providerScore === null ? '' : formatProviderScore(providerScore)
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

function mentionCrawlStatus(mention: BrandMention) {
  return stringField(mention, ['latest_crawl_status'])
}

function mentionCrawlChangeSummary(mention: BrandMention) {
  return Array.isArray(mention.latest_crawl_change_summary)
    ? mention.latest_crawl_change_summary.filter(field => typeof field === 'string' && field.trim())
    : []
}

function formatCrawlChangeSummary(fields: string[]) {
  return fields.map(field => CRAWL_CHANGE_LABELS[field] || titleCase(field)).join(', ')
}

function mentionDuplicateCount(mention: BrandMention) {
  return numberField(mention, ['duplicate_count']) ?? 1
}

function mentionDuplicateKey(mention: BrandMention) {
  return stringField(mention, ['duplicate_key'], mentionUrl(mention) || mentionTitle(mention))
}

function mentionReviewStatus(mention: BrandMention): ReviewStatusValue {
  const value = stringField(mention, ['review_status'], 'unreviewed').toLowerCase()
  return ['approved', 'noise', 'false_positive'].includes(value) ? value as ReviewStatusValue : 'unreviewed'
}

function reviewStatusLabel(status: ReviewStatusValue) {
  return titleCase(status === 'false_positive' ? 'wrong mention' : status)
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

function mentionMatchEvidence(mention: BrandMention, keyword?: string | null) {
  const phrase = (keyword || '').trim()
  if (!phrase) return { phrase: '-', locations: [] as string[] }

  const needle = phrase.toLowerCase()
  const fields: { label: string; value: string }[] = [
    { label: 'Title', value: mentionTitle(mention) },
    { label: 'Snippet', value: mentionSnippet(mention) },
    { label: 'URL', value: mentionUrl(mention) },
    { label: 'Domain', value: mentionDomain(mention) },
  ]
  const locations = fields
    .filter(field => field.value.toLowerCase().includes(needle))
    .map(field => field.label)

  return { phrase, locations }
}

function mentionTimeValue(mention: BrandMention) {
  const value = mentionDiscovered(mention)
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function crawlRunTimeValue(run: CrawlRun) {
  const value = stringField(run, ['started_at', 'created_at'])
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function formatInteger(value: number | null) {
  return value === null ? '-' : INTEGER_FORMAT.format(value)
}

function summaryPayload(insight: BrandMentionSummaryInsight | null): BrandPulseSummaryPayload | null {
  return insight?.payload && typeof insight.payload === 'object' ? insight.payload : null
}

function summaryCountItems(
  payload: BrandPulseSummaryPayload | null,
  key: 'countries' | 'languages' | 'page_types' | 'top_domains',
  labelKeys: string[],
  limit = 4,
) {
  const items = payload?.[key]
  if (!Array.isArray(items)) return []
  return items
    .map(item => {
      const record = asRecord(item)
      const label = stringField(record, labelKeys)
      const value = numberField(record, ['count'])
      return label && value !== null
        ? { label: titleCase(label), value, share: 0 }
        : null
    })
    .filter((item): item is { label: string; value: number; share: number } => item !== null)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map((item, _index, list) => ({
      ...item,
      share: (item.value / Math.max(1, ...list.map(entry => entry.value))) * 100,
    }))
}

function summarySentimentItems(payload: BrandPulseSummaryPayload | null) {
  const sentiment = asRecord(payload?.connotation_types)
  return ['positive', 'neutral', 'negative']
    .map(label => {
      const value = numberField(sentiment, [label])
      return value === null ? null : { label: titleCase(label), value, share: 0 }
    })
    .filter((item): item is { label: string; value: number; share: number } => item !== null)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .map((item, _index, list) => ({
      ...item,
      share: (item.value / Math.max(1, ...list.map(entry => entry.value))) * 100,
    }))
}

function summaryEmotionItems(payload: BrandPulseSummaryPayload | null, limit = 4) {
  const emotions = asRecord(payload?.sentiment_connotations)
  return Object.keys(emotions)
    .map(label => {
      const value = numberField(emotions, [label])
      return value === null ? null : { label: titleCase(label), value, share: 0 }
    })
    .filter((item): item is { label: string; value: number; share: number } => item !== null)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map((item, _index, list) => ({
      ...item,
      share: (item.value / Math.max(1, ...list.map(entry => entry.value))) * 100,
    }))
}

function topSummaryItemLabel(items: { label: string; value: number }[]) {
  if (!items.length) return '-'
  return `${items[0].label} ${formatInteger(items[0].value)}`
}

function formatInsightCost(insight: BrandMentionSummaryInsight | null) {
  const cost = numberField(asRecord(insight), ['estimated_cost_usd', 'cost_usd', 'cost'])
  return cost === null ? '-' : `$${cost.toFixed(4)}`
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
  return (
    mentionRelevanceLevel(mention) === 'low'
    || quality === 'low'
    || quality === 'noise'
  )
}

function hasSentimentMismatch(mention: BrandMention) {
  const providerSentiment = mentionProviderSentiment(mention).toLowerCase()
  const localSentiment = mentionLocalSentiment(mention).toLowerCase()
  if (!providerSentiment || !localSentiment) return false
  if (providerSentiment === 'unknown' || localSentiment === 'unknown') return false
  return providerSentiment !== localSentiment
    && (providerSentiment === 'negative' || localSentiment === 'negative')
}

function needsReviewMention(mention: BrandMention) {
  if (mentionReviewStatus(mention) !== 'unreviewed') return false
  return (
    hasSentimentMismatch(mention)
    ||
    isHighValueMention(mention)
    || mentionSentiment(mention).toLowerCase() === 'negative'
    || (mentionRelevanceLevel(mention) === 'medium' && !isNoiseMention(mention))
  )
}

function sortMentionsByValue(mentions: BrandMention[]) {
  return [...mentions].sort((a, b) => {
    const favoriteDelta = Number(b.favorite === true) - Number(a.favorite === true)
    if (favoriteDelta !== 0) return favoriteDelta

    const highValueDelta = Number(!isHighValueMention(a)) - Number(!isHighValueMention(b))
    if (highValueDelta !== 0) return highValueDelta

    const negativeDelta = Number(mentionSentiment(b).toLowerCase() === 'negative') - Number(mentionSentiment(a).toLowerCase() === 'negative')
    if (negativeDelta !== 0) return negativeDelta

    const relevanceDelta = (RELEVANCE_ORDER[mentionRelevanceLevel(a)] ?? 9) - (RELEVANCE_ORDER[mentionRelevanceLevel(b)] ?? 9)
    if (relevanceDelta !== 0) return relevanceDelta

    const qualityDelta = (QUALITY_ORDER[mentionQualityLabel(a).toLowerCase()] ?? 9) - (QUALITY_ORDER[mentionQualityLabel(b).toLowerCase()] ?? 9)
    if (qualityDelta !== 0) return qualityDelta

    const scoreDelta = mentionQualityScoreValue(b) - mentionQualityScoreValue(a)
    if (scoreDelta !== 0) return scoreDelta

    const categoryDelta = (CATEGORY_ORDER[mentionCategory(a).toLowerCase()] ?? 9) - (CATEGORY_ORDER[mentionCategory(b).toLowerCase()] ?? 9)
    if (categoryDelta !== 0) return categoryDelta

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

function collapseDuplicateGroups(mentions: BrandMention[], expandedDuplicateKeys: Set<string>) {
  const groups = new Map<string, BrandMention[]>()

  for (const mention of mentions) {
    const key = mentionDuplicateKey(mention)
    if (!key || mentionDuplicateCount(mention) <= 1) continue
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)?.push(mention)
  }

  const consumedKeys = new Set<string>()
  const rows: BrandMention[] = []
  for (const mention of mentions) {
    const key = mentionDuplicateKey(mention)
    const group = key ? groups.get(key) : undefined
    if (!key || !group) {
      rows.push(mention)
      continue
    }
    if (consumedKeys.has(key)) continue
    consumedKeys.add(key)
    rows.push(...(expandedDuplicateKeys.has(key) ? group : [group[0]]))
  }

  return rows
}

function reviewModeLabel(reviewMode: ReviewMode) {
  return REVIEW_MODE_OPTIONS.find(option => option.value === reviewMode)?.label || 'Best mentions'
}

function crawlStatusLabel(status: CrawlStatusFilter | string) {
  return CRAWL_STATUS_OPTIONS.find(option => option.value === status)?.label || titleCase(status)
}

function quoteCsv(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function buildMentionsExportRows(mentions: BrandMention[]) {
  return mentions.map(mention => ({
    Title: mentionTitle(mention),
    Snippet: mentionSnippet(mention),
    URL: mentionUrl(mention),
    Domain: mentionDomain(mention),
    Category: mentionCategory(mention),
    Source: mentionSource(mention),
    Sentiment: mentionSentiment(mention),
    'Provider sentiment': mentionProviderSentiment(mention),
    'Provider sentiment score': mentionProviderSentimentScore(mention) ?? '',
    'Provider positive score': mentionProviderPositiveScore(mention) ?? '',
    'Provider neutral score': mentionProviderNeutralScore(mention) ?? '',
    'Provider negative score': mentionProviderNegativeScore(mention) ?? '',
    'Latest crawl status': mentionCrawlStatus(mention) ? crawlStatusLabel(mentionCrawlStatus(mention)) : '',
    'Latest crawl changes': formatCrawlChangeSummary(mentionCrawlChangeSummary(mention)),
    Quality: mentionQualityLabel(mention),
    'Quality Score': mentionQualityScore(mention),
    'Quality Reasons': mentionQualityReasons(mention).join('; '),
    Relevance: mentionRelevance(mention),
    'Domain Rank': mentionDomainRank(mention),
    Published: mentionPublished(mention),
    Discovered: mentionDiscovered(mention),
  }))
}

function buildMentionsCsv(mentions: BrandMention[]) {
  const rows = buildMentionsExportRows(mentions)
  return [
    CSV_HEADERS.join(','),
    ...rows.map(row => CSV_HEADERS.map(header => quoteCsv(row[header as keyof typeof row])).join(',')),
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
  crawlStatus: CrawlStatusFilter,
  includeDuplicates = false,
) {
  const params = new URLSearchParams()
  if (sentiment !== 'all') params.set('sentiment', sentiment)
  if (sourceType !== 'all') params.set('source_type', sourceType)
  if (relevance !== 'all') params.set('relevance', relevance)
  if (quality !== 'all') params.set('quality_label', quality)
  if (category !== 'all') params.set('mention_category', category)
  if (crawlStatus !== 'all') params.set('crawl_status', crawlStatus)
  if (includeDuplicates) params.set('include_duplicates', 'true')
  return params.toString()
}

function buildPageQuery(
  sentiment: FilterValue,
  sourceType: SourceFilter,
  relevance: RelevanceFilter,
  quality: QualityFilter,
  category: CategoryFilter,
  crawlStatus: CrawlStatusFilter,
  reviewMode: ReviewMode,
) {
  const params = new URLSearchParams(buildMentionQuery(sentiment, sourceType, relevance, quality, category, crawlStatus))
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

function parseCrawlStatus(params: URLSearchParams): CrawlStatusFilter {
  const value = params.get('crawl_status') || params.get('crawl')
  return CRAWL_STATUS_OPTIONS.some(option => option.value === value) ? value as CrawlStatusFilter : 'all'
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

function formatEstimatedDfsCost(rows: number) {
  return `$${(DFS_REQUEST_BASE_COST_USD + (DFS_ROW_COST_USD * rows)).toFixed(4)}`
}

function dfsRowGuardrailText(rows: number) {
  if (rows >= HIGH_DFS_ROW_CONFIRMATION_THRESHOLD) {
    return 'High-depth crawl. Confirm before running.'
  }
  if (rows >= CAUTION_DFS_ROW_THRESHOLD) {
    return 'Broader crawl. Use when you need wider coverage.'
  }
  return ''
}

function dfsPullModeLabel(mode: string) {
  return DFS_PULL_MODE_OPTIONS.find(option => option.value === mode)?.label || titleCase(mode)
}

function buildDfsCrawlFilters(
  country: string,
  language: string,
  providerSentiment: DfsProviderSentimentFilter,
  includeDomain: string,
  excludeDomain: string,
  dateFrom: string,
) {
  const filters: NonNullable<BrandMentionCrawlPayload['filters']> = {}
  if (country.trim()) filters.country = country.trim().toUpperCase()
  if (language.trim()) filters.language = language.trim().toLowerCase()
  if (providerSentiment !== 'all') filters.provider_sentiment = providerSentiment
  if (includeDomain.trim()) filters.include_domain = includeDomain.trim()
  if (excludeDomain.trim()) filters.exclude_domain = excludeDomain.trim()
  if (dateFrom.trim()) filters.date_from = dateFrom.trim()
  return filters
}

function activeFilterCount(filters?: Record<string, unknown> | null) {
  return Object.values(filters || {}).filter(value => value !== undefined && value !== null && String(value).trim()).length
}

function formatCrawlFilters(filters?: RecordValue | null) {
  const count = activeFilterCount(filters)
  return count === 0 ? '' : `${count} filter${count === 1 ? '' : 's'}`
}

function confirmHighDfsRows(rows: number) {
  if (rows < HIGH_DFS_ROW_CONFIRMATION_THRESHOLD || typeof window === 'undefined') {
    return true
  }
  return window.confirm(`Run a ${rows}-row DFS crawl? Estimated DFS cost is ${formatEstimatedDfsCost(rows)}.`)
}

function formatCrawlRunCost(run: CrawlRun | null) {
  if (!run) return '-'
  const cost = numberField(run, ['estimated_cost_usd', 'cost_usd', 'cost'])
  return cost === null ? '-' : `$${cost.toFixed(4)}`
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

function ReviewBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
      {label}
    </span>
  )
}

function CrawlStatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase()
  const styles = normalized === 'new'
    ? { background: 'rgba(11,122,92,0.10)', borderColor: 'rgba(11,122,92,0.24)', color: 'var(--success)' }
    : normalized === 'updated'
      ? { background: 'rgba(198,123,0,0.10)', borderColor: 'rgba(198,123,0,0.24)', color: 'var(--warning)' }
      : { background: 'rgba(124,118,111,0.10)', borderColor: 'rgba(124,118,111,0.20)', color: 'var(--muted)' }
  return (
    <span className="inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold" style={styles}>
      {crawlStatusLabel(normalized)}
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
  const [crawlStatus, setCrawlStatus] = useState<CrawlStatusFilter>('all')
  const [reviewMode, setReviewMode] = useState<ReviewMode>('best')
  const [filtersReady, setFiltersReady] = useState(false)
  const [alert, setAlert] = useState<BrandMentionAlert | null>(null)
  const [mentions, setMentions] = useState<BrandMention[]>([])
  const [runs, setRuns] = useState<CrawlRun[]>([])
  const [coverageInsight, setCoverageInsight] = useState<BrandMentionSummaryInsight | null>(null)
  const [sentimentInsight, setSentimentInsight] = useState<BrandMentionSentimentInsight | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [coverageInsightError, setCoverageInsightError] = useState('')
  const [coverageInsightRefreshing, setCoverageInsightRefreshing] = useState(false)
  const [sentimentInsightError, setSentimentInsightError] = useState('')
  const [sentimentInsightRefreshing, setSentimentInsightRefreshing] = useState(false)
  const [crawling, setCrawling] = useState(false)
  const [crawlError, setCrawlError] = useState('')
  const [exportingSheets, setExportingSheets] = useState(false)
  const [reviewActionError, setReviewActionError] = useState('')
  const [pendingMentionAction, setPendingMentionAction] = useState('')
  const [showSettingsCta, setShowSettingsCta] = useState(false)
  const [selectedDfsRows, setSelectedDfsRows] = useState(DEFAULT_DFS_ROWS_PER_CRAWL)
  const [selectedDfsPullMode, setSelectedDfsPullMode] = useState<DfsPullMode>(DEFAULT_DFS_PULL_MODE)
  const [mentionPageSize, setMentionPageSize] = useState(DEFAULT_MENTION_PAGE_SIZE)
  const [visibleMentionLimit, setVisibleMentionLimit] = useState(DEFAULT_MENTION_PAGE_SIZE)
  const [showDfsFilters, setShowDfsFilters] = useState(false)
  const [showDfsInsightDetails, setShowDfsInsightDetails] = useState(false)
  const [showCrawlHistory, setShowCrawlHistory] = useState(false)
  const [expandedDuplicateKeys, setExpandedDuplicateKeys] = useState<Set<string>>(new Set())
  const [dfsCountry, setDfsCountry] = useState('')
  const [dfsLanguage, setDfsLanguage] = useState('')
  const [dfsProviderSentiment, setDfsProviderSentiment] = useState<DfsProviderSentimentFilter>('all')
  const [dfsIncludeDomain, setDfsIncludeDomain] = useState('')
  const [dfsExcludeDomain, setDfsExcludeDomain] = useState('')
  const [dfsDateFrom, setDfsDateFrom] = useState('')
  const categoryOptions = useMemo(() => categoryOptionsForSource(sourceType), [sourceType])
  const selectedDfsCost = formatEstimatedDfsCost(selectedDfsRows)
  const selectedDfsGuardrail = dfsRowGuardrailText(selectedDfsRows)
  const selectedDfsFilters = useMemo(
    () => buildDfsCrawlFilters(
      dfsCountry,
      dfsLanguage,
      dfsProviderSentiment,
      dfsIncludeDomain,
      dfsExcludeDomain,
      dfsDateFrom,
    ),
    [dfsCountry, dfsDateFrom, dfsExcludeDomain, dfsIncludeDomain, dfsLanguage, dfsProviderSentiment],
  )
  const selectedDfsFilterCount = activeFilterCount(selectedDfsFilters)

  const apiMentionQuery = useMemo(
    () => buildMentionQuery(sentiment, sourceType, relevance, quality, category, crawlStatus, true),
    [category, crawlStatus, quality, relevance, sentiment, sourceType],
  )

  const pageQuery = useMemo(
    () => buildPageQuery(sentiment, sourceType, relevance, quality, category, crawlStatus, reviewMode),
    [category, crawlStatus, quality, relevance, reviewMode, sentiment, sourceType],
  )

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setSentiment(parseSentiment(params))
    setSourceType(parseSourceType(params))
    setRelevance(parseRelevance(params))
    setQuality(parseQuality(params))
    setCategory(parseCategory(params))
    setCrawlStatus(parseCrawlStatus(params))
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
      try {
        const insightData = await brandMentionsApi.getSummaryInsight(token, alertId)
        setCoverageInsight(extractSummaryInsight(insightData))
        setCoverageInsightError('')
      } catch (insightError) {
        setCoverageInsight(null)
        setCoverageInsightError(
          insightError instanceof Error
            ? insightError.message
            : 'Coverage insight unavailable.',
        )
      }
      try {
        const sentimentData = await brandMentionsApi.getSentimentInsight(token, alertId)
        setSentimentInsight(extractSentimentInsight(sentimentData))
        setSentimentInsightError('')
      } catch (sentimentError) {
        setSentimentInsight(null)
        setSentimentInsightError(
          sentimentError instanceof Error
            ? sentimentError.message
            : 'Sentiment insight unavailable.',
        )
      }
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
    setCrawlError('')
    setShowSettingsCta(false)
    if (!confirmHighDfsRows(selectedDfsRows)) return
    setCrawling(true)
    try {
      const token = await getSessionToken()
      if (!token) {
        router.push('/login')
        return
      }

      const payload: BrandMentionCrawlPayload = {
        max_results_per_crawl: selectedDfsRows,
        pull_mode: selectedDfsPullMode,
      }
      if (selectedDfsFilterCount > 0) payload.filters = selectedDfsFilters
      await brandMentionsApi.crawlAlert(token, alertId, payload)
      await load()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Run Pulse failed.'
      setCrawlError(message)
      setShowSettingsCta(isSettingsError(message))
    } finally {
      setCrawling(false)
    }
  }

  function applyMentionPatch(mentionId: string, patch: Partial<BrandMention>) {
    setMentions(current => current.map(mention => mention.id === mentionId ? { ...mention, ...patch } : mention))
  }

  async function handleReviewMention(mention: BrandMention, reviewStatus: ReviewStatusValue) {
    if (!mention.id) return
    const actionKey = `${mention.id}:review:${reviewStatus}`
    setReviewActionError('')
    setPendingMentionAction(actionKey)
    try {
      const token = await getSessionToken()
      if (!token) {
        router.push('/login')
        return
      }
      const updated = await brandMentionsApi.updateMentionReview(token, mention.id, { review_status: reviewStatus })
      const feedbackPatch = reviewStatus === 'noise'
        ? { quality_label: 'noise', quality_score: Math.min(mentionQualityScoreValue(mention), 10), relevance: 'low' }
        : reviewStatus === 'false_positive'
        ? { quality_label: 'noise', quality_score: 0, relevance: 'low', sentiment: 'neutral' }
        : {}
      applyMentionPatch(mention.id, { review_status: reviewStatus, ...feedbackPatch, ...asRecord(updated) })
    } catch (error) {
      setReviewActionError(error instanceof Error ? error.message : 'Review update failed.')
    } finally {
      setPendingMentionAction('')
    }
  }

  async function handleFavoriteMention(mention: BrandMention) {
    if (!mention.id) return
    const nextFavorite = mention.favorite !== true
    const actionKey = `${mention.id}:favorite`
    setReviewActionError('')
    setPendingMentionAction(actionKey)
    try {
      const token = await getSessionToken()
      if (!token) {
        router.push('/login')
        return
      }
      const updated = await brandMentionsApi.updateMentionReview(token, mention.id, { favorite: nextFavorite })
      applyMentionPatch(mention.id, { favorite: nextFavorite, ...asRecord(updated) })
    } catch (error) {
      setReviewActionError(error instanceof Error ? error.message : 'Favorite update failed.')
    } finally {
      setPendingMentionAction('')
    }
  }

  async function handleSuppressMention(mention: BrandMention, ruleType: 'domain' | 'url' | 'duplicate_key') {
    const value = ruleType === 'domain'
      ? mentionDomain(mention)
      : ruleType === 'url'
      ? mentionUrl(mention)
      : mentionDuplicateKey(mention)
    if (!value) return
    const actionKey = `${mention.id || value}:suppress:${ruleType}`
    setReviewActionError('')
    setPendingMentionAction(actionKey)
    try {
      const token = await getSessionToken()
      if (!token) {
        router.push('/login')
        return
      }
      await brandMentionsApi.createSuppressionRule(token, alertId, { rule_type: ruleType, value })
      setMentions(current => current.filter(row => {
        if (ruleType === 'domain') return mentionDomain(row) !== value
        if (ruleType === 'url') return mentionUrl(row) !== value
        return mentionDuplicateKey(row) !== value
      }))
    } catch (error) {
      setReviewActionError(error instanceof Error ? error.message : 'Suppression rule failed.')
    } finally {
      setPendingMentionAction('')
    }
  }

  async function handleRefreshSummaryInsight() {
    setCoverageInsightError('')
    setCoverageInsightRefreshing(true)
    try {
      const token = await getSessionToken()
      if (!token) {
        router.push('/login')
        return
      }
      const insightData = await brandMentionsApi.refreshSummaryInsight(token, alertId)
      setCoverageInsight(extractSummaryInsight(insightData))
    } catch (error) {
      setCoverageInsightError(
        error instanceof Error ? error.message : 'Coverage insight refresh failed.',
      )
    } finally {
      setCoverageInsightRefreshing(false)
    }
  }

  async function handleRefreshSentimentInsight() {
    setSentimentInsightError('')
    setSentimentInsightRefreshing(true)
    try {
      const token = await getSessionToken()
      if (!token) {
        router.push('/login')
        return
      }
      const insightData = await brandMentionsApi.refreshSentimentInsight(token, alertId)
      setSentimentInsight(extractSentimentInsight(insightData))
    } catch (error) {
      setSentimentInsightError(
        error instanceof Error ? error.message : 'Sentiment insight refresh failed.',
      )
    } finally {
      setSentimentInsightRefreshing(false)
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

  function applyQuickReviewFilter(filter: 'new' | 'updated' | 'review') {
    if (filter === 'new') {
      setCrawlStatus('new')
      setReviewMode('all')
      return
    }
    if (filter === 'updated') {
      setCrawlStatus('updated')
      setReviewMode('all')
      return
    }
    setCrawlStatus('all')
    setReviewMode('review')
  }

  function toggleDuplicateGroup(duplicateKey: string) {
    setExpandedDuplicateKeys(current => {
      const next = new Set(current)
      if (next.has(duplicateKey)) {
        next.delete(duplicateKey)
      } else {
        next.add(duplicateKey)
      }
      return next
    })
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

  function downloadXlsx() {
    if (!displayedMentions.length) return
    const rows = buildMentionsExportRows(displayedMentions)
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: CSV_HEADERS })
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Mentions')
    XLSX.writeFile(workbook, `${safeFileName(alert?.label || alertId)}-mentions.xlsx`)
  }

  async function exportGoogleSheets() {
    if (!displayedMentions.length || exportingSheets) return
    setExportingSheets(true)
    try {
      await exportRowsToGoogleSheets({
        title: `${alert?.label || alert?.keyword || 'Brand Pulse'} - Brand Pulse mentions`,
        sheet_name: 'Mentions',
        headers: CSV_HEADERS,
        rows: buildMentionsExportRows(displayedMentions),
      })
    } catch (error) {
      window.alert(googleSheetsExportError(error))
    } finally {
      setExportingSheets(false)
    }
  }

  const sortedMentions = useMemo(() => sortMentionsByValue(mentions), [mentions])
  const reviewFilteredMentions = useMemo(
    () => filterMentionsByReviewMode(sortedMentions, reviewMode),
    [reviewMode, sortedMentions],
  )
  const displayedMentions = useMemo(
    () => collapseDuplicateGroups(reviewFilteredMentions, expandedDuplicateKeys),
    [expandedDuplicateKeys, reviewFilteredMentions],
  )
  const visibleMentions = useMemo(
    () => displayedMentions.slice(0, visibleMentionLimit),
    [displayedMentions, visibleMentionLimit],
  )
  const hiddenMentionCount = Math.max(0, displayedMentions.length - visibleMentions.length)
  useEffect(() => {
    setVisibleMentionLimit(mentionPageSize)
  }, [alertId, category, crawlStatus, mentionPageSize, quality, relevance, reviewMode, sentiment, sourceType])
  const negativeCount = mentions.filter(mention => mentionSentiment(mention).toLowerCase() === 'negative').length
  const highValueCount = mentions.filter(isHighValueMention).length
  const lowValueCount = mentions.filter(mention => isLowValueMention(mention) && !isNoiseMention(mention)).length
  const noiseCount = mentions.filter(isNoiseMention).length
  const coveragePayload = useMemo(() => summaryPayload(coverageInsight), [coverageInsight])
  const coverageCountryItems = useMemo(
    () => summaryCountItems(coveragePayload, 'countries', ['code']),
    [coveragePayload],
  )
  const coverageLanguageItems = useMemo(
    () => summaryCountItems(coveragePayload, 'languages', ['code']),
    [coveragePayload],
  )
  const coveragePageTypeItems = useMemo(
    () => summaryCountItems(coveragePayload, 'page_types', ['type']),
    [coveragePayload],
  )
  const coverageSentimentItems = useMemo(
    () => summarySentimentItems(coveragePayload),
    [coveragePayload],
  )
  const coverageTotalCount = (
    numberField(asRecord(coveragePayload), ['total_count'])
    ?? numberField(asRecord(coverageInsight), ['total_count'])
  )
  const coverageRank = numberField(asRecord(coveragePayload), ['rank'])
  const coverageInsightSummaryItems = useMemo(() => [
    { label: 'Indexed citations', value: formatInteger(coverageTotalCount) },
    { label: 'DFS rank', value: formatInteger(coverageRank) },
    { label: 'Top country', value: topSummaryItemLabel(coverageCountryItems) },
    { label: 'Top language', value: topSummaryItemLabel(coverageLanguageItems) },
    { label: 'Cost', value: formatInsightCost(coverageInsight) },
  ], [
    coverageCountryItems,
    coverageInsight,
    coverageLanguageItems,
    coverageRank,
    coverageTotalCount,
  ])
  const sentimentPayload = useMemo(() => summaryPayload(sentimentInsight), [sentimentInsight])
  const sentimentOverviewItems = useMemo(
    () => summarySentimentItems(sentimentPayload),
    [sentimentPayload],
  )
  const sentimentEmotionItems = useMemo(
    () => summaryEmotionItems(sentimentPayload),
    [sentimentPayload],
  )
  const sentimentTotalCount = (
    numberField(asRecord(sentimentPayload), ['total_count'])
    ?? numberField(asRecord(sentimentInsight), ['total_count'])
  )
  const sentimentInsightSummaryItems = useMemo(() => [
    { label: 'Analyzed mentions', value: formatInteger(sentimentTotalCount) },
    { label: 'Positive', value: formatInteger(numberField(asRecord(sentimentPayload?.connotation_types), ['positive'])) },
    { label: 'Neutral', value: formatInteger(numberField(asRecord(sentimentPayload?.connotation_types), ['neutral'])) },
    { label: 'Negative', value: formatInteger(numberField(asRecord(sentimentPayload?.connotation_types), ['negative'])) },
    { label: 'Top emotion', value: topSummaryItemLabel(sentimentEmotionItems) },
    { label: 'Cost', value: formatInsightCost(sentimentInsight) },
  ], [sentimentEmotionItems, sentimentInsight, sentimentPayload, sentimentTotalCount])
  const latestInsightRefresh = useMemo(() => {
    const timestamps = [coverageInsight?.refreshed_at, sentimentInsight?.refreshed_at]
      .map(value => value ? new Date(value).getTime() : Number.NaN)
      .filter(value => Number.isFinite(value))
    return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null
  }, [coverageInsight?.refreshed_at, sentimentInsight?.refreshed_at])
  const insightCostTotal = useMemo(() => {
    const coverageCost = numberField(asRecord(coverageInsight), ['estimated_cost_usd', 'cost_usd', 'cost'])
    const sentimentCost = numberField(asRecord(sentimentInsight), ['estimated_cost_usd', 'cost_usd', 'cost'])
    if (coverageCost === null && sentimentCost === null) return '-'
    return `$${((coverageCost ?? 0) + (sentimentCost ?? 0)).toFixed(4)}`
  }, [coverageInsight, sentimentInsight])
  const dfsInsightSnapshotItems = useMemo(() => [
    { label: 'Indexed mentions', value: formatInteger(coverageTotalCount) },
    { label: 'Positive', value: formatInteger(numberField(asRecord(sentimentPayload?.connotation_types), ['positive'])) },
    { label: 'Neutral', value: formatInteger(numberField(asRecord(sentimentPayload?.connotation_types), ['neutral'])) },
    { label: 'Negative', value: formatInteger(numberField(asRecord(sentimentPayload?.connotation_types), ['negative'])) },
    { label: 'Last refreshed', value: formatDate(latestInsightRefresh) },
    { label: 'Cost', value: insightCostTotal },
  ], [coverageTotalCount, insightCostTotal, latestInsightRefresh, sentimentPayload])
  const latestCrawlRun = useMemo(
    () => [...runs].sort((a, b) => crawlRunTimeValue(b) - crawlRunTimeValue(a))[0] || null,
    [runs],
  )
  const latestCrawlSummaryItems = useMemo(() => [
    { label: 'New', value: numberField(latestCrawlRun || {}, ['new_mentions', 'new_count']) ?? 0 },
    { label: 'Updated', value: numberField(latestCrawlRun || {}, ['updated_mentions', 'updated_count']) ?? 0 },
    { label: 'Seen again', value: numberField(latestCrawlRun || {}, ['seen_mentions', 'seen_count']) ?? 0 },
    { label: 'Rows checked', value: numberField(latestCrawlRun || {}, ['dfs_rows', 'dataforseo_rows', 'rows']) ?? 0 },
    { label: 'Cost', value: formatCrawlRunCost(latestCrawlRun) },
  ], [latestCrawlRun])
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
            <div className="brand-pulse-summary-controls">
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
              <p className="text-sm font-semibold text-warning">Run Pulse failed</p>
              <p className="mt-1 text-sm text-muted">{crawlError}</p>
              {showSettingsCta && (
                <Link href="/settings" className="btn-ghost mt-3 gap-2 text-xs">
                  <Settings size={13} />
                  Open Settings
                </Link>
              )}
            </div>
          )}

          {reviewActionError && (
            <div className="rounded-lg border p-4" style={{ background: 'rgba(198,123,0,0.08)', borderColor: 'rgba(198,123,0,0.26)' }}>
              <p className="text-sm font-semibold text-warning">Review action failed</p>
              <p className="mt-1 text-sm text-muted">{reviewActionError}</p>
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

          <JobSection title="Crawl controls" className="brand-pulse-crawl-panel">
            <div className="brand-pulse-crawl-actions brand-pulse-crawl-toolbar">
              <div className="brand-pulse-dfs-selector">
                <div className="brand-pulse-dfs-control-grid">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-xs font-semibold text-muted">DFS rows for this crawl</label>
                      <span className="text-xs font-semibold text-text">Estimated DFS cost {selectedDfsCost}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {DFS_ROW_PRESETS.map(preset => {
                        const active = selectedDfsRows === preset
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setSelectedDfsRows(preset)}
                            className="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                            style={active ? { background: 'var(--accent)', color: 'white' } : { color: 'var(--muted)' }}
                            aria-pressed={active}
                          >
                            {preset}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted">Pull</label>
                    <CustomSelect
                      value={selectedDfsPullMode}
                      onChange={value => setSelectedDfsPullMode(value as DfsPullMode)}
                      options={DFS_PULL_MODE_OPTIONS}
                    />
                    <p className="sr-only">Selected pull mode: {dfsPullModeLabel(selectedDfsPullMode)}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDfsFilters(value => !value)}
                    className="btn-ghost gap-2 px-2 py-1 text-xs"
                    aria-expanded={showDfsFilters}
                  >
                    <Settings size={12} />
                    Filters{selectedDfsFilterCount ? ` ${selectedDfsFilterCount}` : ''}
                  </button>
                  {selectedDfsFilterCount > 0 && (
                    <span className="text-xs text-muted">{selectedDfsFilterCount} active</span>
                  )}
                </div>
                {showDfsFilters && (
                  <div className="brand-pulse-dfs-filter-grid mt-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted">Country</label>
                      <input
                        value={dfsCountry}
                        onChange={event => setDfsCountry(event.target.value)}
                        placeholder="US"
                        maxLength={3}
                        className="input-field h-9 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted">Language</label>
                      <input
                        value={dfsLanguage}
                        onChange={event => setDfsLanguage(event.target.value)}
                        placeholder="en"
                        maxLength={8}
                        className="input-field h-9 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted">Provider sentiment</label>
                      <CustomSelect
                        value={dfsProviderSentiment}
                        onChange={value => setDfsProviderSentiment(value as DfsProviderSentimentFilter)}
                        options={DFS_PROVIDER_SENTIMENT_OPTIONS}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted">Include domain</label>
                      <input
                        value={dfsIncludeDomain}
                        onChange={event => setDfsIncludeDomain(event.target.value)}
                        placeholder="example.com"
                        className="input-field h-9 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted">Exclude domain</label>
                      <input
                        value={dfsExcludeDomain}
                        onChange={event => setDfsExcludeDomain(event.target.value)}
                        placeholder="example.com"
                        className="input-field h-9 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted">From date</label>
                      <input
                        type="date"
                        value={dfsDateFrom}
                        onChange={event => setDfsDateFrom(event.target.value)}
                        className="input-field h-9 text-sm"
                      />
                    </div>
                  </div>
                )}
                {selectedDfsGuardrail && (
                  <p className="mt-2 text-xs text-warning">{selectedDfsGuardrail}</p>
                )}
              </div>
              <div className="brand-pulse-action-buttons">
                <button onClick={() => void load()} disabled={loading || crawling} className="btn-ghost gap-2 text-sm">
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  Refresh
                </button>
                <ExportMenu
                  onCsv={downloadCsv}
                  onXlsx={downloadXlsx}
                  onGoogleSheets={exportGoogleSheets}
                  sheetsLoading={exportingSheets}
                  className={!displayedMentions.length ? 'pointer-events-none opacity-50' : ''}
                />
                <button onClick={() => void handleCrawl()} disabled={crawling} className="btn-primary gap-2 text-sm">
                  <RefreshCw size={14} className={crawling ? 'animate-spin' : ''} />
                  {crawling ? 'Running...' : 'Run Pulse'}
                </button>
              </div>
            </div>
          </JobSection>

          <JobSection title="DFS insights" className="brand-pulse-coverage">
            <div className="brand-pulse-insight-header">
              <div className="brand-pulse-insight-summary">
                <JobSummaryBar summaryItems={dfsInsightSnapshotItems} />
              </div>
              <div className="brand-pulse-insight-actions">
                <button
                  type="button"
                  onClick={() => setShowDfsInsightDetails(value => !value)}
                  className="btn-ghost gap-2 text-xs"
                  aria-expanded={showDfsInsightDetails}
                >
                  {showDfsInsightDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  {showDfsInsightDetails ? 'Hide details' : 'Details'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleRefreshSummaryInsight()}
                  disabled={coverageInsightRefreshing}
                  className="btn-ghost gap-2 text-xs"
                >
                  <RefreshCw size={13} className={coverageInsightRefreshing ? 'animate-spin' : ''} />
                  {coverageInsightRefreshing ? 'Refreshing...' : 'Refresh summary'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleRefreshSentimentInsight()}
                  disabled={sentimentInsightRefreshing}
                  className="btn-ghost gap-2 text-xs"
                >
                  <RefreshCw size={13} className={sentimentInsightRefreshing ? 'animate-spin' : ''} />
                  {sentimentInsightRefreshing ? 'Refreshing...' : 'Refresh sentiment'}
                </button>
              </div>
            </div>
            {(coverageInsightError || sentimentInsightError) && (
              <p
                className="mt-3 rounded-md border px-3 py-2 text-xs text-warning"
                style={{ background: 'rgba(198,123,0,0.08)', borderColor: 'rgba(198,123,0,0.24)' }}
              >
                {coverageInsightError || sentimentInsightError}
              </p>
            )}
            {showDfsInsightDetails && (
              <div className="brand-pulse-insight-details">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Coverage details</p>
                  <JobSummaryBar summaryItems={coverageInsightSummaryItems} />
                </div>
                {coveragePayload ? (
                  <div className="brand-pulse-insight-grid">
                    {[
                      { title: 'Top countries', items: coverageCountryItems },
                      { title: 'Top languages', items: coverageLanguageItems },
                      { title: 'DFS source mix', items: coveragePageTypeItems },
                      { title: 'DFS sentiment', items: coverageSentimentItems },
                    ].map(group => (
                      <div key={group.title} className="brand-pulse-insight-list">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{group.title}</p>
                        <div className="space-y-1.5">
                          {(group.items.length ? group.items : [{ label: '-', value: 0, share: 0 }]).map(item => (
                            <div key={item.label} className="flex items-center gap-2 text-xs">
                              <span className="min-w-0 flex-1 truncate font-semibold text-text">{item.label}</span>
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-bg">
                                <div className="h-full rounded-full bg-accent" style={{ width: `${item.share}%` }} />
                              </div>
                              <span className="w-12 text-right text-muted">{formatInteger(item.value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {sentimentPayload ? (
                  <div className="brand-pulse-sentiment-overview">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Sentiment overview</p>
                      <JobSummaryBar summaryItems={sentimentInsightSummaryItems} />
                    </div>
                    <div className="brand-pulse-insight-grid brand-pulse-insight-grid--compact">
                      {[
                        { title: 'Provider sentiment', items: sentimentOverviewItems },
                        { title: 'Emotion signals', items: sentimentEmotionItems },
                      ].map(group => (
                        <div key={group.title} className="brand-pulse-insight-list">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{group.title}</p>
                          <div className="space-y-1.5">
                            {(group.items.length ? group.items : [{ label: '-', value: 0, share: 0 }]).map(item => (
                              <div key={item.label} className="flex items-center gap-2 text-xs">
                                <span className="min-w-0 flex-1 truncate font-semibold text-text">{item.label}</span>
                                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-bg">
                                  <div className="h-full rounded-full bg-accent" style={{ width: `${item.share}%` }} />
                                </div>
                                <span className="w-12 text-right text-muted">{formatInteger(item.value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

          </JobSection>

          <JobSection title="Mention filters" description="Filters reload the mention list and are reflected in the URL.">
            {latestCrawlRun && (
              <div className="brand-pulse-latest-crawl-strip mb-4 flex flex-col gap-3 rounded-lg border border-border bg-bg/60 p-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 flex-wrap gap-2">
                  {latestCrawlSummaryItems.map(item => (
                    <div key={item.label} className="min-w-24 rounded-md border border-border bg-surface px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{item.label}</p>
                      <p className="mt-1 text-sm font-semibold text-text">{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => applyQuickReviewFilter('new')}
                    className="btn-ghost text-xs"
                  >
                    New only
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickReviewFilter('updated')}
                    className="btn-ghost text-xs"
                  >
                    Updated only
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickReviewFilter('review')}
                    className="btn-ghost text-xs"
                  >
                    Needs review
                  </button>
                </div>
              </div>
            )}
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
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
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
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">Latest crawl</label>
                <CustomSelect
                  value={crawlStatus}
                  onChange={value => setCrawlStatus(value as CrawlStatusFilter)}
                  options={CRAWL_STATUS_OPTIONS}
                />
              </div>
              <div className="flex items-end md:col-span-2 xl:col-span-6">
                <JobSummaryPills
                  items={[
                    { label: reviewModeLabel(reviewMode), tone: reviewMode === 'noise' ? 'muted' : 'accent' },
                    { label: sentiment === 'all' ? 'All sentiment' : sentiment, tone: sentiment === 'negative' ? 'muted' : 'neutral' },
                    { label: sourceType === 'all' ? 'All sources' : sourceType, tone: 'accent' },
                    { label: relevance === 'all' ? 'All relevance' : relevance, tone: 'neutral' },
                    { label: quality === 'all' ? 'All quality' : quality, tone: quality === 'noise' ? 'muted' : 'accent' },
                    { label: category === 'all' ? 'All categories' : category, tone: 'neutral' },
                    { label: crawlStatus === 'all' ? 'All crawl status' : crawlStatusLabel(crawlStatus), tone: crawlStatus === 'new' ? 'accent' : 'neutral' },
                  ]}
                />
              </div>
            </div>
          </JobSection>

          <JobSection title="Mentions" description={`${reviewModeLabel(reviewMode)}: showing ${visibleMentions.length} of ${displayedMentions.length} filtered mentions (${mentions.length} loaded).`}>
            {loading ? (
              <div className="text-sm text-muted">Loading mentions...</div>
            ) : displayedMentions.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted">No mentions match the current review mode and filters.</div>
            ) : (
              <>
                <div className="brand-pulse-mentions-toolbar">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 text-xs font-semibold text-text">
                      Showing {visibleMentions.length} of {displayedMentions.length} filtered mentions
                    </div>
                    <JobSummaryPills
                      items={[
                        { label: reviewModeLabel(reviewMode), tone: reviewMode === 'noise' ? 'muted' : 'accent' },
                        { label: sentiment === 'all' ? 'All sentiment' : sentiment, tone: sentiment === 'negative' ? 'muted' : 'neutral' },
                        { label: sourceType === 'all' ? 'All sources' : sourceType, tone: 'accent' },
                        { label: relevance === 'all' ? 'All relevance' : relevance, tone: 'neutral' },
                        { label: quality === 'all' ? 'All quality' : quality, tone: quality === 'noise' ? 'muted' : 'accent' },
                        { label: category === 'all' ? 'All categories' : category, tone: 'neutral' },
                        { label: crawlStatus === 'all' ? 'All crawl status' : crawlStatusLabel(crawlStatus), tone: crawlStatus === 'new' ? 'accent' : 'neutral' },
                      ]}
                    />
                  </div>
                  <div className="brand-pulse-mentions-actions">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="mr-1 text-xs font-semibold text-muted">Rows</span>
                      {MENTION_PAGE_SIZE_OPTIONS.map(size => {
                        const active = mentionPageSize === size
                        return (
                          <button
                            key={size}
                            type="button"
                            onClick={() => {
                              setMentionPageSize(size)
                              setVisibleMentionLimit(size)
                            }}
                            className="rounded-md px-2.5 py-1 text-xs font-semibold transition-colors"
                            style={active ? { background: 'var(--accent)', color: 'white' } : { color: 'var(--muted)' }}
                            aria-pressed={active}
                          >
                            {size}
                          </button>
                        )
                      })}
                    </div>
                    <button onClick={() => void load()} disabled={loading || crawling} className="btn-ghost gap-2 text-sm">
                      <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                      Refresh
                    </button>
                    <ExportMenu
                      onCsv={downloadCsv}
                      onXlsx={downloadXlsx}
                      onGoogleSheets={exportGoogleSheets}
                      sheetsLoading={exportingSheets}
                    />
                    <button onClick={() => void handleCrawl()} disabled={crawling} className="btn-primary gap-2 text-sm">
                      <RefreshCw size={14} className={crawling ? 'animate-spin' : ''} />
                      {crawling ? 'Running...' : 'Run Pulse'}
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Mention</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Signal</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Review</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Quality</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Published</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Discovered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleMentions.map((mention, index) => {
                      const url = mentionUrl(mention)
                      const title = mentionTitle(mention)
                      const snippet = mentionSnippet(mention)
                      const duplicateCount = mentionDuplicateCount(mention)
                      const duplicateKey = mentionDuplicateKey(mention)
                      const duplicateGroupExpanded = duplicateKey ? expandedDuplicateKeys.has(duplicateKey) : false
                      const domain = mentionDomain(mention)
                      const sentimentConfidence = mentionSentimentConfidence(mention)
                      const mismatch = hasSentimentMismatch(mention)
                      const domainRank = mentionDomainRank(mention)
                      const latestCrawlStatus = mentionCrawlStatus(mention)
                      const crawlChangeSummary = mentionCrawlChangeSummary(mention)
                      const reviewStatus = mentionReviewStatus(mention)
                      const actionBusy = Boolean(pendingMentionAction)
                      const favoriteBusy = pendingMentionAction === `${mention.id}:favorite`
                      const approveBusy = pendingMentionAction === `${mention.id}:review:approved`
                      const noiseBusy = pendingMentionAction === `${mention.id}:review:noise`
                      const falsePositiveBusy = pendingMentionAction === `${mention.id}:review:false_positive`
                      const matchEvidence = mentionMatchEvidence(mention, alert?.keyword)
                      return (
                        <Fragment key={mention.id || `${url}-${index}`}>
                        <tr className="border-b border-border transition-colors last:border-0 hover:bg-bg">
                          <td className="max-w-2xl px-4 py-3">
                            <div className="line-clamp-2 font-semibold text-text">{title}</div>
                            {snippet && (
                              <p className="mt-1 line-clamp-2 text-xs text-muted">
                                <span className="font-semibold">Snippet:</span> {snippet}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                              {url ? (
                                <a href={url} target="_blank" rel="noreferrer" className="inline-flex max-w-xs items-center gap-1 truncate font-mono text-accent hover:underline">
                                  <span className="truncate">{domain || url}</span>
                                  <ExternalLink size={11} />
                                </a>
                              ) : (
                                <span>{domain || '-'}</span>
                              )}
                              {domainRank !== '-' && <span>Rank {domainRank}</span>}
                              {duplicateCount > 1 && (
                                <button
                                  type="button"
                                  onClick={() => duplicateKey && toggleDuplicateGroup(duplicateKey)}
                                  className="brand-pulse-duplicate-toggle"
                                  aria-expanded={duplicateGroupExpanded}
                                  disabled={!duplicateKey}
                                >
                                  {duplicateGroupExpanded ? 'Hide similar' : 'Show similar'}
                                  <span>{duplicateCount}</span>
                                </button>
                              )}
                            </div>
                            <details className="brand-pulse-evidence">
                              <summary>Evidence</summary>
                              <div className="brand-pulse-evidence-panel">
                                <div className="brand-pulse-evidence-grid">
                                  <div>
                                    <span>Matched phrase</span>
                                    <strong>{matchEvidence.phrase}</strong>
                                  </div>
                                  <div>
                                    <span>Visible in</span>
                                    <strong>{matchEvidence.locations.length ? matchEvidence.locations.join(', ') : 'Not visible'}</strong>
                                  </div>
                                  <div>
                                    <span>Source</span>
                                    <strong>{titleCase(mentionSource(mention))}</strong>
                                  </div>
                                  <div>
                                    <span>Review</span>
                                    <strong>{reviewStatusLabel(reviewStatus)}</strong>
                                  </div>
                                </div>
                                <div className="brand-pulse-evidence-text">
                                  <span>Title</span>
                                  <p>{title}</p>
                                </div>
                                {snippet && (
                                  <div className="brand-pulse-evidence-text">
                                    <span>Snippet</span>
                                    <p>{snippet}</p>
                                  </div>
                                )}
                                <div className="brand-pulse-evidence-chips">
                                  <span>Sentiment {titleCase(mentionSentiment(mention))}</span>
                                  <span>Quality {mentionQualityLabel(mention)} {mentionQualityScore(mention)}</span>
                                  <span>Category {titleCase(mentionCategory(mention))}</span>
                                  {domainRank !== '-' && <span>Rank {domainRank}</span>}
                                </div>
                              </div>
                            </details>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex min-w-28 flex-col gap-1">
                              <SentimentBadge sentiment={mentionSentiment(mention)} />
                              {sentimentConfidence && <span className="text-xs text-muted">DFS {sentimentConfidence}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex min-w-24 flex-col items-start gap-1">
                              {latestCrawlStatus ? <CrawlStatusBadge status={latestCrawlStatus} /> : <span className="text-xs text-muted">-</span>}
                              {latestCrawlStatus === 'updated' && crawlChangeSummary.length > 0 && (
                                <span className="max-w-36 text-xs text-muted">
                                  Changed: {formatCrawlChangeSummary(crawlChangeSummary)}
                                </span>
                              )}
                              {mismatch && <ReviewBadge label="Mismatch" />}
                              <span className="rounded-full border border-border bg-bg px-2 py-0.5 text-[11px] font-semibold text-muted">
                                {reviewStatusLabel(reviewStatus)}
                              </span>
                              <div className="mt-1 flex flex-wrap items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => void handleFavoriteMention(mention)}
                                  disabled={actionBusy}
                                  title={mention.favorite ? 'Remove favorite' : 'Favorite'}
                                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-xs transition-colors ${mention.favorite ? 'bg-accent/10 text-accent' : 'bg-surface text-muted hover:text-accent'}`}
                                >
                                  <Star size={13} fill={mention.favorite ? 'currentColor' : 'none'} className={favoriteBusy ? 'animate-pulse' : ''} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleReviewMention(mention, 'approved')}
                                  disabled={actionBusy}
                                  title="Approve"
                                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-xs transition-colors ${reviewStatus === 'approved' ? 'bg-accent/10 text-accent' : 'bg-surface text-muted hover:text-accent'}`}
                                >
                                  <CheckCircle2 size={13} className={approveBusy ? 'animate-pulse' : ''} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleReviewMention(mention, 'noise')}
                                  disabled={actionBusy}
                                  title="Mark noise"
                                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-xs transition-colors ${reviewStatus === 'noise' ? 'bg-warning/10 text-warning' : 'bg-surface text-muted hover:text-warning'}`}
                                >
                                  <Ban size={13} className={noiseBusy ? 'animate-pulse' : ''} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleReviewMention(mention, 'false_positive')}
                                  disabled={actionBusy}
                                  title="Mark wrong mention"
                                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-xs transition-colors ${reviewStatus === 'false_positive' ? 'bg-error/10 text-error' : 'bg-surface text-muted hover:text-error'}`}
                                >
                                  <XCircle size={13} className={falsePositiveBusy ? 'animate-pulse' : ''} />
                                </button>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {domain && (
                                  <button
                                    type="button"
                                    onClick={() => void handleSuppressMention(mention, 'domain')}
                                    disabled={actionBusy}
                                    className="rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-muted hover:text-text"
                                  >
                                    Hide domain
                                  </button>
                                )}
                                {duplicateKey && duplicateCount > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => void handleSuppressMention(mention, 'duplicate_key')}
                                    disabled={actionBusy}
                                    className="rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-muted hover:text-text"
                                  >
                                    Hide group
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex min-w-24 flex-col gap-1">
                              <QualityBadge label={mentionQualityLabel(mention)} score={mentionQualityScore(mention)} />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex min-w-28 flex-col gap-1 text-xs text-muted">
                              <span className="font-semibold text-text">{titleCase(mentionCategory(mention))}</span>
                              <span>{titleCase(mentionSource(mention))}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted">{formatDate(mentionPublished(mention))}</td>
                          <td className="px-4 py-3 text-xs text-muted">{formatDate(mentionDiscovered(mention))}</td>
                        </tr>
                        </Fragment>
                      )
                      })}
                    </tbody>
                  </table>
                </div>
                {hiddenMentionCount > 0 && (
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setVisibleMentionLimit(current => Math.min(current + mentionPageSize, displayedMentions.length))}
                      className="btn-ghost text-sm"
                    >
                      Load more ({hiddenMentionCount} remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </JobSection>

          <JobSection title="Recent crawl runs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">{runs.length} crawl {runs.length === 1 ? 'run' : 'runs'} recorded.</p>
              <button
                type="button"
                onClick={() => setShowCrawlHistory(value => !value)}
                className="btn-ghost gap-2 text-xs"
                aria-expanded={showCrawlHistory}
              >
                {showCrawlHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {showCrawlHistory ? 'Hide crawl history' : 'Show crawl history'}
              </button>
            </div>
            {runs.length === 0 ? (
              <div className="py-6 text-sm text-muted">No crawl runs recorded yet.</div>
            ) : showCrawlHistory ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Trigger</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">New</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Updated</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Seen</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Pull</th>
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
                      const returnedRows = numberField(run, ['dfs_rows', 'dataforseo_rows', 'rows']) ?? 0
                      const requestedRows = numberField(run, ['requested_rows'])
                      const indexedRows = numberField(run, ['dfs_total_count'])
                      const filterLabel = formatCrawlFilters(asRecord(run.crawl_filters))
                      return (
                        <tr key={run.id || index} className="border-b border-border transition-colors last:border-0 hover:bg-bg">
                          <td className="px-4 py-3 text-xs font-semibold capitalize text-text">{titleCase(stringField(run, ['status'], 'unknown'))}</td>
                          <td className="px-4 py-3 text-xs capitalize text-muted">{titleCase(stringField(run, ['trigger', 'trigger_type'], 'manual'))}</td>
                          <td className="px-4 py-3 text-xs text-muted">{numberField(run, ['new_mentions', 'new_count']) ?? 0}</td>
                          <td className="px-4 py-3 text-xs text-muted">{numberField(run, ['updated_mentions', 'updated_count']) ?? 0}</td>
                          <td className="px-4 py-3 text-xs text-muted">{numberField(run, ['seen_mentions', 'seen_count']) ?? 0}</td>
                          <td className="px-4 py-3 text-xs text-muted">
                            <div className="flex min-w-28 flex-col gap-0.5">
                              <span className="font-semibold text-text">{dfsPullModeLabel(stringField(run, ['pull_mode'], 'newest'))}</span>
                              {filterLabel && <span>{filterLabel}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted">
                            <div className="flex min-w-24 flex-col gap-0.5">
                              <span>{requestedRows ? `${returnedRows} / ${requestedRows}` : returnedRows}</span>
                              {indexedRows !== null && <span>Indexed {formatInteger(indexedRows)}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted">{cost === null ? '-' : `$${cost.toFixed(4)}`}</td>
                          <td className="px-4 py-3 text-xs text-muted">{formatDate(stringField(run, ['started_at', 'created_at']))}</td>
                          <td className="max-w-xs px-4 py-3 text-xs text-muted">{error ? <span className="line-clamp-2 text-error">{error}</span> : '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </JobSection>
        </JobLauncherShell>
      </div>
    </AppLayout>
  )
}
