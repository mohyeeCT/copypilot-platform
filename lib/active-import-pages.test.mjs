import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readPage = (...segments) => fs.readFileSync(path.join(root, 'app', '(app)', ...segments), 'utf8')

const faqSource = readPage('faq', 'jobs', 'new', 'page.tsx')
const aioSource = readPage('all-in-one', 'jobs', 'new', 'page.tsx')

test('faq paste import opts into smart missing-keyword mapping', () => {
  assert.match(faqSource, /createFaqRowImportSchema\(\)/)
  assert.match(faqSource, /pageTypeValues: PAGE_TYPES/)
  assert.match(faqSource, /keys: \['url', 'page_type', 'h1'\]/)
  assert.match(faqSource, /keys: \['url', 'keyword', 'h1'\]/)
})

test('faq paste import displays non-blocking import notices', () => {
  assert.match(faqSource, /const \[importNotices, setImportNotices\]/)
  assert.match(faqSource, /setImportNotices\(result\.notices\)/)
  assert.match(faqSource, /importNotices\.map/)
})

test('all-in-one paste import opts into smart missing-keyword mapping with selected page type', () => {
  assert.match(aioSource, /createAioRowImportSchema\(pageType\)/)
  assert.match(aioSource, /pageTypeValues: PAGE_TYPES/)
  assert.match(aioSource, /keys: \['url', 'page_type', 'h1'\]/)
  assert.match(aioSource, /keys: \['url', 'keyword', 'h1'\]/)
})

test('all-in-one paste import displays non-blocking import notices', () => {
  assert.match(aioSource, /const \[importNotices, setImportNotices\]/)
  assert.match(aioSource, /setImportNotices\(result\.notices\)/)
  assert.match(aioSource, /importNotices\.map/)
})
