import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sharedSrc = () => readFile(new URL('./api/shared.ts', import.meta.url), 'utf8')

// Attempt to import the module for behavioral contract tests.
// Node 24 + --experimental-strip-types strips type annotations from .ts files,
// leaving valid JS. global fetch is available in Node 18+.
let sharedModule = null
let importError = null
try {
  sharedModule = await import(new URL('./api/shared.ts', import.meta.url))
} catch (e) {
  importError = e
}

if (sharedModule) {
  function mockFetch(response) {
    const original = globalThis.fetch
    const calls = []
    globalThis.fetch = async (url, opts) => {
      calls.push({
        url: String(url),
        method: opts?.method ?? 'GET',
        headers: opts?.headers ?? {},
        body: opts?.body,
      })
      return { ok: true, json: async () => response }
    }
    return { calls, restore: () => { globalThis.fetch = original } }
  }

  test('startGscOAuth POSTs to /api/settings/gsc/oauth/start with Authorization and activate_on_success body', async () => {
    const { calls, restore } = mockFetch({ authorization_url: 'https://accounts.google.com/oauth' })
    try {
      const result = await sharedModule.startGscOAuth('tok-abc', true)
      assert.equal(calls.length, 1, 'expected exactly one fetch call')
      assert.ok(calls[0].url.endsWith('/api/settings/gsc/oauth/start'), `unexpected URL: ${calls[0].url}`)
      assert.equal(calls[0].method, 'POST')
      assert.equal(calls[0].headers['Authorization'], 'Bearer tok-abc')
      assert.deepEqual(JSON.parse(calls[0].body), { activate_on_success: true })
      assert.equal(result.authorization_url, 'https://accounts.google.com/oauth')
    } finally {
      restore()
    }
  })

  test('listGscProperties GETs /api/settings/gsc/oauth/properties with Authorization header', async () => {
    const props = [{ site_url: 'sc-domain:example.com', permission_level: 'siteOwner' }]
    const { calls, restore } = mockFetch({ properties: props })
    try {
      const result = await sharedModule.listGscProperties('tok-def')
      assert.equal(calls.length, 1)
      assert.ok(calls[0].url.endsWith('/api/settings/gsc/oauth/properties'), `unexpected URL: ${calls[0].url}`)
      assert.equal(calls[0].method, 'GET')
      assert.equal(calls[0].headers['Authorization'], 'Bearer tok-def')
      assert.deepEqual(result.properties, props)
    } finally {
      restore()
    }
  })

  test('disconnectGscOAuth DELETEs /api/settings/gsc/oauth (not bare /gsc) with Authorization header', async () => {
    const { calls, restore } = mockFetch({})
    try {
      await sharedModule.disconnectGscOAuth('tok-ghi')
      assert.equal(calls.length, 1)
      assert.ok(calls[0].url.endsWith('/api/settings/gsc/oauth'), `unexpected URL: ${calls[0].url}`)
      assert.ok(!calls[0].url.endsWith('/api/settings/gsc'), 'must target /oauth sub-path, not bare /gsc')
      assert.equal(calls[0].method, 'DELETE')
      assert.equal(calls[0].headers['Authorization'], 'Bearer tok-ghi')
    } finally {
      restore()
    }
  })

  test('setGscAuthMethod PUTs /api/settings/gsc/method with { method } body and Authorization header', async () => {
    const { calls, restore } = mockFetch({})
    try {
      await sharedModule.setGscAuthMethod('tok-jkl', 'google_oauth')
      assert.equal(calls.length, 1)
      assert.ok(calls[0].url.endsWith('/api/settings/gsc/method'), `unexpected URL: ${calls[0].url}`)
      assert.equal(calls[0].method, 'PUT')
      assert.equal(calls[0].headers['Authorization'], 'Bearer tok-jkl')
      assert.deepEqual(JSON.parse(calls[0].body), { method: 'google_oauth' })
    } finally {
      restore()
    }
  })
} else {
  test('sharedModule import evidence (import was blocked)', () => {
    assert.fail(`import of lib/api/shared.ts was blocked: ${importError?.message ?? 'unknown'}`)
  })
}

// Static type-level checks — TypeScript types are erased at runtime and
// cannot be verified via module import; source scanning is the only option.
test('shared API defines GscSettings type with active_method, service_account, and google_oauth', async () => {
  const source = await sharedSrc()
  assert.match(source, /GscSettings/)
  assert.match(source, /active_method/)
  assert.match(source, /google_oauth/)
  assert.match(source, /oauth_available/)
})

test('shared API defines GscAuthMethod union type', async () => {
  const source = await sharedSrc()
  assert.match(source, /GscAuthMethod/)
  assert.match(source, /service_account/)
  assert.match(source, /google_oauth/)
})

test('shared API defines GscProperty type with site_url and permission_level', async () => {
  const source = await sharedSrc()
  assert.match(source, /GscProperty/)
  assert.match(source, /site_url/)
  assert.match(source, /permission_level/)
})
