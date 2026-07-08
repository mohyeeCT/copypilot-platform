'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, FolderPlus, RefreshCw } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import { JobLauncherShell } from '@/components/ui/JobLauncher'
import { createClient } from '@/lib/supabase'
import { brandMentionsApi } from '@/lib/api/brand-mentions'

export const dynamic = 'force-dynamic'

type RecordValue = Record<string, unknown>

type BrandPulseProfile = RecordValue & {
  id: string
  name?: string | null
  alert_count?: number | string | null
  active_alerts?: number | string | null
  mention_count?: number | string | null
  negative_mentions?: number | string | null
  unique_domains?: number | string | null
  last_crawled_at?: string | null
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

function numberField(record: RecordValue, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return 0
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

async function getSessionToken() {
  const sb = createClient()
  const { data: { session } } = await sb.auth.getSession()
  return session?.access_token ?? null
}

export default function BrandMentionsOverviewPage() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<BrandPulseProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async () => {
    let shouldClearLoading = true
    setLoading(true)
    try {
      const token = await getSessionToken()
      if (!token) {
        shouldClearLoading = false
        router.push('/login')
        return
      }

      const profilesData = await brandMentionsApi.listProfiles(token)
      setProfiles(extractList<BrandPulseProfile>(profilesData, ['profiles', 'items', 'results', 'data']))
      setLoadError('')
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load Brand Pulse profiles.')
    } finally {
      if (shouldClearLoading) setLoading(false)
    }
  }, [router])

  useEffect(() => { void load() }, [load])

  return (
    <AppLayout title="Brand Pulse">
      <div className="max-w-full">
        <JobLauncherShell
          compact
          eyebrow="Insights"
          title="Brand Pulse"
          actions={
            <div className="flex flex-wrap justify-end gap-2">
              <button onClick={() => void load()} disabled={loading} className="btn-ghost gap-2 text-sm">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
              <Link href="/brand-mentions/new" className="btn-primary gap-2">
                <FolderPlus size={15} />
                New Profile
              </Link>
            </div>
          }
        >
          {loading ? (
            <div className="text-sm text-muted">Loading Brand Pulse profiles...</div>
          ) : loadError ? (
            <div className="rounded-lg border p-4" style={{ background: 'rgba(198,41,41,0.08)', borderColor: 'rgba(198,41,41,0.24)' }}>
              <p className="text-sm font-semibold text-error">Failed to load Brand Pulse</p>
              <p className="mt-1 text-sm text-muted">{loadError}</p>
              <button onClick={() => void load()} className="btn-ghost mt-3 text-xs">Retry</button>
            </div>
          ) : profiles.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-10 text-center">
              <p className="text-sm font-semibold text-text">No Brand Pulse profiles yet.</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                Create a profile for a client or brand, then add brand, competitor, and keyword alerts inside it.
              </p>
              <Link href="/brand-mentions/new" className="btn-primary mt-5 gap-2">
                <FolderPlus size={15} />
                New Profile
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-muted">Profile</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Alerts</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Active</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Mentions</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Negative</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Domains</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Last crawl</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Last error</th>
                      <th className="px-4 py-3 text-xs" />
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map(profile => {
                      const alertCount = numberField(profile, ['alert_count'])
                      const activeAlerts = numberField(profile, ['active_alerts'])
                      const mentions = numberField(profile, ['mention_count'])
                      const negative = numberField(profile, ['negative_mentions'])
                      const domains = numberField(profile, ['unique_domains'])
                      const lastError = stringField(profile, ['last_error'])
                      return (
                        <tr key={profile.id} className="border-b border-border transition-colors last:border-0 hover:bg-bg">
                          <td className="px-5 py-3">
                            <Link href={`/brand-mentions/profiles/${profile.id}`} className="font-semibold text-text transition-colors hover:text-accent">
                              {profile.name || 'Untitled profile'}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted">{alertCount}</td>
                          <td className="px-4 py-3 text-xs text-muted">{activeAlerts}</td>
                          <td className="px-4 py-3 text-xs text-muted">{mentions}</td>
                          <td className={negative > 0 ? 'px-4 py-3 text-xs font-semibold text-error' : 'px-4 py-3 text-xs text-muted'}>{negative}</td>
                          <td className="px-4 py-3 text-xs text-muted">{domains}</td>
                          <td className="px-4 py-3 text-xs text-muted">{formatDate(profile.last_crawled_at)}</td>
                          <td className="max-w-xs px-4 py-3 text-xs text-muted">
                            {lastError ? <span className="line-clamp-2 text-error">{lastError}</span> : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <Link href={`/brand-mentions/profiles/${profile.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
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
        </JobLauncherShell>
      </div>
    </AppLayout>
  )
}
