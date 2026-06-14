import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const newJobPages = ['faq', 'intro', 'meta', 'page-copy', 'all-in-one']

for (const workflow of newJobPages) {
  test(`${workflow} new-job page does not request or submit saved secrets`, async () => {
    const source = await readFile(
      new URL(`../app/(app)/${workflow}/jobs/new/page.tsx`, import.meta.url),
      'utf8',
    )

    assert.doesNotMatch(source, /getProviderCredentials/)
    assert.doesNotMatch(source, /\bapi_key\s*:/)
    assert.doesNotMatch(source, /\bdfs_password\s*:/)
    assert.doesNotMatch(source, /\bjina_api_key\s*:/)
  })
}

test('shared API exposes provider metadata instead of a full-credential helper', async () => {
  const source = await readFile(new URL('./api/shared.ts', import.meta.url), 'utf8')

  assert.match(source, /getProviderMetadata/)
  assert.doesNotMatch(source, /getProviderCredentials/)
})
