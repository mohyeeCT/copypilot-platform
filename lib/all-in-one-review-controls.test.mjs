import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('AIO section rerun API can send a reviewer instruction', async () => {
  const source = await readFile(new URL('./api/all-in-one.ts', import.meta.url), 'utf8')

  assert.match(source, /reviewerInstruction/)
  assert.match(source, /reviewer_instruction: reviewerInstruction/)
})

test('AIO new-job page exposes optional brand consistency check', async () => {
  const source = await readFile(new URL('../app/(app)/all-in-one/jobs/new/page.tsx', import.meta.url), 'utf8')

  assert.match(source, /brandConsistencyCheck/)
  assert.match(source, /brand_consistency_check: brandConsistencyCheck/)
  assert.match(source, /Brand consistency check/)
})

test('AIO result page shows diagnostics and reviewer-note controls', async () => {
  const source = await readFile(new URL('../app/(app)/all-in-one/jobs/[id]/page.tsx', import.meta.url), 'utf8')

  assert.match(source, /content_gap_summary/)
  assert.match(source, /brand_consistency/)
  assert.match(source, /Content gaps/)
  assert.match(source, /Brand match/)
  assert.match(source, /reviewerInstruction/)
})

test('AIO result page shows read-only strategy brief', async () => {
  const source = await readFile(new URL('../app/(app)/all-in-one/jobs/[id]/page.tsx', import.meta.url), 'utf8')

  assert.match(source, /strategy_brief/)
  assert.match(source, /Strategy Brief/)
  assert.match(source, /formatStrategyBriefValue/)
  assert.match(source, /Search intent/)
  assert.match(source, /Recommended angle/)
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
