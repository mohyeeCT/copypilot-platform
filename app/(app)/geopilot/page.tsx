'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, FolderPlus, RefreshCw } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import { JobLauncherShell } from '@/components/ui/JobLauncher'
import { createClient } from '@/lib/supabase'
import { geopilotApi } from '@/lib/api/geopilot'

type Profile = {
  id: string; name: string; brand_name: string; primary_domain?: string; collection_count?: number; prompt_count?: number
  country_code?: string; language_code?: string; last_run_at?: string | null; active?: boolean
}

async function token() {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token || null
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function GeoPilotPage() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const accessToken = await token()
      if (!accessToken) return router.push('/login')
      const data = await geopilotApi.listProfiles(accessToken)
      setProfiles(data.profiles || [])
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load GEOPilot profiles.')
    } finally { setLoading(false) }
  }, [router])
  useEffect(() => { void load() }, [load])

  return (
    <AppLayout title="GEOPilot">
      <JobLauncherShell compact eyebrow="Insights" title="GEOPilot" actions={<div className="flex gap-2"><button className="btn-ghost gap-2" onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button><Link className="btn-primary gap-2" href="/geopilot/new"><FolderPlus size={15} /> New Profile</Link></div>}>
        {loading ? <p className="text-sm text-muted">Loading client profiles...</p> : error ? <div className="rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error">{error}</div> : profiles.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-10 text-center"><p className="font-semibold text-text">No GEOPilot profiles yet.</p><p className="mt-2 text-sm text-muted">Create a client profile, organize prompts into collections, and start measuring AI visibility.</p><Link className="btn-primary mt-5 gap-2" href="/geopilot/new"><FolderPlus size={15} /> New Profile</Link></div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted"><th className="px-5 py-3">Client</th><th className="px-4 py-3">Brand</th><th className="px-4 py-3">Market</th><th className="px-4 py-3">Collections</th><th className="px-4 py-3">Prompts</th><th className="px-4 py-3">Last run</th><th className="px-4 py-3" /></tr></thead><tbody>{profiles.map(profile => <tr key={profile.id} className="border-b border-border last:border-0 hover:bg-bg"><td className="px-5 py-3"><Link className="font-semibold text-text hover:text-accent" href={`/geopilot/profiles/${profile.id}`}>{profile.name}</Link></td><td className="px-4 py-3 text-muted">{profile.brand_name}</td><td className="px-4 py-3 text-xs text-muted">{profile.country_code} / {profile.language_code}</td><td className="px-4 py-3 text-muted">{profile.collection_count || 0}</td><td className="px-4 py-3 text-muted">{profile.prompt_count || 0}/15</td><td className="px-4 py-3 text-xs text-muted">{formatDate(profile.last_run_at)}</td><td className="px-4 py-3"><Link className="inline-flex items-center gap-1 text-xs font-semibold text-accent" href={`/geopilot/profiles/${profile.id}`}>Open <ArrowRight size={12} /></Link></td></tr>)}</tbody></table></div></div>
        )}
      </JobLauncherShell>
    </AppLayout>
  )
}

