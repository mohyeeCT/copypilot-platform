import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const schemaJobPage = readFileSync('app/(app)/schema/jobs/[id]/page.tsx', 'utf8')

test('schema job detail warns when generated without scraped source data', () => {
  assert.match(schemaJobPage, /source_summary\?:\s*\{\s*scraped_sections:\s*string\[\]\s*serp_used:\s*boolean\s*\}/)
  assert.match(schemaJobPage, /result\.source_summary\?\.scraped_sections\?\.length === 0/)
  assert.match(schemaJobPage, /No page content was available for this URL/)
  assert.match(schemaJobPage, /text-warning/)
  assert.match(schemaJobPage, /rgba\(198,\s*123,\s*0,\s*0\.08\)/)
  assert.match(schemaJobPage, /rgba\(198,\s*123,\s*0,\s*0\.22\)/)
})
