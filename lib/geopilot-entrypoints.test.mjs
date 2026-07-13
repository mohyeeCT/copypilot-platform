import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'


test('GEOPilot is integrated as a CopyPilot insight', async () => {
  const sidebar = await readFile(new URL('../components/layout/Sidebar.tsx', import.meta.url), 'utf8')
  const settings = await readFile(new URL('../app/(app)/settings/page.tsx', import.meta.url), 'utf8')
  const api = await readFile(new URL('./api/geopilot.ts', import.meta.url), 'utf8')
  assert.match(sidebar, /href:\s*'\/geopilot'[\s\S]*label:\s*'GEOPilot'/)
  assert.match(settings, /GEOPilot[\s\S]*geopilot-backend-production\.up\.railway\.app/)
  assert.match(api, /NEXT_PUBLIC_GEOPILOT_API_URL/)
  assert.match(api, /\/api\/geopilot\/profiles/)
})


test('GEOPilot exposes profiles collections results and opportunities', async () => {
  const overview = await readFile(new URL('../app/(app)/geopilot/page.tsx', import.meta.url), 'utf8')
  const profile = await readFile(new URL('../app/(app)/geopilot/profiles/[id]/page.tsx', import.meta.url), 'utf8')
  const collection = await readFile(new URL('../app/(app)/geopilot/profiles/[id]/collections/new/page.tsx', import.meta.url), 'utf8')
  const result = await readFile(new URL('../app/(app)/geopilot/runs/[id]/page.tsx', import.meta.url), 'utf8')
  assert.match(overview, /New Profile/)
  assert.match(profile, /Overview[\s\S]*Prompts[\s\S]*Results[\s\S]*Opportunities/)
  assert.match(collection, /Suggest with Parallel/)
  assert.match(result, /Google AI Overview/)
})


test('GEOPilot keeps calibration and Google AI Overview methodology distinct', async () => {
  const profile = await readFile(new URL('../app/(app)/geopilot/profiles/[id]/page.tsx', import.meta.url), 'utf8')
  const api = await readFile(new URL('./api/geopilot.ts', import.meta.url), 'utf8')
  assert.match(profile, /Consumer-result calibration stays separate from API visibility/)
  assert.match(profile, /Google AI Overview/)
  assert.match(api, /chatgpt_calibration/)
})

