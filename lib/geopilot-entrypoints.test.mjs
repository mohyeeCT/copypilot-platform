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
  assert.match(profile, /Consumer result sample, kept separate from API visibility/)
  assert.match(profile, /Google AI Overview/)
  assert.match(api, /chatgpt_calibration/)
})


test('GEOPilot only renders safe external evidence links', async () => {
  const profile = await readFile(new URL('../app/(app)/geopilot/profiles/[id]/page.tsx', import.meta.url), 'utf8')
  assert.match(profile, /function safeExternalUrl/)
  assert.match(profile, /url\.protocol === 'https:' \|\| url\.protocol === 'http:'/)
  assert.match(profile, /const href = safeExternalUrl\(url\)[\s\S]*if \(!href\) return null/)
})


test('GEOPilot lets users choose collection and one-time run surfaces', async () => {
  const profile = await readFile(new URL('../app/(app)/geopilot/profiles/[id]/page.tsx', import.meta.url), 'utf8')
  const collection = await readFile(new URL('../app/(app)/geopilot/profiles/[id]/collections/new/page.tsx', import.meta.url), 'utf8')
  const dialog = await readFile(new URL('../components/geopilot/RunSurfaceDialog.tsx', import.meta.url), 'utf8')
  const api = await readFile(new URL('./api/geopilot.ts', import.meta.url), 'utf8')
  assert.match(collection, /Tracked sources[\s\S]*SurfaceSelector/)
  assert.match(profile, /openRun\(collection\)[\s\S]*RunSurfaceDialog/)
  assert.match(profile, /PRIMARY_SURFACES[\s\S]*google_ai_overview[\s\S]*chatgpt[\s\S]*gemini[\s\S]*claude/)
  assert.match(profile, /surfaces:\s*collection\?\.surfaces\?\.length[\s\S]*ALL_GEOPILOT_SURFACES/)
  assert.match(dialog, /Include ChatGPT consumer calibration[\s\S]*Measurements/)
  assert.match(dialog, /target\.promptCount \* surfaces\.length \+ calibrationMeasurements/)
  assert.match(api, /surfaces:\s*options\.surfaces/)
  assert.match(api, /include_calibration:\s*options\.includeCalibration/)
})


test('GEOPilot profile deletion requires exact confirmation and warns about history', async () => {
  const edit = await readFile(new URL('../app/(app)/geopilot/profiles/[id]/edit/page.tsx', import.meta.url), 'utf8')
  assert.match(edit, /Delete profile/)
  assert.match(edit, /geopilotApi\.deleteProfile/)
  assert.match(edit, /deleteConfirmation !== initial\.name/)
  assert.match(edit, /collections, prompts, results, metrics, citations, and insights/)
  assert.match(edit, /ACTIVE_BATCH_STATUSES\.has\(profile\.latest_batch\.status\)/)
})
