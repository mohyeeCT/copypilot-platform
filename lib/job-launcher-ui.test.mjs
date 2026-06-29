import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(...parts) {
  return fs.readFileSync(path.join(root, ...parts), 'utf8')
}

const visibleNewJobPages = [
  ['meta', 'app', '(app)', 'meta', 'jobs', 'new', 'page.tsx'],
  ['faq', 'app', '(app)', 'faq', 'jobs', 'new', 'page.tsx'],
  ['intro', 'app', '(app)', 'intro', 'jobs', 'new', 'page.tsx'],
  ['all-in-one', 'app', '(app)', 'all-in-one', 'jobs', 'new', 'page.tsx'],
]

test('shared job launcher components exist with shell, sections, and summary', () => {
  const shell = read('components', 'ui', 'JobLauncher.tsx')
  assert.match(shell, /function JobLauncherShell/)
  assert.match(shell, /function JobSection/)
  assert.match(shell, /function JobSummaryBar/)
  assert.match(shell, /children/)
  assert.match(shell, /summaryItems/)
})

test('visible batch job pages use the shared single-page launcher layout', () => {
  for (const [name, ...parts] of visibleNewJobPages) {
    const source = read(...parts)
    assert.match(source, /JobLauncherShell/, `${name} should use JobLauncherShell`)
    assert.match(source, /JobSection/, `${name} should use JobSection`)
    assert.match(source, /JobSummaryBar/, `${name} should use JobSummaryBar`)
    assert.match(source, /Inputs/, `${name} should retain an Inputs section`)
    assert.match(source, /Configuration/, `${name} should retain a Configuration section`)
  }
})

test('visible batch job pages use the same wide inputs plus configuration layout', () => {
  for (const [name, ...parts] of visibleNewJobPages) {
    const source = read(...parts)
    assert.match(source, /max-w-full/, `${name} should use the wide workbench width`)
    assert.match(source, /grid grid-cols-7 gap-/, `${name} should use the split workbench grid`)
    assert.match(source, /col-span-5/, `${name} should reserve the wide left area for inputs`)
    assert.match(source, /col-span-2/, `${name} should reserve the right rail for configuration`)
  }
})

test('visible batch job pages keep primary run actions in the launcher header', () => {
  for (const [name, ...parts] of visibleNewJobPages) {
    const source = read(...parts)
    assert.match(source, /actions=\{/, `${name} should provide launcher header actions`)
    assert.match(source, /Run job|Generate Meta Copy|Run All in One/, `${name} should expose a run action`)
  }
})

test('safe launcher redesign keeps schema as a short single-page form', () => {
  const source = read('app', '(app)', 'schema', 'jobs', 'new', 'page.tsx')
  assert.doesNotMatch(source, /JobLauncherShell/)
  assert.match(source, /Schema Settings/)
  assert.match(source, /Generate Schema/)
})

test('safe launcher redesign does not modify hidden standalone page-copy form', () => {
  const source = read('app', '(app)', 'page-copy', 'jobs', 'new', 'page.tsx')
  assert.doesNotMatch(source, /JobLauncherShell/)
  assert.match(source, /Generate Page Copy/)
})
