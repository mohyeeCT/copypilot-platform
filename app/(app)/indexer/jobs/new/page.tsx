'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Papa from 'papaparse'
import { AlignLeft, ArrowLeft, FileText, Link2, Search } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import workspaceStyles from '@/components/meta/MetaCopyWorkspace.module.css'
import { JobLauncherShell, JobSection, JobSummaryBar, JobSummaryPills } from '@/components/ui/JobLauncher'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { createClient } from '@/lib/supabase'
import { indexerApi } from '@/lib/api/indexer'
import { getSettings, type GscSettings } from '@/lib/api/shared'

export const dynamic = 'force-dynamic'

type Tab = 'paste' | 'csv' | 'sitemap'

const TABS: { value: Tab; label: string }[] = [
  { value: 'paste', label: 'Paste URLs' },
  { value: 'csv', label: 'Upload CSV' },
  { value: 'sitemap', label: 'Sitemap URL' },
]

function parseUrlsFromText(text: string): string[] {
  return [...new Set(
    text
      .split(/[\n\r]+/)
      .map(line => line.trim())
      .filter(line => line.startsWith('http://') || line.startsWith('https://'))
  )]
}

function findUrlColumn(headers: string[]): number {
  const lower = headers.map(header => header.toLowerCase())
  const exact = lower.findIndex(header => header === 'url' || header === 'urls' || header === 'address')
  if (exact !== -1) return exact
  const partial = lower.findIndex(header => header.includes('url') || header.includes('address') || header.includes('link'))
  if (partial !== -1) return partial
  return 0
}

async function getToken() {
  const sb = createClient()
  const { data: { session } } = await sb.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return session.access_token
}

export default function NewIndexerJobPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState<Tab>('paste')
  const [jobName, setJobName] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [csvUrls, setCsvUrls] = useState<string[]>([])
  const [csvFileName, setCsvFileName] = useState('')
  const [csvError, setCsvError] = useState('')
  const [sitemapUrl, setSitemapUrl] = useState('')
  const [sitemapPreview, setSitemapPreview] = useState<{ count: number; sample: string[] } | null>(null)
  const [sitemapError, setSitemapError] = useState('')
  const [fetching, setFetching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [gscSettings, setGscSettings] = useState<GscSettings | null>(null)

  const pastedUrls = parseUrlsFromText(pasteText)
  const activeUrlCount = tab === 'sitemap'
    ? sitemapPreview?.count || (sitemapUrl.startsWith('http') ? 1 : 0)
    : tab === 'csv'
      ? csvUrls.length
      : pastedUrls.length
  const authLabel = gscSettings?.active_method === 'google_oauth' ? 'Google account' : 'Service account'
  const oauthNeedsReconnect = Boolean(
    gscSettings?.active_method === 'google_oauth' &&
    gscSettings.google_oauth.configured &&
    gscSettings.google_oauth.has_indexing_scope === false
  )

  useEffect(() => {
    void getToken()
      .then(token => getSettings(token))
      .then(settings => {
        if (settings?.gsc) setGscSettings(settings.gsc as GscSettings)
      })
      .catch(() => undefined)
  }, [])

  function handleCSV(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setCsvError('')
    setCsvUrls([])
    setCsvFileName(file.name)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: results => {
        const headers = results.meta.fields || []
        if (!headers.length) {
          setCsvError('Could not read CSV headers.')
          return
        }
        const colIdx = findUrlColumn(headers)
        const colName = headers[colIdx]
        const urls = (results.data as Record<string, string>[])
          .map(row => (row[colName] || '').trim())
          .filter(url => url.startsWith('http://') || url.startsWith('https://'))
        const unique = [...new Set(urls)]
        if (!unique.length) {
          setCsvError(`No URLs found in column "${colName}". Make sure the file has a URL column.`)
          return
        }
        setCsvUrls(unique)
      },
      error: () => setCsvError('Failed to parse CSV file.'),
    })
  }

  async function handleFetchSitemap() {
    if (!sitemapUrl) return
    setFetching(true)
    setSitemapError('')
    setSitemapPreview(null)
    try {
      const token = await getToken()
      const data = await indexerApi.previewSitemap(token, sitemapUrl)
      setSitemapPreview(data)
    } catch (err) {
      setSitemapError(err instanceof Error ? err.message : 'Failed to fetch sitemap.')
    } finally {
      setFetching(false)
    }
  }

  function getActiveUrls(): string[] {
    if (tab === 'paste') return pastedUrls
    if (tab === 'csv') return csvUrls
    return []
  }

  function canSubmit() {
    if (submitting) return false
    if (oauthNeedsReconnect) return false
    if (tab === 'paste') return pastedUrls.length > 0
    if (tab === 'csv') return csvUrls.length > 0
    if (tab === 'sitemap') return sitemapPreview !== null || sitemapUrl.startsWith('http')
    return false
  }

  async function handleSubmit() {
    setError('')
    setSubmitting(true)
    try {
      const token = await getToken()
      let jobId: string

      if (tab === 'sitemap') {
        const res = await indexerApi.submitSitemap(token, sitemapUrl, jobName || undefined)
        jobId = res.job_id
      } else {
        const urls = getActiveUrls()
        if (!urls.length) {
          setError('No valid URLs to submit.')
          setSubmitting(false)
          return
        }
        const res = await indexerApi.submitUrls(token, urls, jobName || undefined)
        jobId = res.job_id
      }

      router.push(`/indexer/jobs/${jobId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed.')
      setSubmitting(false)
    }
  }

  const sourceLabel = TABS.find(item => item.value === tab)?.label ?? 'Paste URLs'

  return (
    <AppLayout title="New Indexer Job">
      <div className={`max-w-full ${workspaceStyles.newPage}`}>
        <Link href="/indexer/jobs" className={workspaceStyles.backLink}>
          <ArrowLeft size={16} /> Back to Indexer jobs
        </Link>
        <JobLauncherShell
          eyebrow="Indexer"
          title="New Indexer Job"
          description="Submit URLs to Google's Indexing API using paste, CSV, or sitemap input."
          summary={
            <JobSummaryBar
              summaryItems={[
                { label: 'URLs', value: activeUrlCount },
                { label: 'Input', value: sourceLabel },
                { label: 'Auth', value: <JobSummaryPills items={[
                  { label: authLabel, tone: oauthNeedsReconnect ? 'muted' : 'accent' },
                  ...(oauthNeedsReconnect ? [{ label: 'Reconnect needed', tone: 'muted' as const }] : []),
                ]} /> },
                { label: 'Limit', value: '200/day' },
              ]}
            />
          }
          actions={
            <button onClick={() => void handleSubmit()} disabled={!canSubmit()} className="btn-primary gap-2">
              {submitting ? 'Starting job...' : 'Run Job'}
            </button>
          }
        >
          {error && <p className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}
          {oauthNeedsReconnect && (
            <p className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
              Reconnect Google in Settings before running Indexer with Google account.
            </p>
          )}

          <div className={`grid grid-cols-7 gap-6 ${workspaceStyles.composerGrid}`}>
            <div className={`col-span-5 space-y-4 ${workspaceStyles.composerMain}`}>
              <JobSection title="Inputs" description="Name the run and add the URLs that should be submitted.">
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs text-muted">Job name (optional)</label>
                    <input
                      type="text"
                      value={jobName}
                      onChange={event => setJobName(event.target.value)}
                      className="input-base"
                      placeholder="e.g. Blog posts batch - May 2026"
                    />
                  </div>

                  <SegmentedControl value={tab} onChange={setTab} options={TABS} ariaLabel="Indexer input source" />

                  {tab === 'paste' && (
                    <div>
                      <label className="mb-2 flex items-center gap-2 text-xs text-muted">
                        <AlignLeft size={14} />
                        One URL per line. Only https:// and http:// URLs are accepted.
                      </label>
                      <textarea
                        value={pasteText}
                        onChange={event => setPasteText(event.target.value)}
                        className="input-base h-56"
                        placeholder={"https://example.com/page-1\nhttps://example.com/page-2\nhttps://example.com/page-3"}
                      />
                      {pasteText && (
                        <p className="mt-2 text-xs text-muted">
                          {pastedUrls.length} valid URL{pastedUrls.length !== 1 ? 's' : ''} detected
                        </p>
                      )}
                    </div>
                  )}

                  {tab === 'csv' && (
                    <div>
                      <label className="mb-2 flex items-center gap-2 text-xs text-muted">
                        <FileText size={14} />
                        Upload a CSV file. The tool auto-detects the URL column.
                      </label>
                      <div
                        onClick={() => fileRef.current?.click()}
                        className="cursor-pointer rounded-lg border border-dashed border-border bg-bg/50 p-8 text-center transition-colors hover:border-accent"
                      >
                        <FileText size={24} className="mx-auto mb-2 text-muted" />
                        <p className="text-sm text-muted">{csvFileName || 'Click to upload CSV'}</p>
                        {csvUrls.length > 0 && <p className="mt-1 text-xs text-accent">{csvUrls.length} URLs loaded</p>}
                      </div>
                      <input ref={fileRef} type="file" accept=".csv" onChange={handleCSV} className="hidden" />
                      {csvError && <p className="mt-2 text-xs text-error">{csvError}</p>}
                      {csvUrls.length > 0 && (
                        <div className="mt-3 max-h-32 overflow-auto rounded-lg border border-border bg-bg p-3">
                          {csvUrls.slice(0, 5).map(url => (
                            <p key={url} className="truncate font-mono text-xs text-muted">{url}</p>
                          ))}
                          {csvUrls.length > 5 && <p className="mt-1 text-xs text-muted">...and {csvUrls.length - 5} more</p>}
                        </div>
                      )}
                    </div>
                  )}

                  {tab === 'sitemap' && (
                    <div>
                      <label className="mb-2 flex items-center gap-2 text-xs text-muted">
                        <Link2 size={14} />
                        Enter a sitemap URL. Sitemap indexes are supported.
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={sitemapUrl}
                          onChange={event => {
                            setSitemapUrl(event.target.value)
                            setSitemapPreview(null)
                            setSitemapError('')
                          }}
                          className="input-base flex-1"
                          placeholder="https://example.com/sitemap.xml"
                        />
                        <button
                          onClick={() => void handleFetchSitemap()}
                          disabled={!sitemapUrl || fetching}
                          className="btn-ghost gap-2 whitespace-nowrap"
                        >
                          <Search size={14} />
                          {fetching ? 'Fetching...' : 'Fetch URLs'}
                        </button>
                      </div>
                      {sitemapError && <p className="mt-2 text-xs text-error">{sitemapError}</p>}
                      {sitemapPreview && (
                        <div className="mt-3 rounded-lg border border-border bg-bg p-4">
                          <p className="mb-2 text-sm font-medium text-accent">Found {sitemapPreview.count} URLs</p>
                          {sitemapPreview.sample.map(url => (
                            <p key={url} className="truncate font-mono text-xs text-muted">{url}</p>
                          ))}
                          {sitemapPreview.count > 10 && <p className="mt-1 text-xs text-muted">...and {sitemapPreview.count - 10} more</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </JobSection>
            </div>

            <div className={`col-span-2 space-y-4 ${workspaceStyles.settingsRail}`}>
              <JobSection title="Configuration" description="Indexer jobs submit URL_UPDATED notifications through Google.">
                <div className={workspaceStyles.settingsBody}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">Action</span>
                    <span className="text-xs font-medium text-text">Submit for indexing</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">Daily limit</span>
                    <span className="text-xs font-medium text-text">200 URLs</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">Source</span>
                    <span className="text-xs font-medium text-text">{sourceLabel}</span>
                  </div>
                </div>
              </JobSection>
            </div>
          </div>
        </JobLauncherShell>
      </div>
    </AppLayout>
  )
}
