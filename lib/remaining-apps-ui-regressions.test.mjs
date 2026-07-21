import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function read(path) {
  return readFileSync(path, 'utf8')
}

test('All in One composer keeps its footer and long configuration rail in normal page flow', () => {
  const page = read('app/(app)/all-in-one/jobs/new/page.tsx')
  const styles = read('components/meta/MetaCopyWorkspace.module.css')

  assert.match(page, /<\/div>\s*<\/div>\s*<div className=\{`space-y-4 \$\{styles\.composerFooter\}`\}>/)
  assert.doesNotMatch(styles, /\.composerFooter\s*\{[^}]*grid-column/)
  assert.match(page, /styles\.settingsRail\} \$\{styles\.aioSettingsRail\}/)
  assert.match(styles, /\.aioSettingsRail\s*\{[^}]*position:\s*static/)
  assert.match(page, /grid-cols-1 sm:grid-cols-12/)
  assert.match(page, /sm:col-span-5/)
})

test('Shared job composer uses a fluid desktop configuration rail', () => {
  const styles = read('components/meta/MetaCopyWorkspace.module.css')

  assert.match(styles, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*clamp\(480px,\s*30%,\s*560px\)/)
})

test('Schema result rows use the full queue width when no checkbox column is rendered', () => {
  const page = read('app/(app)/schema/jobs/[id]/page.tsx')
  const styles = read('components/schema/SchemaWorkspace.module.css')

  assert.match(page, /schemaStyles\.resultRow/)
  assert.match(styles, /\.resultRow\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/)
})

test('Indexer preserves readable URL columns inside its mobile scroll region', () => {
  const page = read('app/(app)/indexer/jobs/[id]/page.tsx')

  assert.match(page, /min-w-\[780px\]/)
  assert.match(page, /w-\[300px\][^\n]*>URL</)
  assert.match(page, /max-h-\[60vh\] overflow-auto/)
})

test('constrained review panes contain scroll without trapping responsive detail pages', () => {
  const sharedStyles = read('components/meta/MetaCopyWorkspace.module.css')
  const aioStyles = read('components/all-in-one/AllInOneWorkspace.module.css')
  const resultListRule = sharedStyles.match(/\.resultList\s*\{([^}]*)\}/)?.[1] || ''
  const logsPanelRule = sharedStyles.match(/\.logsPanel\s*\{([^}]*)\}/)?.[1] || ''
  const baseDetailRule = sharedStyles.match(/\.detailBody\s*\{([^}]*)\}/)?.[1] || ''
  const evidenceRule = aioStyles.match(/\.evidenceText\s*\{([^}]*)\}/)?.[1] || ''

  assert.match(resultListRule, /overflow-y:\s*auto/)
  assert.match(logsPanelRule, /overflow-y:\s*auto/)
  assert.match(evidenceRule, /overflow:\s*auto/)
  assert.doesNotMatch(resultListRule, /overscroll-behavior/)
  assert.doesNotMatch(logsPanelRule, /overscroll-behavior/)
  assert.doesNotMatch(baseDetailRule, /overscroll-behavior/)
  assert.doesNotMatch(evidenceRule, /overscroll-behavior/)
  assert.match(sharedStyles, /@media \(min-width:\s*981px\)\s*\{\s*\.resultList,\s*\.logsPanel,\s*\.detailBody\s*\{[^}]*overscroll-behavior-y:\s*contain/)
  assert.match(aioStyles, /@media \(min-width:\s*981px\)\s*\{\s*\.evidenceText\s*\{[^}]*overscroll-behavior-y:\s*contain/)
})
