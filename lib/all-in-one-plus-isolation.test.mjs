import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const apiUrl = new URL('./api/all-in-one-plus.ts', import.meta.url)
const jobsUrl = new URL('../app/(app)/all-in-one-plus/jobs/page.tsx', import.meta.url)
const newJobUrl = new URL('../app/(app)/all-in-one-plus/jobs/new/page.tsx', import.meta.url)
const jobUrl = new URL('../app/(app)/all-in-one-plus/jobs/[id]/page.tsx', import.meta.url)
const sidebarUrl = new URL('../components/layout/Sidebar.tsx', import.meta.url)

test('AIO+ uses its isolated backend host while preserving the AIO v1 endpoint contract', async () => {
  const source = await readFile(apiUrl, 'utf8')

  assert.match(source, /NEXT_PUBLIC_AIO_PLUS_API_URL/)
  assert.match(source, /all-in-one-plus-saas-backend-production\.up\.railway\.app/)
  assert.doesNotMatch(source, /NEXT_PUBLIC_AIO_API_URL/)
  assert.match(source, /'\/api\/all-in-one\/run'/)
  assert.match(source, /`\/api\/jobs\/\$\{id\}`/)
})

test('AIO+ navigation and route actions stay inside the AIO+ workspace', async () => {
  const [jobs, newJob, job, sidebar] = await Promise.all([
    readFile(jobsUrl, 'utf8'),
    readFile(newJobUrl, 'utf8'),
    readFile(jobUrl, 'utf8'),
    readFile(sidebarUrl, 'utf8'),
  ])

  for (const source of [jobs, newJob, job]) {
    assert.match(source, /@\/lib\/api\/all-in-one-plus/)
    assert.doesNotMatch(source, /@\/lib\/api\/all-in-one['"]/)
    assert.doesNotMatch(source, /["'`]\/all-in-one\/jobs/)
  }

  assert.match(sidebar, /href:\s*'\/all-in-one\/jobs'[\s\S]*label:\s*'All in One'/)
  assert.match(sidebar, /href:\s*'\/all-in-one-plus\/jobs'[\s\S]*label:\s*'AIO\+'/)
  assert.match(sidebar, /href:\s*'\/all-in-one-v2\/jobs'[\s\S]*label:\s*'All in One v2'/)
})

test('AIO+ retains the existing export surfaces without importing AIO v1 private helpers', async () => {
  const source = await readFile(jobUrl, 'utf8')

  assert.match(source, /exportRowsToGoogleDocs/)
  assert.match(source, /exportRowsToGoogleSheets/)
  assert.match(source, /downloadAllDocx/)
  assert.match(source, /@\/components\/all-in-one-plus\/AllInOnePlusWorkspace\.module\.css/)
  assert.match(source, /@\/lib\/all-in-one-plus-section-headings/)
  assert.doesNotMatch(source, /@\/components\/all-in-one\/AllInOneWorkspace\.module\.css/)
  assert.doesNotMatch(source, /@\/lib\/all-in-one-section-headings/)
})
