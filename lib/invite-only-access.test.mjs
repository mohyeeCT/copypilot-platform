import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('signup page is message-only and cannot create accounts', async () => {
  const source = await readFile(
    new URL('../app/(public)/signup/page.tsx', import.meta.url),
    'utf8',
  )

  assert.doesNotMatch(source, /auth\.signUp/)
  assert.doesNotMatch(source, /<form/)
  assert.match(source, /Invite-only access/)
  assert.match(source, /Back to sign in/)
})

test('homepage does not advertise public registration', async () => {
  const source = await readFile(new URL('../app/home/page.tsx', import.meta.url), 'utf8')

  assert.doesNotMatch(source, />Sign up</)
  assert.doesNotMatch(source, /Try FAQ Copy free/)
  assert.doesNotMatch(source, /Get started/)
  assert.doesNotMatch(source, /free to try/)
})
