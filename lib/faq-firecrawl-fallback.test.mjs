import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('settings places Firecrawl directly after Jina and restores metadata only', async () => {
  const source = await readFile(new URL('../app/(app)/settings/page.tsx', import.meta.url), 'utf8')

  assert.ok(source.indexOf('Firecrawl API Key') > source.indexOf('Jina API Key'))
  assert.match(source, /has_firecrawl_key/)
  assert.match(source, /firecrawl_api_key: ''/)
  assert.doesNotMatch(source, /firecrawl_api_key: creds\.firecrawl_api_key/)
})

test('FAQ new jobs keep Firecrawl fallback off and submit only a safe boolean', async () => {
  const source = await readFile(new URL('../app/(app)/faq/jobs/new/page.tsx', import.meta.url), 'utf8')

  assert.match(source, /firecrawlFallback.*useState\(false\)/i)
  assert.match(source, /has_firecrawl_key/)
  assert.match(source, /firecrawl_fallback: scrapePages && firecrawlFallback && firecrawlKeyConfigured/)
  assert.match(source, /disabled=\{!scrapePages \|\| !firecrawlKeyConfigured\}/)
  assert.doesNotMatch(source, /\bfirecrawl_api_key\s*:/)
})

test('FAQ results offer Firecrawl rerun only for failed page scraping', async () => {
  const source = await readFile(new URL('../app/(app)/faq/jobs/[id]/page.tsx', import.meta.url), 'utf8')
  const apiSource = await readFile(new URL('./api/faq.ts', import.meta.url), 'utf8')

  assert.match(source, /scrape_status\?\.toLowerCase\(\)\.startsWith\('failed:'\)/)
  assert.match(source, /selectedScrapeFailed && firecrawlKeyConfigured/)
  assert.match(source, /startRowRerun\(selectedIndex, selectedResult\.selected_keyword \|\| selectedResult\.keyword, 'firecrawl'\)/)
  assert.match(source, /Rerun with Firecrawl/)
  assert.match(apiSource, /scraper_override: scraperOverride \|\| ''/)
})
