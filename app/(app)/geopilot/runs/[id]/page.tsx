'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import { JobLauncherShell, JobSection } from '@/components/ui/JobLauncher'
import { createClient } from '@/lib/supabase'
import { geopilotApi } from '@/lib/api/geopilot'

type Citation = { id: string; url: string; domain: string; title?: string; excerpt?: string; classification?: string; position?: number }
type Run = {
  id: string; profile_id: string; surface: string; method: string; model_name?: string; status: string; response_text?: string;
  raw_response?: unknown; brand_mentioned?: boolean; prominence?: string; sentiment?: string; summary?: string;
  web_search_requested?: boolean; web_search_used?: boolean | null; cost_usd?: number; request_snapshot?: Record<string, string>; citations?: Citation[]
}
const LABELS: Record<string, string> = { google_ai_overview: 'Google AI Overview', chatgpt: 'ChatGPT', gemini: 'Gemini', claude: 'Claude', chatgpt_calibration: 'ChatGPT calibration' }

export default function GeoPilotRunPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [run, setRun] = useState<Run | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { void createClient().auth.getSession().then(async ({ data: { session } }) => {
    if (!session) return router.push('/login')
    const data = await geopilotApi.getRun(session.access_token, id)
    setRun(data.run)
  }).catch(loadError => setError(loadError instanceof Error ? loadError.message : 'Failed to load result.')) }, [id, router])

  return <AppLayout title="GEOPilot Result">{run && <Link href={`/geopilot/profiles/${run.profile_id}`} className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-text"><ArrowLeft size={16} /> Back to Profile</Link>}<JobLauncherShell compact eyebrow="GEOPilot result" title={run ? LABELS[run.surface] || run.surface : 'Measurement Result'} summary={run && <div className="text-right text-xs text-muted"><p className="font-semibold text-text">{run.status}</p><p>{run.method} / {run.model_name || 'provider default'}</p></div>}>
    {error ? <div className="text-sm text-error">{error}</div> : !run ? <div className="text-sm text-muted">Loading result...</div> : <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Signal label="Brand mentioned" value={run.brand_mentioned == null ? '-' : run.brand_mentioned ? 'Yes' : 'No'} /><Signal label="Prominence" value={run.prominence || '-'} /><Signal label="Sentiment" value={run.sentiment || '-'} /><Signal label="Web search used" value={run.web_search_requested ? run.web_search_used == null ? 'Not reported' : run.web_search_used ? 'Yes' : 'No' : 'Not requested'} /><Signal label="Provider cost" value={run.cost_usd == null ? '-' : `$${Number(run.cost_usd).toFixed(4)}`} /></div>
      <JobSection title="Tracked question" className="mt-5"><p className="whitespace-pre-wrap text-sm text-text">{run.request_snapshot?.prompt_text || '-'}</p>{run.request_snapshot?.google_query && run.request_snapshot.google_query !== run.request_snapshot.prompt_text && <p className="mt-2 text-xs text-muted">Google query: {run.request_snapshot.google_query}</p>}</JobSection>
      <JobSection title="Answer"><div className="max-h-[34rem] overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-surface p-4 text-sm leading-7 text-text">{run.response_text || 'No answer text was returned.'}</div>{run.summary && <p className="mt-3 text-sm text-muted">{run.summary}</p>}</JobSection>
      <JobSection title="Citations"><div className="divide-y divide-border">{run.citations?.length ? run.citations.map(citation => <div key={citation.id} className="flex items-start justify-between gap-4 py-3"><div><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-muted">{citation.position || '-'}</span><p className="text-sm font-semibold text-text">{citation.title || citation.domain}</p><span className="rounded-md bg-bg px-2 py-0.5 text-[11px] text-muted">{citation.classification}</span></div>{citation.excerpt && <p className="mt-1 line-clamp-2 text-xs text-muted">{citation.excerpt}</p>}</div><a href={citation.url} target="_blank" rel="noreferrer" className="shrink-0 text-accent"><ExternalLink size={14} /></a></div>) : <p className="py-4 text-sm text-muted">No citations were returned for this measurement.</p>}</div></JobSection>
      <JobSection title="Provider record"><pre className="max-h-96 overflow-auto rounded-lg border border-border bg-surface p-4 text-xs text-muted">{JSON.stringify(run.raw_response, null, 2)}</pre></JobSection>
    </>}
  </JobLauncherShell></AppLayout>
}

function Signal({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-border bg-surface p-3"><p className="text-xs font-semibold text-muted">{label}</p><p className="mt-1 text-sm font-semibold text-text">{value}</p></div> }

