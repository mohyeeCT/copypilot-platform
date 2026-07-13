import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'


test('GEOPilot UI preview is noindex and cannot call production services', async () => {
  const layout = await readFile(new URL('../app/ui-preview/layout.tsx', import.meta.url), 'utf8')
  const page = await readFile(new URL('../app/ui-preview/geopilot/page.tsx', import.meta.url), 'utf8')
  const preview = await readFile(new URL('../components/ui-preview/GeoPilotPreview.tsx', import.meta.url), 'utf8')

  assert.match(layout, /index:\s*false[\s\S]*follow:\s*false/)
  assert.match(page, /GeoPilotPreview/)
  assert.match(preview, /UI preview/)
  assert.match(preview, /Preview only:[\s\S]*measurements were not started/)
  assert.doesNotMatch(preview, /geopilotApi|createClient|fetch\s*\(/)
})
