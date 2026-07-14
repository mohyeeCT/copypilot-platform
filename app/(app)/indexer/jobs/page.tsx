'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, PlusCircle, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import AppLayout from '@/components/layout/AppLayout'
import workspaceStyles from '@/components/meta/MetaCopyWorkspace.module.css'
import { JobLauncherShell, JobSummaryBar, JobSummaryPills } from '@/components/ui/JobLauncher'
import { createClient } from '@/lib/supabase'
import { indexerApi } from '@/lib/api/indexer'
import { getSettings, type GscSettings } from '@/lib/api/shared'

export const dynamic = 'force-dynamic'

type Job = {
  id: string
  name: string
  status: string
  total_urls: number
  submitted_urls: number
  failed_urls: number
  queued_urls: number
  current_step: string
  created_at: string
}

type Quota = {
  used: number
  remaining: number
  limit: number
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize', {
        'bg-accent/10 text-accent': status === 'running',
        'bg-success/10 text-success': status === 'complete',
        'bg-error/10 text-error': status === 'error',
        'bg-warning/10 text-warning': status !== 'running' && status !== 'complete' && status !== 'error',
      })}
    >
      {status}
    </span>
  )
}

async function getToken() {
  const sb = createClient()
  const { data: { session } } = await sb.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return session.access_token
}

export default function IndexerJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [quota, setQuota] = useState<Quota | null>(null)
  const [gscSettings, setGscSettings] = useState<GscSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const token = await getToken()
      const [jobsData, quotaData] = await Promise.all([
        indexerApi.listJobs(token),
        indexerApi.getQuota(token),
      ])
      setJobs(jobsData)
      setQuota(quotaData)
      const settings = await getSettings(token).catch(() => null)
      if (settings?.gsc) setGscSettings(settings.gsc as GscSettings)
      setLoadError('')
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load Indexer data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!jobs.some(job => job.status === 'running')) return
    const interval = setInterval(() => { void load() }, 4000)
    return () => clearInterval(interval)
  }, [jobs, load])

  async function handleDelete(id: string) {
    if (!confirm('Delete this Indexer job?')) return
    setDeleting(id)
    try {
      const token = await getToken()
      await indexerApi.deleteJob(token, id)
      setJobs(prev => prev.filter(job => job.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  const quotaPct = quota ? Math.min((quota.used / quota.limit) * 100, 100) : 0
  const authLabel = gscSettings?.active_method === 'google_oauth' ? 'Google account' : 'Service account'
  const oauthNeedsReconnect = Boolean(
    gscSettings?.active_method === 'google_oauth' &&
    gscSettings.google_oauth.configured &&
    gscSettings.google_oauth.has_indexing_scope === false
  )

  return (
    <AppLayout title="Indexer">
      <div className={`max-w-full ${workspaceStyles.newPage}`}>
        <JobLauncherShell
          compact
          eyebrow="Indexer"
          title="Indexer Jobs"
          description="Submit URLs to Google's Indexing API and track daily quota, queued URLs, and submission results."
          summary={
            <JobSummaryBar
              summaryItems={[
                { label: 'Jobs', value: jobs.length },
                { label: 'Quota', value: quota ? `${quota.remaining} left` : 'Loading' },
                { label: 'Auth', value: <JobSummaryPills items={[
                  { label: authLabel, tone: oauthNeedsReconnect ? 'muted' : 'accent' },
                  ...(oauthNeedsReconnect ? [{ label: 'Reconnect needed', tone: 'muted' as const }] : []),
                ]} /> },
                { label: 'Status', value: jobs.some(job => job.status === 'running') ? 'Running' : 'Ready' },
              ]}
            />
          }
          actions={
            <Link href="/indexer/jobs/new" className="btn-primary gap-2">
              <PlusCircle size={15} />
              Run Job
            </Link>
          }
        >
          {quota && (
            <div className="rounded-lg border border-border bg-surface-raised p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-text">Daily quota</span>
                <span className="text-xs text-muted">{quota.used} / {quota.limit} used today</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-border">
                <div
                  className={clsx('h-1.5 rounded-full transition-[width,background-color]', {
                    'bg-accent': quotaPct < 70,
                    'bg-warning': quotaPct >= 70 && quotaPct < 90,
                    'bg-error': quotaPct >= 90,
                  })}
                  style={{ width: `${quotaPct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted">
                {quota.remaining} submissions remaining today. Quota resets at midnight UTC.
              </p>
            </div>
          )}

          {loading ? (
            <div className="text-sm text-muted">Loading...</div>
          ) : loadError ? (
            <div className="card border-error/30 bg-error/5 p-5">
              <p className="mb-1 text-sm font-medium text-error">Failed to load</p>
              <p className="text-sm text-muted">{loadError}</p>
              <button onClick={() => void load()} className="btn-ghost mt-3 text-xs">Retry</button>
            </div>
          ) : jobs.length === 0 ? (
            <div className="card py-16 text-center">
              <p className="mb-4 text-sm text-muted">No Indexer jobs yet.</p>
              <Link href="/indexer/jobs/new" className="btn-primary gap-2">
                <PlusCircle size={15} />
                Run Job
              </Link>
            </div>
          ) : (
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted">Total</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted">Submitted</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted">Failed</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted">Queued</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted">Date</th>
                      <th className="px-4 py-3 text-xs" />
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map(job => (
                      <tr key={job.id} className="border-b border-border transition-colors last:border-0 hover:bg-bg/50">
                        <td className="px-6 py-3">
                          <div className="font-medium text-text">{job.name}</div>
                          {job.status === 'running' && job.current_step && (
                            <div className="mt-0.5 text-xs text-muted">{job.current_step}</div>
                          )}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                        <td className="px-4 py-3 text-muted">{job.total_urls || '-'}</td>
                        <td className="px-4 py-3 text-success">{job.submitted_urls || 0}</td>
                        <td className="px-4 py-3 text-error">{job.failed_urls || 0}</td>
                        <td className="px-4 py-3 text-warning">{job.queued_urls || 0}</td>
                        <td className="px-4 py-3 text-xs text-muted">
                          {new Date(job.created_at).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Link href={`/indexer/jobs/${job.id}`} className="flex items-center gap-1 text-xs text-accent hover:underline">
                              View <ArrowRight size={11} />
                            </Link>
                            <button
                              onClick={() => void handleDelete(job.id)}
                              disabled={deleting === job.id}
                              className="text-muted transition-colors hover:text-error disabled:opacity-40"
                              aria-label={`Delete ${job.name}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </JobLauncherShell>
      </div>
    </AppLayout>
  )
}
