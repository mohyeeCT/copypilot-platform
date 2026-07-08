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
  assert.match(api, /\/api\/brand-mentions\/alerts/)
})

test('Brand Pulse pages use the visible product name', async () => {
  const list = await readFile(new URL('../app/(app)/brand-mentions/page.tsx', import.meta.url), 'utf8')
  const detail = await readFile(new URL('../app/(app)/brand-mentions/[id]/page.tsx', import.meta.url), 'utf8')
  const create = await readFile(new URL('../app/(app)/brand-mentions/new/page.tsx', import.meta.url), 'utf8')

  assert.match(list, /Brand Pulse/)
  assert.match(detail, /Brand Pulse Alert/)
  assert.match(detail, /Back to Brand Pulse/)
  assert.match(create, /New Brand Pulse Alert/)
  assert.match(create, /Back to Brand Pulse/)
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

test('Brand Pulse does not force all listicles into low value review mode', async () => {
  const detail = await readFile(new URL('../app/(app)/brand-mentions/[id]/page.tsx', import.meta.url), 'utf8')
  const lowValueSet = detail.match(/const LOW_VALUE_MENTION_CATEGORIES = new Set\(\[([^\]]+)\]\)/)

  assert.ok(lowValueSet)
  assert.doesNotMatch(lowValueSet[1], /listicle/)
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
  const create = await readFile(new URL('../app/(app)/brand-mentions/new/page.tsx', import.meta.url), 'utf8')

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

test('Brand Pulse overview hero is compact and descriptionless', async () => {
  const list = await readFile(new URL('../app/(app)/brand-mentions/page.tsx', import.meta.url), 'utf8')

  assert.match(list, /<JobLauncherShell[\s\S]*compact/)
  assert.doesNotMatch(list, /Monitor live brand, competitor, and keyword signals from external sources\./)
  assert.match(list, /brand-pulse-overview-metrics/)
})

test('Brand Pulse detail uses compact coverage and aligned crawl actions', async () => {
  const detail = await readFile(new URL('../app/(app)/brand-mentions/[id]/page.tsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8')

  assert.match(detail, /brand-pulse-crawl-actions/)
  assert.match(detail, /brand-pulse-dfs-selector/)
  assert.match(detail, /brand-pulse-action-buttons/)
  assert.match(detail, /className="brand-pulse-coverage-strip"/)
  assert.match(css, /\.brand-pulse-crawl-actions[\s\S]*align-items: flex-end/)
  assert.match(css, /\.brand-pulse-coverage-strip[\s\S]*grid-template-columns/)
})
