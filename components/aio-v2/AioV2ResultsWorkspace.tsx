'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Check,
  ClipboardCheck,
  Download,
  FileOutput,
  FileText,
  ListChecks,
  RefreshCw,
  SearchCheck,
  Send,
  Sparkles,
  WandSparkles,
} from 'lucide-react'
import {
  aioV2Api,
  AioV2ApiError,
  type AioV2ChangesView,
  type AioV2ExportOperation,
  type AioV2OutputsView,
  type AioV2QaView,
  type AioV2SectionsView,
} from '@/lib/api/aio-v2'
import styles from './AioV2ResultsWorkspace.module.css'

type ResultTab = 'overview' | 'page' | 'meta' | 'faq' | 'qa' | 'changes' | 'exports'
type LoadState = 'loading' | 'waiting' | 'ready' | 'error'
type ExportRetry = {
  format: 'docx' | 'google_docs'
  googleAuthMethod: 'google_oauth' | 'service_account' | null
  key: string
}
type RegenerationRetry = {
  sectionId: string
  correction: string
  key: string
}

type ResultBundle = {
  outputs: AioV2OutputsView
  sections: AioV2SectionsView
  qa: AioV2QaView
  changes: AioV2ChangesView
  exports: AioV2ExportOperation[]
}

const tabs: Array<{ id: ResultTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'page', label: 'Page Copy' },
  { id: 'meta', label: 'Meta' },
  { id: 'faq', label: 'AIO FAQ' },
  { id: 'qa', label: 'QA' },
  { id: 'changes', label: 'Changes' },
  { id: 'exports', label: 'Exports' },
]

function pretty(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

function shortHash(value: string | null | undefined) {
  if (!value) return 'Not available'
  return `${value.slice(0, 8)}...${value.slice(-6)}`
}

function safeAccessUrl(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function AioV2ResultsWorkspace({
  jobId,
  token,
}: {
  jobId: string
  token: string
}) {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [result, setResult] = useState<ResultBundle | null>(null)
  const [activeTab, setActiveTab] = useState<ResultTab>('overview')
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [exporting, setExporting] = useState<'docx' | 'google_docs' | null>(null)
  const [googleAuthMethod, setGoogleAuthMethod] = useState<'google_oauth' | 'service_account'>('google_oauth')
  const [exportRetry, setExportRetry] = useState<ExportRetry | null>(null)
  const [regenerating, setRegenerating] = useState<string | null>(null)
  const [regenerationRetry, setRegenerationRetry] = useState<RegenerationRetry | null>(null)
  const [corrections, setCorrections] = useState<Record<string, string>>({})
  const [regenerationNotice, setRegenerationNotice] = useState('')

  const loadResults = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    setError('')
    try {
      const [outputs, sections, qa, changes, exportResponse] = await Promise.all([
        aioV2Api.getOutputs(token, jobId),
        aioV2Api.getSections(token, jobId),
        aioV2Api.getQa(token, jobId),
        aioV2Api.getChanges(token, jobId),
        aioV2Api.listExports(token, jobId),
      ])
      setResult({ outputs, sections, qa, changes, exports: exportResponse.exports })
      setLoadState('ready')
    } catch (cause) {
      if (cause instanceof AioV2ApiError && cause.code === 'result_not_ready') {
        setLoadState('waiting')
      } else {
        setLoadState('error')
        setError(cause instanceof Error ? cause.message : 'Results could not be loaded.')
      }
    } finally {
      setRefreshing(false)
    }
  }, [jobId, token])

  useEffect(() => {
    void loadResults()
  }, [loadResults])

  const shouldPoll = loadState === 'waiting' || (
    result !== null && !['complete', 'partial', 'failed', 'cancelled'].includes(result.outputs.state)
  ) || result?.exports.some(item => item.status === 'queued' || item.status === 'running') === true

  useEffect(() => {
    if (!shouldPoll) return
    const timer = window.setInterval(() => void loadResults(true), 5000)
    return () => window.clearInterval(timer)
  }, [loadResults, shouldPoll])

  const requestedTabs = useMemo(() => ({
    page: result?.outputs.requested_outputs.page_copy ?? false,
    meta: result?.outputs.requested_outputs.meta ?? false,
    faq: result?.outputs.requested_outputs.aio_faq ?? false,
  }), [result])

  async function requestExport(format: 'docx' | 'google_docs') {
    if (exporting) return
    setExporting(format)
    setError('')
    const googleAuth = format === 'google_docs' ? googleAuthMethod : null
    const sameRequest = exportRetry?.format === format
      && exportRetry.googleAuthMethod === googleAuth
    const key = sameRequest
      ? exportRetry.key
      : `aio-v2-export:${window.crypto.randomUUID()}`
    setExportRetry({ format, googleAuthMethod: googleAuth, key })
    try {
      await aioV2Api.requestExport(
        token,
        jobId,
        {
          format,
          google_auth_method: googleAuth,
        },
        key,
      )
      setExportRetry(null)
      await loadResults(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The export could not be requested.')
    } finally {
      setExporting(null)
    }
  }

  async function regenerateSection(sectionId: string) {
    if (regenerating) return
    const correction = (corrections[sectionId] ?? '').trim()
    const sameRequest = regenerationRetry?.sectionId === sectionId
      && regenerationRetry.correction === correction
    const key = sameRequest
      ? regenerationRetry.key
      : `aio-v2-regeneration:${window.crypto.randomUUID()}`

    setRegenerating(sectionId)
    setRegenerationRetry({ sectionId, correction, key })
    setRegenerationNotice('')
    setError('')
    try {
      await aioV2Api.regenerateSection(token, jobId, sectionId, correction || null, key)
      setRegenerationRetry(null)
      setRegenerationNotice('Regeneration queued. The current completed revision remains visible until the requested revision succeeds.')
      await loadResults(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The section regeneration could not be requested.')
    } finally {
      setRegenerating(null)
    }
  }

  if (loadState === 'loading') {
    return <section className={styles.stateCard} aria-live="polite"><span className={styles.spinner} /><h2>Preparing result tabs</h2><p>Waiting for the approved generation manifest.</p></section>
  }

  if (loadState === 'waiting') {
    return (
      <section className={styles.stateCard} aria-live="polite">
        <Sparkles size={22} />
        <h2>Generation has not started yet</h2>
        <p>The approved plan is safe. Result tabs will appear as checkpoints are retained.</p>
        <button type="button" className="btn-ghost" disabled={refreshing} onClick={() => void loadResults()}><RefreshCw size={14} /> Check now</button>
      </section>
    )
  }

  if (loadState === 'error' || !result) {
    return (
      <section className={styles.stateCard}>
        <AlertTriangle size={22} />
        <h2>Results are temporarily unavailable</h2>
        <p>{error}</p>
        <button type="button" className="btn-ghost" disabled={refreshing} onClick={() => void loadResults()}><RefreshCw size={14} /> Try again</button>
      </section>
    )
  }

  return (
    <section className={styles.workspace} aria-label="AIO v2 generation results">
      <header className={styles.header}>
        <div>
          <span className={styles.kicker}><FileOutput size={13} /> Generated result</span>
          <h2>{result.outputs.final_available ? 'Approved output bundle' : 'Retained partial output'}</h2>
          <p>Meta, Page Copy, and AIO FAQ remain separate outputs under the exact approved plan.</p>
        </div>
        <div className={styles.headerActions}>
          <span data-state={result.outputs.state}>{pretty(result.outputs.state)}</span>
          <button type="button" className="btn-ghost" disabled={refreshing} onClick={() => void loadResults()}><RefreshCw size={14} /> {refreshing ? 'Refreshing...' : 'Refresh'}</button>
        </div>
      </header>

      {result.outputs.state === 'partial' ? (
        <div className={styles.partialNotice} role="status"><AlertTriangle size={15} /><span>Only safely retained outputs are shown and exportable. Missing outputs are not reconstructed silently.</span></div>
      ) : null}
      {regenerationNotice ? <div className={styles.regenerationNotice} role="status"><WandSparkles size={15} /><span>{regenerationNotice}</span></div> : null}
      {error ? <div className={styles.error} role="alert"><AlertTriangle size={15} /><span>{error}</span></div> : null}

      <div className={styles.tabs} role="tablist" aria-label="Result views">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            data-available={tab.id === 'page' ? requestedTabs.page : tab.id === 'meta' ? requestedTabs.meta : tab.id === 'faq' ? requestedTabs.faq : true}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.tabBody} role="tabpanel">
        {activeTab === 'overview' ? <Overview result={result} /> : null}
        {activeTab === 'page' ? (
          <PageCopy
            sections={result.sections}
            requested={requestedTabs.page}
            corrections={corrections}
            regenerating={regenerating}
            onCorrection={(sectionId, value) => setCorrections(current => ({ ...current, [sectionId]: value }))}
            onRegenerate={regenerateSection}
          />
        ) : null}
        {activeTab === 'meta' ? <MetaOutput outputs={result.outputs} requested={requestedTabs.meta} /> : null}
        {activeTab === 'faq' ? <FaqOutput outputs={result.outputs} requested={requestedTabs.faq} /> : null}
        {activeTab === 'qa' ? <QaOutput qa={result.qa} /> : null}
        {activeTab === 'changes' ? <ChangesOutput changes={result.changes} requested={requestedTabs.page} /> : null}
        {activeTab === 'exports' ? (
          <ExportsOutput
            exports={result.exports}
            exporting={exporting}
            authMethod={googleAuthMethod}
            onAuthMethod={setGoogleAuthMethod}
            onExport={requestExport}
          />
        ) : null}
      </div>
    </section>
  )
}

function Overview({ result }: { result: ResultBundle }) {
  const availableSections = result.sections.page?.sections ?? result.sections.sections.map(item => item.section)
  return (
    <div className={styles.overviewGrid}>
      <SummaryCard icon={<FileText size={16} />} label="Page Copy" value={result.outputs.requested_outputs.page_copy ? `${availableSections.length} sections` : 'Not requested'} />
      <SummaryCard icon={<SearchCheck size={16} />} label="Meta" value={result.outputs.meta ? 'Title + description ready' : result.outputs.requested_outputs.meta ? 'Unavailable' : 'Not requested'} />
      <SummaryCard icon={<ListChecks size={16} />} label="AIO FAQ" value={result.outputs.aio_faq ? `${result.outputs.aio_faq.items.length} answers` : result.outputs.requested_outputs.aio_faq ? 'Unavailable' : 'Not requested'} />
      <SummaryCard icon={<ClipboardCheck size={16} />} label="Deterministic QA" value={result.qa.available ? `${result.qa.report?.blocking_count ?? 0} blocking` : 'Not published'} />
      <div className={styles.hashCard}>
        <span>Manifest</span><code>{shortHash(result.sections.manifest_hash)}</code>
        <span>Output bundle</span><code>{shortHash(result.outputs.bundle?.output_hash)}</code>
      </div>
    </div>
  )
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <article className={styles.summaryCard}>{icon}<span>{label}</span><strong>{value}</strong></article>
}

function PageCopy({
  sections,
  requested,
  corrections,
  regenerating,
  onCorrection,
  onRegenerate,
}: {
  sections: AioV2SectionsView
  requested: boolean
  corrections: Record<string, string>
  regenerating: string | null
  onCorrection: (sectionId: string, value: string) => void
  onRegenerate: (sectionId: string) => Promise<void>
}) {
  if (!requested) return <Unavailable text="Page Copy was not selected for this approved plan." />
  const items = sections.page?.sections ?? sections.sections.map(item => item.section)
  if (!items.length) return <Unavailable text="No Page Copy section was safely retained." />
  const regenerationAllowed = sections.state === 'complete'
  return <div className={styles.copyStack}>{items.map(item => <article key={item.section_id} className={styles.copySection}><div><span>{pretty(item.action)}</span><small>{item.word_count} words</small></div>{item.approved_heading ? item.heading_level === 'h1' ? <h1>{item.approved_heading}</h1> : item.heading_level === 'h3' ? <h3>{item.approved_heading}</h3> : <h2>{item.approved_heading}</h2> : null}<p>{item.content_markdown}</p><code>{shortHash(item.content_hash)}</code>{regenerationAllowed && item.call_required ? <div className={styles.regenerationControl}><label htmlFor={`regeneration-${item.section_id}`}>Optional editorial correction</label><textarea id={`regeneration-${item.section_id}`} maxLength={1000} value={corrections[item.section_id] ?? ''} onChange={event => onCorrection(item.section_id, event.target.value)} placeholder="Describe the correction without changing the approved structure, provider, or evidence scope." /><button type="button" className="btn-ghost" disabled={regenerating !== null} onClick={() => void onRegenerate(item.section_id)}><WandSparkles size={14} /> {regenerating === item.section_id ? 'Queuing...' : 'Regenerate section'}</button><small>Always user initiated · one new revision · no reviewer loop.</small></div> : null}</article>)}</div>
}

function MetaOutput({ outputs, requested }: { outputs: AioV2OutputsView; requested: boolean }) {
  if (!requested) return <Unavailable text="Meta was not selected for this approved plan." />
  if (!outputs.meta) return <Unavailable text="Meta was requested but was not safely retained." />
  return <div className={styles.metaGrid}><article><span>Approved H1 - unchanged</span><h2>{outputs.meta.approved_h1}</h2></article><article><span>Meta title - {outputs.meta.title_characters} characters</span><p>{outputs.meta.title}</p></article><article><span>Meta description - {outputs.meta.description_characters} characters</span><p>{outputs.meta.description}</p></article></div>
}

function FaqOutput({ outputs, requested }: { outputs: AioV2OutputsView; requested: boolean }) {
  if (!requested) return <Unavailable text="AIO FAQ was not selected. Standalone FAQ is unchanged." />
  if (!outputs.aio_faq) return <Unavailable text="AIO FAQ was requested but was not safely retained." />
  return <div className={styles.faqList}>{outputs.aio_faq.items.map(item => <article key={item.id}><span>{item.id}</span><h3>{item.question}</h3><p>{item.answer}</p><small>Intent: {item.intent}</small></article>)}</div>
}

function QaOutput({ qa }: { qa: AioV2QaView }) {
  if (!qa.report) return <Unavailable text="Final deterministic QA is not published for this lifecycle state." />
  return <div><div className={styles.qaSummary}><span><strong>{qa.report.blocking_count}</strong> Blocking</span><span><strong>{qa.report.warning_count}</strong> Warnings</span><span><strong>{qa.report.info_count}</strong> Info</span></div><p className={styles.qaScope}>These checks cover structure, hashes, locks, evidence references, and call ceilings. Semantic truth and responsibility fulfillment remain human benchmark gates.</p><div className={styles.findingList}>{qa.report.findings.length ? qa.report.findings.map((finding, index) => <article key={`${finding.code}-${index}`} data-severity={finding.severity}><AlertTriangle size={14} /><span><strong>{pretty(finding.code)}</strong><small>{finding.section_id ?? 'Whole output'} - {pretty(finding.severity)}</small></span></article>) : <div className={styles.passNotice}><Check size={15} /> No deterministic findings.</div>}</div></div>
}

function ChangesOutput({ changes, requested }: { changes: AioV2ChangesView; requested: boolean }) {
  if (!requested) return <Unavailable text="Changes apply only to Page Copy; no page output was selected." />
  if (!changes.change_set) return <Unavailable text="A final change set is not published for this lifecycle state." />
  return <div><div className={styles.changeCounts}>{changes.change_set.counts.map(item => <span key={item.label}><strong>{item.count}</strong>{pretty(item.label)}</span>)}</div><div className={styles.changeList}>{changes.change_set.final_section_changes.map(item => <article key={item.section_id}><span>{pretty(item.label)}</span><strong>{item.section_id}</strong><small>{pretty(item.action)} - {item.word_count} words - {item.source_section_ids.length} source sections</small></article>)}</div></div>
}

function ExportsOutput({
  exports,
  exporting,
  authMethod,
  onAuthMethod,
  onExport,
}: {
  exports: AioV2ExportOperation[]
  exporting: 'docx' | 'google_docs' | null
  authMethod: 'google_oauth' | 'service_account'
  onAuthMethod: (method: 'google_oauth' | 'service_account') => void
  onExport: (format: 'docx' | 'google_docs') => Promise<void>
}) {
  return <div className={styles.exportGrid}><section className={styles.exportControls}><h3>Create an export</h3><p>DOCX is rebuilt from retained results. Google Docs uses only the method selected below.</p><button type="button" className="btn-primary" disabled={exporting !== null} onClick={() => void onExport('docx')}><Download size={14} /> {exporting === 'docx' ? 'Queuing...' : 'Create DOCX'}</button><fieldset><legend>Google Docs connection</legend><label><input type="radio" name="aio-v2-google-auth" checked={authMethod === 'google_oauth'} onChange={() => onAuthMethod('google_oauth')} /><span><strong>Google OAuth</strong><small>Recommended - uses the connected Google account</small></span></label><label><input type="radio" name="aio-v2-google-auth" checked={authMethod === 'service_account'} onChange={() => onAuthMethod('service_account')} /><span><strong>Service account</strong><small>Uses the configured service-account connection</small></span></label></fieldset><button type="button" className="btn-ghost" disabled={exporting !== null} onClick={() => void onExport('google_docs')}><Send size={14} /> {exporting === 'google_docs' ? 'Queuing...' : 'Create Google Doc'}</button><small>No automatic switch occurs if the selected Google method is unavailable.</small></section><section className={styles.exportHistory}><h3>Export history</h3>{exports.length ? exports.map(item => { const accessUrl = safeAccessUrl(item.artifact?.access_url ?? null); return <article key={item.operation_id}><div><span>{item.format === 'docx' ? 'DOCX' : 'Google Docs'}</span><strong data-state={item.status}>{pretty(item.status)}</strong></div><small>{formatDate(item.created_at)}{item.google_auth_method ? ` - ${pretty(item.google_auth_method)}` : ''}</small>{item.safe_error_code ? <p>{pretty(item.safe_error_code)}</p> : null}{accessUrl ? <a href={accessUrl} target="_blank" rel="noreferrer"><FileText size={13} /> {item.format === 'docx' ? 'Download private DOCX' : 'Open Google Doc'}</a> : null}</article> }) : <Unavailable text="No export has been requested for this job." />}</section></div>
}

function Unavailable({ text }: { text: string }) {
  return <div className={styles.unavailable}><FileOutput size={18} /><p>{text}</p></div>
}
