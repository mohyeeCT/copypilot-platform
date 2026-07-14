'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Check, Plus, Search, Trash2 } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import CollectionMethodSelector from '@/components/geopilot/CollectionMethodSelector'
import SurfaceSelector, { ALL_GEOPILOT_SURFACES } from '@/components/geopilot/SurfaceSelector'
import CustomSelect from '@/components/ui/CustomSelect'
import { JobLauncherShell, JobSection } from '@/components/ui/JobLauncher'
import { createClient } from '@/lib/supabase'
import { geopilotApi, type GeoPilotCollectionPayload, type GeoPilotPrimarySurface, type GeoPilotPromptPayload } from '@/lib/api/geopilot'
import { buildMeasurementMethods, normalizeCollectionMeasurementMethods } from '@/lib/geopilot-methods'

type DraftPrompt = GeoPilotPromptPayload & { selected: boolean }
const SCHEDULE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'manual', label: 'Manual only' },
]
const blankPrompt = (): DraftPrompt => ({ prompt_text: '', google_query: '', category: '', funnel_stage: null, calibration: false, source: 'manual', active: true, selected: true })

export default function NewGeoPilotCollectionPage() {
  const params = useParams<{ id: string }>()
  const profileId = params.id
  const router = useRouter()
  const [collectionId, setCollectionId] = useState('')
  const [collection, setCollection] = useState<GeoPilotCollectionPayload>({ name: '', objective: '', funnel_stage: null, schedule: 'daily', surfaces: [...ALL_GEOPILOT_SURFACES], measurement_methods: buildMeasurementMethods(ALL_GEOPILOT_SURFACES, {}), monthly_budget_usd: null, active: true })
  const [consumerUi, setConsumerUi] = useState<{ enabled: boolean; surfaces: GeoPilotPrimarySurface[] }>({ enabled: false, surfaces: [] })
  const [prompts, setPrompts] = useState<DraftPrompt[]>([blankPrompt()])
  const [busy, setBusy] = useState<'collection' | 'suggest' | 'prompts' | ''>('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function loadCapabilities() {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) { router.push('/login'); return }
      const capabilities = await geopilotApi.capabilities(session.access_token)
      if (active) setConsumerUi(capabilities.consumer_ui)
    }
    void loadCapabilities().catch(() => undefined)
    return () => { active = false }
  }, [router])

  async function accessToken() {
    const { data: { session } } = await createClient().auth.getSession()
    if (!session) { router.push('/login'); return null }
    return session.access_token
  }
  function updateSchedule(schedule: 'manual' | 'daily') {
    setCollection(current => ({
      ...current,
      schedule,
      measurement_methods: schedule === 'daily'
        ? buildMeasurementMethods(current.surfaces, {})
        : normalizeCollectionMeasurementMethods(current.surfaces, current.measurement_methods),
    }))
  }
  function updateSurfaces(surfaces: GeoPilotPrimarySurface[]) {
    setCollection(current => ({
      ...current,
      surfaces,
      measurement_methods: normalizeCollectionMeasurementMethods(surfaces, current.measurement_methods),
    }))
  }
  async function createCollection() {
    setError('')
    if (!collection.name.trim()) return setError('Add a collection name first.')
    setBusy('collection')
    try {
      const token = await accessToken(); if (!token) return
      const data = await geopilotApi.createCollection(token, profileId, collection)
      setCollectionId(data.collection.id)
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'Failed to create collection.') }
    finally { setBusy('') }
  }
  async function suggest() {
    setBusy('suggest'); setError('')
    try {
      const token = await accessToken(); if (!token) return
      const data = await geopilotApi.suggestPrompts(token, collectionId, collection.objective)
      const suggestions: DraftPrompt[] = (data.suggestions || []).map((item: { prompt_text: string; google_query?: string }) => ({ ...blankPrompt(), prompt_text: item.prompt_text, google_query: item.google_query || '', source: 'parallel' }))
      setPrompts(current => [...current.filter(item => item.prompt_text.trim()), ...suggestions].slice(0, 15))
    } catch (suggestError) { setError(suggestError instanceof Error ? suggestError.message : 'Prompt suggestions are unavailable.') }
    finally { setBusy('') }
  }
  function updatePrompt(index: number, patch: Partial<DraftPrompt>) { setPrompts(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)) }
  async function savePrompts() {
    const selected = prompts.filter(item => item.selected && item.prompt_text.trim())
    if (!selected.length) return setError('Add or select at least one prompt.')
    if (selected.filter(item => item.calibration).length > 3) return setError('Choose no more than three calibration prompts.')
    setBusy('prompts'); setError('')
    try {
      const token = await accessToken(); if (!token) return
      for (const prompt of selected) {
        const { selected: _, ...payload } = prompt
        void _
        await geopilotApi.createPrompt(token, collectionId, payload)
      }
      router.push(`/geopilot/profiles/${profileId}`)
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Failed to save prompts.') }
    finally { setBusy('') }
  }

  return <AppLayout title="New Prompt Collection"><Link href={`/geopilot/profiles/${profileId}`} className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-text"><ArrowLeft size={16} /> Back to Profile</Link><JobLauncherShell compact eyebrow="GEOPilot" title="New Prompt Collection">
    {error && <div className="mb-4 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">{error}</div>}
    <JobSection title="Collection">
      <div className="grid gap-4 lg:grid-cols-2"><label className="text-xs font-semibold text-muted">Name<input className="input-base mt-1" value={collection.name} onChange={event => setCollection({ ...collection, name: event.target.value })} disabled={Boolean(collectionId)} /></label><label className="text-xs font-semibold text-muted">Schedule<CustomSelect className="mt-1" ariaLabel="Collection schedule" value={collection.schedule} onChange={value => updateSchedule(value as 'manual' | 'daily')} options={SCHEDULE_OPTIONS} disabled={Boolean(collectionId)} /></label><label className="text-xs font-semibold text-muted">Monthly budget (USD)<input className="input-base mt-1" type="number" min="0.01" step="0.01" placeholder="No budget" value={collection.monthly_budget_usd ?? ''} onChange={event => setCollection({ ...collection, monthly_budget_usd: event.target.value ? Number(event.target.value) : null })} disabled={Boolean(collectionId)} /></label><label className="text-xs font-semibold text-muted lg:col-span-2">Research objective<textarea className="input-base mt-1 min-h-20" value={collection.objective} onChange={event => setCollection({ ...collection, objective: event.target.value })} disabled={Boolean(collectionId)} /></label></div>
      <div className="mt-4"><p className="mb-2 text-xs font-semibold text-muted">Tracked sources</p><SurfaceSelector selected={collection.surfaces} onChange={updateSurfaces} disabled={Boolean(collectionId)} /></div>
      <div className="mt-4"><CollectionMethodSelector surfaces={collection.surfaces} measurementMethods={collection.measurement_methods} consumerUiEnabled={consumerUi.enabled} consumerUiSurfaces={consumerUi.surfaces} schedule={collection.schedule} onChange={measurementMethods => setCollection(current => ({ ...current, measurement_methods: measurementMethods }))} disabled={Boolean(collectionId)} /></div>
      {!collectionId ? <button type="button" className="btn-primary mt-4 gap-2" onClick={() => void createCollection()} disabled={busy === 'collection'}><Check size={15} />{busy === 'collection' ? 'Creating...' : 'Create Collection'}</button> : <p className="mt-4 text-xs font-semibold text-success">Collection created. Add the prompts you want to track.</p>}
    </JobSection>
    {collectionId && <JobSection title="Tracked prompts" description={`${prompts.filter(item => item.selected && item.prompt_text.trim()).length} of 15 selected`}>
      <div className="mb-4 flex flex-wrap gap-2"><button type="button" className="btn-ghost gap-2" onClick={() => setPrompts(current => [...current, blankPrompt()].slice(0, 15))} disabled={prompts.length >= 15}><Plus size={15} /> Add prompt</button><button type="button" className="btn-ghost gap-2" onClick={() => void suggest()} disabled={busy === 'suggest'}><Search size={15} />{busy === 'suggest' ? 'Researching...' : 'Suggest with Parallel'}</button></div>
      <div className="space-y-3">{prompts.map((prompt, index) => <div key={index} className="grid gap-3 rounded-lg border border-border bg-surface p-3 lg:grid-cols-[auto_1.5fr_1fr_auto_auto]">
        <input aria-label="Select prompt" type="checkbox" checked={prompt.selected} onChange={event => updatePrompt(index, { selected: event.target.checked })} className="mt-2 h-4 w-4 accent-accent" />
        <textarea aria-label="LLM prompt" className="input-base min-h-16" value={prompt.prompt_text} onChange={event => updatePrompt(index, { prompt_text: event.target.value })} placeholder="What are the best options for...?" />
        <textarea aria-label="Google query override" className="input-base min-h-16" value={prompt.google_query} onChange={event => updatePrompt(index, { google_query: event.target.value })} placeholder="Google query override (optional)" />
        <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={prompt.calibration} onChange={event => updatePrompt(index, { calibration: event.target.checked })} className="h-4 w-4 accent-accent" /> Calibration</label>
        <button type="button" className="btn-ghost h-9 px-3" title="Remove prompt" onClick={() => setPrompts(current => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={14} /></button>
      </div>)}</div>
      <div className="mt-5 flex justify-end"><button type="button" className="btn-primary" onClick={() => void savePrompts()} disabled={busy === 'prompts'}>{busy === 'prompts' ? 'Saving...' : 'Save Prompts'}</button></div>
    </JobSection>}
  </JobLauncherShell></AppLayout>
}
