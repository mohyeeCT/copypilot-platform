'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Trash2, ExternalLink, Plus, Pencil, Check, X, Copy,
  FileText, HelpCircle, Tag, BookOpen, Layers, Clock
} from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import Badge from '@/components/ui/Badge'
import { SkeletonJobList } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase'

interface Job {
  id: string
  name: string
  status: string
  total_rows: number
  completed_rows: number
  failed_rows?: number
  created_at: string
  error: string | null
}

interface ToolConfig {
  label: string
  newHref: string
  jobHref: (id: string) => string
  icon: React.ElementType
  accent: string
  emptyTitle: string
  emptyDesc: string
  listJobs: (token: string) => Promise<Job[]>
  deleteJob: (token: string, id: string) => Promise<unknown>
  duplicateJob: (token: string, id: string) => Promise<{job_id?: string}>
  renameJob: (token: string, id: string, name: string) => Promise<unknown>
}

const STATUS_COLORS: Record<string, string> = {
  complete:   '#0A9B7A',
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

export default function JobsListPage({ tool }: { tool: ToolConfig }) {
  const router = useRouter()
  const toast  = useToast()

  const [jobs, setJobs]           = useState<Job[]>([])
  const [loading, setLoading]     = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [refreshLabel, setRefreshLabel] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const Icon = tool.icon

  const load = useCallback(async (quiet = false) => {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) return
    try {
      const data = await tool.listJobs(session.access_token)
      setJobs(data)
      setLastRefreshed(new Date())
      if (!quiet) setLoading(false)
    } catch {
      if (!quiet) setLoading(false)
    }
  }, [tool])

  useEffect(() => { load() }, [load])

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

  async function handleDelete(id: string) {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) return
    await tool.deleteJob(session.access_token, id)
    setJobs(j => j.filter(x => x.id !== id))
    toast.success('Job deleted')
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

  return (
    <AppLayout title={tool.label}>
      <div className="max-w-5xl mx-auto">
        {/* Page header */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <div className="flex items-center gap-2.5 mb-0.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `${tool.accent}18`, border: `1px solid ${tool.accent}30` }}
              >
                <Icon size={14} style={{ color: tool.accent }} />
              </div>
              <h1 className="text-xl font-bold tracking-tight">{tool.label}</h1>
            </div>
            <div className="flex items-center gap-2 pl-9">
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                {jobs.length > 0 ? `${jobs.length} job${jobs.length !== 1 ? 's' : ''}` : 'No jobs yet'}
              </p>
              {refreshLabel && (
                <span className="text-xs flex items-center gap-1" style={{ color: 'var(--muted)', opacity: 0.6 }}>
                  <Clock size={10} />
                  {refreshLabel}
                </span>
              )}
            </div>
          </div>
          <Link href={tool.newHref} className="btn-primary flex items-center gap-2">
            <Plus size={14} /> New Job
          </Link>
        </div>

        {/* Loading */}
        {loading ? (
          <SkeletonJobList rows={5} />
        ) : jobs.length === 0 ? (
          /* Empty state */
          <div className="card text-center" style={{ padding: '64px 32px' }}>
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: `${tool.accent}12`, border: `1px solid ${tool.accent}25` }}
            >
              <Icon size={24} style={{ color: tool.accent }} />
            </div>
            <h3 className="font-semibold mb-2">{tool.emptyTitle}</h3>
            <p className="text-sm mb-7 max-w-xs mx-auto leading-relaxed" style={{ color: 'var(--muted)' }}>
              {tool.emptyDesc}
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href={tool.newHref} className="btn-primary flex items-center gap-2">
                <Plus size={14} /> Run your first job
              </Link>
              <Link href="/settings" className="btn-ghost flex items-center gap-2 text-sm">
                Configure settings
              </Link>
            </div>
          </div>
        ) : (
          /* Jobs list */
          <div className="card overflow-hidden">
            {jobs.map((job, i) => {
              const progress = job.total_rows > 0 ? (job.completed_rows / job.total_rows) * 100 : 0
              const isRunning = job.status === 'running' || job.status === 'pending'
              const borderColor = statusBorder(job.status)

              return (
                <div
                  key={job.id}
                  className="group relative transition-colors cursor-pointer"
                  style={{
                    borderBottom: i < jobs.length - 1 ? '1px solid var(--border-subtle)' : 'none',
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
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-black/[0.025] transition-colors"
                    style={{ paddingLeft: 20 }}
                  >
                    {/* Name */}
                    <div className="flex-1 min-w-0" onClick={e => e.stopPropagation()}>
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
                            className="font-medium text-sm truncate"
                            style={{ color: 'var(--text)' }}
                            onClick={() => router.push(tool.jobHref(job.id))}
                          >
                            {job.name || 'Untitled'}
                          </span>
                          <button
                            onClick={e => { e.stopPropagation(); setEditingId(job.id); setEditingName(job.name || '') }}
                            className="opacity-0 group-hover/name:opacity-100 p-0.5 transition-all"
                            style={{ color: 'var(--muted)' }}
                          >
                            <Pencil size={11} />
                          </button>
                        </div>
                      )}

                      {/* Subtitle: rows summary */}
                      <div className="flex items-center gap-2 mt-0.5">
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
                      </div>
                    </div>

                    {/* Status badge + date */}
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge label={job.status} />
                      <span className="text-xs hidden sm:block" style={{ color: 'var(--muted)', minWidth: 56 }}>
                        {formatDate(job.created_at)}
                      </span>
                    </div>

                    {/* Actions */}
                    <div
                      className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
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
                        onClick={() => handleDelete(job.id)}
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
          </div>
        )}
      </div>
    </AppLayout>
  )
}
