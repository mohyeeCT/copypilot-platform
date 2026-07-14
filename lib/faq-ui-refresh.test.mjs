import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')

test('FAQ jobs opt into the production workflow without changing the app shell', async () => {
  const [route, jobsList] = await Promise.all([
    read('../app/(app)/faq/jobs/page.tsx'),
    read('../components/ui/JobsListPage.tsx'),
  ])

  assert.match(route, /variant:\s*'faq'/)
  assert.match(route, /Generate, review, and export search-informed FAQ copy/)
  assert.match(jobsList, /tool\.variant === 'meta' \|\| tool\.variant === 'faq'/)
  assert.match(jobsList, /Search \{workflowLabel\} jobs/)
  assert.match(jobsList, /Delete this \{workflowLabel\} job\?/)
  assert.doesNotMatch(route, /Sidebar/)
})

test('FAQ creation keeps every production input in the responsive settings workflow', async () => {
  const source = await read('../app/(app)/faq/jobs/new/page.tsx')

  assert.match(source, /MetaCopyWorkspace\.module\.css/)
  assert.match(source, /settingsTab/)
  assert.match(source, /Generation/)
  assert.match(source, /Brand/)
  assert.match(source, /Data/)
  assert.match(source, /faqApi\.runJob/)
  assert.match(source, /brand_profile_id:\s*selectedBrandProfileId/)
  assert.match(source, /load_async_ai_overview:\s*loadAsyncAiOverview/)
  assert.match(source, /restricted_industry:\s*restrictedIndustry/)
  assert.match(source, /forbidden_phrases:\s*forbiddenPhrases/)
  assert.match(source, /grid grid-cols-7 gap-6/)
  assert.doesNotMatch(source, /Sidebar/)
})

test('FAQ results expose queue, copy, quality, sources, and schema without dropping actions', async () => {
  const source = await read('../app/(app)/faq/jobs/[id]/page.tsx')

  assert.match(source, /Review queue/)
  assert.match(source, /Search FAQ results/)
  assert.match(source, /\['copy', 'FAQ copy'\]/)
  assert.match(source, /\['quality', `Quality/)
  assert.match(source, /\['sources', 'Sources'\]/)
  assert.match(source, /\['schema', 'Schema'\]/)
  assert.match(source, /onCsv=\{downloadCsv\}/)
  assert.match(source, /onXlsx=\{downloadXlsx\}/)
  assert.match(source, /onGoogleSheets=\{exportGoogleSheets\}/)
  assert.match(source, /buildFaqExportRows\(results, edits\)/)
  assert.match(source, /faqApi\.rerunRow/)
  assert.match(source, /faqApi\.rerunRows/)
  assert.match(source, /faqApi\.cancelJob/)
  assert.match(source, /FAQPage JSON-LD/)
  assert.match(source, /detailBodyRef\.current\.scrollTop = 0/)
  assert.match(source, /\[activeIndex, detailTab\]/)
  assert.match(source, /<details className=\{faqStyles\.evidenceBlock\} open=\{isOpen\} onToggle=/)
  assert.match(source, /Owned page context[\s\S]*initiallyOpen/)
  assert.doesNotMatch(source, /Sidebar/)
})

test('temporary FAQ preview is removed after production promotion', async () => {
  await assert.rejects(read('../app/ui-preview/faq/page.tsx'))
  await assert.rejects(read('../components/ui-preview/FaqCopyPreview.tsx'))
})
