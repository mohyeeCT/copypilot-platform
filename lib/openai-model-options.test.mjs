import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8')
}

test('Intro new-job page offers the current GPT-5 OpenAI model set', async () => {
  const src = await source('app/(app)/intro/jobs/new/page.tsx')

  assert.match(src, /GPT-5\.5 \(latest\)/)
  assert.match(src, /gpt-5\.5/)
  assert.match(src, /GPT-5\.4/)
  assert.match(src, /gpt-5\.4/)
  assert.match(src, /gpt-5\.4-mini/)
  assert.match(src, /gpt-5\.4-nano/)
  assert.doesNotMatch(src, /gpt-4o-mini/)
  assert.doesNotMatch(src, /gpt-4o/)
})
