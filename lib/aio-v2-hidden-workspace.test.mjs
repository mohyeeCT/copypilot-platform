import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const workspaceUrl = new URL('../components/aio-v2/AioV2PlanWorkspace.tsx', import.meta.url)
const resultsUrl = new URL('../components/aio-v2/AioV2ResultsWorkspace.tsx', import.meta.url)
const jobsUrl = new URL('../components/aio-v2/AioV2JobsWorkspace.tsx', import.meta.url)
const newJobUrl = new URL('../components/aio-v2/AioV2NewJobWorkspace.tsx', import.meta.url)
const lifecycleUrl = new URL('../components/aio-v2/AioV2JobLifecyclePanel.tsx', import.meta.url)
const apiUrl = new URL('../lib/api/aio-v2.ts', import.meta.url)
const routeUrl = new URL('../app/(app)/all-in-one-v2/jobs/[id]/page.tsx', import.meta.url)
const jobsRouteUrl = new URL('../app/(app)/all-in-one-v2/jobs/page.tsx', import.meta.url)
const newJobRouteUrl = new URL('../app/(app)/all-in-one-v2/jobs/new/page.tsx', import.meta.url)
const sidebarUrl = new URL('../components/layout/Sidebar.tsx', import.meta.url)

test('AIO v2 planning route stays hidden and uses an async Next 15 route parameter', async () => {
  const [route, sidebar] = await Promise.all([
    readFile(routeUrl, 'utf8'),
    readFile(sidebarUrl, 'utf8'),
  ])

  assert.match(route, /params:\s*Promise<\{ id: string \}>/)
  assert.match(route, /await params/)
  assert.doesNotMatch(sidebar, /\/all-in-one-v2/)
})

test('AIO v2 workspace checks entitlement before requesting job-scoped data', async () => {
  const source = await readFile(workspaceUrl, 'utf8')
  const accessIndex = source.indexOf('aioV2Api.getAccess(authToken)')
  const sourcesIndex = source.indexOf('aioV2Api.getSources(authToken, jobId)')

  assert.ok(accessIndex > -1)
  assert.ok(sourcesIndex > accessIndex)
  assert.match(source, /if \(!access\.enabled\)/)
  assert.match(source, /named beta entitlement/)
})

test('AIO v2 revisions use a retryable idempotency key and never submit removal approval', async () => {
  const [source, api] = await Promise.all([
    readFile(workspaceUrl, 'utf8'),
    readFile(apiUrl, 'utf8'),
  ])

  assert.match(source, /revisionKey \|\| `aio-v2-plan-revision:\$\{window\.crypto\.randomUUID\(\)\}`/)
  assert.match(api, /'Idempotency-Key': idempotencyKey/)
  assert.match(api, /body: JSON\.stringify\(\{ sections \}\)/)
  const revisionContract = api.match(/export type AioV2SectionRevision = Pick<[\s\S]*?\n>/)?.[0] || ''
  assert.doesNotMatch(revisionContract, /approved_removal/)
  assert.doesNotMatch(source, /approved_removal:\s*(?:true|false)/)
})

test('AIO v2 approval submits only exact removal acknowledgements with a retry-stable key', async () => {
  const [source, api] = await Promise.all([
    readFile(workspaceUrl, 'utf8'),
    readFile(apiUrl, 'utf8'),
  ])

  assert.match(source, /approvalKey \|\| `aio-v2-plan-approval:\$\{window\.crypto\.randomUUID\(\)\}`/)
  assert.match(source, /pendingRemovals\.map\(item => item\.source_section_id\)/)
  assert.match(source, /allRemovalsAcknowledged/)
  assert.match(source, /Save or reset your edits before approval/)
  assert.match(api, /body: JSON\.stringify\(\{ acknowledged_removal_ids: acknowledgedRemovalIds \}\)/)
  assert.doesNotMatch(api, /approveAndGenerate[\s\S]{0,900}(?:provider|model|plan_hash):/)
})

test('AIO v2 approved plans become immutable and cancellation is idempotent', async () => {
  const [source, api] = await Promise.all([
    readFile(workspaceUrl, 'utf8'),
    readFile(apiUrl, 'utf8'),
  ])

  assert.match(source, /planEditable = viewingLatest && detail\?\.approved === false/)
  assert.match(source, /This exact version is approved and immutable/)
  assert.match(source, /cancelKey \|\| `aio-v2-job-cancel:\$\{window\.crypto\.randomUUID\(\)\}`/)
  assert.match(api, /`\/api\/aio-v2\/jobs\/\$\{encodeURIComponent\(jobId\)\}\/cancel`/)
  assert.match(source, /Any completed section remains safely retained/)
})

test('AIO v2 has no live-backend fallback and exposes evidence-preserving plan controls', async () => {
  const [source, api] = await Promise.all([
    readFile(workspaceUrl, 'utf8'),
    readFile(apiUrl, 'utf8'),
  ])

  assert.match(api, /NEXT_PUBLIC_AIO_V2_API_URL/)
  assert.doesNotMatch(api, /all-in-one-saas-backend-production/)
  assert.doesNotMatch(api, /from ['"]\.\/shared['"]/)
  assert.match(api, /class AioV2ApiError extends Error/)
  assert.match(api, /payload\?\.error\?\.code/)
  assert.match(source, /Frozen sources/)
  assert.match(source, /Eligible evidence/)
  assert.match(source, /Proposed removals/)
  assert.match(source, /only you can approve them/)
  assert.match(source, /Keep in later stages/)
  assert.doesNotMatch(source, /api[_-]?key|secret|provider credential/i)
})

test('AIO v2 exposes separate retained outputs only after exact plan approval', async () => {
  const [workspace, results, api] = await Promise.all([
    readFile(workspaceUrl, 'utf8'),
    readFile(resultsUrl, 'utf8'),
    readFile(apiUrl, 'utf8'),
  ])

  assert.match(workspace, /detail\.approved \? <AioV2ResultsWorkspace/)
  assert.match(results, /Page Copy/)
  assert.match(results, /Approved H1 - unchanged/)
  assert.match(results, /AIO FAQ/)
  assert.match(results, /Standalone FAQ is unchanged/)
  assert.match(results, /Only safely retained outputs are shown and exportable/)
  assert.doesNotMatch(results, /dangerouslySetInnerHTML/)
  assert.match(api, /\/outputs`/)
  assert.match(api, /\/sections`/)
  assert.match(api, /\/qa`/)
  assert.match(api, /\/changes`/)
})

test('AIO v2 exports are explicit, retry-stable, and never switch Google methods', async () => {
  const [results, api] = await Promise.all([
    readFile(resultsUrl, 'utf8'),
    readFile(apiUrl, 'utf8'),
  ])

  assert.match(results, /aio-v2-export:\$\{window\.crypto\.randomUUID\(\)\}/)
  assert.match(results, /Google OAuth/)
  assert.match(results, /Recommended - uses the connected Google account/)
  assert.match(results, /Service account/)
  assert.match(results, /No automatic switch occurs/)
  assert.match(results, /url\.protocol === 'https:'/)
  assert.match(api, /google_auth_method: 'google_oauth' \| 'service_account' \| null/)
  assert.match(api, /'Idempotency-Key': idempotencyKey/)
  assert.match(api, /\/exports`/)
})

test('AIO v2 history and launcher stay hidden while keeping Create and Refresh explicit', async () => {
  const [jobsRoute, newJobRoute, jobs, launcher, sidebar] = await Promise.all([
    readFile(jobsRouteUrl, 'utf8'),
    readFile(newJobRouteUrl, 'utf8'),
    readFile(jobsUrl, 'utf8'),
    readFile(newJobUrl, 'utf8'),
    readFile(sidebarUrl, 'utf8'),
  ])

  assert.match(jobsRoute, /AioV2JobsWorkspace/)
  assert.match(newJobRoute, /AioV2NewJobWorkspace/)
  assert.doesNotMatch(sidebar, /\/all-in-one-v2/)
  assert.match(jobs, /Create New Page/)
  assert.match(jobs, /Refresh Existing Page/)
  assert.match(launcher, /capabilities\.workflows\.map/)
  assert.match(launcher, /workflow === 'create_new'/)
  assert.match(launcher, /workflow === 'improve_existing'/)
  assert.match(launcher, /This does not alter any current-AIO job/)
})

test('AIO v2 history and launcher check entitlement before owner data or capabilities', async () => {
  const [jobs, launcher] = await Promise.all([
    readFile(jobsUrl, 'utf8'),
    readFile(newJobUrl, 'utf8'),
  ])

  const historyAccess = jobs.indexOf('aioV2Api.getAccess(session.access_token)')
  const historyJobs = jobs.indexOf('aioV2Api.listJobs(session.access_token)')
  const launcherAccess = launcher.indexOf('aioV2Api.getAccess(session.access_token)')
  const launcherCapabilities = launcher.indexOf('aioV2Api.getCapabilities(session.access_token)')
  const launcherProfiles = launcher.indexOf('listBrandProfiles(session.access_token)')
  assert.ok(historyAccess > -1 && historyJobs > historyAccess)
  assert.ok(launcherAccess > -1 && launcherCapabilities > launcherAccess)
  assert.ok(launcherAccess > -1 && launcherProfiles > launcherAccess)
  assert.match(jobs, /named beta entitlement/)
  assert.match(launcher, /named beta entitlement/)
})

test('AIO v2 creation is provider-gated, retry-stable, and has no silent fallback', async () => {
  const [launcher, api] = await Promise.all([
    readFile(newJobUrl, 'utf8'),
    readFile(apiUrl, 'utf8'),
  ])

  assert.match(launcher, /capabilities\?\.provider_calls_enabled === true && provider\?\.available === true/)
  assert.match(launcher, /&& providerReady/)
  assert.match(launcher, /disabled=\{!formReady \|\| submitting\}/)
  assert.match(launcher, /No provider fallback will occur/)
  assert.match(launcher, /aio-v2-create:\$\{window\.crypto\.randomUUID\(\)\}/)
  assert.match(launcher, /const key = idempotencyKey \|\|/)
  assert.match(launcher, /setIdempotencyKey\(null\)/)
  assert.match(api, /createJob:[\s\S]{0,350}'Idempotency-Key': idempotencyKey/)
  assert.doesNotMatch(launcher, /(?:fallbackProvider|fallbackModel|automatic fallback)/i)
})

test('AIO v2 lifecycle actions are explicit, retry-stable, and owner-scoped through job routes', async () => {
  const [lifecycle, jobs, api] = await Promise.all([
    readFile(lifecycleUrl, 'utf8'),
    readFile(jobsUrl, 'utf8'),
    readFile(apiUrl, 'utf8'),
  ])

  assert.match(jobs, /aio-v2-archive:\$\{window\.crypto\.randomUUID\(\)\}/)
  assert.match(jobs, /aio-v2-duplicate:\$\{window\.crypto\.randomUUID\(\)\}/)
  assert.match(lifecycle, /retryFor\(action, `aio-v2-\$\{action\}`\)/)
  assert.match(lifecycle, /aioV2Api\.retryPlanning/)
  assert.match(lifecycle, /aioV2Api\.replanJob/)
  assert.match(lifecycle, /aioV2Api\.archiveJob/)
  assert.match(lifecycle, /aioV2Api\.duplicateJob/)
  assert.match(lifecycle, /aioV2Api\.cancelOperation/)
  assert.match(lifecycle, /\['regeneration', 'export'\]\.includes/)
  assert.match(api, /\/operations\/\$\{encodeURIComponent\(operationId\)\}\/cancel/)
  assert.match(api, /\/retry-planning`/)
  assert.match(api, /\/archive`/)
  assert.match(api, /\/duplicate`/)
  assert.match(api, /\/replan`/)
})

test('AIO v2 section regeneration is one user action with exact correction and no review loop', async () => {
  const [results, api] = await Promise.all([
    readFile(resultsUrl, 'utf8'),
    readFile(apiUrl, 'utf8'),
  ])

  assert.match(results, /aio-v2-regeneration:\$\{window\.crypto\.randomUUID\(\)\}/)
  assert.match(results, /regenerationRetry\?\.sectionId === sectionId/)
  assert.match(results, /regenerationRetry\.correction === correction/)
  assert.match(results, /const regenerationAllowed = sections\.state === 'complete'/)
  assert.doesNotMatch(results, /regenerationAllowed = [^\n]*partial/)
  assert.match(results, /regenerationAllowed && item\.call_required/)
  assert.match(results, /Regenerate section/)
  assert.match(results, /one new revision · no reviewer loop/)
  assert.match(results, /current completed revision remains visible until the requested revision succeeds/)
  assert.match(api, /body: JSON\.stringify\(\{ editorial_correction: editorialCorrection \}\)/)
  assert.doesNotMatch(results, /setInterval\([\s\S]{0,500}regenerateSection/)
  assert.doesNotMatch(results, /await regenerateSection\(/)
})
