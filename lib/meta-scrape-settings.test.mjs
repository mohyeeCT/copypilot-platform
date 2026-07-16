import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const newMetaPageSrc = () =>
  readFile(new URL('../app/(app)/meta/jobs/new/page.tsx', import.meta.url), 'utf8')

test('Meta new job page exposes page scraping as a normal setting without sending Jina secrets', async () => {
  const source = await newMetaPageSrc()
  const controls = await readFile(
    new URL('../components/ui/ScraperControls.tsx', import.meta.url),
    'utf8',
  )

  assert.match(source, /scrapePages/)
  assert.match(source, /setScrapePages/)
  assert.match(source, /scrape_pages:\s*scrapePages/)
  assert.match(source, /ScraperControls/)
  assert.match(controls, /Scrape pages for context/)
  assert.doesNotMatch(source, /\bjina_api_key\s*:/)
})
