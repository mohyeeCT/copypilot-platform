import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { clientScopedJobsPath } from './api/shared.ts'


const sharedJobApps = ['faq', 'intro', 'meta', 'all-in-one', 'schema']
const newJobApps = [...sharedJobApps, 'indexer']


test('client job filters distinguish all, assigned, and unassigned jobs', () => {
  assert.equal(clientScopedJobsPath(undefined), '/api/jobs')
  assert.equal(clientScopedJobsPath(null), '/api/jobs?unassigned=true')
  assert.equal(
    clientScopedJobsPath('profile/with unsafe query'),
    '/api/jobs?client_profile_id=profile%2Fwith%20unsafe%20query',
  )
})

for (const app of sharedJobApps) {
  test(`${app} jobs explicitly enable and forward client filtering`, async () => {
    const source = await readFile(
      new URL(`../app/(app)/${app}/jobs/page.tsx`, import.meta.url),
      'utf8',
    )

    assert.match(source, /supportsClientProfiles:\s*true/)
    assert.match(source, /listJobs\(token, clientProfileId\)/)
  })
}

test('hidden standalone Page Copy does not opt into client-profile UI', async () => {
  const source = await readFile(
    new URL('../app/(app)/page-copy/jobs/page.tsx', import.meta.url),
    'utf8',
  )

  assert.doesNotMatch(source, /supportsClientProfiles:\s*true/)
  assert.doesNotMatch(source, /clientProfileId/)
})

for (const app of newJobApps) {
  test(`${app} new jobs accept inherited client context`, async () => {
    const source = await readFile(
      new URL(`../app/(app)/${app}/jobs/new/page.tsx`, import.meta.url),
      'utf8',
    )

    assert.match(source, /client_profile_id/)
    assert.match(source, /Unassigned/)
  })
}

test('content import creates a reviewable draft without auto-saving a profile', async () => {
  const source = await readFile(
    new URL('../components/ui/BrandProfilesCard.tsx', import.meta.url),
    'utf8',
  )
  const analyseFunction = source.match(/async function analyseContent\(\)[\s\S]*?\n  }/)?.[0] || ''

  assert.match(source, /Create from content/)
  assert.match(source, /Review every field before saving/)
  assert.match(source, /draftEvidence/)
  assert.match(analyseFunction, /setEditingId\('new'\)/)
  assert.doesNotMatch(analyseFunction, /createBrandProfile\(/)
})

test('profile upload uses multipart boundaries supplied by the browser', async () => {
  const source = await readFile(new URL('./api/shared.ts', import.meta.url), 'utf8')

  assert.match(source, /options\.body instanceof FormData/)
  assert.match(source, /new FormData\(\)/)
  assert.match(source, /draft-from-content/)
})
