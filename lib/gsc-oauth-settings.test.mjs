import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const settingsSrc = () =>
  readFile(new URL('../app/(app)/settings/page.tsx', import.meta.url), 'utf8')

// ── Existing tests (preserved) ───────────────────────────────────────────────

test('settings page renders a Google account section', async () => {
  const source = await settingsSrc()
  assert.match(source, /Google account/)
  assert.match(source, /Connected as/)
})

test('settings page uses explicit gscSettings state instead of single gscConfigured boolean', async () => {
  const source = await settingsSrc()
  assert.match(source, /gscSettings/)
  assert.doesNotMatch(source, /setGscConfigured/)
})

test('settings page calls startGscOAuth for the Google Connect action', async () => {
  const source = await settingsSrc()
  assert.match(source, /startGscOAuth/)
})

test('settings page validates authorization_url is https and accounts.google.com before redirecting', async () => {
  const source = await settingsSrc()
  assert.match(source, /accounts\.google\.com/)
  assert.match(source, /https:/)
  assert.match(source, /authorization_url/)
})

test('settings page calls disconnectGscOAuth for Google disconnect', async () => {
  const source = await settingsSrc()
  assert.match(source, /disconnectGscOAuth/)
})

test('settings page calls setGscAuthMethod for method switching', async () => {
  const source = await settingsSrc()
  assert.match(source, /setGscAuthMethod/)
})

test('settings page handles GSC callback status from URL with fixed message allowlist', async () => {
  const source = await settingsSrc()
  assert.match(source, /state_invalid/)
  assert.match(source, /token_failed/)
  assert.match(source, /identity_failed/)
  assert.match(source, /Google account connection failed/)
  assert.match(source, /gscStatus === 'connected'/)
  assert.match(source, /loadGscSettings\(\)/)
  assert.match(source, /replaceState/)
})

test('settings page renders Use Google account and Use service account method buttons', async () => {
  const source = await settingsSrc()
  assert.match(source, /Use Google account/)
  assert.match(source, /Use service account/)
})

test('settings page explains Indexer can use Google OAuth while service account remains available', async () => {
  const source = await settingsSrc()
  assert.match(source, /Google OAuth is preferred for Search Console copy tools and Indexer/)
  assert.match(source, /Service account support remains available/)
})

test('settings page presents Google OAuth as preferred while keeping service account available', async () => {
  const source = await settingsSrc()
  assert.match(source, /Preferred for Search Console, Indexer submissions, Google exports, and GEOPilot Analytics attribution/i)
  assert.match(source, /Service account support remains available/i)
})

test('settings page explains Google OAuth connection states clearly', async () => {
  const source = await settingsSrc()
  assert.match(source, /gscStatusText/)
  assert.match(source, /Ready for Search Console, Indexer, Google exports, and GEOPilot Analytics attribution/)
  assert.match(source, /Reconnect to enable Indexer submissions/)
  assert.match(source, /Reconnect to restore Search Console data/)
  assert.match(source, /Connect Google to use Search Console data/)
})

test('settings page loads GSC properties via listGscProperties on demand', async () => {
  const source = await settingsSrc()
  assert.match(source, /listGscProperties/)
  assert.match(source, /View accessible properties/)
})

test('settings page can collapse accessible Search Console properties', async () => {
  const source = await settingsSrc()
  assert.match(source, /gscPropertiesExpanded/)
  assert.match(source, /Hide accessible properties/)
})

test('settings page does not use a custom Search Console icon helper', async () => {
  const source = await settingsSrc()
  assert.doesNotMatch(source, /function SearchConsoleIcon/)
  assert.doesNotMatch(source, /SearchConsoleIcon/)
  assert.doesNotMatch(source, /<svg/)
})

test('settings page still calls deleteGscAccount for service account removal', async () => {
  const source = await settingsSrc()
  assert.match(source, /deleteGscAccount/)
})

test('settings page uses compatibility mapping from data.gsc_service_account for older backends', async () => {
  const source = await settingsSrc()
  assert.match(source, /gsc_service_account/)
  assert.match(source, /data\.gsc/)
})

test('settings page does not display raw provider error text to the user', async () => {
  const source = await settingsSrc()
  assert.doesNotMatch(source, /params\.get\(['"]gsc['"]\)[^}]*\{[^}]*\}[^}]*setGscMessage\(gscStatus\)/)
})

// ── Regression tests for Phase 3 fixes (RED before implementation) ────────────

// Fix 1: handleConnectGoogle must clear gscBusy on missing session
test('handleConnectGoogle clears gscBusy when session is absent (no bare if-return)', async () => {
  const source = await settingsSrc()
  // Current bug: `if (!session) return` inside handleConnectGoogle has no finally/clear
  // After fix: `if (!session) { setGscBusy(null); return }` — plain bare return gone
  assert.doesNotMatch(
    source,
    /setGscBusy\('connect'\)[\s\S]{0,600}if \(!session\) return/
  )
})

// Fix 2: handleDelete must call loadGscSettings after successful deletion
test('handleDelete calls loadGscSettings after deleteGscAccount', async () => {
  const source = await settingsSrc()
  assert.match(
    source,
    /await deleteGscAccount[\s\S]{0,300}await loadGscSettings/
  )
})

test('handleDelete shows a fixed refresh-failure message, not a deletion-failure message', async () => {
  const source = await settingsSrc()
  // After fix there must be a message for the case where deletion succeeded but refresh failed
  assert.match(source, /Could not refresh settings|refresh — please reload/i)
})

// Fix 3: disconnect and settings refresh must be in separate try blocks
test('handleDisconnectGoogle has a dedicated refresh-failure message separate from disconnect failure', async () => {
  const source = await settingsSrc()
  // After fix: separate message for "disconnected but refresh failed"
  assert.match(source, /disconnected[\s\S]{0,120}Could not refresh|Google account disconnected[\s\S]{0,120}reload/i)
})

// Fix 4: service-account Remove button must also be disabled while gscBusy is set
test('service account Remove button is disabled when gscBusy is set', async () => {
  const source = await settingsSrc()
  // After fix: the Remove button's disabled prop references gscBusy
  assert.match(
    source,
    /onClick=\{handleDelete\}[\s\S]{0,200}disabled=\{[^}]*gscBusy/
  )
})

// Fix 5: shared GSC feedback area with accessibility attribute
test('GSC feedback area uses role="status" or aria-live for accessibility', async () => {
  const source = await settingsSrc()
  assert.match(source, /role="status"|aria-live=["']polite["']/)
})

test('GSC feedback area tracks error vs success for conditional styling (gscIsError)', async () => {
  const source = await settingsSrc()
  assert.match(source, /gscIsError/)
})

// Fix 6: URL cleanup must preserve other query params and hash
test('GSC callback URL cleanup removes only the gsc param via URLSearchParams.delete', async () => {
  const source = await settingsSrc()
  // Must use .delete('gsc') not strip everything with pathname-only replaceState
  assert.match(source, /\.delete\(['"]gsc['"]\)/)
})

test('GSC callback URL cleanup does not erase all query params by replacing with bare pathname', async () => {
  const source = await settingsSrc()
  // The old one-liner replaced with just window.location.pathname, losing all other params
  assert.doesNotMatch(
    source,
    /replaceState\(\{\},\s*['"]['"]\s*,\s*window\.location\.pathname\s*\)/
  )
})
