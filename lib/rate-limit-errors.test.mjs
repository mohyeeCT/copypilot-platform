import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const workflows = ['faq', 'intro', 'meta', 'page-copy', 'all-in-one']

test('429 duplicate and rerun responses dispatch their backend message for the themed Toast', async () => {
  const source = await readFile(new URL('./api/shared.ts', import.meta.url), 'utf8')

  assert.match(source, /res\.status === 429/)
  assert.match(source, /\/\(duplicate\|rerun-row\|rerun-rows\|rerun-section\)/)
  assert.match(source, /window\.dispatchEvent\(new CustomEvent\('api-rate-limit'/)
})

test('Toast provider displays dispatched rate-limit messages using its existing error theme', async () => {
  const source = await readFile(
    new URL('../components/ui/Toast.tsx', import.meta.url),
    'utf8',
  )

  assert.match(source, /window\.addEventListener\('api-rate-limit'/)
  assert.match(source, /toast\(event\.detail, 'error'\)/)
  assert.match(source, /window\.removeEventListener\('api-rate-limit'/)
})

test('duplicate does not add a second generic popup after a rate-limit popup', async () => {
  const source = await readFile(
    new URL('../components/ui/JobsListPage.tsx', import.meta.url),
    'utf8',
  )

  assert.match(source, /catch \(e\) \{ if \(e instanceof Error && e\.message !== 'Rate limit displayed'\) toast\.error\('Failed to duplicate'\) \}/)
})

for (const workflow of workflows) {
  test(`${workflow} restores rerun controls after a rate-limit response`, async () => {
    const source = await readFile(
      new URL(`../app/(app)/${workflow}/jobs/[id]/page.tsx`, import.meta.url),
      'utf8',
    )
    assert.match(source, /window\.addEventListener\('api-rate-limit', resetRateLimitedAction\)/)
    assert.match(source, /setRerunning\(null\); setRerunningMulti\(false\)/)
  })
}
