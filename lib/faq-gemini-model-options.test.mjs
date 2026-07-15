import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const faqPage = new URL('../app/(app)/faq/jobs/new/page.tsx', import.meta.url)

test('FAQ new-job page offers current Gemini models and rejects retired template values', async () => {
  const source = await readFile(faqPage, 'utf8')

  assert.match(source, /Gemini 3\.5 Flash \(default\)/)
  assert.match(source, /gemini-3\.5-flash/)
  assert.match(source, /Gemini 3\.1 Flash-Lite/)
  assert.match(source, /gemini-3\.1-flash-lite/)
  assert.match(source, /resolveProviderModel\(/)
  assert.doesNotMatch(source, /gemini-2\.0-flash/)
})
