'use client'
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Copy, ExternalLink, Square } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import Badge from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase'
import { schemaApi } from '@/lib/api/schema'

export const dynamic = 'force-dynamic'

interface SchemaResult {
  url: string
  status: string
  schema_type: string
  schema_json?: string
  schema_script?: string
  error?: string | null
}

interface Job {
  id: string
  name: string
  status: string
  total_rows?: number
  completed_rows?: number
  failed_rows?: number
  progress?: { total?: number; completed?: number; failed?: number }
  results?: SchemaResult[]
}

export default function SchemaJobPage() {
  const { id } = useParams()
  const router = useRouter()
  const [job, setJob] = useState<Job | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [copied, setCopied] = useState('')

  const load = useCallback(async () => {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { router.push('/login'); return }
    const data = await schemaApi.getJob(session.access_token, id as string)
    setJob(data)
  }, [id, router])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!job || (job.status !== 'running' && job.status !== 'cancelling')) return
    const t = setInterval(load, 2500)
    return () => clearInterval(t)
  }, [job, load])

  async function handleCancel() {
    if (!job) return
    setCancelling(true)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (session) {
        await schemaApi.cancelJob(session.access_token, job.id)
        await load()
      }
    } finally {
      setCancelling(false)
    }
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 1500)
  }

  if (!job) return (
    <AppLayout title="Schema Generator">
      <div className="flex items-center justify-center h-48">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  )

  const total = job.total_rows ?? job.progress?.total ?? 0
  const completed = job.completed_rows ?? job.progress?.completed ?? 0
  const failed = job.failed_rows ?? job.progress?.failed ?? 0
  const firstUrl = job.results?.[0]?.url

  return (
    <AppLayout title="Schema Generator">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/schema/jobs" className="text-muted hover:text-text transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{job.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge label={job.status} />
              <span className="text-xs text-muted font-mono">{completed}/{total} rows</span>
              {failed > 0 && <span className="text-xs text-error font-mono">{failed} failed</span>}
            </div>
          </div>
        </div>

        {(job.status === 'running' || job.status === 'cancelling') && (
          <div className="mb-4">
            <button onClick={handleCancel} disabled={cancelling || job.status === 'cancelling'}
              className="flex items-center gap-2 text-xs border border-error/30 text-error bg-error/8 hover:bg-error/15 transition-colors rounded-lg px-3 py-2 disabled:opacity-50">
              <Square size={12} fill="currentColor" />
              {job.status === 'cancelling' ? 'Stopping...' : 'Stop job'}
            </button>
          </div>
        )}

        <div className="space-y-4">
          {(job.results || []).map((result, index) => (
            <div key={`${result.url}-${index}`} className="card p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-xs text-muted uppercase tracking-wider">{result.schema_type}</p>
                  <p className="text-sm font-mono text-muted mt-1 break-all">{result.url}</p>
                </div>
                <Badge label={result.status} />
              </div>

              {result.error ? (
                <p className="text-sm text-error">{result.error}</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => copyText(result.schema_json || '', `json-${index}`)} className="btn-ghost text-xs flex items-center gap-1.5">
                      <Copy size={12} /> {copied === `json-${index}` ? 'Copied!' : 'Copy JSON'}
                    </button>
                    <button onClick={() => copyText(result.schema_script || '', `script-${index}`)} className="btn-ghost text-xs flex items-center gap-1.5">
                      <Copy size={12} /> {copied === `script-${index}` ? 'Copied!' : 'Copy script'}
                    </button>
                    <a href={`https://search.google.com/test/rich-results?url=${encodeURIComponent(result.url)}`} target="_blank" rel="noreferrer" className="btn-ghost text-xs flex items-center gap-1.5">
                      <ExternalLink size={12} /> Rich Results
                    </a>
                    <a href="https://validator.schema.org/" target="_blank" rel="noreferrer" className="btn-ghost text-xs flex items-center gap-1.5">
                      <ExternalLink size={12} /> Schema.org
                    </a>
                  </div>
                  <pre className="text-xs font-mono whitespace-pre-wrap overflow-auto rounded-lg border border-border p-4" style={{ background: 'var(--surface)' }}>
                    {result.schema_json}
                  </pre>
                </div>
              )}
            </div>
          ))}

          {!job.results?.length && (
            <div className="card p-8 text-center">
              <p className="text-sm text-muted">Schema output will appear here when generation starts.</p>
              {firstUrl && <p className="text-xs text-muted font-mono mt-2">{firstUrl}</p>}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
