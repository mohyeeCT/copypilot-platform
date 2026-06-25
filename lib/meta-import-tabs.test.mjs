import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = fs.readFileSync(path.join(root, 'app', '(app)', 'meta', 'jobs', 'new', 'page.tsx'), 'utf8')

test('meta new-job page exposes Intro-style manual, paste, and CSV import tabs', () => {
  assert.match(source, /\(\['manual', 'paste', 'csv'\] as const\)/)
  assert.match(source, /'Manual entry'/)
  assert.match(source, /'Paste from sheet'/)
  assert.match(source, /'Upload CSV'/)
})

test('meta paste and CSV upload reuse the shared import path', () => {
  assert.match(source, /function applyImportedText\(text: string\)/)
  assert.match(source, /function handleCsvUpload\(e: React\.ChangeEvent<HTMLInputElement>\)/)
  assert.match(source, /applyImportedText\(pasteText\)/)
  assert.match(source, /applyImportedText\(await file\.text\(\)\)/)
  assert.match(source, /parseImportedRows\(text, createMetaRowImportSchema\(\)\)/)
})

test('meta paste import displays non-blocking import notices', () => {
  assert.match(source, /const \[importNotices, setImportNotices\]/)
  assert.match(source, /setImportNotices\(result\.notices\)/)
  assert.match(source, /importNotices\.map/)
})
