'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Download, ExternalLink, Pencil, Play, Plus, RefreshCw, Save, Square, X } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import RunSurfaceDialog, { type GeoPilotRunTarget } from '@/components/geopilot/RunSurfaceDialog'
import SurfaceSelector, { ALL_GEOPILOT_SURFACES, GEOPILOT_SURFACES } from '@/components/geopilot/SurfaceSelector'
import { JobLauncherShell, JobSection } from '@/components/ui/JobLauncher'
import { createClient } from '@/lib/supabase'
import { downloadGeoPilotCsv, geopilotApi, type GeoPilotCollectionPayload, type GeoPilotPrimarySurface, type GeoPilotPromptPayload } from '@/lib/api/geopilot'

type RecordValue = Record<string, unknown>
type Prompt = { id: string; prompt_text: string; google_query?: string; calibration?: boolean; source?: 'manual' | 'parallel'; version?: number; category?: string; funnel_stage?: 'awareness' | 'consideration' | 'decision' | null; active?: boolean }
type Collection = { id: string; name: string; objective?: string; schedule?: 'manual' | 'daily'; prompt_count?: number; prompts?: Prompt[]; surfaces?: GeoPilotPrimarySurface[]; active?: boolean; funnel_stage?: 'awareness' | 'consideration' | 'decision' | null; country_code?: string | null; location_name?: string | null; language_code?: string | null; device?: 'desktop' | 'mobile' | null }
type Profile = { id: string; name: string; brand_name: string; primary_domain?: string; country_code?: string; language_code?: string; device?: string; competitors?: Array<{ name: string }>; collections?: Collection[]; latest_batch?: Batch | null }
type Batch = { id: string; status: string; total_runs?: number; completed_runs?: number; failed_runs?: number; created_at?: string; error?: string | null }
type Run = { id: string; surface: string; method: string; model_name?: string; status: string; brand_mentioned?: boolean; prominence?: string; sentiment?: string; summary?: string; created_at?: string; request_snapshot?: { prompt_text?: string }; citations?: Array<{ domain?: string; url?: string }> }
type SurfaceMetrics = { visibility_score?: number | null; share_of_voice?: number | null; prominence_score?: number | null; sentiment_score?: number | null; citation_share?: number | null; ai_overview_coverage?: number | null; successful_runs?: number }
type Dashboard = { overall_visibility?: number | null; overall_share_of_voice?: number | null; overall_citation_share?: number | null; measured_surfaces?: GeoPilotPrimarySurface[]; surfaces?: Record<string, SurfaceMetrics>; calibration?: SurfaceMetrics; timeline?: RecordValue[]; prompt_performance?: Array<RecordValue & { id: string; prompt_text?: string; visibility_score?: number | null; share_of_voice?: number | null; successful_runs?: number }> }
type Insight = { id: string; status: string; insight?: Record<string, unknown>; evidence_urls?: string[]; generated_at?: string }

const ACTIVE = new Set(['queued', 'submitting', 'collecting', 'classifying', 'enriching'])
const SURFACES: Record<string, string> = { google_ai_overview: 'Google AI Overview', chatgpt: 'ChatGPT', gemini: 'Gemini', claude: 'Claude', chatgpt_calibration: 'ChatGPT calibration' }
const TABS = ['Overview', 'Prompts', 'Results', 'Opportunities'] as const

function metric(value?: number | null, suffix = '%') { return value == null ? '-' : `${Number(value).toFixed(value % 1 ? 1 : 0)}${suffix}` }
function dateLabel(value?: string) { return value ? new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-' }
function statusTone(status: string) { return status === 'complete' ? 'text-success' : status === 'failed' ? 'text-error' : status === 'partial' ? 'text-warning' : 'text-muted' }

export default function GeoPilotProfilePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [accessToken, setAccessToken] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [dashboard, setDashboard] = useState<Dashboard>({})
  const [runs, setRuns] = useState<Run[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [insights, setInsights] = useState<Insight[]>([])
  const [tab, setTab] = useState<(typeof TABS)[number]>('Overview')
  const [days, setDays] = useState(30)
  const [surface, setSurface] = useState('')
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState('')
  const [error, setError] = useState('')
  const [runTarget, setRunTarget] = useState<GeoPilotRunTarget | null>(null)
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null)
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) return router.push('/login')
      setAccessToken(session.access_token)
      const [profileData, dashboardData, runsData, insightsData, batchesData] = await Promise.all([
        geopilotApi.getProfile(session.access_token, id), geopilotApi.dashboard(session.access_token, id, days),
        geopilotApi.listRuns(session.access_token, id, days, surface), geopilotApi.listInsights(session.access_token, id), geopilotApi.listBatches(session.access_token, id),
      ])
      setProfile(profileData.profile); setDashboard(dashboardData); setRuns(runsData.runs || []); setInsights(insightsData.insights || []); setBatches(batchesData.batches || []); setError('')
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Failed to load GEOPilot profile.') }
    finally { setLoading(false) }
  }, [days, id, router, surface])
  useEffect(() => { void load() }, [load])
  const activeBatch = profile?.latest_batch && ACTIVE.has(profile.latest_batch.status) ? profile.latest_batch : null
  useEffect(() => {
    if (!activeBatch) return
    const timer = window.setInterval(() => void load(), 5000)
    return () => window.clearInterval(timer)
  }, [activeBatch, load])

  function openRun(collection?: Collection) {
    const collections = collection ? [collection] : profile?.collections || []
    const prompts = collections.flatMap(item => item.prompts || []).filter(prompt => prompt.active !== false)
    const promptCount = prompts.length || collections.reduce((sum, item) => sum + (item.prompt_count || 0), 0)
    setRunTarget({
      collectionId: collection?.id,
      label: collection?.name || profile?.name || 'profile',
      promptCount,
      calibrationCount: prompts.filter(prompt => prompt.calibration).length,
      surfaces: collection?.surfaces?.length ? [...collection.surfaces] : [...ALL_GEOPILOT_SURFACES],
    })
  }
  async function runNow(surfaces: GeoPilotPrimarySurface[], includeCalibration: boolean) {
    if (!accessToken || !runTarget) return
    setAction(runTarget.collectionId || 'profile'); setError('')
    try {
      await geopilotApi.runProfile(accessToken, id, { collectionId: runTarget.collectionId, surfaces, includeCalibration })
      setRunTarget(null)
      await load()
    }
    catch (runError) { setError(runError instanceof Error ? runError.message : 'Failed to start run.') }
    finally { setAction('') }
  }
  async function cancel() {
    if (!accessToken || !activeBatch) return
    setAction('cancel')
    try { await geopilotApi.cancelBatch(accessToken, activeBatch.id); await load() }
    catch (cancelError) { setError(cancelError instanceof Error ? cancelError.message : 'Failed to cancel run.') }
    finally { setAction('') }
  }
  async function saveCollection() {
    if (!accessToken || !editingCollection) return
    setAction(`collection-${editingCollection.id}`)
    const payload: GeoPilotCollectionPayload = {
      name: editingCollection.name,
      objective: editingCollection.objective || '',
      funnel_stage: editingCollection.funnel_stage || null,
      schedule: editingCollection.schedule || 'daily',
      country_code: editingCollection.country_code || null,
      location_name: editingCollection.location_name || null,
      language_code: editingCollection.language_code || null,
      device: editingCollection.device || null,
      surfaces: editingCollection.surfaces?.length ? editingCollection.surfaces : [...ALL_GEOPILOT_SURFACES],
      active: editingCollection.active !== false,
    }
    try { await geopilotApi.updateCollection(accessToken, editingCollection.id, payload); setEditingCollection(null); await load() }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Failed to update collection.') }
    finally { setAction('') }
  }
  async function savePrompt() {
    if (!accessToken || !editingPrompt) return
    setAction(`prompt-${editingPrompt.id}`)
    const payload: GeoPilotPromptPayload = {
      prompt_text: editingPrompt.prompt_text,
      google_query: editingPrompt.google_query || '',
      category: editingPrompt.category || '',
      funnel_stage: editingPrompt.funnel_stage || null,
      calibration: Boolean(editingPrompt.calibration),
      source: editingPrompt.source || 'manual',
      active: editingPrompt.active !== false,
    }
    try { await geopilotApi.updatePrompt(accessToken, editingPrompt.id, payload); setEditingPrompt(null); await load() }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Failed to update prompt.') }
    finally { setAction('') }
  }
  const citationDomains = useMemo(() => {
    const counts = new Map<string, number>()
    runs.flatMap(run => run.citations || []).forEach(citation => { if (citation.domain) counts.set(citation.domain, (counts.get(citation.domain) || 0) + 1) })
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [runs])
  const dailyTrend = useMemo(() => {
    const grouped = new Map<string, number[]>()
    for (const row of dashboard.timeline || []) {
      const date = String(row.metric_date || '')
      const value = Number(row.visibility_score)
      if (!date || !Number.isFinite(value)) continue
      grouped.set(date, [...(grouped.get(date) || []), value])
    }
    return [...grouped].map(([date, values]) => ({ date, value: values.reduce((sum, value) => sum + value, 0) / values.length })).slice(-14)
  }, [dashboard.timeline])

  return <AppLayout title="GEOPilot Profile"><Link href="/geopilot" className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-text"><ArrowLeft size={16} /> Back to GEOPilot</Link><JobLauncherShell compact eyebrow="GEOPilot client" title={profile?.name || 'Client Profile'} summary={profile && <div className="text-right text-xs text-muted"><p className="font-semibold text-text">{profile.brand_name}</p><p>{profile.country_code} / {profile.language_code} / {profile.device}</p></div>} actions={<div className="flex flex-wrap gap-2"><button className="btn-ghost gap-2" onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>{profile && <Link className="btn-ghost gap-2" href={`/geopilot/profiles/${id}/edit`}><Pencil size={14} /> Edit</Link>}{activeBatch ? <button className="btn-ghost gap-2 text-error" onClick={() => void cancel()} disabled={action === 'cancel'}><Square size={13} /> Cancel</button> : <button className="btn-primary gap-2" onClick={() => openRun()} disabled={!profile}><Play size={14} /> Run Now</button>}</div>}>
    {error && <div className="mb-4 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">{error}</div>}
    {activeBatch && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/30 bg-accent/10 p-3"><div><p className="text-sm font-semibold text-text">Run {activeBatch.status}</p><p className="text-xs text-muted">{activeBatch.completed_runs || 0} of {activeBatch.total_runs || 0} measurements complete</p></div><span className="text-xs font-semibold text-accent">Updating automatically</span></div>}
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border"><div className="flex gap-1">{TABS.map(item => <button key={item} onClick={() => setTab(item)} className={`border-b-2 px-3 py-2 text-sm font-semibold ${tab === item ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-text'}`}>{item}</button>)}</div><div className="flex items-center gap-2 pb-2"><select aria-label="Period" className="input-base w-24" value={days} onChange={event => setDays(Number(event.target.value))}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select>{accessToken && profile && <button className="btn-ghost gap-2" onClick={() => void downloadGeoPilotCsv(accessToken, id, days, `geopilot-${profile.name}-${days}d.csv`)}><Download size={14} /> CSV</button>}</div></div>
    {loading && !profile ? <p className="text-sm text-muted">Loading profile...</p> : tab === 'Overview' ? <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><Score label="Overall visibility" value={metric(dashboard.overall_visibility)} /><Score label="Share of voice" value={metric(dashboard.overall_share_of_voice)} /><Score label="Owned citation share" value={metric(dashboard.overall_citation_share)} /><Score label="Google coverage" value={metric(dashboard.surfaces?.google_ai_overview?.ai_overview_coverage)} /><Score label="Active prompts" value={String(profile?.collections?.reduce((sum, item) => sum + (item.prompt_count || 0), 0) || 0)} /><Score label="Visibility basis" value={`${dashboard.measured_surfaces?.length || 0}/4`} /></div>
      <div className="grid gap-5 lg:grid-cols-2">
        <JobSection title="Run history"><div className="divide-y divide-border">{batches.slice(0, 8).map(batch => <div key={batch.id} className="flex items-center justify-between gap-4 py-2 text-sm"><div><p className={`font-semibold ${statusTone(batch.status)}`}>{batch.status}</p><p className="text-xs text-muted">{dateLabel(batch.created_at)} / {batch.completed_runs || 0} of {batch.total_runs || 0}</p></div>{batch.failed_runs ? <span className="text-xs text-error">{batch.failed_runs} failed</span> : null}</div>)}{!batches.length && <p className="text-sm text-muted">No runs yet.</p>}</div></JobSection>
        <JobSection title="Manage tracking"><div className="space-y-3">{profile?.collections?.map(collection => <div key={collection.id} className="border-b border-border pb-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-text">{collection.name}</p><button className="btn-ghost px-3 py-1.5" title="Edit collection" onClick={() => setEditingCollection({ ...collection, surfaces: collection.surfaces?.length ? collection.surfaces : [...ALL_GEOPILOT_SURFACES] })}><Pencil size={13} /></button></div><div className="mt-2 flex flex-wrap gap-2">{collection.prompts?.map(prompt => <button key={prompt.id} className="rounded-md border border-border px-2 py-1 text-left text-xs text-muted hover:border-accent hover:text-accent" onClick={() => setEditingPrompt({ ...prompt })}>{prompt.prompt_text}</button>)}</div></div>)}</div></JobSection>
      </div>
      <JobSection title="Visibility by surface" className="mt-5"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted"><th className="py-2 pr-4">Surface</th><th className="px-4 py-2">Visibility</th><th className="px-4 py-2">Share of voice</th><th className="px-4 py-2">Prominence</th><th className="px-4 py-2">Sentiment</th><th className="px-4 py-2">Citation share</th><th className="px-4 py-2">Samples</th></tr></thead><tbody>{Object.entries(dashboard.surfaces || {}).map(([key, value]) => <tr key={key} className="border-b border-border last:border-0"><td className="py-3 pr-4 font-semibold text-text">{SURFACES[key] || key}</td><td className="px-4 py-3">{metric(value.visibility_score)}</td><td className="px-4 py-3">{metric(value.share_of_voice)}</td><td className="px-4 py-3">{metric(value.prominence_score)}</td><td className="px-4 py-3">{metric(value.sentiment_score, '')}</td><td className="px-4 py-3">{metric(value.citation_share)}</td><td className="px-4 py-3 text-muted">{value.successful_runs || 0}</td></tr>)}</tbody></table></div></JobSection>
      <div className="grid gap-5 lg:grid-cols-2">
        <JobSection title="Daily visibility trend"><div className="space-y-2">{dailyTrend.length ? dailyTrend.map(item => <div key={item.date} className="grid grid-cols-[5rem_1fr_3rem] items-center gap-3 text-xs"><span className="text-muted">{item.date.slice(5)}</span><div className="h-2 overflow-hidden rounded bg-border"><div className="h-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, item.value))}%` }} /></div><span className="text-right font-semibold text-text">{metric(item.value)}</span></div>) : <p className="text-sm text-muted">Trend data appears after the first completed run.</p>}</div></JobSection>
        <JobSection title="Prompt performance"><div className="space-y-2">{dashboard.prompt_performance?.length ? dashboard.prompt_performance.slice(0, 8).map(prompt => <div key={prompt.id} className="flex items-start justify-between gap-4 border-b border-border py-2 text-sm"><span className="line-clamp-2 text-text">{prompt.prompt_text || 'Prompt'}</span><span className="shrink-0 font-semibold text-accent">{metric(prompt.visibility_score)}</span></div>) : <p className="text-sm text-muted">Prompt performance appears after completed measurements.</p>}</div></JobSection>
      </div>
      <div className="grid gap-5 lg:grid-cols-2"><JobSection title="Top citation domains"><div className="space-y-2">{citationDomains.length ? citationDomains.map(([domain, count]) => <div key={domain} className="flex items-center justify-between border-b border-border py-2 text-sm"><span className="text-text">{domain}</span><span className="text-muted">{count}</span></div>) : <p className="text-sm text-muted">No citations collected in this period.</p>}</div></JobSection><JobSection title="ChatGPT calibration"><p className="text-sm text-muted">Consumer-result calibration stays separate from API visibility.</p><div className="mt-3 grid grid-cols-2 gap-3"><Score label="Visibility" value={metric(dashboard.calibration?.visibility_score)} /><Score label="Samples" value={String(dashboard.calibration?.successful_runs || 0)} /></div></JobSection></div>
    </> : tab === 'Prompts' ? <JobSection title="Prompt collections" description="Up to five collections and 15 active prompts per client."><div className="mb-4 flex justify-end"><Link className="btn-primary gap-2" href={`/geopilot/profiles/${id}/collections/new`}><Plus size={15} /> New Collection</Link></div><div className="space-y-4">{profile?.collections?.length ? profile.collections.map(collection => <div key={collection.id} className="rounded-lg border border-border bg-surface p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-text">{collection.name}</h3><p className="mt-1 text-xs text-muted">{collection.schedule === 'daily' ? 'Daily' : 'Manual'} / {collection.prompt_count || 0} prompts</p><p className="mt-1 text-xs text-muted">{(collection.surfaces?.length ? collection.surfaces : ALL_GEOPILOT_SURFACES).map(item => GEOPILOT_SURFACES.find(option => option.value === item)?.label).join(' / ')}</p></div><button className="btn-ghost gap-2 text-xs" onClick={() => openRun(collection)} disabled={Boolean(activeBatch)}><Play size={13} /> Run Collection</button></div><div className="mt-3 divide-y divide-border">{collection.prompts?.map(prompt => <div key={prompt.id} className="flex items-start justify-between gap-3 py-3"><div><p className="text-sm text-text">{prompt.prompt_text}</p>{prompt.google_query && <p className="mt-1 text-xs text-muted">Google: {prompt.google_query}</p>}</div><div className="flex shrink-0 gap-2 text-[11px] text-muted">{prompt.calibration && <span className="rounded-md bg-accent/10 px-2 py-1 text-accent">Calibration</span>}<span>v{prompt.version || 1}</span></div></div>)}</div></div>) : <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted">No prompt collections yet.</div>}</div></JobSection> : tab === 'Results' ? <JobSection title="Measurement results"><div className="mb-4 flex justify-end"><select aria-label="Surface filter" className="input-base w-56" value={surface} onChange={event => setSurface(event.target.value)}><option value="">All surfaces</option>{Object.entries(SURFACES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted"><th className="py-2 pr-4">Prompt</th><th className="px-4 py-2">Surface</th><th className="px-4 py-2">Mention</th><th className="px-4 py-2">Prominence</th><th className="px-4 py-2">Sentiment</th><th className="px-4 py-2">Run</th><th className="px-4 py-2" /></tr></thead><tbody>{runs.map(run => <tr key={run.id} className="border-b border-border last:border-0"><td className="max-w-sm py-3 pr-4 text-text">{run.request_snapshot?.prompt_text || '-'}</td><td className="px-4 py-3 text-xs">{SURFACES[run.surface] || run.surface}</td><td className="px-4 py-3">{run.status === 'complete' ? run.brand_mentioned ? 'Yes' : 'No' : <span className={statusTone(run.status)}>{run.status}</span>}</td><td className="px-4 py-3 text-muted">{run.prominence || '-'}</td><td className="px-4 py-3 text-muted">{run.sentiment || '-'}</td><td className="px-4 py-3 text-xs text-muted">{dateLabel(run.created_at)}</td><td className="px-4 py-3"><Link href={`/geopilot/runs/${run.id}`} className="text-accent"><ExternalLink size={14} /></Link></td></tr>)}</tbody></table>{!runs.length && <p className="py-8 text-center text-sm text-muted">No results in this period.</p>}</div></JobSection> : <JobSection title="Weekly citation opportunities" description="Parallel research is evidence for action, not part of your visibility score."><div className="space-y-4">{insights.length ? insights.map(item => <div key={item.id} className="rounded-lg border border-border bg-surface p-4"><div className="flex items-center justify-between"><span className={`text-xs font-semibold uppercase ${statusTone(item.status)}`}>{item.status}</span><span className="text-xs text-muted">{dateLabel(item.generated_at)}</span></div>{item.status === 'complete' && <div className="mt-3 space-y-2 text-sm"><p className="font-semibold text-text">{String(item.insight?.gap || 'Citation opportunity')}</p><p className="text-muted">{String(item.insight?.missing_content_asset || '')}</p><p className="text-text">Recommended: {String(item.insight?.recommended_content_type || 'Review cited source patterns')}</p>{item.evidence_urls?.length ? <div className="flex flex-wrap gap-2 pt-2">{item.evidence_urls.slice(0, 6).map(url => <a key={url} href={url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">{new URL(url).hostname}</a>)}</div> : null}</div>}</div>) : <p className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted">Weekly opportunities appear after citation data has been collected.</p>}</div></JobSection>}
    {runTarget && <RunSurfaceDialog target={runTarget} busy={action === (runTarget.collectionId || 'profile')} onClose={() => setRunTarget(null)} onRun={(surfaces, includeCalibration) => void runNow(surfaces, includeCalibration)} />}
    {editingCollection && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div role="dialog" aria-modal="true" aria-label="Edit collection" className="w-full max-w-xl rounded-lg border border-border bg-surface-raised p-5 shadow-lg"><div className="flex items-center justify-between"><h2 className="text-base font-semibold text-text">Edit collection</h2><button className="btn-ghost px-2" title="Close" onClick={() => setEditingCollection(null)}><X size={15} /></button></div><div className="mt-4 space-y-4"><label className="block text-xs font-semibold text-muted">Name<input className="input-base mt-1" value={editingCollection.name} onChange={event => setEditingCollection({ ...editingCollection, name: event.target.value })} /></label><label className="block text-xs font-semibold text-muted">Objective<textarea className="input-base mt-1 min-h-20" value={editingCollection.objective || ''} onChange={event => setEditingCollection({ ...editingCollection, objective: event.target.value })} /></label><label className="block text-xs font-semibold text-muted">Schedule<select className="input-base mt-1" value={editingCollection.schedule || 'daily'} onChange={event => setEditingCollection({ ...editingCollection, schedule: event.target.value as 'daily' | 'manual' })}><option value="daily">Daily</option><option value="manual">Manual only</option></select></label><div><p className="mb-2 text-xs font-semibold text-muted">Tracked sources</p><SurfaceSelector selected={editingCollection.surfaces?.length ? editingCollection.surfaces : ALL_GEOPILOT_SURFACES} onChange={surfaces => setEditingCollection({ ...editingCollection, surfaces })} /></div></div><div className="mt-5 flex justify-end gap-2"><button className="btn-ghost" onClick={() => setEditingCollection(null)}>Cancel</button><button className="btn-primary gap-2" onClick={() => void saveCollection()} disabled={action === `collection-${editingCollection.id}`}><Save size={14} /> Save</button></div></div></div>}
    {editingPrompt && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div role="dialog" aria-modal="true" aria-label="Edit prompt" className="w-full max-w-2xl rounded-lg border border-border bg-surface-raised p-5 shadow-lg"><div className="flex items-center justify-between"><div><h2 className="text-base font-semibold text-text">Edit tracked prompt</h2><p className="mt-1 text-xs text-muted">Saving creates a new version when this prompt already has results.</p></div><button className="btn-ghost px-2" title="Close" onClick={() => setEditingPrompt(null)}><X size={15} /></button></div><div className="mt-4 space-y-4"><label className="block text-xs font-semibold text-muted">LLM prompt<textarea className="input-base mt-1 min-h-24" value={editingPrompt.prompt_text} onChange={event => setEditingPrompt({ ...editingPrompt, prompt_text: event.target.value })} /></label><label className="block text-xs font-semibold text-muted">Google query override<textarea className="input-base mt-1 min-h-16" value={editingPrompt.google_query || ''} onChange={event => setEditingPrompt({ ...editingPrompt, google_query: event.target.value })} /></label><label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={Boolean(editingPrompt.calibration)} onChange={event => setEditingPrompt({ ...editingPrompt, calibration: event.target.checked })} className="h-4 w-4 accent-accent" /> Use for ChatGPT consumer calibration</label></div><div className="mt-5 flex justify-end gap-2"><button className="btn-ghost" onClick={() => setEditingPrompt(null)}>Cancel</button><button className="btn-primary gap-2" onClick={() => void savePrompt()} disabled={action === `prompt-${editingPrompt.id}`}><Save size={14} /> Save New Version</button></div></div></div>}
  </JobLauncherShell></AppLayout>
}

function Score({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-border bg-surface p-4"><p className="text-xs font-semibold text-muted">{label}</p><p className="mt-1 text-xl font-semibold text-text">{value}</p></div> }
