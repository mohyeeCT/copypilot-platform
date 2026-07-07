import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('brand mentions is available under insights navigation', async () => {
  const sidebar = await readFile(new URL('../components/layout/Sidebar.tsx', import.meta.url), 'utf8')
  const settings = await readFile(new URL('../app/(app)/settings/page.tsx', import.meta.url), 'utf8')
  const api = await readFile(new URL('../lib/api/brand-mentions.ts', import.meta.url), 'utf8')

  assert.match(sidebar, /const insights: Tool\[\] = \[/)
  assert.match(sidebar, /href:\s*'\/brand-mentions'[\s\S]*label:\s*'Brand Mentions'/)
  assert.match(sidebar, /Tools[\s\S]*Insights[\s\S]*Other/)
  assert.doesNotMatch(sidebar, /label:\s*'Page Copy'/)
  assert.match(settings, /brand-mentions-saas-backend-production\.up\.railway\.app/)
  assert.match(api, /NEXT_PUBLIC_BRAND_MENTIONS_API_URL/)
  assert.match(api, /\/api\/brand-mentions\/alerts/)
})
