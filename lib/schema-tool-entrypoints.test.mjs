import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('schema generator is available as a first-class app tool', async () => {
  const sidebar = await readFile(new URL('../components/layout/Sidebar.tsx', import.meta.url), 'utf8')
  const settings = await readFile(new URL('../app/(app)/settings/page.tsx', import.meta.url), 'utf8')
  const jobsPage = await readFile(new URL('../app/(app)/schema/jobs/page.tsx', import.meta.url), 'utf8')

  assert.match(sidebar, /href:\s*'\/schema\/jobs'/)
  assert.match(sidebar, /label:\s*'Schema Generator'/)
  assert.match(settings, /schema-saas-backend-production\.up\.railway\.app/)
  assert.match(jobsPage, /Schema Generator/)
  assert.match(jobsPage, /schemaApi\.listJobs/)
})
