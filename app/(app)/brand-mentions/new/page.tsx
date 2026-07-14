'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FolderPlus } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import pulseStyles from '@/components/brand-pulse/BrandPulseWorkspace.module.css'
import { JobLauncherShell, JobSection } from '@/components/ui/JobLauncher'
import { createClient } from '@/lib/supabase'
import { brandMentionsApi } from '@/lib/api/brand-mentions'

export const dynamic = 'force-dynamic'

async function getSessionToken() {
  const sb = createClient()
  const { data: { session } } = await sb.auth.getSession()
  return session?.access_token ?? null
}

function createdProfileId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.id === 'string') return record.id
  const profile = record.profile
  if (profile && typeof profile === 'object' && typeof (profile as Record<string, unknown>).id === 'string') {
    return (profile as Record<string, string>).id
  }
  return null
}

export default function NewBrandPulseProfilePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    void getSessionToken()
      .then(token => {
        if (!mounted) return
        if (!token) {
          router.push('/login')
          return
        }
        setCheckingSession(false)
      })
      .catch(() => {
        if (mounted) router.push('/login')
      })

    return () => { mounted = false }
  }, [router])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Add a profile name before creating the profile.')
      return
    }

    setSubmitting(true)
    try {
      const token = await getSessionToken()
      if (!token) {
        router.push('/login')
        return
      }

      const created = await brandMentionsApi.createProfile(token, { name: trimmedName })
      const id = createdProfileId(created)
      router.push(id ? `/brand-mentions/profiles/${id}` : '/brand-mentions')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create Brand Pulse profile.')
      setSubmitting(false)
    }
  }

  if (checkingSession) {
    return (
      <AppLayout title="New Brand Pulse Profile">
        <div className="text-sm text-muted">Checking session...</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="New Brand Pulse Profile">
      <div className={`max-w-full ${pulseStyles.page}`}>
        <Link href="/brand-mentions" className="mb-4 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-text">
          <ArrowLeft size={16} /> Back to Brand Pulse
        </Link>

        <form onSubmit={handleSubmit}>
          <JobLauncherShell
            compact
            eyebrow="Insights"
            title="New Brand Pulse Profile"
            actions={
              <button type="submit" disabled={submitting} className="btn-primary gap-2">
                <FolderPlus size={15} />
                {submitting ? 'Creating...' : 'Create Profile'}
              </button>
            }
          >
            {error && (
              <div className="rounded-lg border p-4" style={{ background: 'rgba(198,41,41,0.08)', borderColor: 'rgba(198,41,41,0.24)' }}>
                <p className="text-sm font-semibold text-error">{error}</p>
              </div>
            )}

            <JobSection title="Profile" description="Create one workspace for a client, brand, or market you want to monitor.">
              <div className="max-w-xl">
                <label htmlFor="brand-pulse-profile-name" className="mb-1 block text-xs font-semibold text-muted">Name</label>
                <input
                  id="brand-pulse-profile-name"
                  name="name"
                  value={name}
                  onChange={event => setName(event.target.value)}
                  className="input-base"
                  placeholder="Coalition Technologies"
                  required
                />
              </div>
            </JobSection>
          </JobLauncherShell>
        </form>
      </div>
    </AppLayout>
  )
}
