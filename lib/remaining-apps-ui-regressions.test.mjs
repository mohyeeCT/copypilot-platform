import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function read(path) {
  return readFileSync(path, 'utf8')
}

test('All in One composer keeps its footer out of the responsive input grid', () => {
  const page = read('app/(app)/all-in-one/jobs/new/page.tsx')
  const styles = read('components/meta/MetaCopyWorkspace.module.css')

  assert.match(page, /styles\.composerFooter/)
  assert.match(styles, /\.composerFooter\s*\{[\s\S]*grid-column:\s*1\s*\/\s*-1/)
  assert.match(page, /grid-cols-1 sm:grid-cols-12/)
  assert.match(page, /sm:col-span-5/)
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
