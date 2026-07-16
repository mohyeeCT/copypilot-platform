'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, CheckCircle, Clock, RefreshCw, XCircle } from 'lucide-react'
import clsx from 'clsx'
import AppLayout from '@/components/layout/AppLayout'
import workspaceStyles from '@/components/meta/MetaCopyWorkspace.module.css'
import ExportMenu from '@/components/ui/ExportMenu'
import RunningJobPanel from '@/components/ui/RunningJobPanel'
import StyledCheckbox from '@/components/ui/StyledCheckbox'
import { JobLauncherShell, JobSummaryBar } from '@/components/ui/JobLauncher'
import { createClient } from '@/lib/supabase'
import { indexerApi } from '@/lib/api/indexer'
import { exportRowsToGoogleSheets, googleSheetsExportError } from '@/lib/export/googleSheets'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

type Result = {
  url: string
  status: 'submitted' | 'failed' | 'queued' | 'quota_exceeded'
  message: string
  timestamp: string | null
}

type Job = {
  id: string
  name: string
  status: string
  total_urls: number
  submitted_urls: number
  failed_urls: number
  queued_urls: number
  current_step: string
  error: string | null
  results: Result[]
  created_at: string
  client_profile_id?: string | null
}

const STATUS_CONFIG = {
  submitted: { label: 'Submitted', icon: CheckCircle, className: 'text-success' },
  failed: { label: 'Failed', icon: XCircle, className: 'text-error' },
  queued: { label: 'Queued', icon: Clock, className: 'text-warning' },
  quota_exceeded: { label: 'Quota', icon: AlertTriangle, className: 'text-warning' },
}

function buildExportRows(job: Job) {
  const headers = ['URL', 'Status', 'Message', 'Timestamp']
  const rows = job.results.map(result => ({
    'URL': result.url,
    'Status': result.status,
    'Message': result.message,
    'Timestamp': result.timestamp || '',
  }))
  return { headers, rows }
}

async function getToken() {
  const sb = createClient()
  const { data: { session } } = await sb.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return session.access_token
}

function downloadCSV(job: Job) {
  const rows = [
    ['URL', 'Status', 'Message', 'Timestamp'],
    ...job.results.map(result => [
      result.url,
      result.status,
      result.message.replace(/"/g, '""'),
      result.timestamp || '',
    ]),
  ]
  const csv = rows.map(row => row.map(value => `"${value}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `indexer-${job.id.slice(0, 8)}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function downloadXLSX(job: Job) {
  const rows = job.results.map(result => ({
    URL: result.url,
    Status: result.status,
    Message: result.message,
    Timestamp: result.timestamp || '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Results')
  XLSX.writeFile(wb, `indexer-${job.id.slice(0, 8)}.xlsx`)
}

export default function IndexerJobResultPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.id as string
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [resubmitting, setResubmitting] = useState(false)
  const [exportingSheets, setExportingSheets] = useState(false)

  const fetchJob = useCallback(async () => {
    try {
      const token = await getToken()
      const data = await indexerApi.getJob(token, jobId)
      setJob(data)
      if (data.status !== 'running' && pollingRef.current) clearInterval(pollingRef.current)
    } catch {
      router.push('/indexer/jobs')
    } finally {
      setLoading(false)
    }
  }, [jobId, router])

  useEffect(() => {
    void fetchJob()
    pollingRef.current = setInterval(() => { void fetchJob() }, 3000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [fetchJob])

  if (loading) {
    return (
      <AppLayout title="Indexer Result">
        <div className="text-sm text-muted">Loading...</div>
      </AppLayout>
    )
  }

  if (!job) return null

  const filteredResults = filter === 'all'
    ? job.results
    : job.results.filter(result => result.status === filter || (filter === 'queued' && result.status === 'quota_exceeded'))

  async function handleResubmit() {
    if (!job || selected.size === 0) return
    setResubmitting(true)
    try {
      const token = await getToken()
      const res = await indexerApi.resubmitUrls(
        token,
        Array.from(selected),
        `Resubmit from ${job.name}`,
        job.client_profile_id || undefined,
      )
      setSelected(new Set())
      router.push(`/indexer/jobs/${res.job_id}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to resubmit')
    } finally {
      setResubmitting(false)
    }
  }

  async function exportGoogleSheets() {
    if (!job?.results?.length || exportingSheets) return
    setExportingSheets(true)
    try {
      const { headers, rows } = buildExportRows(job)
      await exportRowsToGoogleSheets({
        title: `${job.name || 'Indexer results'} - Indexer`,
        sheet_name: 'Indexer Results',
        headers,
        rows,
      })
    } catch (error) {
      alert(googleSheetsExportError(error))
    } finally {
      setExportingSheets(false)
    }
  }

  return (
    <AppLayout title="Indexer Result">
      <div className={`max-w-full ${workspaceStyles.newPage}`}>
        <Link href="/indexer/jobs" className={workspaceStyles.backLink}>
          <ArrowLeft size={16} /> Back to Indexer jobs
        </Link>

        <JobLauncherShell
          compact
          eyebrow="Indexer result"
          title={job.name}
          description={new Date(job.created_at).toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
          summary={
            <JobSummaryBar
              summaryItems={[
                { label: 'Total', value: job.total_urls },
                { label: 'Submitted', value: job.submitted_urls || 0 },
                { label: 'Failed', value: job.failed_urls || 0 },
                { label: 'Status', value: <span className="capitalize">{job.status}</span> },
              ]}
            />
          }
          actions={
            <div className="flex flex-wrap items-center justify-end gap-3">
              {selected.size > 0 && (
                <button onClick={() => void handleResubmit()} disabled={resubmitting} className="btn-primary gap-2 text-sm">
                  <RefreshCw size={13} className={resubmitting ? 'animate-spin' : ''} />
                  {resubmitting ? 'Submitting...' : `Re-request ${selected.size} URL${selected.size !== 1 ? 's' : ''}`}
                </button>
              )}
              {job.status === 'complete' && job.results.length > 0 && (
                <>
                  <ExportMenu
                    onCsv={() => downloadCSV(job)}
                    onXlsx={() => downloadXLSX(job)}
                    onGoogleSheets={exportGoogleSheets}
                    sheetsLoading={exportingSheets}
                  />
                </>
              )}
              <span className={clsx('rounded-full px-3 py-1 text-sm font-medium capitalize', {
                'bg-accent/10 text-accent': job.status === 'running',
                'bg-success/10 text-success': job.status === 'complete',
                'bg-error/10 text-error': job.status === 'error',
              })}>
                {job.status}
              </span>
            </div>
          }
        >
          {job.status === 'error' && job.error && (
            <div className="card border-error/30 bg-error/5 p-4">
              <p className="mb-1 text-sm font-medium text-error">Job failed</p>
              <p className="text-sm text-muted">{job.error}</p>
            </div>
          )}

          {job.status === 'running' && (
            <RunningJobPanel
              status={job.status}
              completedRows={job.submitted_urls + job.failed_urls}
              totalRows={job.total_urls}
              failedRows={job.failed_urls}
              currentStep={job.current_step}
            />
          )}

          <section className={workspaceStyles.metricStrip} aria-label="Indexer result summary">
            <div><span>Total URLs</span><strong>{job.total_urls}</strong><small>Submitted in this batch</small></div>
            <div><span>Submitted</span><strong className={workspaceStyles.successValue}>{job.submitted_urls || 0}</strong><small>Accepted by Google</small></div>
            <div><span>Failed</span><strong className={job.failed_urls ? workspaceStyles.warningValue : undefined}>{job.failed_urls || 0}</strong><small>Can be requested again</small></div>
            <div><span>Queued</span><strong className={job.queued_urls ? workspaceStyles.warningValue : undefined}>{job.queued_urls || 0}</strong><small>Waiting for quota</small></div>
          </section>

          {job.results.length > 0 && (
            <div className="card overflow-hidden p-0">
              <div className={workspaceStyles.resultFilters} role="tablist" aria-label="Filter Indexer results">
                {[
                  { id: 'all', label: `All (${job.results.length})` },
                  { id: 'submitted', label: `Submitted (${job.results.filter(result => result.status === 'submitted').length})` },
                  { id: 'failed', label: `Failed (${job.results.filter(result => result.status === 'failed').length})` },
                  { id: 'queued', label: `Queued (${job.results.filter(result => result.status === 'queued' || result.status === 'quota_exceeded').length})` },
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={filter === item.id}
                    onClick={() => setFilter(item.id)}
                    data-active={filter === item.id ? 'true' : 'false'}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="max-h-[60vh] overflow-auto">
                <table className="min-w-[780px] w-full table-fixed text-sm">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="border-b border-border">
                      <th className="w-8 px-4 py-3">
                        <StyledCheckbox
                          ariaLabel="Select all filtered URLs"
                          checked={selected.size === filteredResults.length && filteredResults.length > 0}
                          onChange={checked => setSelected(checked ? new Set(filteredResults.map(result => result.url)) : new Set())}
                        />
                      </th>
                      <th className="w-[300px] px-6 py-3 text-left text-xs font-medium text-muted">URL</th>
                      <th className="w-28 px-4 py-3 text-left text-xs font-medium text-muted">Status</th>
                      <th className="w-[240px] px-4 py-3 text-left text-xs font-medium text-muted">Message</th>
                      <th className="w-40 px-4 py-3 text-left text-xs font-medium text-muted">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.map(result => {
                      const cfg = STATUS_CONFIG[result.status] || STATUS_CONFIG.failed
                      const Icon = cfg.icon
                      return (
                        <tr key={`${result.url}-${result.status}`} className={clsx('border-b border-border transition-colors last:border-0 hover:bg-bg/50', selected.has(result.url) && 'bg-accent/5')}>
                          <td className="px-4 py-3">
                            <StyledCheckbox
                              ariaLabel={`Select ${result.url}`}
                              checked={selected.has(result.url)}
                              onChange={checked => setSelected(prev => {
                                const next = new Set(prev)
                                if (checked) next.add(result.url)
                                else next.delete(result.url)
                                return next
                              })}
                            />
                          </td>
                          <td className="px-6 py-3">
                            <a href={result.url} target="_blank" rel="noopener noreferrer" className="break-all font-mono text-xs text-text transition-colors hover:text-accent">
                              {result.url}
                            </a>
                          </td>
                          <td className="px-4 py-3">
                            <span className={clsx('flex items-center gap-1.5 text-xs font-medium', cfg.className)}>
                              <Icon size={11} />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted">{result.message}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted">
                            {result.timestamp
                              ? new Date(result.timestamp).toLocaleTimeString('en-GB', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })
                              : '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {job.status === 'complete' && job.queued_urls > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
              <p className="text-sm font-medium text-warning">
                {job.queued_urls} URL{job.queued_urls !== 1 ? 's' : ''} not submitted due to daily quota.
              </p>
              <p className="mt-1 text-xs text-muted">
                Download the CSV, filter to queued rows, and create a new job tomorrow with those URLs.
              </p>
            </div>
          )}
        </JobLauncherShell>
      </div>
    </AppLayout>
  )
}
