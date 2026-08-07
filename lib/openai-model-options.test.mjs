import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8')
}

function assertSolIsOptIn(src) {
  const existingDefault = src.indexOf("value: 'gpt-5.5'")
  const solOption = src.indexOf("value: 'gpt-5.6-sol'")

  assert.match(src, /GPT-5\.6 Sol \(premium\)/)
  assert.ok(existingDefault >= 0, 'expected the existing GPT-5.5 option')
  assert.ok(solOption > existingDefault, 'GPT-5.6 Sol must not replace the existing OpenAI default')
  assert.doesNotMatch(src, /GPT-5\.5 \(latest\)/)
}

test('Intro new-job page offers the current GPT-5 OpenAI model set', async () => {
  const src = await source('app/(app)/intro/jobs/new/page.tsx')

  assertSolIsOptIn(src)
  assert.match(src, /GPT-5\.4/)
  assert.match(src, /gpt-5\.4/)
  assert.match(src, /gpt-5\.4-mini/)
  assert.match(src, /gpt-5\.4-nano/)
  assert.match(src, /settings:\s*\{\s*provider,\s*model,/)
  assert.doesNotMatch(src, /gpt-4o-mini/)
  assert.doesNotMatch(src, /gpt-4o/)
})

test('All-in-One new-job page offers model selection and submits the selected model', async () => {
  const src = await source('app/(app)/all-in-one/jobs/new/page.tsx')

  assert.match(src, /const PROVIDER_MODELS/)
  assertSolIsOptIn(src)
  assert.match(src, /claude-sonnet-5/)
  assert.match(src, /claude-sonnet-4-6/)
  assert.doesNotMatch(src, /claude-sonnet-4-5/)
  assert.match(src, /const \[model, setModel\]/)
  assert.match(src, /<CustomSelect value=\{model\} onChange=\{setModel\}/)
  assert.match(src, /niche, provider, model, dfs_login/)
  assert.doesNotMatch(src, /gpt-4o-mini/)
  assert.doesNotMatch(src, /gpt-4o/)
})

test('FAQ and Meta offer GPT-5.6 Sol without changing their OpenAI default', async () => {
  const launchers = await Promise.all([
    source('app/(app)/faq/jobs/new/page.tsx'),
    source('app/(app)/meta/jobs/new/page.tsx'),
  ])

  launchers.forEach(src => {
    assertSolIsOptIn(src)
    assert.match(src, /settings:\s*\{\s*provider,\s*model,/)
  })
})

test('Schema offers OpenAI GPT-5.6 Sol while retaining Claude as the default', async () => {
  const src = await source('app/(app)/schema/jobs/new/page.tsx')

  assert.match(src, /const PROVIDERS = \['Claude', 'OpenAI'\]/)
  assert.match(src, /GPT-5\.6 Sol \(premium\)/)
  assert.match(src, /value: 'gpt-5\.6-sol'/)
  assert.match(src, /useState\('Claude'\)/)
  assert.match(src, /useState\(PROVIDER_MODELS\.Claude\[0\]\.value\)/)
  assert.match(src, /settings:\s*\{\s*provider,\s*model,/)
})
