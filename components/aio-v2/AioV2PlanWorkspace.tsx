'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpenCheck,
  Ban,
  Check,
  ChevronRight,
  CircleDot,
  Database,
  FileSearch,
  Fingerprint,
  Link2,
  Lock,
  RotateCcw,
  Rocket,
  Save,
  ShieldCheck,
  Unlock,
} from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import AioV2JobLifecyclePanel from '@/components/aio-v2/AioV2JobLifecyclePanel'
import AioV2ResultsWorkspace from '@/components/aio-v2/AioV2ResultsWorkspace'
import {
  aioV2Api,
  toAioV2Revision,
  type AioV2PlanAction,
  type AioV2JobDetail,
  type AioV2PlanDetail,
  type AioV2PlanSection,
  type AioV2PlanSummary,
  type AioV2SectionRevision,
  type AioV2Sources,
  type AioV2UserLockedField,
} from '@/lib/api/aio-v2'
import { createClient } from '@/lib/supabase'
import styles from './AioV2PlanWorkspace.module.css'

type WorkspaceState = 'loading' | 'locked' | 'empty' | 'ready' | 'error'

const editableLocks: Array<{ field: AioV2UserLockedField; label: string }> = [
  { field: 'proposed_heading', label: 'Heading' },
  { field: 'responsibility', label: 'Purpose' },
  { field: 'coverage_points', label: 'Coverage' },
  { field: 'target_words_min', label: 'Word range' },
]

function pretty(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

function shortHash(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-6)}`
}

function safeExternalUrl(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

function timestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function revisionSnapshot(sections: AioV2SectionRevision[]) {
  return JSON.stringify(sections)
}

function actionOptions(workflow: string, sourceCount: number): AioV2PlanAction[] {
  if (workflow === 'create_new') return ['create']
  if (sourceCount === 0) return ['add']
  if (sourceCount > 1) return ['merge']
  return ['keep', 'refine', 'expand', 'reorder', 'remove']
}

function buildDraft(detail: AioV2PlanDetail) {
  return detail.plan.sections
    .map(toAioV2Revision)
    .sort((left, right) => left.order - right.order)
}

export default function AioV2PlanWorkspace({ jobId }: { jobId: string }) {
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>('loading')
  const [error, setError] = useState('')
  const [token, setToken] = useState('')
  const [job, setJob] = useState<AioV2JobDetail | null>(null)
  const [sources, setSources] = useState<AioV2Sources | null>(null)
  const [plans, setPlans] = useState<AioV2PlanSummary[]>([])
  const [detail, setDetail] = useState<AioV2PlanDetail | null>(null)
  const [draft, setDraft] = useState<AioV2SectionRevision[]>([])
  const [savedDraft, setSavedDraft] = useState('')
  const [revisionKey, setRevisionKey] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [acknowledgedRemovals, setAcknowledgedRemovals] = useState<string[]>([])
  const [approvalKey, setApprovalKey] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [cancelKey, setCancelKey] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [lifecycleNotice, setLifecycleNotice] = useState('')
  const [sourceTab, setSourceTab] = useState<'owned' | 'evidence' | 'keywords'>('evidence')

  const loadPlan = useCallback(async (authToken: string, version: number) => {
    const nextDetail = await aioV2Api.getPlan(authToken, jobId, version)
    const nextDraft = buildDraft(nextDetail)
    setDetail(nextDetail)
    setDraft(nextDraft)
    setSavedDraft(revisionSnapshot(nextDraft))
    setRevisionKey(null)
    setAcknowledgedRemovals(nextDetail.approval?.acknowledged_removal_ids ?? [])
  }, [jobId])

  const loadWorkspace = useCallback(async () => {
    setWorkspaceState('loading')
    setError('')
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session?.access_token) throw new Error('Please sign in again to open this workspace.')
      const authToken = session.access_token
      setToken(authToken)

      // Access is deliberately checked before any job-scoped data is requested.
      const access = await aioV2Api.getAccess(authToken)
      if (!access.enabled) {
        setWorkspaceState('locked')
        return
      }

      const nextJob = await aioV2Api.getJob(authToken, jobId)
      setJob(nextJob)
      const planResponse = await aioV2Api.listPlans(authToken, jobId)
      const orderedPlans = [...planResponse.plans].sort((left, right) => right.plan_version - left.plan_version)
      setPlans(orderedPlans)
      if (orderedPlans.length === 0) {
        setWorkspaceState('empty')
        return
      }
      const nextSources = await aioV2Api.getSources(authToken, jobId)
      setSources(nextSources)
      await loadPlan(authToken, orderedPlans[0].plan_version)
      setWorkspaceState('ready')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The AIO v2 workspace could not be loaded.')
      setWorkspaceState('error')
    }
  }, [jobId, loadPlan])

  useEffect(() => {
    void loadWorkspace()
  }, [loadWorkspace])

  const dirty = detail !== null && revisionSnapshot(draft) !== savedDraft
  const latestVersion = plans[0]?.plan_version ?? 0
  const viewingLatest = detail?.plan.plan_version === latestVersion
  const planEditable = viewingLatest && detail?.approved === false
  const pendingRemovals = detail?.plan.source_dispositions.filter(item => item.action === 'remove' && !item.approved_removal) ?? []
  const allRemovalsAcknowledged = pendingRemovals.every(item => acknowledgedRemovals.includes(item.source_section_id))
  const sectionById = useMemo(
    () => new Map(detail?.plan.sections.map(section => [section.id, section]) ?? []),
    [detail],
  )
  const evidenceById = useMemo(
    () => new Map(sources?.evidence_items.map(item => [item.id, item]) ?? []),
    [sources],
  )
  const keywordById = useMemo(
    () => new Map(sources?.keyword_candidates.map(item => [item.id, item]) ?? []),
    [sources],
  )

  function replaceSection(sectionId: string, update: (section: AioV2SectionRevision) => AioV2SectionRevision) {
    setDraft(current => current.map(section => section.id === sectionId ? update(section) : section))
    setRevisionKey(null)
  }

  function changeAction(sectionId: string, action: AioV2PlanAction) {
    replaceSection(sectionId, section => {
      if (action === 'remove') {
        return { ...section, action, included: false, target_words_min: 0, target_words_max: 0 }
      }
      const restoring = section.action === 'remove'
      const persisted = sectionById.get(sectionId)
      return {
        ...section,
        action,
        included: true,
        target_words_min: restoring ? persisted?.target_words_min ?? 0 : section.target_words_min,
        target_words_max: restoring ? persisted?.target_words_max ?? 0 : section.target_words_max,
      }
    })
  }

  function moveSection(sectionId: string, direction: -1 | 1) {
    setDraft(current => {
      const ordered = [...current].sort((left, right) => left.order - right.order)
      const index = ordered.findIndex(section => section.id === sectionId)
      const destination = index + direction
      if (index < 0 || destination < 0 || destination >= ordered.length) return current
      ;[ordered[index], ordered[destination]] = [ordered[destination], ordered[index]]
      return ordered.map((section, nextIndex) => ({ ...section, order: nextIndex + 1 }))
    })
    setRevisionKey(null)
  }

  function toggleLock(sectionId: string, field: AioV2UserLockedField) {
    replaceSection(sectionId, section => {
      const hasLock = section.user_locked_fields.includes(field)
      const related = field === 'target_words_min' ? ['target_words_min', 'target_words_max'] as AioV2UserLockedField[] : [field]
      const nextLocks = hasLock
        ? section.user_locked_fields.filter(value => !related.includes(value))
        : Array.from(new Set([...section.user_locked_fields, ...related]))
      return { ...section, user_locked_fields: nextLocks }
    })
  }

  function resetDraft() {
    if (!detail) return
    const nextDraft = buildDraft(detail)
    setDraft(nextDraft)
    setRevisionKey(null)
  }

  async function selectVersion(version: number) {
    if (!token || version === detail?.plan.plan_version) return
    setError('')
    try {
      await loadPlan(token, version)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That plan version could not be loaded.')
    }
  }

  async function saveRevision() {
    if (!detail || !token || !dirty || !planEditable) return
    const invalidSection = draft.find(section => (
      section.included && (
        !section.responsibility.trim()
        || section.coverage_points.length === 0
        || section.coverage_points.some(point => !point.trim())
        || section.target_words_min > section.target_words_max
      )
    ))
    if (invalidSection) {
      setError('Each included section needs a purpose, at least one coverage point, and a valid word range.')
      return
    }
    setSaving(true)
    setError('')
    const key = revisionKey || `aio-v2-plan-revision:${window.crypto.randomUUID()}`
    setRevisionKey(key)
    try {
      const nextDetail = await aioV2Api.revisePlan(
        token,
        jobId,
        detail.plan.plan_version,
        draft,
        key,
      )
      const nextDraft = buildDraft(nextDetail)
      setDetail(nextDetail)
      setDraft(nextDraft)
      setSavedDraft(revisionSnapshot(nextDraft))
      setRevisionKey(null)
      try {
        const response = await aioV2Api.listPlans(token, jobId)
        setPlans([...response.plans].sort((left, right) => right.plan_version - left.plan_version))
      } catch {
        setPlans(current => [{
          plan_id: nextDetail.plan_id,
          plan_version: nextDetail.plan.plan_version,
          plan_hash: nextDetail.plan_hash,
          draft_valid: nextDetail.plan.validation_summary.draft_valid,
          approval_valid: nextDetail.plan.validation_summary.approval_valid,
          approved: nextDetail.approved,
          created_by: nextDetail.plan.created_by,
          created_at: nextDetail.plan.created_at,
        }, ...current])
        setError('The new version was saved, but the history list could not be refreshed.')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The revision could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  function toggleRemovalAcknowledgement(sourceSectionId: string) {
    setAcknowledgedRemovals(current => (
      current.includes(sourceSectionId)
        ? current.filter(value => value !== sourceSectionId)
        : [...current, sourceSectionId]
    ))
    setApprovalKey(null)
  }

  async function approveAndGenerate() {
    if (!detail || !token || detail.approved || !viewingLatest || dirty || !allRemovalsAcknowledged) return
    setApproving(true)
    setError('')
    setLifecycleNotice('')
    const key = approvalKey || `aio-v2-plan-approval:${window.crypto.randomUUID()}`
    setApprovalKey(key)
    try {
      const result = await aioV2Api.approveAndGenerate(
        token,
        jobId,
        detail.plan.plan_version,
        pendingRemovals.map(item => item.source_section_id),
        key,
      )
      const nextDetail = result.plan
      const nextDraft = buildDraft(nextDetail)
      setDetail(nextDetail)
      setDraft(nextDraft)
      setSavedDraft(revisionSnapshot(nextDraft))
      setAcknowledgedRemovals(nextDetail.approval?.acknowledged_removal_ids ?? [])
      setApprovalKey(null)
      setLifecycleNotice('The exact plan is approved. Generation is queued with checkpoints and no automatic rewrite loop.')
      setPlans(current => current.map(plan => (
        plan.plan_id === nextDetail.plan_id ? { ...plan, approved: true, approval_valid: true } : plan
      )))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The plan could not be approved.')
    } finally {
      setApproving(false)
    }
  }

  async function cancelJob() {
    if (!token || cancelling) return
    setCancelling(true)
    setError('')
    const key = cancelKey || `aio-v2-job-cancel:${window.crypto.randomUUID()}`
    setCancelKey(key)
    try {
      const result = await aioV2Api.cancelJob(token, jobId, key)
      setCancelKey(null)
      setLifecycleNotice(
        result.state === 'cancelled'
          ? 'This job is cancelled.'
          : 'Cancellation is requested. Any completed section remains safely retained.',
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Cancellation could not be requested.')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <AppLayout title="AIO v2 · Page plan">
      <div className={styles.page}>
        {job && token && workspaceState !== 'locked' ? <AioV2JobLifecyclePanel job={job} token={token} onRefresh={loadWorkspace} /> : null}
        {workspaceState === 'loading' ? <WorkspaceLoading /> : null}
        {workspaceState === 'locked' ? <WorkspaceLocked /> : null}
        {workspaceState === 'empty' ? <WorkspaceEmpty job={job} onRetry={() => void loadWorkspace()} /> : null}
        {workspaceState === 'error' ? <WorkspaceError message={error} onRetry={() => void loadWorkspace()} /> : null}
        {workspaceState === 'ready' && detail && sources ? (
          <>
            <header className={styles.hero}>
              <div>
                <span className={styles.eyebrow}><BookOpenCheck size={13} /> AIO v2 planning desk</span>
                <h1>Shape the page before any copy is generated.</h1>
                <p>Every section stays connected to its frozen sources, keywords, and evidence. Saving creates a new immutable plan version.</p>
              </div>
              <div className={styles.heroFacts}>
                <span><strong>{pretty(detail.plan.workflow)}</strong><small>Workflow</small></span>
                <span><strong>{pretty(detail.plan.page_type)}</strong><small>Page type</small></span>
                <span><strong>{detail.plan.page_words_min}–{detail.plan.page_words_max}</strong><small>Planned words</small></span>
              </div>
            </header>

            <div className={styles.provenanceRail} aria-label="AIO v2 provenance flow">
              <span><Database size={14} /> Frozen sources</span>
              <ChevronRight size={14} />
              <span><FileSearch size={14} /> Eligible evidence</span>
              <ChevronRight size={14} />
              <span className={styles.provenanceActive}><BookOpenCheck size={14} /> Page plan v{detail.plan.plan_version}</span>
            </div>

            {error ? (
              <div className={styles.inlineError} role="alert"><AlertTriangle size={15} /><span>{error}</span></div>
            ) : null}
            {lifecycleNotice ? <div className={styles.lifecycleNotice} role="status"><Check size={15} /><span>{lifecycleNotice}</span></div> : null}

            <div className={styles.workspaceGrid}>
              <aside className={styles.sourcePanel} aria-label="Frozen planning sources">
                <div className={styles.panelHeader}>
                  <div><span className={styles.panelKicker}>Source ledger</span><h2>What the plan can use</h2></div>
                  <span className={styles.countBadge}>{sources.snapshots.length} snapshots</span>
                </div>
                <div className={styles.sourceTabs} role="tablist" aria-label="Source categories">
                  {(['evidence', 'owned', 'keywords'] as const).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={sourceTab === tab}
                      className={sourceTab === tab ? styles.sourceTabActive : undefined}
                      onClick={() => setSourceTab(tab)}
                    >
                      {pretty(tab)}
                    </button>
                  ))}
                </div>
                <div className={styles.sourceBody}>
                  {sourceTab === 'evidence' ? (
                    sources.evidence_items.length ? sources.evidence_items.map(item => {
                      const sourceHref = safeExternalUrl(item.source_url)
                      return (
                        <article key={item.id} className={styles.evidenceCard}>
                          <div><span className={styles.classification} data-classification={item.classification}>{pretty(item.classification)}</span><code>{item.id}</code></div>
                          <p>{item.captured_excerpt}</p>
                          <small>{item.eligibility_reason}</small>
                          {sourceHref ? <a href={sourceHref} target="_blank" rel="noreferrer"><Link2 size={12} /> View captured source</a> : null}
                        </article>
                      )
                    }) : <EmptyLedger text="No evidence items were retained for this plan." />
                  ) : null}
                  {sourceTab === 'owned' ? (
                    <>
                      {safeExternalUrl(sources.owned_source_url) ? <a className={styles.ownedUrl} href={safeExternalUrl(sources.owned_source_url) || undefined} target="_blank" rel="noreferrer"><Link2 size={13} /> {sources.owned_source_url}</a> : null}
                      {sources.owned_sections.length ? sources.owned_sections.map(section => (
                        <article key={section.id} className={styles.ownedCard}>
                          <div><strong>{section.heading || 'Untitled source section'}</strong><code>{section.id}</code></div>
                          <p>{section.node_count} nodes · {section.fact_count} facts · {section.link_count} links · {section.cta_count} CTAs</p>
                        </article>
                      )) : <EmptyLedger text="This Create New plan has no owned-page sections." />}
                    </>
                  ) : null}
                  {sourceTab === 'keywords' ? (
                    sources.keyword_candidates.length ? sources.keyword_candidates.map(keyword => (
                      <article key={keyword.id} className={styles.keywordCard}>
                        <span className={keyword.primary ? styles.primaryKeyword : undefined}><CircleDot size={12} /> {keyword.primary ? 'Frozen primary' : 'Supporting'}</span>
                        <strong>{keyword.keyword}</strong>
                        <small>{keyword.source || 'Source not labelled'} · {keyword.id}</small>
                      </article>
                    )) : <EmptyLedger text="No eligible keyword candidates were retained." />
                  ) : null}
                </div>
              </aside>

              <main className={styles.planPanel}>
                <div className={styles.planHeader}>
                  <div>
                    <span className={styles.panelKicker}>Editable structure</span>
                    <h2>{detail.plan.page_through_line}</h2>
                    <p>{detail.plan.primary_goal}</p>
                  </div>
                  <div className={styles.planHeaderActions}>
                    <button type="button" className="btn-ghost" disabled={!dirty || saving || !planEditable} onClick={resetDraft}><RotateCcw size={14} /> Reset</button>
                    <button type="button" className="btn-primary" disabled={!dirty || saving || !planEditable} onClick={() => void saveRevision()}>
                      <Save size={14} /> {saving ? 'Saving…' : revisionKey ? 'Retry save' : 'Save new version'}
                    </button>
                  </div>
                </div>

                {!viewingLatest ? (
                  <div className={styles.historyNotice}>You are viewing an earlier immutable version. Open version {latestVersion} to make edits.</div>
                ) : null}
                {detail.approved ? <div className={styles.approvedNotice}><ShieldCheck size={14} /> This exact version is approved and immutable.</div> : null}

                <div className={styles.sectionList}>
                  {draft.map((section, index) => {
                    const authority = sectionById.get(section.id)
                    const sectionEvidence = section.evidence_item_ids.map(id => evidenceById.get(id)).filter(Boolean)
                    const sectionKeywords = section.keyword_candidate_ids.map(id => keywordById.get(id)).filter(Boolean)
                    const options = actionOptions(detail.plan.workflow, authority?.source_section_ids.length ?? 0)
                    return (
                      <article key={section.id} className={styles.sectionCard} data-removed={section.action === 'remove'}>
                        <div className={styles.sectionIndex} aria-hidden="true">{String(index + 1).padStart(2, '0')}</div>
                        <div className={styles.sectionContent}>
                          <div className={styles.sectionTopline}>
                            <div className={styles.sectionLabels}>
                              <span>{authority?.heading_level.toUpperCase()}</span>
                              <span>{pretty(authority?.module_role || '')}</span>
                              {authority?.source_section_ids.map(id => <code key={id}>{id}</code>)}
                            </div>
                            <div className={styles.orderButtons}>
                              <button type="button" aria-label={`Move section ${index + 1} up`} disabled={!planEditable || index === 0} onClick={() => moveSection(section.id, -1)}><ArrowUp size={13} /></button>
                              <button type="button" aria-label={`Move section ${index + 1} down`} disabled={!planEditable || index === draft.length - 1} onClick={() => moveSection(section.id, 1)}><ArrowDown size={13} /></button>
                            </div>
                          </div>

                          <div className={styles.sectionHeadingRow}>
                            <input
                              aria-label={`Proposed heading for section ${index + 1}`}
                              className={styles.headingInput}
                              value={section.proposed_heading || ''}
                              disabled={!planEditable || section.action === 'remove'}
                              placeholder="No visible heading"
                              onChange={event => replaceSection(section.id, current => ({ ...current, proposed_heading: event.target.value || null }))}
                            />
                            <select
                              aria-label={`Action for section ${index + 1}`}
                              className={styles.actionSelect}
                              value={section.action}
                              disabled={!planEditable || options.length === 1}
                              onChange={event => changeAction(section.id, event.target.value as AioV2PlanAction)}
                            >
                              {options.map(option => <option key={option} value={option}>{pretty(option)}</option>)}
                            </select>
                          </div>

                          {authority?.current_heading ? <p className={styles.currentHeading}>Current page: “{authority.current_heading}”</p> : null}
                          <label className={styles.fieldLabel}>
                            Section purpose
                            <textarea
                              value={section.responsibility}
                              disabled={!planEditable || section.action === 'remove'}
                              rows={2}
                              onChange={event => replaceSection(section.id, current => ({ ...current, responsibility: event.target.value }))}
                            />
                          </label>

                          <div className={styles.sectionFields}>
                            <label className={styles.fieldLabel}>
                              Coverage points <small>One point per line</small>
                              <textarea
                                value={section.coverage_points.join('\n')}
                                disabled={!planEditable || section.action === 'remove'}
                                rows={3}
                                onChange={event => replaceSection(section.id, current => ({
                                  ...current,
                                  coverage_points: event.target.value.split('\n').map(value => value.trim()).filter(Boolean),
                                }))}
                              />
                            </label>
                            <div className={styles.wordField}>
                              <span>Target words</span>
                              <div>
                                <input
                                  type="number"
                                  min={0}
                                  max={10000}
                                  aria-label={`Minimum words for section ${index + 1}`}
                                  value={section.target_words_min}
                                  disabled={!planEditable || section.action === 'remove'}
                                  onChange={event => replaceSection(section.id, current => ({ ...current, target_words_min: Number(event.target.value) }))}
                                />
                                <span>to</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={10000}
                                  aria-label={`Maximum words for section ${index + 1}`}
                                  value={section.target_words_max}
                                  disabled={!planEditable || section.action === 'remove'}
                                  onChange={event => replaceSection(section.id, current => ({ ...current, target_words_max: Number(event.target.value) }))}
                                />
                              </div>
                            </div>
                          </div>

                          <div className={styles.referenceStrip}>
                            <span><Fingerprint size={12} /> {sectionKeywords.length ? sectionKeywords.map(item => item?.keyword).join(', ') : 'No keyword placement'}</span>
                            <span><FileSearch size={12} /> {sectionEvidence.length} evidence item{sectionEvidence.length === 1 ? '' : 's'}</span>
                            <span><ShieldCheck size={12} /> {pretty(authority?.proof_policy || 'no_claims')}</span>
                          </div>

                          <div className={styles.lockRow} aria-label={`User locks for section ${index + 1}`}>
                            <span>Keep in later stages</span>
                            {editableLocks.map(lock => {
                              const active = section.user_locked_fields.includes(lock.field)
                              return (
                                <button
                                  key={lock.field}
                                  type="button"
                                  aria-pressed={active}
                                  disabled={!planEditable}
                                  className={active ? styles.lockActive : undefined}
                                  onClick={() => toggleLock(section.id, lock.field)}
                                >
                                  {active ? <Lock size={11} /> : <Unlock size={11} />} {lock.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </main>

              <aside className={styles.reviewPanel} aria-label="Plan validation and history">
                <section className={styles.reviewCard}>
                  <div className={styles.reviewTitle}><ShieldCheck size={16} /><div><span className={styles.panelKicker}>Validation</span><h2>Plan readiness</h2></div></div>
                  <div className={styles.readinessRows}>
                    <div data-ready={detail.plan.validation_summary.draft_valid}><span>Draft contract</span><strong>{detail.plan.validation_summary.draft_valid ? <><Check size={13} /> Ready</> : 'Needs work'}</strong></div>
                    <div data-ready={detail.plan.validation_summary.approval_valid}><span>Approval contract</span><strong>{detail.plan.validation_summary.approval_valid ? <><Check size={13} /> Ready</> : 'Blocked'}</strong></div>
                  </div>
                  {detail.plan.warnings.length ? (
                    <div className={styles.warningList}>
                      {detail.plan.warnings.map(warning => (
                        <div key={`${warning.code}-${warning.severity}`} data-severity={warning.severity}>
                          <AlertTriangle size={13} /><p><strong>{pretty(warning.code)}</strong><span>{warning.message}</span></p>
                        </div>
                      ))}
                    </div>
                  ) : <p className={styles.clearMessage}><Check size={14} /> No plan warnings.</p>}
                </section>

                {pendingRemovals.length ? (
                  <section className={styles.removalCard}>
                    <span className={styles.panelKicker}>Explicit approval decision</span>
                    <h2>Proposed removals</h2>
                    <p>Planning proposed these removals, but only you can approve them. Check every item before generation can start.</p>
                    {pendingRemovals.map(item => (
                      <label key={item.source_section_id} className={styles.removalDecision}>
                        <input
                          type="checkbox"
                          checked={acknowledgedRemovals.includes(item.source_section_id)}
                          disabled={detail.approved || approving}
                          onChange={() => toggleRemovalAcknowledgement(item.source_section_id)}
                        />
                        <AlertTriangle size={13} />
                        <span><strong>{item.source_section_id}</strong><small>{item.reason}</small></span>
                      </label>
                    ))}
                  </section>
                ) : null}

                <section className={styles.approvalCard}>
                  <div className={styles.reviewTitle}><Rocket size={16} /><div><span className={styles.panelKicker}>Approval gate</span><h2>{detail.approved ? 'Generation queued' : 'Approve exact plan'}</h2></div></div>
                  {detail.approved && detail.approval ? (
                    <>
                      <p>This plan version and its source, evidence, lock, provider, and prompt authority are frozen.</p>
                      <code>{shortHash(detail.approval.approval_hash)}</code>
                      <button type="button" className="btn-ghost" disabled={cancelling} onClick={() => void cancelJob()}><Ban size={14} /> {cancelling ? 'Requesting…' : cancelKey ? 'Retry cancellation' : 'Cancel generation'}</button>
                    </>
                  ) : (
                    <>
                      <p>Approval is irreversible for this job. Future planning requires a duplicate job; generation will use this version exactly once per required section.</p>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={approving || dirty || !viewingLatest || !detail.plan.validation_summary.draft_valid || !allRemovalsAcknowledged}
                        onClick={() => void approveAndGenerate()}
                      >
                        <Rocket size={14} /> {approving ? 'Approving…' : approvalKey ? 'Retry approval' : 'Approve & generate'}
                      </button>
                      {dirty ? <small>Save or reset your edits before approval.</small> : null}
                    </>
                  )}
                </section>

                <section className={styles.reviewCard}>
                  <div className={styles.reviewTitle}><Fingerprint size={16} /><div><span className={styles.panelKicker}>Immutable history</span><h2>Plan versions</h2></div></div>
                  <div className={styles.versionList}>
                    {plans.map(plan => (
                      <button
                        key={plan.plan_id}
                        type="button"
                        aria-current={plan.plan_version === detail.plan.plan_version ? 'true' : undefined}
                        onClick={() => void selectVersion(plan.plan_version)}
                      >
                        <span><strong>Version {plan.plan_version}</strong><small>{timestamp(plan.created_at)} · {pretty(plan.created_by)}</small></span>
                        <code>{shortHash(plan.plan_hash)}</code>
                      </button>
                    ))}
                  </div>
                </section>

                <section className={styles.contractCard}>
                  <span><Database size={13} /> Frozen contract</span>
                  <code>{detail.plan.schema_version}</code>
                  <p>{detail.plan.source_snapshot_ids_and_hashes.length} snapshot hashes · {pretty(detail.plan.guidance_profile.id)} guidance {detail.plan.guidance_profile.version}</p>
                </section>
              </aside>
            </div>
            {detail.approved ? <AioV2ResultsWorkspace jobId={jobId} token={token} /> : null}
          </>
        ) : null}
      </div>
    </AppLayout>
  )
}

function EmptyLedger({ text }: { text: string }) {
  return <p className={styles.emptyLedger}>{text}</p>
}

function WorkspaceLoading() {
  return <div className={styles.stateCard} aria-live="polite"><span className={styles.stateMark} /><h1>Opening the planning desk</h1><p>Checking access before loading any job data.</p></div>
}

function WorkspaceLocked() {
  return <div className={styles.stateCard}><Lock size={24} /><h1>AIO v2 is not enabled for this account</h1><p>This private workspace stays hidden until a named beta entitlement is granted.</p></div>
}

function WorkspaceEmpty({ job, onRetry }: { job: AioV2JobDetail | null; onRetry: () => void }) {
  const description = job?.state === 'failed'
    ? 'Planning failed safely. Use Retry planning above to start again from the frozen inputs.'
    : job?.state === 'cancelled'
      ? 'This job was cancelled before a page plan was retained.'
      : 'Planning is queued or in progress. No provider or model will be switched silently.'
  return <div className={styles.stateCard}><BookOpenCheck size={24} /><h1>No page plan is ready yet</h1><p>{description}</p><button type="button" className="btn-ghost" onClick={onRetry}>Check again</button></div>
}

function WorkspaceError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className={styles.stateCard}><AlertTriangle size={24} /><h1>The planning desk is unavailable</h1><p>{message}</p><button type="button" className="btn-ghost" onClick={onRetry}>Try again</button></div>
}
