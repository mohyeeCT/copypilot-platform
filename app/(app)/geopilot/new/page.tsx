'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import ProfileForm from '@/components/geopilot/ProfileForm'
import { JobLauncherShell } from '@/components/ui/JobLauncher'
import { createClient } from '@/lib/supabase'
import { geopilotApi, type GeoPilotProfilePayload } from '@/lib/api/geopilot'

export default function NewGeoPilotProfilePage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  async function save(payload: GeoPilotProfilePayload) {
    setSubmitting(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) return router.push('/login')
      const data = await geopilotApi.createProfile(session.access_token, payload)
      router.push(`/geopilot/profiles/${data.profile.id}`)
    } finally { setSubmitting(false) }
  }
  return <AppLayout title="New GEOPilot Profile"><Link href="/geopilot" className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-text"><ArrowLeft size={16} /> Back to GEOPilot</Link><JobLauncherShell compact eyebrow="Insights" title="New GEOPilot Profile"><ProfileForm submitting={submitting} onSubmit={save} /></JobLauncherShell></AppLayout>
}

