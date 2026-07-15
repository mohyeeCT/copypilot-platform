import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('app shell uses a full-height docked workspace without outer card chrome', async () => {
  const source = await readFile(
    new URL('../components/layout/AppLayout.tsx', import.meta.url),
    'utf8',
  )
  const css = await readFile(
    new URL('../components/layout/AppLayout.module.css', import.meta.url),
    'utf8',
  )

  assert.match(source, /className=\{styles\.shell\}/)
  assert.match(css, /\.shell\s*\{[\s\S]*height:\s*100dvh[\s\S]*overflow:\s*hidden/)
  assert.match(css, /\.sidebarDock\s*\{[\s\S]*height:\s*100%/)
  assert.doesNotMatch(css, /\.shell\s*\{[^}]*padding:/)
  assert.doesNotMatch(css, /\.shell\s*\{[^}]*border-radius:/)
})

test('sidebar is docked on desktop and becomes an accessible mobile drawer', async () => {
  const source = await readFile(
    new URL('../components/layout/AppLayout.tsx', import.meta.url),
    'utf8',
  )
  const css = await readFile(
    new URL('../components/layout/AppLayout.module.css', import.meta.url),
    'utf8',
  )
  const sidebarCss = await readFile(
    new URL('../components/layout/Sidebar.module.css', import.meta.url),
    'utf8',
  )

  assert.match(sidebarCss, /\.sidebar\s*\{[\s\S]*width:\s*236px[\s\S]*background:\s*#121915/)
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.sidebarDock\s*\{[\s\S]*position:\s*fixed[\s\S]*translateX\(-100%\)/)
  assert.match(css, /\.sidebarDockOpen\s*\{[\s\S]*translateX\(0\)/)
  assert.match(source, /aria-label="Open navigation"/)
  assert.match(source, /aria-label="Close navigation"/)
})

test('sidebar wordmark keeps descenders clear of the logo row', async () => {
  const css = await readFile(
    new URL('../components/layout/Sidebar.module.css', import.meta.url),
    'utf8',
  )

  assert.match(css, /\.brandRow\s*\{[\s\S]*align-items:\s*center/)
  assert.match(css, /\.brandName\s*\{[\s\S]*line-height:\s*1\.4/)
  assert.doesNotMatch(css, /\.brandName\s*\{[^}]*line-height:\s*1;/)
})

test('sidebar nav labels avoid clipped descenders', async () => {
  const css = await readFile(
    new URL('../components/layout/Sidebar.module.css', import.meta.url),
    'utf8',
  )

  assert.match(css, /\.navItem\s*\{[\s\S]*line-height:\s*1\.3/)
  assert.doesNotMatch(css, /\.navItem\s*\{[^}]*line-height:\s*1;/)
})

test('sidebar submenus are opt-in, compact, and motion-safe', async () => {
  const source = await readFile(
    new URL('../components/layout/Sidebar.tsx', import.meta.url),
    'utf8',
  )
  const css = await readFile(
    new URL('../components/layout/Sidebar.module.css', import.meta.url),
    'utf8',
  )

  assert.equal((source.match(/\bsubmenu:\s*\[/g) ?? []).length, 2)
  assert.match(source, /href:\s*'\/brand-mentions'[\s\S]*href:\s*'\/brand-mentions\/new'/)
  assert.match(source, /href:\s*'\/geopilot'[\s\S]*href:\s*'\/geopilot\/new'/)
  assert.doesNotMatch(source, /href:\s*'\/geopilot\/runs'/)
  assert.match(source, /useState<string \| null>\(null\)/)
  assert.match(source, /aria-expanded=\{submenuOpen\}/)
  assert.match(source, /current === tool\.href \? null : tool\.href/)
  assert.match(source, /compactSubmenu[\s\S]*createPortal/)
  assert.match(css, /\.submenu\s*\{[\s\S]*grid-template-rows:\s*0fr/)
  assert.match(css, /\.submenuOpen\s*\{[\s\S]*grid-template-rows:\s*1fr/)
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/)
})

test('sidebar workspace label is personalized from the signed-in account', async () => {
  const source = await readFile(
    new URL('../components/layout/Sidebar.tsx', import.meta.url),
    'utf8',
  )

  assert.match(source, /function getWorkspaceLabel\(name: string, email: string\)/)
  assert.match(source, /source\.split\(\/\[\\s\._\+\-\]\+\//)
  assert.match(source, /return `\$\{displayName\}'s Workspace`/)
  assert.match(source, /const workspaceLabel = getWorkspaceLabel\(accountName, accountEmail\)/)
  assert.match(source, /title=\{collapsed \? workspaceLabel : undefined\}/)
  assert.match(source, /<strong>\{workspaceLabel\}<\/strong>/)
  assert.match(source, /if \(!firstName\) return 'My Workspace'/)
  assert.doesNotMatch(source, /<strong>Agency workspace<\/strong>/)
})
