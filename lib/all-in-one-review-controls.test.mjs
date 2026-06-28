import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('AIO section rerun API can send a reviewer instruction', async () => {
  const source = await readFile(new URL('./api/all-in-one.ts', import.meta.url), 'utf8')

  assert.match(source, /reviewerInstruction/)
  assert.match(source, /reviewer_instruction: reviewerInstruction/)
})

test('AIO new-job page exposes optional brand consistency check', async () => {
  const source = await readFile(new URL('../app/(app)/all-in-one/jobs/new/page.tsx', import.meta.url), 'utf8')

  assert.match(source, /brandConsistencyCheck/)
  assert.match(source, /brand_consistency_check: brandConsistencyCheck/)
  assert.match(source, /Brand consistency check/)
})

test('AIO result page shows diagnostics and reviewer-note controls', async () => {
  const source = await readFile(new URL('../app/(app)/all-in-one/jobs/[id]/page.tsx', import.meta.url), 'utf8')

  assert.match(source, /content_gap_summary/)
  assert.match(source, /brand_consistency/)
  assert.match(source, /Content gaps/)
  assert.match(source, /Brand match/)
  assert.match(source, /reviewerInstruction/)
})

test('AIO result page shows and exports internal link suggestions', async () => {
  const source = await readFile(new URL('../app/(app)/all-in-one/jobs/[id]/page.tsx', import.meta.url), 'utf8')

  assert.match(source, /internal_link_suggestions/)
  assert.match(source, /Internal link suggestions/)
  assert.match(source, /downloadInternalLinksCsv/)
  assert.match(source, /Suggested Anchor/)
})
