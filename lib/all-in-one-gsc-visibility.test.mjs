import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const jobPageSrc = () =>
  readFile(new URL('../app/(app)/all-in-one/jobs/[id]/page.tsx', import.meta.url), 'utf8')

test('All-in-One job result type includes the safe GSC auth method label', async () => {
  const source = await jobPageSrc()
  assert.match(source, /gsc_auth_method\?:/)
})

test('All-in-One results render a GSC auth badge when the backend provides one', async () => {
  const source = await jobPageSrc()
  assert.match(source, /Google OAuth|Service account/)
  assert.match(source, /row\.gsc_auth_method/)
})

test('All-in-One job page translates known GSC job errors into helpful UI copy', async () => {
  const source = await jobPageSrc()
  assert.match(source, /gscErrorMessage/)
  assert.match(source, /Reconnect Google in Settings/)
  assert.match(source, /Google OAuth is not configured for this backend/)
  assert.match(source, /Choose Google OAuth or service account in Settings/)
})
