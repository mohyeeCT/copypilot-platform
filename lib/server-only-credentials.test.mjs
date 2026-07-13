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

test('settings page tracks AI API key status per provider without exposing keys', async () => {
  const source = await readFile(new URL('../app/(app)/settings/page.tsx', import.meta.url), 'utf8')

  assert.match(source, /providerKeyStatus/)
  assert.match(source, /api_key_status/)
  assert.match(source, /AI_PROVIDERS\.map\(provider =>/)
  assert.match(source, /providerKeyStatus\[credsForm\.provider\]/)
  assert.match(source, /provider: value, api_key: ''/)
  assert.match(source, /Parallel API Key/)
  assert.match(source, /has_parallel_key/)
  assert.match(source, /has_dfs_password/)
  assert.match(source, /parallel_api_key: ''/)
  assert.doesNotMatch(source, /setCredsForm\(\{[\s\S]*?api_key: creds\.api_key/)
  assert.doesNotMatch(source, /parallel_api_key: creds\.parallel_api_key/)
})
