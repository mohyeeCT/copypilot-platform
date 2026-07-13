'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import ProfileForm from '@/components/geopilot/ProfileForm'
import { JobLauncherShell } from '@/components/ui/JobLauncher'
import { createClient } from '@/lib/supabase'
import { geopilotApi, type GeoPilotProfilePayload } from '@/lib/api/geopilot'

export default function EditGeoPilotProfilePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [initial, setInitial] = useState<GeoPilotProfilePayload>()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { void createClient().auth.getSession().then(async ({ data: { session } }) => {
    if (!session) return router.push('/login')
    const data = await geopilotApi.getProfile(session.access_token, id)
    const profile = data.profile
    setInitial({
      name: profile.name, brand_name: profile.brand_name, primary_domain: profile.primary_domain || '', owned_domains: profile.owned_domains || [],
      brand_aliases: profile.brand_aliases || [], description: profile.description || '', category: profile.category || '', country_code: profile.country_code,
      location_name: profile.location_name, language_code: profile.language_code, timezone: profile.timezone, device: profile.device,
      source_brand_profile_id: profile.source_brand_profile_id, competitors: profile.competitors || [], active: profile.active,
    })
  }).catch(loadError => setError(loadError instanceof Error ? loadError.message : 'Failed to load profile.')) }, [id, router])
  async function save(payload: GeoPilotProfilePayload) {
    setSubmitting(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) return router.push('/login')
      await geopilotApi.updateProfile(session.access_token, id, payload)
      router.push(`/geopilot/profiles/${id}`)
    } finally { setSubmitting(false) }
  }
  return <AppLayout title="Edit GEOPilot Profile"><Link href={`/geopilot/profiles/${id}`} className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-text"><ArrowLeft size={16} /> Back to Profile</Link><JobLauncherShell compact eyebrow="GEOPilot" title="Edit Client Profile">{error ? <div className="text-sm text-error">{error}</div> : initial ? <ProfileForm initial={initial} submitting={submitting} onSubmit={save} /> : <div className="text-sm text-muted">Loading profile...</div>}</JobLauncherShell></AppLayout>
}
