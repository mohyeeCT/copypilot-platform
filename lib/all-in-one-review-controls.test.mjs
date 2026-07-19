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

test('AIO top output selection applies the corresponding choice to every existing row', async () => {
  const { applyAioOutputSelection } = await import('./all-in-one-output-selection.ts')
  const rows = [
    { url: 'https://example.com/one', gen_page_copy: true, gen_meta: false, gen_faqs: true },
    { url: 'https://example.com/two', gen_page_copy: false, gen_meta: true, gen_faqs: false },
  ]

  for (const [field, enabled] of [
    ['gen_page_copy', false],
    ['gen_meta', false],
    ['gen_faqs', true],
  ]) {
    const updatedRows = applyAioOutputSelection(rows, field, enabled)

    assert.deepEqual(updatedRows.map(row => row[field]), [enabled, enabled])
    assert.deepEqual(updatedRows.map(row => row.url), rows.map(row => row.url))
  }
})

test('AIO guidance selector is capability-gated and submits only the selected profile ID', async () => {
  const apiSource = await readFile(new URL('./api/all-in-one.ts', import.meta.url), 'utf8')
  const pageSource = await readFile(new URL('../app/(app)/all-in-one/jobs/new/page.tsx', import.meta.url), 'utf8')

  assert.match(apiSource, /\/api\/all-in-one\/page-copy-capabilities/)
  assert.match(apiSource, /page-copy-capabilities', token, \{ cache: 'no-store' \}/)
  assert.match(apiSource, /default_profile_id/)
  assert.match(pageSource, /pageCopyCapabilities\?\.enabled/)
  assert.match(pageSource, /const pageCopyRequestedByRows = rows\.some\(row => row\.gen_page_copy\)/)
  assert.match(pageSource, /const validRowsRequestOutput = validRows\.some\(row =>/)
  assert.match(pageSource, /pageCopyCapabilities\?\.enabled && validRowsRequestPageCopy/)
  assert.match(pageSource, /\{pageCopyRequestedByRows && \(/)
  assert.match(pageSource, /const validRowsForSummary = rows\.filter\(row => row\.url\.startsWith\('http'\)\)/)
  assert.match(pageSource, /validRowsForSummary\.some\(row => row\.gen_page_copy\)/)
  assert.match(pageSource, /validRowsForSummary\.some\(row => row\.gen_meta\)/)
  assert.match(pageSource, /validRowsForSummary\.some\(row => row\.gen_faqs\)/)
  assert.match(pageSource, /Writing Guidance/)
  assert.match(pageSource, /ariaLabel="Writing guidance"/)
  assert.match(pageSource, /page_copy_guidance_profile_id: pageCopyGuidanceProfileId/)
  assert.doesNotMatch(pageSource, /page_copy_guidance_prompt/)
  assert.doesNotMatch(pageSource, /guidance_instruction:/)
})

test('AIO rerun failures expose only safe shared messages', async () => {
  const source = await readFile(new URL('../app/(app)/all-in-one/jobs/[id]/page.tsx', import.meta.url), 'utf8')
  const safeErrorCalls = source.match(/safeRerunStartError\(error\)/g) ?? []

  assert.match(source, /const SAFE_RERUN_ERROR_PREFIXES = \[/)
  assert.match(source, /Page-copy quality v1 reruns are temporarily unavailable\./)
  assert.match(source, /This job was not rerun because its stored page-copy quality configuration is unavailable:/)
  assert.match(source, /const GENERIC_RERUN_START_ERROR = 'Could not start the rerun\. Please try again\.'/)
  assert.match(source, /const RERUN_STATUS_ERROR = 'The rerun started, but its latest status could not be loaded\./)
  assert.match(source, /if \(message === 'Rate limit displayed'\) return ''/)
  assert.match(source, /return message\.slice\(0, 500\)/)
  assert.equal(safeErrorCalls.length, 3)
  assert.match(source, /const \[rerunError, setRerunError\] = useState\(''\)/)
  assert.match(source, /setRerunError\(RERUN_STATUS_ERROR\)/)
  assert.match(source, /<div className=\{styles\.errorNotice\} role="alert">\{rerunError\}<\/div>/)
  assert.doesNotMatch(source, /setRerunError\(error instanceof Error \? error\.message/)
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

test('AIO result page shows additive section plans, guidance versions, and quality diagnostics', async () => {
  const source = await readFile(new URL('../app/(app)/all-in-one/jobs/[id]/page.tsx', import.meta.url), 'utf8')
  const resultStateSource = source.slice(source.indexOf('function resultState('), source.indexOf('function resultStateLabel('))

  assert.match(source, /planned_heading/)
  assert.match(source, /coverage_points/)
  assert.match(source, /owned_block_ids/)
  assert.match(source, /Planned heading/)
  assert.match(source, /Actual heading/)
  assert.match(source, /Owned-page block assignment/)
  assert.match(source, /page_copy_guidance/)
  assert.match(source, /page_quality_policy_version/)
  assert.match(source, /quality_diagnostics/)
  assert.match(source, /Quality diagnostics/)
  assert.match(source, /\^\\s\*#\{1,3\}\\s\+/)
  assert.doesNotMatch(source, /<h\[1-6\]/)
  assert.doesNotMatch(source, /function cleanGeneratedHeading/)
  assert.match(source, /const isVersionedPageCopy = Boolean\(row\.page_quality_policy_version\)/)
  assert.match(source, /if \(isVersionedPageCopy && generatedHeading\) lines\.push\(text, ''\)/)
  assert.match(source, /else if \(isVersionedPageCopy && plannedHeading\) lines\.push\(plannedHeading, text, ''\)/)
  assert.match(source, /isVersionedHeadinglessSection/)
  assert.match(source, /expectedHeadingLevel === 'none'/)
  assert.match(source, /else if \(isVersionedHeadinglessSection\) lines\.push\(text, ''\)/)
  assert.match(source, /else lines\.push\(section, text, ''\)/)
  assert.match(source, /const isVersionedPageCopy = Boolean\(selectedResult\.page_quality_policy_version\)/)
  assert.match(source, /const sectionPlan = isVersionedPageCopy/)
  assert.match(source, /const actualHeading = isVersionedPageCopy/)
  assert.doesNotMatch(resultStateSource, /quality_diagnostics/)
  assert.doesNotMatch(resultStateSource, /quality_findings/)
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
  const resultStateSource = source.slice(source.indexOf('function resultState('), source.indexOf('function resultStateLabel('))

  assert.match(source, /page_context_preview/)
  assert.match(source, /raw_response_chars/)
  assert.match(source, /retained_context_chars/)
  assert.match(source, /Jina cached fallback/)
  assert.match(source, /Collection-aware/)
  assert.match(source, /Retained scraped context/)
  assert.match(source, /Cleaned owned-page scrape preview/)
  assert.match(source, /not the exact strategy payload/)
  assert.doesNotMatch(source, /Characters passed into strategy/)
  assert.doesNotMatch(source, /characters sent to strategy/)
  assert.match(source, /owned_page_mapping_diagnostics/)
  assert.match(source, /source_char_count/)
  assert.match(source, /retained_char_count/)
  assert.match(source, /prompt_char_count/)
  assert.match(source, /prompt_truncated/)
  assert.match(source, /Owned-page mapping diagnostics/)
  assert.doesNotMatch(resultStateSource, /ownedPageMappingDiagnostics/)
  assert.doesNotMatch(resultStateSource, /owned_page_mapping_diagnostics/)
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
