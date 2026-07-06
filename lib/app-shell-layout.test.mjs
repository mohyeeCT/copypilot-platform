import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('app shell removes outer spacing only for docked desktop layout', async () => {
  const source = await readFile(
    new URL('../components/layout/AppLayout.tsx', import.meta.url),
    'utf8',
  )

  assert.match(source, /className="flex gap-2\.5 p-3 md:gap-0 md:p-0"/)
  assert.doesNotMatch(source, /padding: '12px'/)
  assert.doesNotMatch(source, /gap: '10px'/)
})

test('sidebar keeps mobile drawer chrome and flattens desktop docked chrome', async () => {
  const source = await readFile(
    new URL('../components/layout/Sidebar.tsx', import.meta.url),
    'utf8',
  )
  const asideStart = source.indexOf('<aside')
  const logoStart = source.indexOf('{/* Logo */}')
  assert.notEqual(asideStart, -1)
  assert.notEqual(logoStart, -1)
  const aside = source.slice(asideStart, logoStart)

  assert.match(aside, /rounded-2xl/)
  assert.match(aside, /shadow-\[0_2px_8px_rgba\(0,0,0,0\.08\),0_8px_32px_rgba\(0,0,0,0\.10\)\]/)
  assert.match(aside, /md:rounded-none/)
  assert.match(aside, /md:shadow-none/)
  assert.match(aside, /md:border-0/)
  assert.match(aside, /md:border-r/)
  assert.match(aside, /md:border-r-\[var\(--border\)\]/)
  assert.doesNotMatch(aside, /borderRadius: 16/)
  assert.doesNotMatch(aside, /boxShadow: '0 2px 8px/)
})
