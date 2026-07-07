'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, PlusCircle } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import CustomSelect from '@/components/ui/CustomSelect'
import StyledCheckbox from '@/components/ui/StyledCheckbox'
import { JobLauncherShell, JobSection, JobSummaryBar, JobSummaryPills } from '@/components/ui/JobLauncher'
import { createClient } from '@/lib/supabase'
import { brandMentionsApi, type BrandMentionAlertPayload } from '@/lib/api/brand-mentions'

export const dynamic = 'force-dynamic'

type AlertType = BrandMentionAlertPayload['alert_type']
type SourceType = BrandMentionAlertPayload['sources'][number]

const ALERT_TYPES: { value: AlertType; label: string }[] = [
  { value: 'brand', label: 'Brand' },
  { value: 'competitor', label: 'Competitor' },
  { value: 'keyword', label: 'Keyword' },
]

const SOURCES: { value: SourceType; label: string; description: string }[] = [
  { value: 'news', label: 'News', description: 'News publishers and editorial sites' },
  { value: 'blogs', label: 'Blogs', description: 'Blogs, guides, and independent posts' },
  { value: 'forums', label: 'Forums', description: 'Community discussions and forum threads' },
  { value: 'organizations', label: 'Organizations', description: 'Company, nonprofit, and institutional pages' },
]

const MIN_RESULTS_PER_CRAWL = 10
const MAX_RESULTS_PER_CRAWL = 100
const DEFAULT_RESULTS_PER_CRAWL = 50

async function getSessionToken() {
  const sb = createClient()
  const { data: { session } } = await sb.auth.getSession()
  return session?.access_token ?? null
}

function clampMaxResults(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_RESULTS_PER_CRAWL
  return Math.min(MAX_RESULTS_PER_CRAWL, Math.max(MIN_RESULTS_PER_CRAWL, Math.round(value)))
}

function normalizeMaxResultsDraft(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return DEFAULT_RESULTS_PER_CRAWL
  return clampMaxResults(Number(trimmed))
}

function createdAlertId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.id === 'string') return record.id
  const alert = record.alert
  if (alert && typeof alert === 'object' && typeof (alert as Record<string, unknown>).id === 'string') {
    return (alert as Record<string, string>).id
  }
  return null
}

export default function NewBrandMentionAlertPage() {
  const router = useRouter()
  const [label, setLabel] = useState('')
  const [keyword, setKeyword] = useState('')
  const [alertType, setAlertType] = useState<AlertType>('brand')
  const [sources, setSources] = useState<SourceType[]>(['news', 'blogs', 'forums', 'organizations'])
  const [exclusionWords, setExclusionWords] = useState('')
  const [maxResultsInput, setMaxResultsInput] = useState(String(DEFAULT_RESULTS_PER_CRAWL))
  const [active, setActive] = useState(true)
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

  function toggleSource(source: SourceType, checked: boolean) {
    setSources(current => {
      if (checked) return current.includes(source) ? current : [...current, source]
      return current.filter(item => item !== source)
    })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const trimmedLabel = label.trim()
    const trimmedKeyword = keyword.trim()
    if (!trimmedLabel) {
      setError('Add an alert label before creating the alert.')
      return
    }
    if (!trimmedKeyword) {
      setError('Add a keyword before creating the alert.')
      return
    }
    if (sources.length === 0) {
      setError('Select at least one source type.')
      return
    }
    const normalizedMaxResults = normalizeMaxResultsDraft(maxResultsInput)
    if (String(normalizedMaxResults) !== maxResultsInput) setMaxResultsInput(String(normalizedMaxResults))

    setSubmitting(true)
    try {
      const token = await getSessionToken()
      if (!token) {
        router.push('/login')
        return
      }

      const payload: BrandMentionAlertPayload = {
        label: trimmedLabel,
        keyword: trimmedKeyword,
        alert_type: alertType,
        sources,
        exclusion_words: exclusionWords.split('\n').map(word => word.trim()).filter(Boolean),
        max_results_per_crawl: normalizedMaxResults,
        active,
      }
      const created = await brandMentionsApi.createAlert(token, payload)
      const id = createdAlertId(created)
      router.push(id ? `/brand-mentions/${id}` : '/brand-mentions')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create Brand Pulse alert.')
      setSubmitting(false)
    }
  }

  if (checkingSession) {
    return (
      <AppLayout title="New Brand Pulse Alert">
        <div className="text-sm text-muted">Checking session...</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="New Brand Pulse Alert">
      <div className="max-w-full">
        <Link href="/brand-mentions" className="mb-4 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-text">
          <ArrowLeft size={16} /> Back to Brand Pulse
        </Link>

        <form onSubmit={handleSubmit}>
          <JobLauncherShell
            eyebrow="Insights"
            title="New Brand Pulse Alert"
            description="Create an operational alert for brand, competitor, or keyword monitoring."
            summary={
              <JobSummaryBar
                summaryItems={[
                  { label: 'Type', value: alertType },
                  { label: 'Sources', value: sources.length },
                  { label: 'Max results', value: maxResultsInput.trim() || DEFAULT_RESULTS_PER_CRAWL },
                  { label: 'State', value: active ? 'Active' : 'Paused' },
                ]}
              />
            }
            actions={
              <button type="submit" disabled={submitting} className="btn-primary gap-2">
                <PlusCircle size={15} />
                {submitting ? 'Creating...' : 'Create Alert'}
              </button>
            }
          >
            {error && (
              <div className="rounded-lg border p-4" style={{ background: 'rgba(198,41,41,0.08)', borderColor: 'rgba(198,41,41,0.24)' }}>
                <p className="text-sm font-semibold text-error">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-7">
              <div className="space-y-4 lg:col-span-5">
                <JobSection title="Alert definition" description="Name the alert and define the exact term the monitor should search for.">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div>
                      <label htmlFor="brand-mention-label" className="mb-1 block text-xs font-semibold text-muted">Label</label>
                      <input
                        id="brand-mention-label"
                        name="label"
                        value={label}
                        onChange={event => setLabel(event.target.value)}
                        className="input-base"
                        placeholder="Acme Brand Pulse"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="brand-mention-keyword" className="mb-1 block text-xs font-semibold text-muted">Keyword</label>
                      <input
                        id="brand-mention-keyword"
                        name="keyword"
                        value={keyword}
                        onChange={event => setKeyword(event.target.value)}
                        className="input-base"
                        placeholder="Acme"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted">Alert type</label>
                      <CustomSelect
                        value={alertType}
                        onChange={value => setAlertType(value as AlertType)}
                        options={ALERT_TYPES}
                      />
                    </div>
                    <div>
                      <label htmlFor="brand-mention-max-results" className="mb-1 block text-xs font-semibold text-muted">Max results per crawl</label>
                      <input
                        id="brand-mention-max-results"
                        name="max_results_per_crawl"
                        type="number"
                        min={MIN_RESULTS_PER_CRAWL}
                        max={MAX_RESULTS_PER_CRAWL}
                        step={1}
                        inputMode="numeric"
                        value={maxResultsInput}
                        onChange={event => setMaxResultsInput(event.target.value)}
                        onBlur={() => setMaxResultsInput(String(normalizeMaxResultsDraft(maxResultsInput)))}
                        className="input-base"
                      />
                    </div>
                  </div>
                </JobSection>

                <JobSection title="Sources" description="Choose where the alert should look for mentions.">
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {SOURCES.map(source => (
                      <div key={source.value} className="rounded-lg border border-border p-3">
                        <div className="flex items-start gap-3">
                          <StyledCheckbox
                            checked={sources.includes(source.value)}
                            onChange={checked => toggleSource(source.value, checked)}
                            ariaLabel={`Include ${source.label}`}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-text">{source.label}</p>
                            <p className="mt-1 text-xs text-muted">{source.description}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </JobSection>

                <JobSection title="Exclusions" description="Optional words to exclude from matching, one per line.">
                  <label htmlFor="brand-mention-exclusion-words" className="mb-1 block text-xs font-semibold text-muted">Exclusion words</label>
                  <textarea
                    id="brand-mention-exclusion-words"
                    name="exclusion_words"
                    value={exclusionWords}
                    onChange={event => setExclusionWords(event.target.value)}
                    className="input-base min-h-32"
                    placeholder={"careers\njobs\nlogin"}
                  />
                </JobSection>
              </div>

              <div className="space-y-4 lg:col-span-2">
                <JobSection title="Status" description="Active alerts can be crawled immediately after creation.">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 rounded-lg border border-border p-3">
                      <StyledCheckbox
                        checked={active}
                        onChange={setActive}
                        ariaLabel="Alert is active"
                      />
                      <div>
                        <p className="text-sm font-semibold text-text">Active alert</p>
                        <p className="mt-1 text-xs text-muted">Keep enabled for scheduled and manual crawls.</p>
                      </div>
                    </div>
                    <JobSummaryPills
                      items={[
                        { label: `${sources.length} sources`, tone: sources.length > 0 ? 'accent' : 'muted' },
                        { label: `${maxResultsInput.trim() || DEFAULT_RESULTS_PER_CRAWL} max`, tone: 'neutral' },
                        { label: active ? 'Active' : 'Paused', tone: active ? 'success' : 'muted' },
                      ]}
                    />
                  </div>
                </JobSection>
              </div>
            </div>
          </JobLauncherShell>
        </form>
      </div>
    </AppLayout>
  )
}
