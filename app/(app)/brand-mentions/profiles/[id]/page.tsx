'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Download, PlusCircle, RefreshCw } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import { JobLauncherShell, JobSection, JobSummaryBar } from '@/components/ui/JobLauncher'
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
  favorite_mentions?: number | string | null
  approved_mentions?: number | string | null
  noise_mentions?: number | string | null
  false_positive_mentions?: number | string | null
}

type BrandPulseAlert = RecordValue & {
  id: string
  label?: string | null
  keyword?: string | null
  alert_type?: string | null
  active?: boolean | null
  crawl_frequency?: string | null
  digest_enabled?: boolean | null
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

function numberField(record: RecordValue | null, keys: string[], fallback = 0) {
  if (!record) return fallback
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  }
  return fallback
}

function safeFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'brand-pulse-report'
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildReportHtml(report: RecordValue) {
  const profile = asRecord(report.profile)
  const summary = asRecord(report.summary)
  const alerts = extractList<RecordValue>(report.alerts, [])
  const topMentions = extractList<RecordValue>(report.top_mentions, [])
  const risks = extractList<RecordValue>(report.risks, [])
  const favorites = extractList<RecordValue>(report.favorites, [])
  const row = (mention: RecordValue) => `
    <tr>
      <td>${escapeHtml(stringField(mention, ['title'], 'Untitled'))}</td>
      <td>${escapeHtml(stringField(mention, ['domain'], '-'))}</td>
      <td>${escapeHtml(stringField(mention, ['provider_sentiment', 'sentiment'], '-'))}</td>
      <td>${escapeHtml(stringField(mention, ['quality_label'], '-'))}</td>
    </tr>`
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(profile.name || 'Brand Pulse report')}</title>
<style>body{font-family:Arial,sans-serif;margin:32px;color:#161412;background:#f5f1e9}h1{margin:0 0 4px}section{margin-top:28px;padding:20px;background:white;border:1px solid #ddd5c8;border-radius:8px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.metric{padding:12px;border:1px solid #e4ddd0;border-radius:6px}.label{font-size:11px;text-transform:uppercase;color:#766e62;font-weight:700}.value{font-size:22px;font-weight:800;margin-top:6px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #e4ddd0;padding:10px;text-align:left;font-size:13px}th{font-size:11px;text-transform:uppercase;color:#766e62}</style>
</head><body>
<h1>${escapeHtml(profile.name || 'Brand Pulse')}</h1><p>Generated ${escapeHtml(report.generated_at || new Date().toISOString())}</p>
<section><div class="grid">
${['alerts','active_alerts','mentions','negative_mentions','unique_domains','favorites','approved','noise'].map(key => `<div class="metric"><div class="label">${escapeHtml(key.replace(/_/g, ' '))}</div><div class="value">${escapeHtml(summary[key] ?? 0)}</div></div>`).join('')}
</div></section>
<section><h2>Alerts</h2><table><thead><tr><th>Alert</th><th>Keyword</th><th>Type</th><th>Schedule</th></tr></thead><tbody>${alerts.map(alert => `<tr><td>${escapeHtml(alert.label)}</td><td>${escapeHtml(alert.keyword)}</td><td>${escapeHtml(alert.alert_type)}</td><td>${escapeHtml(alert.crawl_frequency || 'manual')}</td></tr>`).join('')}</tbody></table></section>
<section><h2>Top mentions</h2><table><thead><tr><th>Mention</th><th>Domain</th><th>Sentiment</th><th>Quality</th></tr></thead><tbody>${topMentions.map(row).join('')}</tbody></table></section>
<section><h2>Risks</h2><table><thead><tr><th>Mention</th><th>Domain</th><th>Sentiment</th><th>Quality</th></tr></thead><tbody>${risks.map(row).join('')}</tbody></table></section>
<section><h2>Favorites</h2><table><thead><tr><th>Mention</th><th>Domain</th><th>Sentiment</th><th>Quality</th></tr></thead><tbody>${favorites.map(row).join('')}</tbody></table></section>
</body></html>`
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
  const [exportingReport, setExportingReport] = useState(false)

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

  async function downloadReport() {
    if (!profileId) return
    setExportingReport(true)
    try {
      const token = await getSessionToken()
      if (!token) {
        router.push('/login')
        return
      }
      const report = await brandMentionsApi.getProfileReport(token, profileId)
      const html = buildReportHtml(asRecord(report))
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${safeFileName(profile?.name || 'brand-pulse')}-report.html`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to export profile report.')
    } finally {
      setExportingReport(false)
    }
  }

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
          summary={
            <JobSummaryBar
              summaryItems={[
                { label: 'Alerts', value: numberField(profile, ['alert_count']) },
                { label: 'Active', value: numberField(profile, ['active_alerts']) },
                { label: 'Mentions', value: numberField(profile, ['mention_count']) },
                { label: 'Risks', value: numberField(profile, ['negative_mentions']) },
                { label: 'Favorites', value: numberField(profile, ['favorite_mentions']) },
                { label: 'Approved', value: numberField(profile, ['approved_mentions']) },
              ]}
            />
          }
          actions={
            <div className="flex flex-wrap justify-end gap-2">
              <button onClick={() => void load()} disabled={loading} className="btn-ghost gap-2 text-sm">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
              <button onClick={() => void downloadReport()} disabled={exportingReport || !profileId} className="btn-ghost gap-2 text-sm">
                <Download size={14} />
                {exportingReport ? 'Exporting...' : 'Export Report'}
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
                          <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Schedule</th>
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
                              <td className="px-4 py-3 text-xs text-muted">
                                {titleCase(alert.crawl_frequency || 'manual')}
                                {alert.digest_enabled && <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-accent">Digest</span>}
                              </td>
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
