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
