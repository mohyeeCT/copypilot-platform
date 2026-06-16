import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('standalone Page Copy is hidden from primary user entry points', async () => {
  const entryPoints = [
    '../components/layout/Sidebar.tsx',
    '../app/home/page.tsx',
    '../app/(public)/login/page.tsx',
  ]

  for (const entryPoint of entryPoints) {
    const source = await readFile(new URL(entryPoint, import.meta.url), 'utf8')

    assert.doesNotMatch(source, /href:\s*['"]\/page-copy\/jobs['"]/)
    assert.doesNotMatch(source, /label:\s*['"]Page Copy['"]/)
    assert.doesNotMatch(source, /name:\s*['"]Page Copy['"]/)
  }
})

test('standalone Page Copy routes remain available for existing jobs and links', async () => {
  const source = await readFile(
    new URL('../lib/cancellation-polling.test.mjs', import.meta.url),
    'utf8',
  )

  assert.match(source, /'page-copy'/)
})
