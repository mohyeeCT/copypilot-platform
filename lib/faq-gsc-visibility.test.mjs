import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const jobPageSrc = () =>
  readFile(new URL('../app/(app)/faq/jobs/[id]/page.tsx', import.meta.url), 'utf8')

test('FAQ job result type includes the safe GSC auth method label', async () => {
  const source = await jobPageSrc()
  assert.match(source, /gsc_auth_method\?:/)
})

test('FAQ results render a GSC auth badge when the backend provides one', async () => {
  const source = await jobPageSrc()
  assert.match(source, /Google OAuth|Service account/)
  assert.match(source, /row\.gsc_auth_method/)
})
