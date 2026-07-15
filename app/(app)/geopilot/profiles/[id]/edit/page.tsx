'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Trash2, X } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import ProfileForm from '@/components/geopilot/ProfileForm'
import { JobLauncherShell, JobSection } from '@/components/ui/JobLauncher'
import { createClient } from '@/lib/supabase'
import { geopilotApi, type GeoPilotProfilePayload } from '@/lib/api/geopilot'

const ACTIVE_BATCH_STATUSES = new Set(['queued', 'submitting', 'collecting', 'classifying', 'enriching'])

export default function EditGeoPilotProfilePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [initial, setInitial] = useState<GeoPilotProfilePayload>()
  const [hasActiveBatch, setHasActiveBatch] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [error, setError] = useState('')
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    void createClient().auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return router.push('/login')
      const data = await geopilotApi.getProfile(session.access_token, id)
      const profile = data.profile
      setInitial({
        name: profile.name,
        brand_name: profile.brand_name,
        primary_domain: profile.primary_domain || '',
        owned_domains: profile.owned_domains || [],
        brand_aliases: profile.brand_aliases || [],
        description: profile.description || '',
        category: profile.category || '',
        country_code: profile.country_code,
        location_name: profile.location_name,
        language_code: profile.language_code,
        timezone: profile.timezone,
        device: profile.device,
        source_brand_profile_id: profile.source_brand_profile_id,
        competitors: profile.competitors || [],
        active: profile.active,
      })
      setHasActiveBatch(Boolean(profile.latest_batch && ACTIVE_BATCH_STATUSES.has(profile.latest_batch.status)))
    }).catch(loadError => setError(loadError instanceof Error ? loadError.message : 'Failed to load profile.'))
  }, [id, router])

  async function save(payload: GeoPilotProfilePayload) {
    setSubmitting(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) return router.push('/login')
      await geopilotApi.updateProfile(session.access_token, id, payload)
      router.push(`/geopilot/profiles/${id}`)
    } finally {
      setSubmitting(false)
    }
  }

  function openDeleteDialog() {
    setDeleteConfirmation('')
    setDeleteError('')
    setShowDeleteDialog(true)
  }

  async function deleteProfile() {
    if (!initial || deleteConfirmation !== initial.name) return
    setDeleting(true)
    setDeleteError('')
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) return router.push('/login')
      await geopilotApi.deleteProfile(session.access_token, id)
      router.push('/geopilot')
      router.refresh()
    } catch (deleteFailure) {
      setDeleteError(deleteFailure instanceof Error ? deleteFailure.message : 'Failed to delete profile.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AppLayout title="Edit GEOPilot Profile">
      <Link href={`/geopilot/profiles/${id}`} className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} /> Back to Profile
      </Link>
      <JobLauncherShell compact eyebrow="GEOPilot" title="Edit Client Profile">
        {error ? (
          <div className="text-sm text-error">{error}</div>
        ) : initial ? (
          <>
            <ProfileForm initial={initial} submitting={submitting} onSubmit={save} />
            <JobSection
              className="mt-6 border-error/30"
              title="Delete profile"
              description="Permanently remove this client profile and all of its collections, prompts, results, metrics, citations, and insights, including AIO recommendations and profile alerts."
              kicker="Danger zone"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="max-w-2xl text-sm text-muted">
                  {hasActiveBatch
                    ? 'Cancel the active run and wait for it to stop before deleting this profile.'
                    : 'This action cannot be undone.'}
                </p>
                <button
                  className="btn-ghost gap-2 text-error disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={openDeleteDialog}
                  disabled={hasActiveBatch}
                >
                  <Trash2 size={14} /> Delete profile
                </button>
              </div>
            </JobSection>
          </>
        ) : (
          <div className="text-sm text-muted">Loading profile...</div>
        )}
      </JobLauncherShell>

      {showDeleteDialog && initial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-profile-title"
            className="w-full max-w-lg rounded-lg border border-error/30 bg-surface-raised p-5 shadow-lg"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="delete-profile-title" className="text-base font-semibold text-text">Delete {initial.name}?</h2>
                <p className="mt-2 text-sm text-muted">
                  All tracking configuration and historical GEOPilot data for this profile will be permanently deleted.
                </p>
              </div>
              <button className="btn-ghost px-2" title="Close" onClick={() => setShowDeleteDialog(false)} disabled={deleting}>
                <X size={15} />
              </button>
            </div>
            <label className="mt-5 block text-xs font-semibold text-muted">
              Type <span className="text-text">{initial.name}</span> to confirm
              <input
                className="input-base mt-2"
                value={deleteConfirmation}
                onChange={event => setDeleteConfirmation(event.target.value)}
                autoComplete="off"
                autoFocus
              />
            </label>
            {deleteError && <p className="mt-3 text-sm text-error">{deleteError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setShowDeleteDialog(false)} disabled={deleting}>Cancel</button>
              <button
                className="btn-ghost gap-2 border-error/40 text-error disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => void deleteProfile()}
                disabled={deleting || deleteConfirmation !== initial.name}
              >
                <Trash2 size={14} /> {deleting ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
