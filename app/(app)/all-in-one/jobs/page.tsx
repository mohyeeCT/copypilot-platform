'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, ExternalLink, Plus, RefreshCw, Pencil, Check, X, Copy } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import Badge from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase'
import { aioApi } from '@/lib/api/all-in-one'

type Job = {
  id: string
  name: string
  status: string
  total_rows: number
  completed_rows: number
  failed_rows?: number
  created_at: string
  error: string | null
}

export default function DashboardPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const load = useCallback(async () => {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) return
    try {
      const data = await aioApi.listJobs(session.access_token)
      setJobs(data)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Poll while any job is running
  useEffect(() => {
    const running = jobs.some(j => j.status === 'running')
    if (!running) return
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [jobs, load])

  async function handleRename(id: string, name: string) {
    if (!name.trim()) return
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) return
    try {
      await aioApi.renameJob(session.access_token, id, name.trim())
      setJobs(j => j.map(x => x.id === id ? { ...x, name: name.trim() } : x))
    } catch {}
    setEditingId(null)
  }

  async function handleDelete(id: string) {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) return
    await aioApi.deleteJob(session.access_token, id)
    setJobs(j => j.filter(x => x.id !== id))
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <AppLayout title="All in One">
      <div className="max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Jobs</h1>
            <p className="text-muted text-sm mt-1">All in One generation jobs</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="btn-ghost flex items-center gap-2">
              <RefreshCw size={14} /> Refresh
            </button>
            <button onClick={() => router.push('/all-in-one/jobs/new')} className="btn-primary flex items-center gap-2">
              <Plus size={14} /> New Job
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="card p-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-5">
              <Plus size={22} className="text-accent" />
            </div>
            <h3 className="font-semibold text-sm mb-2">No jobs yet</h3>
            <p className="text-muted text-xs mb-6 max-w-xs mx-auto leading-relaxed">
              Add URLs, configure your settings, and generate FAQ copy with AI. Each job processes one or more URLs and outputs ready-to-use FAQ content and Schema.org JSON-LD.
            </p>
            <button onClick={() => router.push('/all-in-one/jobs/new')} className="btn-primary">
              Run your first job
            </button>
            <p className="text-muted text-xs mt-4">
              Make sure your <button onClick={() => router.push('/settings')} className="text-accent hover:underline">settings</button> are configured before running.
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs text-muted uppercase tracking-wider font-normal">Name</th>
                  <th className="text-left px-4 py-3 text-xs text-muted uppercase tracking-wider font-normal">Status</th>
                  <th className="text-left px-4 py-3 text-xs text-muted uppercase tracking-wider font-normal">Progress</th>
                  <th className="text-left px-4 py-3 text-xs text-muted uppercase tracking-wider font-normal">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {jobs.map((job, i) => (
                  <tr
                    key={job.id}
                    className="border-b border-border/50 hover:bg-border/20 transition-colors cursor-pointer"
                    onClick={() => router.push(`/all-in-one/jobs/${job.id}`)}
                  >
                    <td className="px-4 py-3 font-medium" onClick={e => e.stopPropagation()}>
                      {editingId === job.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            value={editingName}
                            onChange={e => setEditingName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleRename(job.id, editingName)
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                            className="input-base text-sm py-1 px-2 h-7"
                          />
                          <button onClick={() => handleRename(job.id, editingName)}
                            className="p-1 text-accent hover:text-accent/80 transition-colors">
                            <Check size={13} />
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="p-1 text-muted hover:text-text transition-colors">
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <span>{job.name || 'Untitled'}</span>
                          <button
                            onClick={() => { setEditingId(job.id); setEditingName(job.name || '') }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-accent transition-all"
                          >
                            <Pencil size={11} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3"><Badge label={job.status} /></td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {job.status === 'complete' ? (
                        <span>
                          <span className="text-accent">{job.completed_rows - (job.failed_rows || 0)} ok</span>
                          {(job.failed_rows || 0) > 0 && (
                            <span className="text-error ml-1.5">{job.failed_rows} failed</span>
                          )}
                          <span className="text-muted ml-1.5">/ {job.total_rows}</span>
                        </span>
                      ) : (
                        <span className="text-muted">{job.completed_rows}/{job.total_rows} rows</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">{formatDate(job.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => router.push(`/all-in-one/jobs/${job.id}`)}
                          className="p-1.5 text-muted hover:text-accent transition-colors"
                        >
                          <ExternalLink size={13} />
                        </button>
                        <button
                          onClick={async () => {
                            const sb = createClient()
                            const { data: { session } } = await sb.auth.getSession()
                            if (!session) return
                            const res = await aioApi.duplicateJob(session.access_token, job.id)
                            if (res?.job_id) router.push(`/page-copy/jobs/${res.job_id}`)
                          }}
                          className="p-1.5 text-muted hover:text-accent transition-colors"
                          title="Duplicate job"
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(job.id)}
                          className="p-1.5 text-muted hover:text-error transition-colors"
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
        )}
      </div>
    </AppLayout>
  )
}
