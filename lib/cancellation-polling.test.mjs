import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const jobPages = [
  'all-in-one',
  'faq',
  'intro',
  'meta',
  'page-copy',
  'schema',
]

const terminalStatusCheckPattern = /(?:job\.status|jobStatus) !== 'running' && (?:job\.status|jobStatus) !== 'cancelling'/

for (const workflow of jobPages) {
  test(`${workflow} job page polls until cancellation reaches a terminal state`, async () => {
    const source = await readFile(
      new URL(`../app/(app)/${workflow}/jobs/[id]/page.tsx`, import.meta.url),
      'utf8',
    )

    assert.match(source, terminalStatusCheckPattern)
  })

  test(`${workflow} job page reloads immediately after requesting cancellation`, async () => {
    const source = await readFile(
      new URL(`../app/(app)/${workflow}/jobs/[id]/page.tsx`, import.meta.url),
      'utf8',
    )

    assert.match(
      source,
      /await \w+Api\.cancelJob\(session\.access_token, job\.id\)\s+await load\(\)/,
    )
  })
}

test('all-in-one job page clears local stopping state after terminal status arrives', async () => {
  const source = await readFile(
    new URL('../app/(app)/all-in-one/jobs/[id]/page.tsx', import.meta.url),
    'utf8',
  )

  assert.match(source, /setCancelling\(false\)/)
  assert.match(
    source,
    /(?:job\.status|jobStatus) !== 'running' && (?:job\.status|jobStatus) !== 'cancelling'[\s\S]{0,180}setCancelling\(false\)/,
  )
})
