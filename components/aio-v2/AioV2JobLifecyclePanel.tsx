'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Ban,
  Clock3,
  Copy,
  RefreshCw,
  RotateCcw,
} from 'lucide-react'
import {
  aioV2Api,
  type AioV2Event,
  type AioV2JobDetail,
  type AioV2Operation,
} from '@/lib/api/aio-v2'
import styles from './AioV2JobLifecyclePanel.module.css'

type ActionName = 'retry' | 'replan' | 'archive' | 'duplicate' | `cancel:${string}`
type RetryState = { action: ActionName; key: string; busy: boolean } | null

function pretty(value: string) {
  return value.replaceAll('_', ' ').replaceAll('.', ' · ').replace(/\b\w/g, letter => letter.toUpperCase())
}

function date(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function AioV2JobLifecyclePanel({
  job,
  token,
  onRefresh,
}: {
  job: AioV2JobDetail
  token: string
  onRefresh: () => Promise<void>
}) {
  const router = useRouter()
  const [operations, setOperations] = useState<AioV2Operation[]>([])
  const [events, setEvents] = useState<AioV2Event[]>([])
  const [retryState, setRetryState] = useState<RetryState>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadLedger = useCallback(async () => {
    try {
      const [operationResponse, eventResponse] = await Promise.all([
        aioV2Api.listOperations(token, job.job_id),
        aioV2Api.listEvents(token, job.job_id),
      ])
      setOperations(operationResponse.operations)
      setEvents(eventResponse.events)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The lifecycle ledger could not be loaded.')
    }
  }, [job.job_id, token])

  useEffect(() => {
    void loadLedger()
  }, [loadLedger])

  function retryFor(action: ActionName, prefix: string) {
    return retryState?.action === action
      ? retryState
      : { action, key: `${prefix}:${window.crypto.randomUUID()}`, busy: false }
  }

  async function run(action: 'retry' | 'replan' | 'archive' | 'duplicate') {
    if (retryState?.busy) return
    const retry = retryFor(action, `aio-v2-${action}`)
    setRetryState({ ...retry, busy: true })
    setError('')
    setNotice('')
    try {
      if (action === 'retry') {
        await aioV2Api.retryPlanning(token, job.job_id, retry.key)
        setNotice('Planning retry queued from the frozen job inputs.')
      } else if (action === 'replan') {
        await aioV2Api.replanJob(token, job.job_id, retry.key)
        setNotice('One explicit pre-approval replan is queued.')
      } else if (action === 'archive') {
        await aioV2Api.archiveJob(token, job.job_id, retry.key)
        setNotice('The job is archived. Its history and retained evidence remain readable.')
      } else {
        const result = await aioV2Api.duplicateJob(token, job.job_id, retry.key)
        setRetryState(null)
        router.push(`/all-in-one-v2/jobs/${result.job.job_id}`)
        return
      }
      setRetryState(null)
      await Promise.all([onRefresh(), loadLedger()])
    } catch (cause) {
      setRetryState({ ...retry, busy: false })
      setError(cause instanceof Error ? cause.message : 'The lifecycle action could not be completed.')
    }
  }

  async function cancel(operation: AioV2Operation) {
    if (retryState?.busy) return
    const action: ActionName = `cancel:${operation.operation_id}`
    const retry = retryFor(action, 'aio-v2-cancel-operation')
    setRetryState({ ...retry, busy: true })
    setError('')
    setNotice('')
    try {
      const result = await aioV2Api.cancelOperation(token, job.job_id, operation.operation_id, retry.key)
      setRetryState(null)
      setNotice(result.status === 'cancelled'
        ? 'The queued secondary operation is cancelled. The last complete result is unchanged.'
        : 'Cancellation is requested. The worker will stop before the next external call.')
      await loadLedger()
    } catch (cause) {
      setRetryState({ ...retry, busy: false })
      setError(cause instanceof Error ? cause.message : 'The operation could not be cancelled.')
    }
  }

  const activePrimary = ['planning_queued', 'acquiring', 'planning', 'generation_queued', 'generating', 'cancelling'].includes(job.state)
  const activeSecondary = operations.filter(operation => (
    ['regeneration', 'export'].includes(operation.operation_type)
    && ['queued', 'running'].includes(operation.status)
  ))

  return (
    <section className={styles.panel} aria-label="AIO v2 job lifecycle">
      <div className={styles.topline}>
        <Link href="/all-in-one-v2/jobs"><ArrowLeft size={13} /> All AIO v2 jobs</Link>
        <div><span>{job.workflow === 'create_new' ? 'Create New Page' : 'Refresh Existing Page'}</span><strong data-state={job.state}>{pretty(job.state)}</strong>{job.archived_at ? <em>Archived</em> : null}</div>
      </div>
      <div className={styles.summary}>
        <div><h2>{job.target_url}</h2><p>{pretty(job.page_type)} · {pretty(job.guidance_profile_id)} {job.guidance_profile_version} · {job.provider} / {job.model}</p></div>
        <div className={styles.actions}>
          {job.state === 'failed' && !job.archived_at ? <button type="button" disabled={retryState?.busy} onClick={() => void run('retry')}><RefreshCw size={13} /> Retry planning</button> : null}
          {job.state === 'plan_ready' && !job.archived_at ? <button type="button" disabled={retryState?.busy} onClick={() => void run('replan')}><RotateCcw size={13} /> Replan</button> : null}
          <button type="button" disabled={retryState?.busy} onClick={() => void run('duplicate')}><Copy size={13} /> Duplicate</button>
          {!activePrimary && !job.archived_at ? <button type="button" disabled={retryState?.busy} onClick={() => void run('archive')}><Archive size={13} /> Archive</button> : null}
        </div>
      </div>
      {error ? <div className={styles.error} role="alert"><AlertTriangle size={14} /> {error}</div> : null}
      {notice ? <div className={styles.notice} role="status">{notice}</div> : null}
      {activeSecondary.length ? <div className={styles.activeOperations}>{activeSecondary.map(operation => <div key={operation.operation_id}><span><Clock3 size={13} /><strong>{pretty(operation.operation_type)}</strong><small>{pretty(operation.status)}</small></span><button type="button" disabled={retryState?.busy} onClick={() => void cancel(operation)}><Ban size={12} /> Cancel operation</button></div>)}</div> : null}
      <details className={styles.ledger}>
        <summary>Lifecycle ledger · {operations.length} operations · {events.length} events</summary>
        <div className={styles.ledgerGrid}>
          <section><h3>Operations</h3>{operations.length ? operations.map(operation => <article key={operation.operation_id}><div><strong>{pretty(operation.operation_type)}</strong><span>{pretty(operation.status)}</span></div><small>{date(operation.created_at)}{operation.safe_error_code ? ` · ${pretty(operation.safe_error_code)}` : ''}</small></article>) : <p>No operations recorded.</p>}</section>
          <section><h3>Safe events</h3>{events.length ? events.map(event => <article key={event.event_id}><div><strong>{pretty(event.event_code)}</strong><span>{pretty(event.stage)}</span></div><small>{date(event.created_at)}</small></article>) : <p>No events recorded.</p>}</section>
        </div>
      </details>
    </section>
  )
}

