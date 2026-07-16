import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('AIO section rerun API can send a reviewer instruction', async () => {
  const source = await readFile(new URL('./api/all-in-one.ts', import.meta.url), 'utf8')

  assert.match(source, /reviewerInstruction/)
  assert.match(source, /reviewer_instruction: reviewerInstruction/)
})

test('AIO new-job page does not expose model-based review controls', async () => {
  const source = await readFile(new URL('../app/(app)/all-in-one/jobs/new/page.tsx', import.meta.url), 'utf8')

  assert.doesNotMatch(source, /brandConsistencyCheck/)
  assert.doesNotMatch(source, /brand_consistency_check:/)
  assert.doesNotMatch(source, /reviewProvider/)
  assert.doesNotMatch(source, /review_provider:/)
  assert.doesNotMatch(source, /review_model:/)
  assert.doesNotMatch(source, /Review Provider/)
})

test('AIO result page keeps evidence diagnostics and manual section reruns without reviewer output', async () => {
  const source = await readFile(new URL('../app/(app)/all-in-one/jobs/[id]/page.tsx', import.meta.url), 'utf8')

  assert.match(source, /content_gap_summary/)
  assert.match(source, /Content gaps/)
  assert.match(source, /reviewerInstruction/)
  assert.doesNotMatch(source, /brand_consistency/)
  assert.doesNotMatch(source, /AI brand signal/)
  assert.doesNotMatch(source, /editorial_review_status/)
  assert.doesNotMatch(source, /review_providers/)
})

test('AIO result page explains QA severity instead of hiding review reasons', async () => {
  const source = await readFile(new URL('../app/(app)/all-in-one/jobs/[id]/page.tsx', import.meta.url), 'utf8')

  assert.match(source, /qa_flags\?: QaFlag\[\]/)
  assert.match(source, /Quality checks/)
  assert.match(source, /flag\.severity/)
  assert.match(source, /strategy_issues/)
  assert.match(source, /rows need review; generated files remain available/)
  assert.match(source, /Select rows needing attention/)
  assert.doesNotMatch(source, /Select all failed/)
})

test('AIO result page shows read-only strategy brief', async () => {
  const source = await readFile(new URL('../app/(app)/all-in-one/jobs/[id]/page.tsx', import.meta.url), 'utf8')

  assert.match(source, /strategy_brief/)
  assert.match(source, /Strategy Brief/)
  assert.match(source, /formatStrategyBriefValue/)
  assert.match(source, /Search intent/)
  assert.match(source, /Recommended angle/)
})

test('AIO result page exposes retained owned-page context and scraper provenance', async () => {
  const source = await readFile(new URL('../app/(app)/all-in-one/jobs/[id]/page.tsx', import.meta.url), 'utf8')

  assert.match(source, /page_context_preview/)
  assert.match(source, /raw_response_chars/)
  assert.match(source, /retained_context_chars/)
  assert.match(source, /Jina cached fallback/)
  assert.match(source, /Collection-aware/)
  assert.match(source, /Owned page context/)
})

test('AIO result page shows and exports internal link suggestions', async () => {
  const source = await readFile(new URL('../app/(app)/all-in-one/jobs/[id]/page.tsx', import.meta.url), 'utf8')

  assert.match(source, /internal_link_suggestions/)
  assert.match(source, /Internal link suggestions/)
  assert.match(source, /exportInternalLinksGoogleSheets/)
  assert.match(source, /Suggested Anchor/)
})

test('AIO result export menu offers DOCX and Google Docs without CSV or XLSX', async () => {
  const source = await readFile(new URL('../app/(app)/all-in-one/jobs/[id]/page.tsx', import.meta.url), 'utf8')
  const sharedApi = await readFile(new URL('./api/shared.ts', import.meta.url), 'utf8')
  const exportMenu = await readFile(new URL('../components/ui/ExportMenu.tsx', import.meta.url), 'utf8')

  assert.match(source, /onDocx=\{hasDocx \? downloadAllDocx : undefined\}/)
  assert.match(source, /onGoogleDocs=\{exportGoogleDocs\}/)
  assert.match(source, /exportRowsToGoogleDocs/)
  assert.doesNotMatch(source, /downloadCsv/)
  assert.doesNotMatch(source, /downloadXlsx/)
  assert.doesNotMatch(source, /downloadInternalLinksCsv/)
  assert.doesNotMatch(source, /downloadInternalLinksXlsx/)
  assert.doesNotMatch(source, /from 'xlsx'/)
  assert.match(sharedApi, /exportToGoogleDocs/)
  assert.match(exportMenu, /onDocx\?:/)
  assert.match(exportMenu, /onGoogleDocs\?:/)
})
