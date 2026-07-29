import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'


const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const page = fs.readFileSync(
  path.join(root, 'app', '(public)', 'accept-invite', 'page.tsx'),
  'utf8',
)
const supabase = fs.readFileSync(path.join(root, 'lib', 'supabase.ts'), 'utf8')

test('invite acceptance keeps tokens in the browser and clears the fragment', () => {
  assert.match(page, /supabase\.auth\.setSession/)
  assert.match(page, /window\.history\.replaceState/)
  assert.doesNotMatch(page, /fetch\(/)
})

test('invite acceptance requires a strong confirmed password', () => {
  assert.match(page, /MINIMUM_PASSWORD_LENGTH = 12/)
  assert.match(page, /password !== confirmation/)
  assert.match(page, /supabase\.auth\.updateUser\(\{ password \}\)/)
})

test('successful activation routes only to the hidden AIO v2 workspace', () => {
  assert.match(page, /router\.replace\('\/all-in-one-v2\/jobs'\)/)
  assert.doesNotMatch(page, /all-in-one\/jobs/)
})

test('missing public auth configuration fails closed for invite methods', () => {
  assert.match(supabase, /setSession: async \(\) =>/)
  assert.match(supabase, /updateUser: async \(\) =>/)
})
