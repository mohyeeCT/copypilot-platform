import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('indexer is available as an internal other navigation entry', async () => {
  const sidebar = await readFile(new URL('../components/layout/Sidebar.tsx', import.meta.url), 'utf8')
  const settings = await readFile(new URL('../app/(app)/settings/page.tsx', import.meta.url), 'utf8')
  const jobsPage = await readFile(new URL('../app/(app)/indexer/jobs/page.tsx', import.meta.url), 'utf8')
  const newJobPage = await readFile(new URL('../app/(app)/indexer/jobs/new/page.tsx', import.meta.url), 'utf8')
  const resultPage = await readFile(new URL('../app/(app)/indexer/jobs/[id]/page.tsx', import.meta.url), 'utf8')
  const api = await readFile(new URL('../lib/api/indexer.ts', import.meta.url), 'utf8')
  const tools = sidebar.match(/const tools: Tool\[\] = \[([\s\S]*?)\n\]/)?.[1] ?? ''
  const other = sidebar.match(/const other: Tool\[\] = \[([\s\S]*?)\n\]/)?.[1] ?? ''

  assert.doesNotMatch(tools, /label:\s*'Indexer'/)
  assert.match(other, /href:\s*'\/indexer\/jobs'[\s\S]*label:\s*'Indexer'/)
  assert.doesNotMatch(other, /https:\/\/indexer\.copypilot\.app/)
  assert.match(settings, /indexer-backend-production\.up\.railway\.app/)
  assert.match(jobsPage, /indexerApi\.listJobs/)
  assert.match(jobsPage, /Google account|Service account/)
  assert.match(jobsPage, /Reconnect needed/)
  assert.match(newJobPage, /indexerApi\.submitUrls/)
  assert.match(newJobPage, /indexerApi\.previewSitemap/)
  assert.match(newJobPage, /Reconnect Google in Settings/)
  assert.match(resultPage, /indexerApi\.resubmitUrls/)
  assert.match(api, /NEXT_PUBLIC_INDEXER_API_URL/)
  assert.match(api, /\/api\/indexer\/submit-sitemap/)
})
