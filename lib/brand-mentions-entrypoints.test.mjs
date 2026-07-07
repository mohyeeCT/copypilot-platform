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

  assert.match(detail, /Best mentions/)
  assert.match(detail, /Needs review/)
  assert.match(detail, /Low value/)
  assert.match(detail, /High value/)
  assert.match(detail, /sortMentionsByValue/)
  assert.match(detail, /displayedMentions/)
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
