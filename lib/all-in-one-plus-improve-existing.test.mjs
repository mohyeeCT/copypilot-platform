import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const newJobUrl = new URL('../app/(app)/all-in-one-plus/jobs/new/page.tsx', import.meta.url)
const jobUrl = new URL('../app/(app)/all-in-one-plus/jobs/[id]/page.tsx', import.meta.url)

test('AIO+ offers a simple job-level page approach with rebuild as the safe default', async () => {
  const source = await readFile(newJobUrl, 'utf8')

  assert.match(source, /useState<PageApproach>\('rebuild'\)/)
  assert.match(source, /Create \/ Rebuild/)
  assert.match(source, /Improve Existing/)
  assert.match(source, /page_approach: pageApproach/)
})

test('Improve Existing requires current-page scraping and does not silently rebuild', async () => {
  const source = await readFile(newJobUrl, 'utf8')

  assert.match(source, /pageApproach === 'improve_existing' && validRowsRequestPageCopy && !scrapePages/)
  assert.match(source, /Improve Existing requires current-page scraping/)
  assert.match(source, /stops instead of silently switching to Create \/ Rebuild/)
  assert.match(source, /setScrapePages\(true\)/)
})

test('AIO+ results explain preservation actions without adding an advanced workflow', async () => {
  const source = await readFile(jobUrl, 'utf8')

  assert.match(source, /improve_existing_summary\?: ImproveExistingSummary/)
  assert.match(source, /Existing page structure preserved/)
  assert.match(source, /Existing sections retained as written/)
  assert.match(source, /Existing sections refined in place/)
  assert.match(source, /New evidence-supported SEO sections/)
  assert.match(source, /#\{1,6\}/)
})
