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
  assert.match(header, /borderRadius: 'var\(--radius-icon\)'/)
  assert.doesNotMatch(header, /tool\.accent/)
})

test('shared jobs list stat and empty-state icons use neutral tiles', async () => {
  const source = await readFile(
    new URL('../components/ui/JobsListPage.tsx', import.meta.url),
    'utf8',
  )
  const emptyStart = source.indexOf('/* Empty state */')
  const emptyEnd = source.indexOf('/* Jobs list */')
  const statsStart = source.indexOf('grid grid-cols-1 gap-3 mb-4')
  const statsEnd = source.indexOf('<div className="card overflow-hidden">')
  assert.notEqual(emptyStart, -1)
  assert.notEqual(emptyEnd, -1)
  assert.notEqual(statsStart, -1)
  assert.notEqual(statsEnd, -1)
  const iconAreas = [source.slice(emptyStart, emptyEnd), source.slice(statsStart, statsEnd)].join('\n')

  assert.match(iconAreas, /background: 'var\(--surface\)'/)
  assert.match(iconAreas, /border: '1px solid var\(--border-subtle\)'/)
  assert.match(iconAreas, /color: 'var\(--text\)'/)
  assert.match(iconAreas, /borderRadius: 'var\(--radius-icon\)'/)
  assert.doesNotMatch(iconAreas, /tool\.accent/)
})
