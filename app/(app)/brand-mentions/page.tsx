'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, PlusCircle, RefreshCw } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import { JobLauncherShell, JobSummaryBar, JobSummaryPills } from '@/components/ui/JobLauncher'
import { createClient } from '@/lib/supabase'
import { brandMentionsApi } from '@/lib/api/brand-mentions'
import { useRouter } from 'next/navigation'

export const dynamic = 'force-dynamic'

type BrandMentionAlert = {
  id: string
  label?: string | null
  keyword?: string | null
  alert_type?: string | null
  active?: boolean | null
  last_crawl?: string | null
  last_crawl_at?: string | null
  last_crawled_at?: string | null
  last_run_at?: string | null
  last_error?: string | null
  error?: string | null
  mention_count?: number | null
  total_mentions?: number | null
}

type RecordValue = Record<string, unknown>

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

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function pickMetric(data: RecordValue, keys: string[]): number | null {
  const records = [
    data,
    asRecord(data.summary),
    asRecord(data.stats),
    asRecord(data.totals),
  ]
  for (const record of records) {
    for (const key of keys) {
      if (key in record) {
        const parsed = parseNumber(record[key])
        if (parsed !== null) return parsed
      }
    }
  }
  return null
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

function AlertStateBadge({ active }: { active?: boolean | null }) {
  const isActive = active !== false
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold"
      style={{
        background: isActive ? 'rgba(11,122,92,0.10)' : 'rgba(124,118,111,0.10)',
        borderColor: isActive ? 'rgba(11,122,92,0.24)' : 'rgba(124,118,111,0.20)',
        color: isActive ? 'var(--accent)' : 'var(--muted)',
      }}
    >
      {isActive ? 'Active' : 'Paused'}
    </span>
  )
}

async function getSessionToken() {
  const sb = createClient()
  const { data: { session } } = await sb.auth.getSession()
  return session?.access_token ?? null
}

export default function BrandMentionsOverviewPage() {
  const router = useRouter()
  const [overview, setOverview] = useState<RecordValue>({})
  const [alerts, setAlerts] = useState<BrandMentionAlert[]>([])
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

      const [overviewData, alertsData] = await Promise.all([
        brandMentionsApi.overview(token),
        brandMentionsApi.listAlerts(token),
      ])
      const overviewRecord = asRecord(overviewData)
      const alertList = extractList<BrandMentionAlert>(alertsData, ['alerts', 'items', 'results', 'data'])
      const overviewAlerts = extractList<BrandMentionAlert>(overviewData, ['alerts', 'items', 'results', 'data'])

      setOverview(overviewRecord)
      setAlerts(alertList.length > 0 ? alertList : overviewAlerts)
      setLoadError('')
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load Brand Pulse alerts.')
    } finally {
      if (shouldClearLoading) setLoading(false)
    }
  }, [router])

  useEffect(() => { void load() }, [load])

  const activeAlerts = pickMetric(overview, ['active_alerts', 'activeAlerts', 'active_alert_count'])
    ?? alerts.filter(alert => alert.active !== false).length
  const totalMentions = pickMetric(overview, ['total_mentions', 'totalMentions', 'mention_count'])
    ?? alerts.reduce((sum, alert) => sum + (alert.mention_count ?? alert.total_mentions ?? 0), 0)
  const negativeMentions = pickMetric(overview, ['negative_mentions', 'negativeMentions', 'negative_count']) ?? 0
  const uniqueDomains = pickMetric(overview, ['unique_domains', 'uniqueDomains', 'domain_count']) ?? 0
  const pausedCount = alerts.filter(alert => alert.active === false).length

  return (
    <AppLayout title="Brand Pulse">
      <div className="max-w-full">
        <JobLauncherShell
          eyebrow="Insights"
          title="Brand Pulse"
          description="Monitor live brand, competitor, and keyword signals from external sources."
          summary={
            <JobSummaryBar
              summaryItems={[
                { label: 'Active alerts', value: activeAlerts },
                { label: 'Mentions', value: totalMentions },
                { label: 'Negative', value: negativeMentions },
                { label: 'Domains', value: uniqueDomains },
              ]}
            />
          }
          actions={
            <div className="flex flex-wrap justify-end gap-2">
              <button onClick={() => void load()} disabled={loading} className="btn-ghost gap-2 text-sm">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
              <Link href="/brand-mentions/new" className="btn-primary gap-2">
                <PlusCircle size={15} />
                New Alert
              </Link>
            </div>
          }
        >
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <div className="card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Configured</p>
              <p className="mt-2 text-2xl font-bold text-text">{alerts.length}</p>
              <p className="mt-1 text-xs text-muted">Total alerts</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Paused</p>
              <p className="mt-2 text-2xl font-bold text-text">{pausedCount}</p>
              <p className="mt-1 text-xs text-muted">Inactive alerts</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Risk</p>
              <p className="mt-2 text-2xl font-bold text-error">{negativeMentions}</p>
              <p className="mt-1 text-xs text-muted">Negative mentions</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Coverage</p>
              <p className="mt-2 text-2xl font-bold text-text">{uniqueDomains}</p>
              <p className="mt-1 text-xs text-muted">Unique domains</p>
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-muted">Loading Brand Pulse alerts...</div>
          ) : loadError ? (
            <div className="rounded-lg border p-4" style={{ background: 'rgba(198,41,41,0.08)', borderColor: 'rgba(198,41,41,0.24)' }}>
              <p className="text-sm font-semibold text-error">Failed to load Brand Pulse</p>
              <p className="mt-1 text-sm text-muted">{loadError}</p>
              <button onClick={() => void load()} className="btn-ghost mt-3 text-xs">Retry</button>
            </div>
          ) : alerts.length === 0 ? (
            <div className="card py-14 text-center">
              <p className="text-sm font-semibold text-text">No Brand Pulse alerts yet.</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                Create the first alert to start tracking brand, competitor, or keyword mentions.
              </p>
              <Link href="/brand-mentions/new" className="btn-primary mt-5 gap-2">
                <PlusCircle size={15} />
                New Alert
              </Link>
            </div>
          ) : (
            <div className="card overflow-hidden p-0">
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
                      const lastCrawl = alert.last_crawl_at || alert.last_crawled_at || alert.last_crawl || alert.last_run_at
                      const lastError = alert.last_error || alert.error
                      return (
                        <tr key={alert.id} className="border-b border-border transition-colors last:border-0 hover:bg-bg">
                          <td className="px-5 py-3">
                            <Link href={`/brand-mentions/${alert.id}`} className="font-semibold text-text transition-colors hover:text-accent">
                              {alert.label || 'Untitled alert'}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-muted">{alert.keyword || '-'}</span>
                          </td>
                          <td className="px-4 py-3 text-muted">{titleCase(alert.alert_type)}</td>
                          <td className="px-4 py-3"><AlertStateBadge active={alert.active} /></td>
                          <td className="px-4 py-3 text-xs text-muted">{formatDate(lastCrawl)}</td>
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

          {!loading && alerts.length > 0 && (
            <div className="text-xs text-muted">
              <JobSummaryPills
                items={[
                  { label: `${alerts.length} configured`, tone: 'neutral' },
                  { label: `${activeAlerts} active`, tone: 'accent' },
                  ...(pausedCount > 0 ? [{ label: `${pausedCount} paused`, tone: 'muted' as const }] : []),
                ]}
              />
            </div>
          )}
        </JobLauncherShell>
      </div>
    </AppLayout>
  )
}
