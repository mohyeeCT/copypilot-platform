import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (...segments) => fs.readFileSync(path.join(root, ...segments), 'utf8')

test('CustomSelect portals its panel to the document body with viewport positioning', () => {
  const source = read('components', 'ui', 'CustomSelect.tsx')

  assert.match(source, /import \{ createPortal \} from 'react-dom'/)
  assert.match(source, /createPortal\(/)
  assert.match(source, /document\.body/)
  assert.match(source, /position: 'fixed'/)
  assert.match(source, /getBoundingClientRect\(\)/)
})

test('FAQ and Intro row type selectors use CustomSelect', () => {
  const faq = read('app', '(app)', 'faq', 'jobs', 'new', 'page.tsx')
  const intro = read('app', '(app)', 'intro', 'jobs', 'new', 'page.tsx')

  assert.match(faq, /import CustomSelect from '@\/components\/ui\/CustomSelect'/)
  assert.match(faq, /<CustomSelect[\s\S]*?options=\{PAGE_TYPES\}/)
  assert.match(intro, /import CustomSelect from '@\/components\/ui\/CustomSelect'/)
  assert.match(intro, /<CustomSelect[\s\S]*?options=\{PAGE_TEMPLATES\}/)
})
