import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (...segments) => fs.readFileSync(path.join(root, ...segments), 'utf8')

const visibleControlPages = [
  ['faq new job', 'app', '(app)', 'faq', 'jobs', 'new', 'page.tsx'],
  ['faq job result', 'app', '(app)', 'faq', 'jobs', '[id]', 'page.tsx'],
  ['intro new job', 'app', '(app)', 'intro', 'jobs', 'new', 'page.tsx'],
  ['intro job result', 'app', '(app)', 'intro', 'jobs', '[id]', 'page.tsx'],
  ['meta new job', 'app', '(app)', 'meta', 'jobs', 'new', 'page.tsx'],
  ['meta job result', 'app', '(app)', 'meta', 'jobs', '[id]', 'page.tsx'],
  ['all-in-one new job', 'app', '(app)', 'all-in-one', 'jobs', 'new', 'page.tsx'],
  ['all-in-one job result', 'app', '(app)', 'all-in-one', 'jobs', '[id]', 'page.tsx'],
  ['schema new job', 'app', '(app)', 'schema', 'jobs', 'new', 'page.tsx'],
]

test('shared control components exist with accessible roles', () => {
  const switchSource = read('components', 'ui', 'Switch.tsx')
  const checkboxSource = read('components', 'ui', 'StyledCheckbox.tsx')
  const segmentedSource = read('components', 'ui', 'SegmentedControl.tsx')

  assert.match(switchSource, /role="switch"/)
  assert.match(switchSource, /aria-checked/)
  assert.match(checkboxSource, /type="checkbox"/)
  assert.match(checkboxSource, /aria-label/)
  assert.match(segmentedSource, /role="tablist"/)
  assert.match(segmentedSource, /aria-selected/)
})

test('shared tokens include hover, switch track, and themed scrollbar support', () => {
  const globals = read('app', 'globals.css')
  const tailwind = read('tailwind.config.ts')

  assert.match(globals, /--hover:\s*#ECE8E0/)
  assert.match(globals, /--track-off:\s*#CFC8BC/)
  assert.match(globals, /--button-primary:\s*color-mix\(in srgb,\s*var\(--accent\)\s*88%,\s*black\)/)
  assert.match(globals, /--button-primary-hover:\s*color-mix\(in srgb,\s*var\(--accent\)\s*76%,\s*black\)/)
  assert.match(globals, /\.btn-primary[\s\S]*background:\s*var\(--button-primary\)/)
  assert.match(globals, /\.btn-primary:hover:not\(:disabled\)[\s\S]*background:\s*var\(--button-primary-hover\)/)
  assert.match(globals, /--radius:\s*8px/)
  assert.match(globals, /--radius-lg:\s*8px/)
  assert.match(globals, /--radius-xl:\s*8px/)
  assert.match(globals, /--radius-icon:\s*4px/)
  assert.match(globals, /\.dropdown-menu[\s\S]*border-radius:\s*var\(--radius\)/)
  assert.match(globals, /\.cs-panel[\s\S]*border-radius:\s*var\(--radius\)/)
  assert.match(tailwind, /DEFAULT:\s*'var\(--radius-icon\)'/)
  assert.match(tailwind, /md:\s*'var\(--radius-icon\)'/)
  assert.match(tailwind, /lg:\s*'var\(--radius\)'/)
  assert.match(tailwind, /xl:\s*'var\(--radius\)'/)
  assert.match(tailwind, /'2xl':\s*'var\(--radius\)'/)
  assert.match(globals, /scrollbar-width:\s*thin/)
  assert.match(globals, /scrollbar-color:\s*var\(--scrollbar-thumb\)\s+transparent/)
  assert.match(globals, /::-webkit-scrollbar-thumb:hover[\s\S]*var\(--accent\)/)
})

test('visible SaaS pages use shared controls instead of raw accent checkboxes', () => {
  for (const [name, ...segments] of visibleControlPages) {
    const source = read(...segments)
    assert.doesNotMatch(source, /accent-accent/, `${name} still uses accent-accent`)
    assert.doesNotMatch(source, /accent-\[var\(--accent\)\]/, `${name} still uses raw accent checkbox`)
  }
})

test('job creation modes use the shared segmented control', () => {
  for (const app of ['faq', 'intro', 'meta', 'all-in-one']) {
    const source = read('app', '(app)', app, 'jobs', 'new', 'page.tsx')
    assert.match(source, /import SegmentedControl from '@\/components\/ui\/SegmentedControl'/)
    assert.match(source, /<SegmentedControl/)
  }
})
