import assert from 'node:assert/strict'
import test from 'node:test'

import nextConfig from '../next.config.js'

test('all frontend routes receive the Phase 1 security headers', async () => {
  const rules = await nextConfig.headers()
  const allRoutes = rules.find(rule => rule.source === '/:path*')

  assert.ok(allRoutes)

  const headers = Object.fromEntries(allRoutes.headers.map(header => [header.key, header.value]))

  assert.equal(headers['X-Frame-Options'], 'DENY')
  assert.equal(headers['X-Content-Type-Options'], 'nosniff')
  assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin')
  assert.match(headers['Permissions-Policy'], /camera=\(\)/)
  assert.match(headers['Permissions-Policy'], /microphone=\(\)/)
  assert.match(headers['Permissions-Policy'], /geolocation=\(\)/)
  assert.equal(headers['Strict-Transport-Security'], undefined)
})

test('CSP remains report-only and permits only traced application resources', async () => {
  const rules = await nextConfig.headers()
  const headers = Object.fromEntries(rules[0].headers.map(header => [header.key, header.value]))
  const policy = headers['Content-Security-Policy-Report-Only']

  assert.ok(policy)
  assert.equal(headers['Content-Security-Policy'], undefined)
  assert.match(policy, /frame-ancestors 'none'/)
  assert.match(policy, /object-src 'none'/)
  assert.match(policy, /script-src 'self' 'unsafe-inline'/)
  assert.match(policy, /style-src 'self' 'unsafe-inline' https:\/\/fonts\.googleapis\.com/)
  assert.match(policy, /font-src 'self' data: https:\/\/fonts\.gstatic\.com/)
  assert.match(policy, /https:\/\/\*\.supabase\.co/)
  assert.match(policy, /wss:\/\/\*\.supabase\.co/)
  assert.match(policy, /https:\/\/\*\.railway\.app/)
})
