import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('schema generator is available in the other navigation section', async () => {
  const sidebar = await readFile(new URL('../components/layout/Sidebar.tsx', import.meta.url), 'utf8')
  const settings = await readFile(new URL('../app/(app)/settings/page.tsx', import.meta.url), 'utf8')
  const jobsPage = await readFile(new URL('../app/(app)/schema/jobs/page.tsx', import.meta.url), 'utf8')
  const create = sidebar.match(/label:\s*'Create',\s*items:\s*\[([\s\S]*?)\]\s*,?\s*}/)?.[1] ?? ''
  const operations = sidebar.match(/label:\s*'Operations',\s*items:\s*\[([\s\S]*?)\]\s*,?\s*}/)?.[1] ?? ''
  const firstOperationsEntry = operations.match(/\{[^}]*\}/)?.[0] ?? ''

  assert.doesNotMatch(create, /label:\s*'Schema Generator'/)
  assert.match(firstOperationsEntry, /href:\s*'\/schema\/jobs'[\s\S]*label:\s*'Schema Generator'/)
  assert.match(settings, /schema-saas-backend-production\.up\.railway\.app/)
  assert.match(jobsPage, /Schema Generator/)
  assert.match(jobsPage, /schemaApi\.listJobs/)
})
