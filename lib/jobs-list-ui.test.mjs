import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('shared jobs list uses safe summary stats and table columns', async () => {
  const source = await readFile(
    new URL('../components/ui/JobsListPage.tsx', import.meta.url),
    'utf8',
  )

  assert.match(source, /Total jobs/)
  assert.match(source, /URLs processed/)
  assert.match(source, /Completed URLs/)
  assert.match(source, /Job name/)
  assert.match(source, /Status/)
  assert.match(source, /When/)
  assert.doesNotMatch(source, /FAQs generated/)
  assert.doesNotMatch(source, /Google Sheets/)
})

test('shared jobs list title icon uses the neutral tile treatment', async () => {
  const source = await readFile(
    new URL('../components/ui/JobsListPage.tsx', import.meta.url),
    'utf8',
  )
  const headerStart = source.indexOf('{/* Page header */}')
  const headerEnd = source.indexOf('{/* Loading */}')
  assert.notEqual(headerStart, -1)
  assert.notEqual(headerEnd, -1)
  const header = source.slice(headerStart, headerEnd)

  assert.match(header, /background: 'var\(--surface\)'/)
  assert.match(header, /border: '1px solid var\(--border-subtle\)'/)
  assert.match(header, /color: 'var\(--text\)'/)
  assert.doesNotMatch(header, /tool\.accent/)
})
