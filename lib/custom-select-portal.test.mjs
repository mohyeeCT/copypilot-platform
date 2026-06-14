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

test('Meta, Page Copy, and All in One row type selectors use CustomSelect without native row selects', () => {
  const pages = [
    ['meta', /options=\{PAGE_TYPES\}/],
    ['page-copy', /options=\{PAGE_TYPES\.map\(pt => \(\{ value: pt, label: PAGE_LABELS\[pt\] \}\)\)\}/],
    ['all-in-one', /options=\{PAGE_TYPES\.map\(pt => \(\{ value: pt, label: PAGE_LABELS\[pt\] \}\)\)\}/],
  ]

  for (const [app, optionsPattern] of pages) {
    const source = read('app', '(app)', app, 'jobs', 'new', 'page.tsx')

    assert.match(source, /import CustomSelect from '@\/components\/ui\/CustomSelect'/)
    assert.match(source, /<CustomSelect[\s\S]*?value=\{row\.page_type\}/)
    assert.match(source, optionsPattern)
    assert.doesNotMatch(source, /<select[^>]*value=\{row\.page_type\}/)
  }
})

test('new-job settings use CustomSelect while preserving special value callbacks', () => {
  const pages = ['faq', 'intro', 'meta', 'page-copy', 'all-in-one']
    .map(app => read('app', '(app)', app, 'jobs', 'new', 'page.tsx'))

  for (const source of pages) {
    assert.doesNotMatch(source, /<select/)
  }

  const [faq, intro, meta, pageCopy, allInOne] = pages
  assert.match(faq, /onChange=\{value => \{[\s\S]*?setSelectedBrandProfileId\(value\)[\s\S]*?brandProfiles\.find\(p => p\.id === value\)/)
  assert.match(intro, /onChange=\{value => setWordCount\(\+value\)\}/)
  assert.match(intro, /onChange=\{value => setParagraphCount\(\+value\)\}/)
  assert.match(intro, /onChange=\{value => \{[\s\S]*?setSelectedBrandProfileId\(value\)[\s\S]*?brandProfiles\.find\(p => p\.id === value\)/)
  assert.match(meta, /value=\{provider\} onChange=\{handleProviderChange\}/)
  assert.match(pageCopy, /onChange=\{value => setTemplateMode\(value as 'predefined' \| 'custom'\)\}/)
  assert.match(allInOne, /onChange=\{value => setTemplateMode\(value as 'predefined' \| 'custom'\)\}/)
})

test('CustomSelect supports grouped options and Group 3 internal selectors use it', () => {
  const customSelect = read('components', 'ui', 'CustomSelect.tsx')
  const niche = read('components', 'ui', 'NicheSelect.tsx')
  const profiles = read('components', 'ui', 'BrandProfilesCard.tsx')
  const settings = read('app', '(app)', 'settings', 'page.tsx')
  const globals = read('app', 'globals.css')

  assert.match(customSelect, /type OptionObject = \{ value: string; label: string; group\?: string \}/)
  assert.match(customSelect, /cs-option-group/)
  assert.match(customSelect, /role="presentation"/)
  assert.match(globals, /\.cs-option-group/)

  assert.match(niche, /import CustomSelect from '\.\/CustomSelect'/)
  assert.match(niche, /group: n\.group/)
  assert.doesNotMatch(niche, /<select/)

  assert.match(profiles, /import CustomSelect from '@\/components\/ui\/CustomSelect'/)
  assert.match(profiles, /value=\{form\.tone \|\| ''\}/)
  assert.match(profiles, /tone: value/)
  assert.doesNotMatch(profiles, /<select/)

  assert.match(settings, /import CustomSelect from '@\/components\/ui\/CustomSelect'/)
  assert.match(settings, /value=\{credsForm\.provider\}/)
  assert.match(settings, /provider: value/)
  assert.doesNotMatch(settings, /<select/)
})

test('Changelog filters use compact CustomSelect controls while preserving filter behavior', () => {
  const changelog = read('app', '(public)', 'changelog', 'page.tsx')

  assert.match(changelog, /import CustomSelect from '@\/components\/ui\/CustomSelect'/)
  assert.match(changelog, /value=\{toolFilter\}[\s\S]*?onChange=\{setToolFilter\}[\s\S]*?options=\{ALL_TOOLS\}/)
  assert.match(changelog, /value=\{typeFilter\}[\s\S]*?onChange=\{value => setTypeFilter\(value as ChangeType \| 'All'\)\}[\s\S]*?options=\{ALL_TYPES\.map\(t => \(\{[\s\S]*?label: t === 'All' \? 'All' : typeStyles\[t as ChangeType\]\.label/)
  assert.match(changelog, /className=\{`changelog-filter \$\{toolFilter !== 'All' \? 'active' : ''\}`\}/)
  assert.match(changelog, /className=\{`changelog-filter \$\{typeFilter !== 'All' \? 'active' : ''\}`\}/)
  assert.match(changelog, /setToolFilter\('All'\); setTypeFilter\('All'\)/)
  assert.doesNotMatch(changelog, /<select/)
})
