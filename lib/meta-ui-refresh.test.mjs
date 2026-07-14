import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('Meta jobs opt into the production workspace variant without changing other tools', async () => {
  const [route, jobsList] = await Promise.all([
    read('../app/(app)/meta/jobs/page.tsx'),
    read('../components/ui/JobsListPage.tsx'),
  ])

  assert.match(route, /variant:\s*'meta'/)
  assert.match(jobsList, /const workflowLabels =/)
  assert.match(jobsList, /meta: 'Meta'/)
  assert.match(jobsList, /workflowLabel = tool\.variant && tool\.variant !== 'default'/)
  assert.match(jobsList, /Search \{workflowLabel\} jobs/)
  assert.match(jobsList, /Needs attention/)
  assert.match(jobsList, /Delete this \{workflowLabel\} job\?/)
  assert.match(jobsList, /isWorkflowVariant \?/)
})

test('Meta creation keeps every production input inside the responsive composer', async () => {
  const source = await read('../app/(app)/meta/jobs/new/page.tsx')

  assert.match(source, /MetaCopyWorkspace\.module\.css/)
  assert.match(source, /settingsTab/)
  assert.match(source, /Generation/)
  assert.match(source, /Brand/)
  assert.match(source, /Data/)
  assert.match(source, /scrape_pages:\s*scrapePages/)
  assert.match(source, /brand_profile_id:\s*brandProfileId/)
  assert.match(source, /restricted_industry:\s*restrictedIndustry/)
  assert.match(source, /grid grid-cols-7 gap-6/)
})

test('Meta results expose queue, copy, quality, and source review without dropping actions', async () => {
  const source = await read('../app/(app)/meta/jobs/[id]/page.tsx')

  assert.match(source, /Review queue/)
  assert.match(source, /Search Meta results/)
  assert.match(source, /\['copy', 'Copy'\]/)
  assert.match(source, /\['quality', `Quality/)
  assert.match(source, /\['sources', 'Sources'\]/)
  assert.match(source, /onCsv=\{downloadCsv\}/)
  assert.match(source, /onXlsx=\{downloadXlsx\}/)
  assert.match(source, /onGoogleSheets=\{exportGoogleSheets\}/)
  assert.match(source, /metaApi\.rerunRow/)
  assert.match(source, /metaApi\.rerunRows/)
  assert.match(source, /metaApi\.cancelJob/)
})

test('temporary Meta preview route is no longer part of production', async () => {
  await assert.rejects(read('../app/ui-preview/meta/page.tsx'))
  await assert.rejects(read('../components/ui-preview/MetaCopyPreview.tsx'))
})
