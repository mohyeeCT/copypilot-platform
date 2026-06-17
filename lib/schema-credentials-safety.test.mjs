import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('schema frontend does not expose direct provider or scraping secrets', async () => {
  const api = await readFile(new URL('../lib/api/schema.ts', import.meta.url), 'utf8')
  const newJob = await readFile(new URL('../app/(app)/schema/jobs/new/page.tsx', import.meta.url), 'utf8')

  for (const source of [api, newJob]) {
    assert.doesNotMatch(source, /anthropic/i)
    assert.doesNotMatch(source, /x-api-key/i)
    assert.doesNotMatch(source, /localStorage/)
    assert.doesNotMatch(source, /api\.dataforseo\.com/)
    assert.doesNotMatch(source, /api\.firecrawl\.dev/)
    assert.doesNotMatch(source, /\bjina_api_key\s*:/)
    assert.doesNotMatch(source, /\bdfs_password\s*:/)
    assert.doesNotMatch(source, /\bapi_key\s*:/)
  }
})
