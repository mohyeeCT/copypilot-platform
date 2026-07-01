import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (...segments) => fs.readFileSync(path.join(root, ...segments), 'utf8')
const readPage = (...segments) => read('app', '(app)', ...segments)

test('visible copy apps expose landing page as a distinct page type', () => {
  const faq = readPage('faq', 'jobs', 'new', 'page.tsx')
  const meta = readPage('meta', 'jobs', 'new', 'page.tsx')
  const intro = readPage('intro', 'jobs', 'new', 'page.tsx')
  const aio = readPage('all-in-one', 'jobs', 'new', 'page.tsx')

  assert.match(faq, /const PAGE_TYPES = \[[^\]]*'landing_page'/)
  assert.match(meta, /const PAGE_TYPES = \[[^\]]*'landing_page'/)
  assert.match(intro, /\{ value: 'service_lp', label: 'Service Page' \}/)
  assert.match(intro, /\{ value: 'landing_page', label: 'Landing Page' \}/)
  assert.doesNotMatch(intro, /Service \/ Landing Page/)
  assert.match(aio, /const PAGE_TYPES = \[[^\]]*'landing_page'/)
  assert.match(aio, /landing_page:\s*'Landing Page'/)
})

test('landing page has a friendly option label', () => {
  const labels = read('lib', 'option-labels.ts')

  assert.match(labels, /landing_page:\s*'Landing Page'/)
})
