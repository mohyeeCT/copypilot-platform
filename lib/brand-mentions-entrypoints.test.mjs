import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('Brand Pulse is available under insights navigation', async () => {
  const sidebar = await readFile(new URL('../components/layout/Sidebar.tsx', import.meta.url), 'utf8')
  const settings = await readFile(new URL('../app/(app)/settings/page.tsx', import.meta.url), 'utf8')
  const api = await readFile(new URL('../lib/api/brand-mentions.ts', import.meta.url), 'utf8')

  assert.match(sidebar, /const insights: Tool\[\] = \[/)
  assert.match(sidebar, /href:\s*'\/brand-mentions'[\s\S]*label:\s*'Brand Pulse'/)
  assert.match(sidebar, /Tools[\s\S]*Insights[\s\S]*Other/)
  assert.doesNotMatch(sidebar, /label:\s*'Page Copy'/)
  assert.match(settings, /Brand Pulse/)
  assert.match(settings, /brand-mentions-saas-backend-production\.up\.railway\.app/)
  assert.match(api, /NEXT_PUBLIC_BRAND_MENTIONS_API_URL/)
  assert.match(api, /\/api\/brand-mentions\/profiles/)
  assert.match(api, /\/api\/brand-mentions\/alerts/)
})

test('Brand Pulse pages use the visible product name', async () => {
  const list = await readFile(new URL('../app/(app)/brand-mentions/page.tsx', import.meta.url), 'utf8')
  const detail = await readFile(new URL('../app/(app)/brand-mentions/[id]/page.tsx', import.meta.url), 'utf8')
  const createProfile = await readFile(new URL('../app/(app)/brand-mentions/new/page.tsx', import.meta.url), 'utf8')
  const profile = await readFile(new URL('../app/(app)/brand-mentions/profiles/[id]/page.tsx', import.meta.url), 'utf8')
  const createAlert = await readFile(new URL('../app/(app)/brand-mentions/profiles/[id]/alerts/new/page.tsx', import.meta.url), 'utf8')

  assert.match(list, /Brand Pulse/)
  assert.match(detail, /Brand Pulse Alert/)
  assert.match(detail, /Back to Brand Pulse/)
  assert.match(createProfile, /New Brand Pulse Profile/)
  assert.match(createProfile, /Back to Brand Pulse/)
  assert.match(profile, /Brand Pulse Profile/)
  assert.match(profile, /New Alert/)
  assert.match(createAlert, /New Brand Pulse Alert/)
  assert.match(createAlert, /Back to Profile/)
})

test('brand mention detail exposes quality filters, snippets, and duplicate signals', async () => {
  const detail = await readFile(new URL('../app/(app)/brand-mentions/[id]/page.tsx', import.meta.url), 'utf8')

  assert.match(detail, /quality_label/)
  assert.match(detail, /quality_score/)
  assert.match(detail, /mention_category/)
  assert.match(detail, /duplicate_count/)
  assert.match(detail, /Snippet/)
  assert.match(detail, /Quality/)
  assert.match(detail, /Mention category/)
})

test('brand mention detail exposes provider sentiment separately', async () => {
  const detail = await readFile(new URL('../app/(app)/brand-mentions/[id]/page.tsx', import.meta.url), 'utf8')

  assert.match(detail, /provider_sentiment/)
  assert.match(detail, /provider_sentiment_score/)
  assert.match(detail, /provider_positive_score/)
  assert.match(detail, /provider_neutral_score/)
  assert.match(detail, /provider_negative_score/)
  assert.match(detail, /Provider sentiment/)
})

test('brand mention detail uses provider sentiment as the primary sentiment', async () => {
  const detail = await readFile(new URL('../app/(app)/brand-mentions/[id]/page.tsx', import.meta.url), 'utf8')

  assert.match(detail, /function mentionProviderSentiment/)
  assert.match(detail, /function mentionLocalSentiment/)
  assert.match(detail, /function hasSentimentMismatch/)
  assert.match(detail, /return stringField\(mention, \['provider_sentiment', 'sentiment'\], 'unknown'\)/)
  assert.match(detail, /needsReviewMention[\s\S]*hasSentimentMismatch\(mention\)/)
  assert.match(detail, /negativeCount = mentions\.filter\(mention => mentionSentiment\(mention\)\.toLowerCase\(\) === 'negative'\)\.length/)
})

test('brand mention table keeps dense quality reasons out of the visible rows', async () => {
  const detail = await readFile(new URL('../app/(app)/brand-mentions/[id]/page.tsx', import.meta.url), 'utf8')

  assert.match(detail, />Mention<\/th>/)
  assert.doesNotMatch(detail, />URL<\/th>/)
  assert.doesNotMatch(detail, />Domain<\/th>/)
  assert.doesNotMatch(detail, /const reasons = mentionQualityReasons\(mention\)[\s\S]*reasons\.join/)
  assert.doesNotMatch(detail, /DFS sentiment:/)
})

test('brand mention detail prioritizes actionable review modes', async () => {
  const detail = await readFile(new URL('../app/(app)/brand-mentions/[id]/page.tsx', import.meta.url), 'utf8')
  const qualitySortIndex = detail.indexOf('const qualityDelta')
  const categorySortIndex = detail.indexOf('const categoryDelta')

  assert.match(detail, /Best mentions/)
  assert.match(detail, /Needs review/)
  assert.match(detail, /Low value/)
  assert.match(detail, /High value/)
  assert.match(detail, /sortMentionsByValue/)
  assert.match(detail, /displayedMentions/)
  assert.ok(qualitySortIndex > -1)
  assert.ok(categorySortIndex > -1)
  assert.ok(qualitySortIndex < categorySortIndex)
})

test('Brand Pulse low value mode follows computed relevance and quality', async () => {
  const detail = await readFile(new URL('../app/(app)/brand-mentions/[id]/page.tsx', import.meta.url), 'utf8')

  assert.match(detail, /function isLowValueMention/)
  assert.doesNotMatch(detail, /LOW_VALUE_MENTION_CATEGORIES/)
  assert.match(detail, /mentionRelevanceLevel\(mention\) === 'low'[\s\S]*quality === 'low'[\s\S]*quality === 'noise'/)
})

test('Brand Pulse category filter is scoped by selected source type', async () => {
  const detail = await readFile(new URL('../app/(app)/brand-mentions/[id]/page.tsx', import.meta.url), 'utf8')

  assert.match(detail, /categoryOptionsForSource/)
  assert.match(detail, /CATEGORY_OPTIONS_BY_SOURCE/)
  assert.match(detail, /options=\{categoryOptions\}/)
  assert.match(detail, /handleSourceTypeChange/)
})

test('Brand Pulse alert header uses compact horizontal summary layout', async () => {
  const detail = await readFile(new URL('../app/(app)/brand-mentions/[id]/page.tsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8')

  assert.match(detail, /<JobLauncherShell[\s\S]*compact/)
  assert.match(css, /\.job-launcher--compact \.job-summary-bar[\s\S]*display: flex/)
})

test('Brand Pulse detail shows existing mention timing and coverage signals', async () => {
  const detail = await readFile(new URL('../app/(app)/brand-mentions/[id]/page.tsx', import.meta.url), 'utf8')

  assert.match(detail, /Coverage snapshot/)
  assert.match(detail, /buildRecentMentionDays/)
  assert.match(detail, /Source mix/)
  assert.match(detail, /Category mix/)
  assert.match(detail, /Published/)
  assert.match(detail, /formatDate\(mentionPublished\(mention\)\)/)
})

test('Brand Pulse create page exposes controlled DFS row limits and cost', async () => {
  const create = await readFile(new URL('../app/(app)/brand-mentions/profiles/[id]/alerts/new/page.tsx', import.meta.url), 'utf8')

  assert.match(create, /const MAX_RESULTS_PER_CRAWL = 1000/)
  assert.match(create, /const DFS_ROW_PRESETS = \[50, 100, 250, 500, 1000\]/)
  assert.match(create, /formatEstimatedDfsCost/)
  assert.match(create, /DFS rows per crawl/)
  assert.match(create, /Estimated DFS cost/)
})

test('Brand Pulse detail page exposes per-crawl DFS row controls with guardrails', async () => {
  const detail = await readFile(new URL('../app/(app)/brand-mentions/[id]/page.tsx', import.meta.url), 'utf8')
  const api = await readFile(new URL('../lib/api/brand-mentions.ts', import.meta.url), 'utf8')

  assert.match(api, /crawlAlert: \(token: string, id: string, payload\?: BrandMentionCrawlPayload\)/)
  assert.match(api, /body: payload \? JSON\.stringify\(payload\) : undefined/)
  assert.match(detail, /const DFS_ROW_PRESETS = \[50, 100, 250, 500, 1000\]/)
  assert.match(detail, /const HIGH_DFS_ROW_CONFIRMATION_THRESHOLD = 500/)
  assert.match(detail, /DFS rows for this crawl/)
  assert.match(detail, /Estimated DFS cost/)
  assert.match(detail, /window\.confirm/)
  assert.match(detail, /brandMentionsApi\.crawlAlert\(token, alertId, \{ max_results_per_crawl: selectedDfsRows \}\)/)
})

test('Brand Pulse detail can filter mentions by latest crawl status', async () => {
  const detail = await readFile(new URL('../app/(app)/brand-mentions/[id]/page.tsx', import.meta.url), 'utf8')

  assert.match(detail, /latest_crawl_status/)
  assert.match(detail, /type CrawlStatusFilter = 'all' \| 'new' \| 'updated' \| 'seen'/)
  assert.match(detail, /CRAWL_STATUS_OPTIONS/)
  assert.match(detail, /crawl_status/)
  assert.match(detail, /parseCrawlStatus/)
  assert.match(detail, /CrawlStatusBadge/)
  assert.match(detail, /Seen again/)
  assert.match(detail, /options=\{CRAWL_STATUS_OPTIONS\}/)
  assert.match(detail, /latest_crawl_change_summary/)
  assert.match(detail, /function mentionCrawlChangeSummary/)
  assert.match(detail, /formatCrawlChangeSummary/)
  assert.match(detail, /CRAWL_CHANGE_LABELS/)
  assert.match(detail, /Provider sentiment score/)
  assert.match(detail, /Snippet text/)
  assert.match(detail, /Changed:/)
  assert.match(detail, /Latest crawl changes/)
})

test('Brand Pulse detail puts crawl controls inside the compact summary panel', async () => {
  const detail = await readFile(new URL('../app/(app)/brand-mentions/[id]/page.tsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8')

  assert.match(detail, /summary=\{\s*<div className="brand-pulse-summary-controls">/)
  assert.match(detail, /<JobSummaryBar[\s\S]*<div className="brand-pulse-crawl-actions">/)
  assert.doesNotMatch(detail, /actions=\{\s*<div className="brand-pulse-crawl-actions">/)
  assert.match(css, /\.brand-pulse-summary-controls[\s\S]*gap: 8px/)
  assert.match(css, /\.brand-pulse-summary-controls \.job-summary-bar[\s\S]*justify-content: flex-end/)
})

test('Brand Pulse overview hero is compact and descriptionless', async () => {
  const list = await readFile(new URL('../app/(app)/brand-mentions/page.tsx', import.meta.url), 'utf8')

  assert.match(list, /<JobLauncherShell[\s\S]*compact/)
  assert.doesNotMatch(list, /Monitor live brand, competitor, and keyword signals from external sources\./)
  assert.doesNotMatch(list, /brand-pulse-overview-metrics/)
  assert.doesNotMatch(list, /JobSummaryBar/)
  assert.doesNotMatch(list, /JobSummaryPills/)
  assert.doesNotMatch(list, /Active alerts/)
  assert.doesNotMatch(list, /Configured/)
  assert.match(list, /New Profile/)
  assert.match(list, /brandMentionsApi\.listProfiles/)
  assert.match(list, /href=\{`\/brand-mentions\/profiles\/\$\{profile\.id\}`\}/)
})

test('Brand Pulse profile page owns alert rows under one profile', async () => {
  const profile = await readFile(new URL('../app/(app)/brand-mentions/profiles/[id]/page.tsx', import.meta.url), 'utf8')

  assert.match(profile, /brandMentionsApi\.getProfile/)
  assert.match(profile, /Brand Pulse Profile/)
  assert.match(profile, /New Alert/)
  assert.match(profile, /href=\{`\/brand-mentions\/profiles\/\$\{profileId\}\/alerts\/new`\}/)
  assert.match(profile, /href=\{`\/brand-mentions\/\$\{alert\.id\}`\}/)
  assert.match(profile, /Alert/)
  assert.match(profile, /Keyword/)
  assert.match(profile, /Type/)
})

test('Brand Pulse new profile page creates profile folders only', async () => {
  const createProfile = await readFile(new URL('../app/(app)/brand-mentions/new/page.tsx', import.meta.url), 'utf8')

  assert.match(createProfile, /New Brand Pulse Profile/)
  assert.match(createProfile, /brandMentionsApi\.createProfile/)
  assert.match(createProfile, /name/)
  assert.doesNotMatch(createProfile, /DFS rows per crawl/)
  assert.doesNotMatch(createProfile, /BrandMentionAlertPayload/)
})

test('Brand Pulse profile alert create page posts alerts into the profile', async () => {
  const createAlert = await readFile(new URL('../app/(app)/brand-mentions/profiles/[id]/alerts/new/page.tsx', import.meta.url), 'utf8')

  assert.match(createAlert, /brandMentionsApi\.createProfileAlert\(token, profileId, payload\)/)
  assert.match(createAlert, /DFS rows per crawl/)
  assert.match(createAlert, /ALERT_TYPES/)
  assert.match(createAlert, /SOURCES/)
})

test('Brand Pulse detail uses compact coverage and aligned crawl actions', async () => {
  const detail = await readFile(new URL('../app/(app)/brand-mentions/[id]/page.tsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8')

  assert.match(detail, /brand-pulse-crawl-actions/)
  assert.match(detail, /brand-pulse-dfs-selector/)
  assert.match(detail, /brand-pulse-action-buttons/)
  assert.match(detail, /className="brand-pulse-coverage-strip"/)
  assert.match(css, /\.brand-pulse-crawl-actions[\s\S]*align-items: center/)
  assert.match(css, /\.brand-pulse-coverage-strip[\s\S]*grid-template-columns/)
})
