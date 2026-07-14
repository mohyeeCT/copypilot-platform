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
  const methods = await readFile(new URL('./geopilot-methods.ts', import.meta.url), 'utf8')
  assert.match(overview, /New Profile/)
  assert.match(profile, /Overview[\s\S]*Prompts[\s\S]*Results[\s\S]*Opportunities/)
  assert.match(collection, /Suggest with Parallel/)
  assert.match(result, /surfaceLabel\(run\.surface\)/)
  assert.match(methods, /google_ai_overview[\s\S]*Google AI Overview/)
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
  const result = await readFile(new URL('../app/(app)/geopilot/runs/[id]/page.tsx', import.meta.url), 'utf8')
  assert.match(profile, /function safeExternalUrl/)
  assert.match(profile, /url\.protocol === 'https:' \|\| url\.protocol === 'http:'/)
  assert.match(profile, /const href = safeExternalUrl\(url\)[\s\S]*if \(!href\) return null/)
  assert.match(result, /const href = safeExternalUrl\(citation\.url\)[\s\S]*href \? \(/)
})


test('GEOPilot lets users choose collection and one-time run surfaces', async () => {
  const profile = await readFile(new URL('../app/(app)/geopilot/profiles/[id]/page.tsx', import.meta.url), 'utf8')
  const collection = await readFile(new URL('../app/(app)/geopilot/profiles/[id]/collections/new/page.tsx', import.meta.url), 'utf8')
  const dialog = await readFile(new URL('../components/geopilot/RunSurfaceDialog.tsx', import.meta.url), 'utf8')
  const collectionMethods = await readFile(new URL('../components/geopilot/CollectionMethodSelector.tsx', import.meta.url), 'utf8')
  const api = await readFile(new URL('./api/geopilot.ts', import.meta.url), 'utf8')
  assert.match(collection, /Tracked sources[\s\S]*SurfaceSelector/)
  assert.match(collection, /CollectionMethodSelector/)
  assert.match(collection, /schedule === 'daily'[\s\S]*buildMeasurementMethods/)
  assert.match(profile, /openRun\(collection\)[\s\S]*RunSurfaceDialog/)
  assert.match(profile, /defaultMeasurementMethods:[\s\S]*collection\.measurement_methods/)
  assert.match(profile, /CollectionMethodSelector/)
  assert.match(profile, /PRIMARY_SURFACES[\s\S]*google_ai_overview[\s\S]*chatgpt[\s\S]*gemini[\s\S]*claude/)
  assert.match(profile, /targetSurfaces = collection\?\.surfaces\?\.length[\s\S]*ALL_GEOPILOT_SURFACES/)
  assert.match(dialog, /Include ChatGPT consumer calibration[\s\S]*Measurements/)
  assert.match(dialog, /API[\s\S]*Consumer UI[\s\S]*Both/)
  assert.match(dialog, /runModeForMeasurementMethods\('chatgpt', target\.defaultMeasurementMethods\)/)
  assert.match(collectionMethods, /Daily schedule: API collection only during the pilot/)
  assert.match(collectionMethods, /RUN_MODES[\s\S]*'api'[\s\S]*'consumer_ui'[\s\S]*'both'/)
  assert.match(collectionMethods, /collectionRunModeLabel\(mode\)/)
  assert.match(dialog, /target\.promptCount \* methodCount \+ calibrationMeasurements/)
  assert.match(api, /surfaces:\s*options\.surfaces/)
  assert.match(api, /measurement_methods:\s*GeoPilotMeasurementMethods/)
  assert.match(api, /measurement_methods:\s*options\.measurementMethods/)
  assert.match(api, /include_calibration:\s*options\.includeCalibration/)
})

test('GEOPilot keeps API and Consumer UI reporting separate', async () => {
  const profile = await readFile(new URL('../app/(app)/geopilot/profiles/[id]/page.tsx', import.meta.url), 'utf8')
  const result = await readFile(new URL('../app/(app)/geopilot/runs/[id]/page.tsx', import.meta.url), 'utf8')
  const api = await readFile(new URL('./api/geopilot.ts', import.meta.url), 'utf8')
  const css = await readFile(new URL('../components/geopilot/GeoPilotProfile.module.css', import.meta.url), 'utf8')

  assert.match(profile, /API vs Consumer UI/)
  assert.match(profile, /Consumer UI measurements remain separate from the primary API visibility score/)
  assert.match(profile, /collectionMethod[\s\S]*setCollectionMethod/)
  assert.match(profile, /costs\.by_method/)
  assert.match(result, /Measurement provenance/)
  assert.match(result, /observed_model/)
  assert.match(api, /collection_method=/)
  assert.match(css, /\.methodComparisonTable \.surfaceLabel\s*\{[\s\S]*display:\s*inline/)
  assert.match(css, /\.sheetPrompt \.surfaceLabel\s*\{[\s\S]*display:\s*inline/)
})


test('GEOPilot profile deletion requires exact confirmation and warns about history', async () => {
  const edit = await readFile(new URL('../app/(app)/geopilot/profiles/[id]/edit/page.tsx', import.meta.url), 'utf8')
  assert.match(edit, /Delete profile/)
  assert.match(edit, /geopilotApi\.deleteProfile/)
  assert.match(edit, /deleteConfirmation !== initial\.name/)
  assert.match(edit, /collections, prompts, results, metrics, citations, and insights/)
  assert.match(edit, /ACTIVE_BATCH_STATUSES\.has\(profile\.latest_batch\.status\)/)
})


test('GEOPilot measurement prompts open the result preview drawer without leaving the profile', async () => {
  const profile = await readFile(new URL('../app/(app)/geopilot/profiles/[id]/page.tsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('../components/geopilot/GeoPilotProfile.module.css', import.meta.url), 'utf8')

  assert.match(profile, /function ResultDrawer/)
  assert.match(profile, /className=\{clsx\(styles\.dialog, styles\.sheetDialog\)\}/)
  assert.match(profile, /geopilotApi\.getRun\(accessToken, run\.id\)/)
  assert.match(profile, /<button type="button" className=\{styles\.promptButton\} onClick=\{\(\) => onInspect\(run\)\}>/)
  assert.match(profile, /<button type="button" className=\{styles\.rowAction\}[^>]*onClick=\{\(\) => onInspect\(run\)\}>/)
  assert.match(profile, /View full result/)
  assert.match(profile, /onCancel=\{event => \{[\s\S]*event\.preventDefault\(\)[\s\S]*onClose\(\)/)
  assert.doesNotMatch(profile, /<Link href=\{`\/geopilot\/runs\/\$\{run\.id\}`\} className=\{styles\.promptButton\}>/)
  assert.match(css, /\.sheetDialog\s*\{[\s\S]*height:\s*100dvh/)
  assert.match(css, /\.resultSheet\s*\{[\s\S]*flex-direction:\s*column/)
  assert.match(css, /\.sheetSectionTitle button,\s*\n\.sheetSectionTitle a/)
})

test('GEOPilot exposes provider spend estimates and collection budgets', async () => {
  const api = await readFile(new URL('./api/geopilot.ts', import.meta.url), 'utf8')
  const profile = await readFile(new URL('../app/(app)/geopilot/profiles/[id]/page.tsx', import.meta.url), 'utf8')
  const collection = await readFile(new URL('../app/(app)/geopilot/profiles/[id]/collections/new/page.tsx', import.meta.url), 'utf8')
  const runDialog = await readFile(new URL('../components/geopilot/RunSurfaceDialog.tsx', import.meta.url), 'utf8')

  assert.match(api, /\/profiles\/\$\{profileId\}\/costs\?days=/)
  assert.match(profile, /Cost control/)
  assert.match(profile, /Provider cost/)
  assert.match(profile, /geopilotApi\.costs[\s\S]*\.catch\(\(\) =>/)
  assert.match(profile, /Cost data is temporarily unavailable/)
  assert.match(collection, /Monthly budget \(USD\)/)
  assert.match(runDialog, /Estimated provider cost/)
  assert.match(runDialog, /No recorded or published price/)
})

test('GEOPilot explains failed measurements and supports repeatable batch and row retries', async () => {
  const profile = await readFile(new URL('../app/(app)/geopilot/profiles/[id]/page.tsx', import.meta.url), 'utf8')
  const api = await readFile(new URL('./api/geopilot.ts', import.meta.url), 'utf8')

  assert.match(api, /retryFailedBatch:[\s\S]*\/batches\/\$\{id\}\/retry-failed/)
  assert.match(api, /retryFailedRun:[\s\S]*\/runs\/\$\{id\}\/retry/)
  assert.match(profile, /Measurement failed[\s\S]*run\.error[\s\S]*Provider attempts:[\s\S]*run\.attempt_count/)
  assert.match(profile, /geopilotApi\.retryFailedBatch\(accessToken, batchId\)/)
  assert.match(profile, /geopilotApi\.retryFailedRun\(accessToken, run\.id\)/)
  assert.match(profile, /Retry failed \(\$\{batch\.failed_runs\}\)/)
  assert.match(profile, /Retry again \(\$\{batch\.failed_runs\}\)/)
  assert.match(profile, /Retry measurement/)
  assert.match(profile, /aria-label="Retry failed measurement"/)
  assert.match(profile, /disabled=\{Boolean\(activeBatch\) \|\| Boolean\(action\)\}/)
})

test('GEOPilot current dashboard and latest table use the newest measurement state', async () => {
  const profile = await readFile(new URL('../app/(app)/geopilot/profiles/[id]/page.tsx', import.meta.url), 'utf8')

  assert.match(profile, /function latestMeasurementRuns/)
  assert.match(profile, /dashboard\.display_surfaces \|\| dashboard\.surfaces/)
  assert.match(profile, /display_overall_visibility \?\? dashboard\.overall_visibility/)
  assert.match(profile, /latest measured method/)
  assert.match(profile, /filteredLatestRuns\.slice\(0, 8\)/)
  assert.match(profile, /All results[\s\S]*Mentioned[\s\S]*Not found[\s\S]*Failed/)
  assert.match(profile, /matchesOutcome\(run, outcome\)/)
})

test('GEOPilot dashboard metrics and surfaces drive one interactive analysis view', async () => {
  const profile = await readFile(new URL('../app/(app)/geopilot/profiles/[id]/page.tsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('../components/geopilot/GeoPilotProfile.module.css', import.meta.url), 'utf8')

  assert.match(profile, /function MetricTrendChart/)
  assert.match(profile, /aria-label=\{`Show \$\{item\.label\} trend`\}/)
  assert.match(profile, /onClick=\{\(\) => toggleDashboardSurface\(key\)\}/)
  assert.match(profile, /setSurface=\{selectDashboardSurface\}/)
  assert.match(profile, /Consumer UI/)
  assert.match(profile, /onPointerMove=/)
  assert.match(profile, /event\.key === 'ArrowLeft' \|\| event\.key === 'ArrowRight'/)
  assert.match(profile, /Owned citation coverage/)
  assert.match(css, /\.metricItemActive/)
  assert.match(css, /\.surfaceMetricActive/)
  assert.match(css, /\.chartTooltip/)
})
