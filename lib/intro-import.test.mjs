import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = fs.readFileSync(path.join(root, 'app', '(app)', 'intro', 'jobs', 'new', 'page.tsx'), 'utf8')

test('intro paste import uses selected default page template', () => {
  assert.match(source, /createIntroRowImportSchema\(pageTemplate\)/)
  assert.doesNotMatch(source, /createCopyRowImportSchema\(\{ page_type: 'service_lp' \}\)/)
})

test('intro paste import displays non-blocking import notices', () => {
  assert.match(source, /const \[importNotices, setImportNotices\]/)
  assert.match(source, /setImportNotices\(result\.notices\)/)
  assert.match(source, /importNotices\.map/)
})
