'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, PlusCircle, RefreshCw } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import { JobLauncherShell, JobSection } from '@/components/ui/JobLauncher'
import { createClient } from '@/lib/supabase'
import { brandMentionsApi } from '@/lib/api/brand-mentions'

export const dynamic = 'force-dynamic'

type RecordValue = Record<string, unknown>

type BrandPulseProfile = RecordValue & {
  id: string
  name?: string | null
}

type BrandPulseAlert = RecordValue & {
  id: string
  label?: string | null
  keyword?: string | null
  alert_type?: string | null
  active?: boolean | null
  last_crawled_at?: string | null
  last_crawl_at?: string | null
  last_crawl?: string | null
  last_error?: string | null
}

function asRecord(value: unknown): RecordValue {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}
}

function extractList<T>(value: unknown, keys: string[]): T[] {
  if (Array.isArray(value)) return value as T[]
  const record = asRecord(value)
  const nestedData = asRecord(record.data)
  for (const key of keys) {
    const candidate = record[key]
    if (Array.isArray(candidate)) return candidate as T[]
    const nestedCandidate = nestedData[key]
    if (Array.isArray(nestedCandidate)) return nestedCandidate as T[]
  }
  return []
}

function extractProfile(value: unknown): BrandPulseProfile | null {
  const record = asRecord(value)
  const profile = asRecord(record.profile)
  if (typeof profile.id === 'string') return profile as BrandPulseProfile
  const nestedProfile = asRecord(asRecord(record.data).profile)
  if (typeof nestedProfile.id === 'string') return nestedProfile as BrandPulseProfile
  if (typeof record.id === 'string') return record as BrandPulseProfile
  return null
}

function stringField(record: RecordValue, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return fallback
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function titleCase(value?: string | null) {
  if (!value) return '-'
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

function lastCrawl(alert: BrandPulseAlert) {
  return stringField(alert, ['last_crawled_at', 'last_crawl_at', 'last_crawl'])
}

function AlertStateBadge({ active }: { active?: boolean | null }) {
  if (active === false) {
    return (
      <span className="inline-flex rounded-full border border-border bg-bg px-2 py-0.5 text-xs font-semibold text-muted">
        Paused
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
      Active
    </span>
  )
}

async function getSessionToken() {
  const sb = createClient()
  const { data: { session } } = await sb.auth.getSession()
  return session?.access_token ?? null
}

export default function BrandPulseProfilePage() {
  const params = useParams()
  const router = useRouter()
  const profileId = Array.isArray(params?.id) ? params.id[0] : params?.id
  const [profile, setProfile] = useState<BrandPulseProfile | null>(null)
  const [alerts, setAlerts] = useState<BrandPulseAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async () => {
    if (!profileId) {
      setLoadError('Profile not found.')
      setLoading(false)
      return
    }

    let shouldClearLoading = true
    setLoading(true)
    try {
      const token = await getSessionToken()
      if (!token) {
        shouldClearLoading = false
        router.push('/login')
        return
      }

      const profileData = await brandMentionsApi.getProfile(token, profileId)
      setProfile(extractProfile(profileData))
      setAlerts(extractList<BrandPulseAlert>(profileData, ['alerts', 'items', 'results', 'data']))
      setLoadError('')
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load Brand Pulse profile.')
    } finally {
      if (shouldClearLoading) setLoading(false)
    }
  }, [profileId, router])

  useEffect(() => { void load() }, [load])

  return (
    <AppLayout title="Brand Pulse Profile">
      <div className="max-w-full">
        <Link href="/brand-mentions" className="mb-4 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-text">
          <ArrowLeft size={16} /> Back to Brand Pulse
        </Link>

        <JobLauncherShell
          compact
          eyebrow="Brand Pulse Profile"
          title={profile?.name || 'Brand Pulse Profile'}
          actions={
            <div className="flex flex-wrap justify-end gap-2">
              <button onClick={() => void load()} disabled={loading} className="btn-ghost gap-2 text-sm">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
              {profileId && (
                <Link href={`/brand-mentions/profiles/${profileId}/alerts/new`} className="btn-primary gap-2">
                  <PlusCircle size={15} />
                  New Alert
                </Link>
              )}
            </div>
          }
        >
          {loading ? (
            <div className="text-sm text-muted">Loading Brand Pulse profile...</div>
          ) : loadError ? (
            <div className="rounded-lg border p-4" style={{ background: 'rgba(198,41,41,0.08)', borderColor: 'rgba(198,41,41,0.24)' }}>
              <p className="text-sm font-semibold text-error">Failed to load profile</p>
              <p className="mt-1 text-sm text-muted">{loadError}</p>
              <button onClick={() => void load()} className="btn-ghost mt-3 text-xs">Retry</button>
            </div>
          ) : (
            <JobSection title="Alerts" description={`${alerts.length} configured alerts under this profile.`}>
              {alerts.length === 0 ? (
                <div className="rounded-lg border border-border bg-surface p-8 text-center">
                  <p className="text-sm font-semibold text-text">No alerts in this profile yet.</p>
                  <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                    Add a brand, competitor, or keyword alert to start collecting mentions for this client profile.
                  </p>
                  {profileId && (
                    <Link href={`/brand-mentions/profiles/${profileId}/alerts/new`} className="btn-primary mt-5 gap-2">
                      <PlusCircle size={15} />
                      New Alert
                    </Link>
                  )}
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border bg-surface">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-5 py-3 text-left text-xs font-semibold text-muted">Alert</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Keyword</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-muted">State</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Last crawl</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Last error</th>
                          <th className="px-4 py-3 text-xs" />
                        </tr>
                      </thead>
                      <tbody>
                        {alerts.map(alert => {
                          const lastError = stringField(alert, ['last_error'])
                          return (
                            <tr key={alert.id} className="border-b border-border transition-colors last:border-0 hover:bg-bg">
                              <td className="px-5 py-3">
                                <Link href={`/brand-mentions/${alert.id}`} className="font-semibold text-text transition-colors hover:text-accent">
                                  {alert.label || 'Untitled alert'}
                                </Link>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-muted">{alert.keyword || '-'}</td>
                              <td className="px-4 py-3 text-xs text-muted">{titleCase(alert.alert_type)}</td>
                              <td className="px-4 py-3"><AlertStateBadge active={alert.active} /></td>
                              <td className="px-4 py-3 text-xs text-muted">{formatDate(lastCrawl(alert))}</td>
                              <td className="max-w-xs px-4 py-3 text-xs text-muted">
                                {lastError ? <span className="line-clamp-2 text-error">{lastError}</span> : '-'}
                              </td>
                              <td className="px-4 py-3">
                                <Link href={`/brand-mentions/${alert.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
                                  Open <ArrowRight size={11} />
                                </Link>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </JobSection>
          )}
        </JobLauncherShell>
      </div>
    </AppLayout>
  )
}
