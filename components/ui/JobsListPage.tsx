'use client'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Trash2, ExternalLink, Plus, Pencil, Check, X, Copy,
  FileText, Layers, Clock, Search, AlertTriangle, Building2
} from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import Badge from '@/components/ui/Badge'
import { SkeletonJobList } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase'
import CustomSelect from '@/components/ui/CustomSelect'
import { listBrandProfiles, type ClientJobFilter } from '@/lib/api/shared'

interface Job {
  id: string
  name: string
  status: string
  total_rows: number
  completed_rows: number
  failed_rows?: number
  created_at: string
  error: string | null
  client_profile_id?: string | null
}

interface ClientProfile {
  id: string
  name: string
  archived_at?: string | null
}

interface ToolConfig {
  label: string
  newHref: string
  jobHref: (id: string) => string
  icon: React.ElementType
  accent: string
  emptyTitle: string
  emptyDesc: string
  supportsClientProfiles?: boolean
  listJobs: (token: string, clientProfileId?: ClientJobFilter) => Promise<Job[]>
  deleteJob: (token: string, id: string) => Promise<unknown>
  duplicateJob: (token: string, id: string) => Promise<{job_id?: string}>
  renameJob: (token: string, id: string, name: string) => Promise<unknown>
  variant?: 'default' | 'meta' | 'faq' | 'intro' | 'aio' | 'schema'
  description?: string
}

type JobFilter = 'all' | 'active' | 'complete' | 'attention'

const STATUS_COLORS: Record<string, string> = {
  complete:   '#0B7A5C',
  running:    '#D97706',
  pending:    '#8080A8',
  failed:     '#C62828',
  cancelled:  '#8080A8',
  cancelling: '#C62828',
  error:      '#C62828',
}

function statusBorder(status: string) {
  return STATUS_COLORS[status] || 'var(--border)'
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHrs = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHrs / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHrs < 24) return `${diffHrs}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

export default function JobsListPage({ tool }: { tool: ToolConfig }) {
  const router = useRouter()
  const toast  = useToast()

  const [jobs, setJobs]           = useState<Job[]>([])
  const [loading, setLoading]     = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [refreshLabel, setRefreshLabel] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<JobFilter>('all')
  const [pendingDelete, setPendingDelete] = useState<Job | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [clientProfiles, setClientProfiles] = useState<ClientProfile[]>([])
  const [selectedClient, setSelectedClient] = useState('all')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const Icon = tool.icon
  const supportsClientProfiles = Boolean(tool.supportsClientProfiles)
  const workflowLabels = {
    meta: 'Meta',
    faq: 'FAQ',
    intro: 'Page Intro',
    aio: 'All in One',
    schema: 'Schema',
  } as const
  const isWorkflowVariant = Boolean(tool.variant && tool.variant !== 'default')
  const workflowLabel = tool.variant && tool.variant !== 'default'
    ? workflowLabels[tool.variant]
    : tool.label

  const load = useCallback(async (quiet = false) => {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) return
    try {
      const clientFilter: ClientJobFilter = !supportsClientProfiles || selectedClient === 'all'
        ? undefined
        : selectedClient === 'unassigned'
          ? null
          : selectedClient
      const data = await tool.listJobs(session.access_token, clientFilter)
      setJobs(data)
      setLastRefreshed(new Date())
      if (!quiet) setLoading(false)
    } catch {
      if (!quiet) setLoading(false)
    }
  }, [selectedClient, supportsClientProfiles, tool])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    async function loadClientProfiles() {
      if (!supportsClientProfiles) return
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) return
      try {
        const profiles = await listBrandProfiles(session.access_token, true)
        setClientProfiles(Array.isArray(profiles) ? profiles : [])
      } catch {
        setClientProfiles([])
      }
    }
    void loadClientProfiles()
  }, [supportsClientProfiles])

  // Smart auto-refresh: poll while any job is running, else every 30s
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    const hasRunning = jobs.some(j => j.status === 'running' || j.status === 'pending')
    intervalRef.current = setInterval(() => load(true), hasRunning ? 2500 : 30000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [jobs, load])

  // Update "last refreshed" label
  useEffect(() => {
    if (!lastRefreshed) return
    const update = () => {
      const diff = Math.round((Date.now() - lastRefreshed.getTime()) / 1000)
      if (diff < 10) setRefreshLabel('just now')
      else if (diff < 60) setRefreshLabel(`${diff}s ago`)
      else setRefreshLabel(`${Math.floor(diff / 60)}m ago`)
    }
    update()
    const t = setInterval(update, 10000)
    return () => clearInterval(t)
  }, [lastRefreshed])

  useEffect(() => {
    if (!pendingDelete) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !deleting) setPendingDelete(null)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [deleting, pendingDelete])

  async function handleDelete(id: string) {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) return
    setDeleting(true)
    try {
      await tool.deleteJob(session.access_token, id)
      setJobs(j => j.filter(x => x.id !== id))
      setPendingDelete(null)
      toast.success('Job deleted')
    } catch {
      toast.error('Failed to delete job')
    } finally {
      setDeleting(false)
    }
  }

  async function handleRename(id: string, name: string) {
    if (!name.trim()) return
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) return
    try {
      await tool.renameJob(session.access_token, id, name.trim())
      setJobs(j => j.map(x => x.id === id ? { ...x, name: name.trim() } : x))
      toast.success('Job renamed')
    } catch { toast.error('Failed to rename') }
    setEditingId(null)
  }

  async function handleDuplicate(id: string) {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) return
    try {
      const res = await tool.duplicateJob(session.access_token, id)
      if (res?.job_id) router.push(tool.jobHref(res.job_id))
    } catch (e) { if (e instanceof Error && e.message !== 'Rate limit displayed') toast.error('Failed to duplicate') }
  }

  const totalJobs = jobs.length
  const totalUrls = jobs.reduce((sum, job) => sum + (job.total_rows || 0), 0)
  const completedUrls = jobs.reduce((sum, job) => sum + (job.completed_rows || 0), 0)
  const failedUrls = jobs.reduce((sum, job) => sum + (job.failed_rows || 0), 0)
  const visibleJobs = useMemo(() => {
    if (!isWorkflowVariant) return jobs
    const needle = query.trim().toLowerCase()
    return jobs.filter(job => {
      const matchesQuery = !needle || (job.name || 'Untitled').toLowerCase().includes(needle)
      const matchesFilter = filter === 'all'
        || (filter === 'active' && ['running', 'pending', 'cancelling'].includes(job.status))
        || (filter === 'complete' && job.status === 'complete')
        || (filter === 'attention' && (['failed', 'error', 'cancelled'].includes(job.status) || (job.failed_rows || 0) > 0))
      return matchesQuery && matchesFilter
    })
  }, [filter, isWorkflowVariant, jobs, query])

  const stats = isWorkflowVariant
    ? [
        { label: 'Total jobs', value: totalJobs, icon: FileText, accentValue: false },
        { label: 'URLs processed', value: totalUrls, icon: Layers, accentValue: true },
        { label: 'Completed URLs', value: completedUrls, icon: Check, accentValue: false },
        { label: 'Needs attention', value: failedUrls, icon: AlertTriangle, accentValue: failedUrls > 0 },
      ]
    : [
        { label: 'Total jobs', value: totalJobs, icon: FileText, accentValue: false },
        { label: 'URLs processed', value: totalUrls, icon: Layers, accentValue: true },
        { label: 'Completed URLs', value: completedUrls, icon: Check, accentValue: false },
      ]

  const selectedProfile = clientProfiles.find(profile => profile.id === selectedClient)
  const newJobHref = supportsClientProfiles && selectedProfile && !selectedProfile.archived_at
    ? `${tool.newHref}?client_profile_id=${encodeURIComponent(selectedProfile.id)}`
    : tool.newHref
  const profileName = (profileId?: string | null) => {
    if (!profileId) return 'Unassigned'
    return clientProfiles.find(profile => profile.id === profileId)?.name || 'Archived client'
  }
  const clientOptions = [
    { value: 'all', label: 'All clients' },
    ...clientProfiles.map(profile => ({
      value: profile.id,
      label: `${profile.name}${profile.archived_at ? ' (archived)' : ''}`,
    })),
    { value: 'unassigned', label: 'Unassigned' },
  ]

  return (
    <AppLayout title={tool.label}>
      <div className="max-w-6xl mx-auto">
        {/* Page header */}
        <div className="flex min-w-0 flex-col gap-4 mb-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-3 mb-0.5">
              <div
                className="w-10 h-10 rounded-xl flex shrink-0 items-center justify-center"
                style={{
                  borderRadius: 'var(--radius-icon)',
                  background: 'var(--surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text)',
                }}
              >
                <Icon size={18} />
              </div>
              <h1 className="truncate whitespace-nowrap text-xl font-bold tracking-tight">{tool.label}</h1>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2 pl-[52px]">
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                {tool.description || (jobs.length > 0 ? `${jobs.length} job${jobs.length !== 1 ? 's' : ''}` : 'No jobs yet')}
              </p>
              {refreshLabel && (
                <span className="text-xs flex items-center gap-1 whitespace-nowrap" style={{ color: 'var(--muted)', opacity: 0.6 }}>
                  <Clock size={10} />
                  {refreshLabel}
                </span>
              )}
            </div>
          </div>
          <Link href={newJobHref} className="btn-primary flex shrink-0 items-center gap-2 self-start sm:self-auto">
            <Plus size={14} /> New Job
          </Link>
        </div>

        {supportsClientProfiles && (
          <div className="mb-4 w-full max-w-xs">
            <label className="mb-1.5 block text-xs font-semibold uppercase text-muted">Client</label>
            <CustomSelect
              ariaLabel="Filter jobs by client"
              value={selectedClient}
              onChange={value => {
                setLoading(true)
                setSelectedClient(value)
              }}
              options={clientOptions}
            />
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <SkeletonJobList rows={5} />
        ) : jobs.length === 0 ? (
          /* Empty state */
          <div className="card text-center" style={{ padding: '64px 32px' }}>
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{
                borderRadius: 'var(--radius-icon)',
                background: 'var(--surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text)',
              }}
            >
              <Icon size={24} />
            </div>
            <h3 className="font-semibold mb-2">{tool.emptyTitle}</h3>
            <p className="text-sm mb-7 max-w-xs mx-auto leading-relaxed" style={{ color: 'var(--muted)' }}>
              {tool.emptyDesc}
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href={newJobHref} className="btn-primary flex items-center gap-2">
                <Plus size={14} /> Run your first job
              </Link>
              <Link href="/settings" className="btn-ghost flex items-center gap-2 text-sm">
                Configure settings
              </Link>
            </div>
          </div>
        ) : (
          /* Jobs list */
          <>
          <div className={`grid grid-cols-1 gap-3 mb-4 sm:grid-cols-3 ${isWorkflowVariant ? 'lg:grid-cols-4' : ''}`}>
            {stats.map(stat => {
              const StatIcon = stat.icon
              return (
                <div
                  key={stat.label}
                  className="flex min-w-0 items-center gap-3"
                  style={{
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '10px 14px',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                    style={{
                      borderRadius: 'var(--radius-icon)',
                      background: 'var(--surface)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text)',
                    }}
                  >
                    <StatIcon size={14} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate whitespace-nowrap text-[0.62rem] font-bold uppercase tracking-[0.07em]" style={{ color: 'var(--muted)' }}>
                      {stat.label}
                    </span>
                    <span className="block truncate whitespace-nowrap text-xl font-bold leading-tight" style={{ color: stat.accentValue ? 'var(--accent)' : 'var(--text)' }}>
                      {formatNumber(stat.value)}
                    </span>
                  </span>
                </div>
              )
            })}
          </div>

          {isWorkflowVariant && (
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="relative block min-w-0 flex-1 sm:max-w-sm">
                <span className="sr-only">Search {workflowLabel} jobs</span>
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  className="input-base h-9 pl-9 pr-9 text-sm"
                  placeholder="Search jobs"
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Clear job search"
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:text-text"
                  >
                    <X size={13} />
                  </button>
                )}
              </label>
              <div className="cp-segmented overflow-x-auto" role="tablist" aria-label={`Filter ${workflowLabel} jobs`}>
                {([
                  ['all', 'All'],
                  ['active', 'Running'],
                  ['complete', 'Complete'],
                  ['attention', 'Needs attention'],
                ] as Array<[JobFilter, string]>).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={filter === value}
                    className="cp-segment whitespace-nowrap"
                    data-active={filter === value ? 'true' : 'false'}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            <div
              className="hidden items-center px-5 py-2.5 text-[0.6rem] font-bold uppercase tracking-[0.07em] sm:grid"
              style={{
                gridTemplateColumns: 'minmax(0, 1fr) 88px 92px 72px 92px',
                background: 'var(--surface)',
                color: 'var(--muted)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span className="whitespace-nowrap">Job name</span>
              <span className="whitespace-nowrap">URLs</span>
              <span className="whitespace-nowrap">Status</span>
              <span className="whitespace-nowrap">When</span>
              <span className="sr-only">Actions</span>
            </div>
            {visibleJobs.map((job, i) => {
              const progress = job.total_rows > 0 ? (job.completed_rows / job.total_rows) * 100 : 0
              const isRunning = job.status === 'running' || job.status === 'pending'
              const borderColor = statusBorder(job.status)

              return (
                <div
                  key={job.id}
                  className="group relative transition-colors cursor-pointer hover:bg-black/[0.025]"
                  style={{
                    borderBottom: i < visibleJobs.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                  onClick={() => router.push(tool.jobHref(job.id))}
                >
                  {/* Status border — left edge */}
                  <div
                    className="absolute left-0 top-0 bottom-0"
                    style={{ width: 3, background: borderColor, borderRadius: '0 2px 2px 0', opacity: 0.8 }}
                  />

                  {/* Running progress bar — bottom edge */}
                  {isRunning && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--border-subtle)' }}>
                      <div
                        className="h-full transition-all duration-1000"
                        style={{ width: `${progress}%`, background: 'var(--accent)' }}
                      />
                    </div>
                  )}

                  <div
                    className="grid grid-cols-[minmax(0,1fr)_92px] items-center gap-3 px-5 py-3.5 sm:grid-cols-[minmax(0,1fr)_88px_92px_72px_92px]"
                    style={{ paddingLeft: 22 }}
                  >
                    {/* Name */}
                    <div className="min-w-0" onClick={e => e.stopPropagation()}>
                      {editingId === job.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            value={editingName}
                            onChange={e => setEditingName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleRename(job.id, editingName)
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                            onClick={e => e.stopPropagation()}
                            className="input-base text-sm py-1 h-7 max-w-xs"
                          />
                          <button onClick={() => handleRename(job.id, editingName)}
                            className="p-1 text-accent hover:text-accent/80 transition-colors">
                            <Check size={13} />
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="p-1 transition-colors" style={{ color: 'var(--muted)' }}>
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group/name">
                          <span
                            className="font-semibold text-sm truncate"
                            style={{ color: 'var(--text)' }}
                            onClick={() => router.push(tool.jobHref(job.id))}
                          >
                            {job.name || 'Untitled'}
                          </span>
                          <button
                            onClick={e => { e.stopPropagation(); setEditingId(job.id); setEditingName(job.name || '') }}
                            className="opacity-0 group-hover/name:opacity-100 p-0.5 transition-all"
                            style={{ color: 'var(--muted)' }}
                            title="Rename job"
                          >
                            <Pencil size={11} />
                          </button>
                        </div>
                      )}

                      {supportsClientProfiles && (
                        <span className="mt-1 hidden items-center gap-1 text-[0.68rem] text-muted sm:flex">
                          <Building2 size={10} />
                          {profileName(job.client_profile_id)}
                        </span>
                      )}

                      {/* Subtitle: rows summary */}
                      <div className="flex items-center gap-2 mt-0.5 sm:hidden">
                        {job.status === 'complete' ? (
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>
                            <span style={{ color: 'var(--accent)' }}>{job.completed_rows - (job.failed_rows || 0)} ok</span>
                            {(job.failed_rows || 0) > 0 && (
                              <span style={{ color: 'var(--error)', marginLeft: 6 }}>{job.failed_rows} failed</span>
                            )}
                            <span style={{ marginLeft: 4 }}>/ {job.total_rows} URLs</span>
                          </span>
                        ) : isRunning ? (
                          <span className="text-xs" style={{ color: 'var(--warning)' }}>
                            {job.completed_rows}/{job.total_rows} URLs · {Math.round(progress)}%
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>
                            {job.total_rows} URL{job.total_rows !== 1 ? 's' : ''}
                          </span>
                        )}
                        {isWorkflowVariant && <Badge label={job.status} />}
                      </div>
                    </div>

                    {/* URLs */}
                    <div className="hidden whitespace-nowrap sm:block">
                      <span className="text-sm font-bold" style={{ color: isRunning ? 'var(--warning)' : 'var(--accent)' }}>
                        {job.completed_rows}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--muted)' }}> / {job.total_rows}</span>
                      {(job.failed_rows || 0) > 0 && (
                        <div className="text-[0.65rem]" style={{ color: 'var(--error)' }}>{job.failed_rows} failed</div>
                      )}
                    </div>

                    {/* Status */}
                    <div className="hidden whitespace-nowrap sm:block">
                      <Badge label={job.status} />
                    </div>

                    {/* When */}
                    <span className="hidden whitespace-nowrap text-xs sm:block" style={{ color: 'var(--muted)' }}>
                      {formatDate(job.created_at)}
                    </span>

                    {/* Actions */}
                    <div
                      className="flex items-center justify-end gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        onClick={() => router.push(tool.jobHref(job.id))}
                        className="p-1.5 rounded-lg transition-colors hover:bg-black/5"
                        style={{ color: 'var(--muted)' }}
                        title="Open job"
                      >
                        <ExternalLink size={13} />
                      </button>
                      <button
                        onClick={() => handleDuplicate(job.id)}
                        className="p-1.5 rounded-lg transition-colors hover:bg-black/5"
                        style={{ color: 'var(--muted)' }}
                        title="Duplicate job"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        onClick={() => isWorkflowVariant ? setPendingDelete(job) : void handleDelete(job.id)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--muted)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--error)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
                        title="Delete job"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
            {visibleJobs.length === 0 && (
              <div className="px-6 py-14 text-center">
                <Search size={22} className="mx-auto mb-3 text-muted" />
                <p className="text-sm font-semibold">No matching jobs</p>
                <p className="mt-1 text-xs text-muted">Clear the search or choose another status.</p>
                <button type="button" className="btn-ghost mt-4 text-xs" onClick={() => { setQuery(''); setFilter('all') }}>
                  Clear filters
                </button>
              </div>
            )}
          </div>
          </>
        )}
      </div>

      {pendingDelete && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4"
          role="presentation"
          onMouseDown={event => { if (event.target === event.currentTarget && !deleting) setPendingDelete(null) }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-workflow-job-title"
            className="w-full max-w-md rounded-lg border border-border bg-surface-raised p-5 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-error/10 text-error">
                <Trash2 size={18} />
              </span>
              <div className="min-w-0">
                <h2 id="delete-workflow-job-title" className="text-base font-semibold">Delete this {workflowLabel} job?</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {pendingDelete.name || 'Untitled'} and its generated results will be removed from job history.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" autoFocus disabled={deleting} className="btn-ghost" onClick={() => setPendingDelete(null)}>
                Keep job
              </button>
              <button
                type="button"
                disabled={deleting}
                className="btn-ghost"
                style={{ color: 'var(--error)', borderColor: 'color-mix(in srgb, var(--error) 28%, var(--border))' }}
                onClick={() => void handleDelete(pendingDelete.id)}
              >
                {deleting ? 'Deleting...' : 'Delete job'}
              </button>
            </div>
          </section>
        </div>
      )}
    </AppLayout>
  )
}
