'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Copy,
  FilePlus2,
  Lock,
  RefreshCw,
} from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import { aioV2Api, type AioV2JobSummary } from '@/lib/api/aio-v2'
import { createClient } from '@/lib/supabase'
import styles from './AioV2JobsWorkspace.module.css'

type LoadState = 'loading' | 'locked' | 'ready' | 'error'
type PendingAction = { jobId: string; type: 'archive' | 'duplicate'; key: string; busy: boolean }

function pretty(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

function date(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

export default function AioV2JobsWorkspace() {
  const router = useRouter()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [token, setToken] = useState('')
  const [jobs, setJobs] = useState<AioV2JobSummary[]>([])
  const [error, setError] = useState('')
  const [pending, setPending] = useState<PendingAction | null>(null)

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
      const response = await aioV2Api.listJobs(session.access_token)
      setToken(session.access_token)
      setJobs(response.jobs)
      setLoadState('ready')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'AIO v2 job history could not be loaded.')
      setLoadState('error')
    }
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  async function archive(job: AioV2JobSummary) {
    if (!token || pending?.busy) return
    const action = pending?.jobId === job.job_id && pending.type === 'archive'
      ? pending
      : { jobId: job.job_id, type: 'archive' as const, key: `aio-v2-archive:${window.crypto.randomUUID()}`, busy: false }
    setPending({ ...action, busy: true })
    setError('')
    try {
      const result = await aioV2Api.archiveJob(token, job.job_id, action.key)
      setJobs(current => current.map(item => item.job_id === job.job_id
        ? { ...item, archived_at: result.archived_at }
        : item))
      setPending(null)
    } catch (cause) {
      setPending({ ...action, busy: false })
      setError(cause instanceof Error ? cause.message : 'The job could not be archived.')
    }
  }

  async function duplicate(job: AioV2JobSummary) {
    if (!token || pending?.busy) return
    const action = pending?.jobId === job.job_id && pending.type === 'duplicate'
      ? pending
      : { jobId: job.job_id, type: 'duplicate' as const, key: `aio-v2-duplicate:${window.crypto.randomUUID()}`, busy: false }
    setPending({ ...action, busy: true })
    setError('')
    try {
      const result = await aioV2Api.duplicateJob(token, job.job_id, action.key)
      setPending(null)
      router.push(`/all-in-one-v2/jobs/${result.job.job_id}`)
    } catch (cause) {
      setPending({ ...action, busy: false })
      setError(cause instanceof Error ? cause.message : 'The job could not be duplicated.')
    }
  }

  return (
    <AppLayout title="AIO v2">
      <div className={styles.page}>
        <header className={styles.hero}>
          <div>
            <span>Private beta workspace</span>
            <h1>AIO v2 jobs</h1>
            <p>Create or refresh a page through an explicit plan, approval, generation, and export trail.</p>
          </div>
          <Link href="/all-in-one-v2/jobs/new" className="btn-primary"><FilePlus2 size={15} /> New AIO v2 job</Link>
        </header>

        {error ? <div className={styles.error} role="alert"><AlertTriangle size={15} /> {error}</div> : null}
        {loadState === 'loading' ? <StateCard title="Loading AIO v2 history" text="Checking access before requesting job data." /> : null}
        {loadState === 'locked' ? <StateCard icon={<Lock size={22} />} title="AIO v2 is not enabled" text="This route remains hidden and unavailable without a named beta entitlement." /> : null}
        {loadState === 'error' ? <StateCard icon={<AlertTriangle size={22} />} title="Job history is unavailable" text={error} action={<button type="button" className="btn-ghost" onClick={() => void load()}><RefreshCw size={14} /> Try again</button>} /> : null}

        {loadState === 'ready' ? (
          jobs.length ? (
            <div className={styles.jobs}>
              {jobs.map(job => {
                const isActive = ['planning_queued', 'acquiring', 'planning', 'generation_queued', 'generating', 'cancelling'].includes(job.state)
                return (
                  <article key={job.job_id} className={styles.job} data-archived={job.archived_at !== null}>
                    <div className={styles.jobMain}>
                      <div className={styles.jobTopline}>
                        <span>{job.workflow === 'create_new' ? 'Create New Page' : 'Refresh Existing Page'}</span>
                        <strong data-state={job.state}>{pretty(job.state)}</strong>
                        {job.archived_at ? <em>Archived</em> : null}
                      </div>
                      <h2>{job.target_url}</h2>
                      <p>{pretty(job.page_type)} · {pretty(job.guidance_profile_id)} · {job.provider} / {job.model}</p>
                      <div className={styles.outputs}>
                        {job.requested_outputs.page_copy ? <span>Page Copy</span> : null}
                        {job.requested_outputs.meta ? <span>Meta</span> : null}
                        {job.requested_outputs.aio_faq ? <span>AIO FAQ</span> : null}
                      </div>
                    </div>
                    <div className={styles.jobSide}>
                      <small>Created {date(job.created_at)}</small>
                      <Link href={`/all-in-one-v2/jobs/${job.job_id}`}>Open workspace <ArrowRight size={13} /></Link>
                      <div>
                        <button type="button" disabled={pending?.busy === true} onClick={() => void duplicate(job)}><Copy size={13} /> Duplicate</button>
                        <button type="button" disabled={pending?.busy === true || isActive || job.archived_at !== null} onClick={() => void archive(job)}><Archive size={13} /> Archive</button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <StateCard title="No AIO v2 jobs yet" text="Start with Create New Page or Refresh Existing Page. No current-AIO job will be changed." action={<Link href="/all-in-one-v2/jobs/new" className="btn-primary"><FilePlus2 size={14} /> Create first job</Link>} />
          )
        ) : null}
      </div>
    </AppLayout>
  )
}

function StateCard({
  icon,
  title,
  text,
  action,
}: {
  icon?: React.ReactNode
  title: string
  text: string
  action?: React.ReactNode
}) {
  return <section className={styles.stateCard}>{icon}<h2>{title}</h2><p>{text}</p>{action}</section>
}
