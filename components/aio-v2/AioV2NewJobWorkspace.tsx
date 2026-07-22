'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Lock, Rocket, ShieldCheck } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import {
  aioV2Api,
  type AioV2Capabilities,
  type AioV2JobCreate,
  type AioV2RequestedOutputs,
  type AioV2Workflow,
} from '@/lib/api/aio-v2'
import { listBrandProfiles } from '@/lib/api/shared'
import { createClient } from '@/lib/supabase'
import styles from './AioV2JobsWorkspace.module.css'

type BrandProfile = { id: string; name: string; archived_at?: string | null }
type LoadState = 'loading' | 'locked' | 'ready' | 'error'

export default function AioV2NewJobWorkspace() {
  const router = useRouter()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [token, setToken] = useState('')
  const [capabilities, setCapabilities] = useState<AioV2Capabilities | null>(null)
  const [profiles, setProfiles] = useState<BrandProfile[]>([])
  const [workflow, setWorkflow] = useState<AioV2Workflow>('create_new')
  const [profileId, setProfileId] = useState('')
  const [targetUrl, setTargetUrl] = useState('')
  const [pageType, setPageType] = useState<'homepage' | 'service' | 'blog'>('service')
  const [nicheContext, setNicheContext] = useState('')
  const [pageGoal, setPageGoal] = useState('')
  const [keyword, setKeyword] = useState('')
  const [guidance, setGuidance] = useState('balanced')
  const [approach, setApproach] = useState<'preserve' | 'hybrid' | 'research_led'>('hybrid')
  const [providerIndex, setProviderIndex] = useState(0)
  const [outputs, setOutputs] = useState<AioV2RequestedOutputs>({ page_copy: true, meta: true, aio_faq: true })
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoadState('loading')
    setError('')
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session?.access_token) {
        router.push('/login')
        return
      }
      const access = await aioV2Api.getAccess(session.access_token)
      if (!access.enabled) {
        setLoadState('locked')
        return
      }
      const [nextCapabilities, profileResponse] = await Promise.all([
        aioV2Api.getCapabilities(session.access_token),
        listBrandProfiles(session.access_token),
      ])
      const nextProfiles = Array.isArray(profileResponse)
        ? profileResponse.filter((profile): profile is BrandProfile => (
          profile !== null
          && typeof profile === 'object'
          && typeof profile.id === 'string'
          && typeof profile.name === 'string'
          && !profile.archived_at
        ))
        : []
      const availableIndex = nextCapabilities.provider_models.findIndex(item => item.available)
      setToken(session.access_token)
      setCapabilities(nextCapabilities)
      setProfiles(nextProfiles)
      setProfileId(nextProfiles[0]?.id ?? '')
      setGuidance(nextCapabilities.guidance_profiles[0]?.id ?? 'balanced')
      setProviderIndex(availableIndex >= 0 ? availableIndex : 0)
      setLoadState('ready')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The AIO v2 launcher could not be loaded.')
      setLoadState('error')
    }
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  const provider = capabilities?.provider_models[providerIndex]
  const providerReady = capabilities?.provider_calls_enabled === true && provider?.available === true
  const outputSelected = outputs.page_copy || outputs.meta || outputs.aio_faq
  const formReady = Boolean(
    profileId
    && targetUrl.trim()
    && nicheContext.trim()
    && pageGoal.trim()
    && (workflow === 'improve_existing' || keyword.trim())
    && outputSelected
    && providerReady,
  )

  const selectedProfileName = useMemo(
    () => profiles.find(profile => profile.id === profileId)?.name ?? 'No profile selected',
    [profileId, profiles],
  )

  function changed() {
    setIdempotencyKey(null)
    setError('')
  }

  function toggleOutput(name: keyof AioV2RequestedOutputs) {
    changed()
    setOutputs(current => ({ ...current, [name]: !current[name] }))
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || !capabilities || !provider || !formReady || submitting) return
    setSubmitting(true)
    setError('')
    const key = idempotencyKey || `aio-v2-create:${window.crypto.randomUUID()}`
    setIdempotencyKey(key)
    const payload: AioV2JobCreate = {
      workflow,
      client_profile_id: profileId,
      target_url: targetUrl.trim(),
      page_type: pageType,
      niche_context: nicheContext.trim(),
      page_goal: pageGoal.trim(),
      manual_primary_keyword: workflow === 'create_new' ? keyword.trim() : null,
      requested_outputs: outputs,
      guidance_profile_id: guidance,
      depth_preference_id: 'standard',
      improve_approach: workflow === 'improve_existing' ? approach : null,
      provider: provider.provider,
      model: provider.model,
    }
    try {
      const result = await aioV2Api.createJob(token, payload, key)
      setIdempotencyKey(null)
      router.push(`/all-in-one-v2/jobs/${result.job.job_id}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The AIO v2 job could not be created.')
      setSubmitting(false)
    }
  }

  return (
    <AppLayout title="New AIO v2 job">
      <div className={styles.page}>
        <Link href="/all-in-one-v2/jobs" className={styles.backLink}><ArrowLeft size={14} /> AIO v2 jobs</Link>
        {loadState === 'loading' ? <section className={styles.stateCard}><h2>Opening the AIO v2 launcher</h2><p>Checking entitlement and safe capabilities first.</p></section> : null}
        {loadState === 'locked' ? <section className={styles.stateCard}><Lock size={22} /><h2>AIO v2 is not enabled</h2><p>This launcher remains hidden without a named beta entitlement.</p></section> : null}
        {loadState === 'error' ? <section className={styles.stateCard}><AlertTriangle size={22} /><h2>The launcher is unavailable</h2><p>{error}</p><button type="button" className="btn-ghost" onClick={() => void load()}>Try again</button></section> : null}

        {loadState === 'ready' && capabilities ? (
          <form className={styles.launcher} onSubmit={submit}>
            <header className={styles.launcherHeader}>
              <div><span>AIO v2 · explicit workflow</span><h1>Start with the page decision.</h1><p>Choose Create New Page or Refresh Existing Page. This does not alter any current-AIO job.</p></div>
              <button type="submit" className="btn-primary" disabled={!formReady || submitting}><Rocket size={15} /> {submitting ? 'Creating…' : idempotencyKey ? 'Retry creation' : 'Create AIO v2 job'}</button>
            </header>

            {error ? <div className={styles.error} role="alert"><AlertTriangle size={15} /> {error}</div> : null}
            {!providerReady ? <div className={styles.activationNotice}><ShieldCheck size={17} /><div><strong>Provider activation is still closed</strong><p>The complete job contract is ready, but creation remains disabled until the controlled-beta provider, cost ceiling, and infrastructure approvals are applied. No provider fallback will occur.</p></div></div> : null}

            <section className={styles.formSection}>
              <div><span>1</span><h2>Workflow</h2><p>These are separate provenance paths, not a hidden automatic choice.</p></div>
              <div className={styles.workflowChoices}>
                {capabilities.workflows.map(item => <button key={item.id} type="button" aria-pressed={workflow === item.id} onClick={() => { changed(); setWorkflow(item.id) }}><strong>{item.label}</strong><small>{item.id === 'create_new' ? 'Build a new page from an explicit primary keyword.' : 'Refresh an owned page while preserving approved evidence and locks.'}</small></button>)}
              </div>
            </section>

            <section className={styles.formSection}>
              <div><span>2</span><h2>Page foundation</h2><p>Only the selected profile ID is sent to AIO v2; the server freezes its safe owned snapshot.</p></div>
              <div className={styles.formGrid}>
                <label>Brand Profile<select value={profileId} onChange={event => { changed(); setProfileId(event.target.value) }}><option value="">Select a profile</option>{profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select><small>{profiles.length ? `Selected: ${selectedProfileName}` : 'Create an active Brand Profile in Settings first.'}</small></label>
                <label>Page type<select value={pageType} onChange={event => { changed(); setPageType(event.target.value as typeof pageType) }}>{capabilities.page_types.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
                <label className={styles.wide}>Target URL<input type="url" value={targetUrl} placeholder="https://example.com/service" onChange={event => { changed(); setTargetUrl(event.target.value) }} required /></label>
                <label className={styles.wide}>Niche context<textarea rows={3} value={nicheContext} onChange={event => { changed(); setNicheContext(event.target.value) }} placeholder="What market, offer, and audience context should guide this page?" required /></label>
                <label className={styles.wide}>Page goal<textarea rows={3} value={pageGoal} onChange={event => { changed(); setPageGoal(event.target.value) }} placeholder="What should this page help the reader understand or do?" required /></label>
                {workflow === 'create_new' ? <label className={styles.wide}>Manual primary keyword<input value={keyword} onChange={event => { changed(); setKeyword(event.target.value) }} required /></label> : <label>Refresh approach<select value={approach} onChange={event => { changed(); setApproach(event.target.value as typeof approach) }}>{capabilities.improve_approaches.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
              </div>
            </section>

            <section className={styles.formSection}>
              <div><span>3</span><h2>Outputs and authority</h2><p>Page Copy, Meta, and AIO FAQ stay separate. Standalone FAQ remains unchanged.</p></div>
              <div>
                <div className={styles.outputChoices}>{([['page_copy', 'Page Copy'], ['meta', 'Meta'], ['aio_faq', 'AIO FAQ']] as const).map(([id, label]) => <label key={id}><input type="checkbox" checked={outputs[id]} onChange={() => toggleOutput(id)} /><span><strong>{label}</strong><small>{id === 'aio_faq' ? 'AIO-only FAQ output' : 'Separate retained output'}</small></span></label>)}</div>
                {!outputSelected ? <p className={styles.fieldError}>Select at least one output.</p> : null}
                <div className={styles.formGrid}>
                  <label>Guidance profile<select value={guidance} onChange={event => { changed(); setGuidance(event.target.value) }}>{capabilities.guidance_profiles.map(item => <option key={item.id} value={item.id}>{item.label} · {item.version}</option>)}</select></label>
                  <label>Depth<input value="Standard · standard-v1" readOnly /></label>
                  <label className={styles.wide}>Provider and model<select value={providerIndex} onChange={event => { changed(); setProviderIndex(Number(event.target.value)) }}>{capabilities.provider_models.map((item, index) => <option key={`${item.provider}-${item.model}`} value={index}>{item.provider} · {item.model}{item.available ? '' : ' · unavailable'}</option>)}</select><small>The selected pair is explicit. AIO v2 never switches provider or model silently.</small></label>
                </div>
              </div>
            </section>
          </form>
        ) : null}
      </div>
    </AppLayout>
  )
}

