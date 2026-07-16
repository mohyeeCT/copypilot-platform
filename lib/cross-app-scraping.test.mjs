import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const appPage = path =>
  readFile(new URL(`../app/(app)/${path}`, import.meta.url), 'utf8')

test('active copy apps share one Jina and Firecrawl control', async () => {
  const control = await readFile(
    new URL('../components/ui/ScraperControls.tsx', import.meta.url),
    'utf8',
  )

  assert.match(control, /value: 'jina', label: 'Jina'/)
  assert.match(control, /value: 'firecrawl', label: 'Firecrawl'/)
  assert.match(control, /Firecrawl fallback/)

  for (const path of [
    'all-in-one/jobs/new/page.tsx',
    'intro/jobs/new/page.tsx',
    'meta/jobs/new/page.tsx',
    'schema/jobs/new/page.tsx',
  ]) {
    const source = await appPage(path)
    assert.match(source, /ScraperControls/)
    assert.match(source, /scrape_provider: scrapeProvider/)
    assert.match(source, /firecrawl_fallback:/)
    assert.doesNotMatch(source, /\bfirecrawl_api_key\s*:/)
  }
})

test('Jina remains the default and Firecrawl fallback remains opt-in', async () => {
  for (const path of [
    'all-in-one/jobs/new/page.tsx',
    'intro/jobs/new/page.tsx',
    'meta/jobs/new/page.tsx',
    'schema/jobs/new/page.tsx',
  ]) {
    const source = await appPage(path)
    assert.match(source, /scrapeProvider.*useState<ScrapeProvider>\('jina'\)/)
    assert.match(source, /firecrawlFallback.*useState\(false\)/i)
    assert.match(source, /has_firecrawl_key/)
  }
})

test('row-based apps expose a Firecrawl retry only after scraping fails', async () => {
  const cases = [
    ['all-in-one/jobs/[id]/page.tsx', './api/all-in-one.ts'],
    ['intro/jobs/[id]/page.tsx', './api/intro.ts'],
    ['meta/jobs/[id]/page.tsx', './api/meta.ts'],
  ]

  for (const [pagePath, apiPath] of cases) {
    const page = await appPage(pagePath)
    const api = await readFile(new URL(apiPath, import.meta.url), 'utf8')

    assert.match(page, /selectedScrapeFailed/)
    assert.match(page, /!jobStartedWithFirecrawl && firecrawlKeyConfigured/)
    assert.match(page, /Rerun with Firecrawl/)
    assert.match(api, /scraper_override: scraperOverride \|\| ''/)
  }
})
