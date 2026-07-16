'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, BarChart3, CalendarCheck, FileSearch, Link2, Search, ShieldCheck, Sparkles, Target } from 'lucide-react'
import styles from './PublicGeoPilotReport.module.css'

type ValueMap = Record<string, unknown>
type PublicReport = {
  report?: { name?: string; period_days?: number; generated_at?: string }
  profile?: { name?: string; brand_name?: string; primary_domain?: string; category?: string; location_name?: string }
  overview?: { overall_visibility?: number | null; share_of_voice?: number | null; citation_share?: number | null; successful_measurements?: number }
  surfaces?: Record<string, ValueMap>
  trends?: ValueMap[]
  prompts?: ValueMap[]
  citations?: { summary?: ValueMap; top_domains?: ValueMap[]; page_types?: ValueMap[] }
  opportunities?: { insights?: ValueMap[]; briefs?: ValueMap[] }
  costs?: ValueMap & { by_surface?: Record<string, ValueMap> }
  methodology?: ValueMap
}

const SURFACES: Record<string, string> = { google_ai_overview: 'Google AI Overview', chatgpt: 'ChatGPT', gemini: 'Gemini', claude: 'Claude' }
type ReportTab = 'Overview' | 'Trends' | 'Prompts' | 'Sources' | 'Opportunities' | 'Costs'

function percent(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? `${number.toFixed(number % 1 ? 1 : 0)}%` : '-'
}

function dateLabel(value: unknown) {
  const date = new Date(String(value || ''))
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function money(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '-'
}

function safeUrl(value: unknown) {
  try { const url = new URL(String(value || '')); return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '' } catch { return '' }
}

export default function PublicGeoPilotReport({ report, error }: { report?: PublicReport; error?: string }) {
  const [tab, setTab] = useState<ReportTab>('Overview')
  const [query, setQuery] = useState('')
  const prompts = useMemo(() => report?.prompts || [], [report?.prompts])
  const tabs = useMemo<ReportTab[]>(() => {
    if (!report) return ['Overview']
    const available: ReportTab[] = []
    if ('overview' in report || 'surfaces' in report) available.push('Overview')
    if ('trends' in report) available.push('Trends')
    if ('prompts' in report) available.push('Prompts')
    if ('citations' in report) available.push('Sources')
    if ('opportunities' in report) available.push('Opportunities')
    if ('costs' in report) available.push('Costs')
    return available.length ? available : ['Overview']
  }, [report])
  const visiblePrompts = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return normalized ? prompts.filter(item => String(item.prompt_text || '').toLowerCase().includes(normalized)) : prompts
  }, [prompts, query])

  useEffect(() => {
    if (!tabs.includes(tab)) setTab(tabs[0])
  }, [tab, tabs])

  if (error || !report) {
    return <main className={styles.accessPage}><section className={styles.accessPanel}><div className={styles.accessBrand}><span>CP</span><strong>CopyPilot</strong></div><div className={styles.accessIcon}><ShieldCheck size={22} /></div><h1>Report unavailable</h1><p>{error || 'This report could not be loaded.'}</p><small>Ask the report owner for a new link.</small></section></main>
  }

  const brand = report.profile?.brand_name || report.profile?.name || 'Client'
  const overview = report.overview || {}
  const citationSummary = report.citations?.summary || {}
  const surfaces = Object.entries(report.surfaces || {})
  const trendRows = [...(report.trends || [])].sort((left, right) => String(right.metric_date || '').localeCompare(String(left.metric_date || '')))
  const costSurfaces = Object.entries(report.costs?.by_surface || {})

  return (
    <main className={styles.reportPage}>
      <header className={styles.reportHeader}>
        <div className={styles.reportShell}>
          <div className={styles.reportTopline}><div className={styles.publicBrand}><span>CP</span><strong>CopyPilot</strong><i>/</i><em>GEOPilot report</em></div><span>Read-only</span></div>
          <div className={styles.reportTitle}><span className={styles.clientInitial}>{brand.charAt(0).toUpperCase()}</span><div><p>{report.report?.name || 'Visibility report'}</p><h1>{brand}</h1><small>{[report.profile?.category, report.profile?.location_name, report.report?.period_days ? `${report.report.period_days}-day view` : ''].filter(Boolean).join(' / ')}</small></div></div>
          <div className={styles.generated}>Generated {dateLabel(report.report?.generated_at)}</div>
        </div>
      </header>

      <div className={styles.reportShell}>
        <nav className={styles.reportTabs}>{tabs.map(item => <button key={item} type="button" className={tab === item ? styles.tabActive : undefined} onClick={() => setTab(item)}>{item}</button>)}</nav>

        {tab === 'Overview' ? <>
          {report.overview ? <section className={styles.metricRow}>
            <article><span><Target size={14} /> Visibility</span><strong>{percent(overview.overall_visibility)}</strong><p>Tracked answers mentioning {brand}</p></article>
            <article><span><BarChart3 size={14} /> Share of voice</span><strong>{percent(overview.share_of_voice)}</strong><p>Brand share among configured entities</p></article>
            <article><span><Link2 size={14} /> Owned citation coverage</span><strong>{percent(overview.citation_share)}</strong><p>{Number(citationSummary.owned || 0)} owned citations observed</p></article>
            <article><span><FileSearch size={14} /> Measurements</span><strong>{Number(overview.successful_measurements || 0).toLocaleString()}</strong><p>Successful checks in this view</p></article>
          </section> : null}
          {report.surfaces ? <section className={styles.reportSection}><div className={styles.sectionTitle}><div><h2>Visibility by surface</h2><p>Each source uses the collection method configured by the report owner.</p></div></div><div className={styles.surfaceTable}>{surfaces.map(([surface, item]) => <div key={surface}><span>{SURFACES[surface] || surface.replaceAll('_', ' ')}</span><div><i style={{ width: `${Math.max(0, Math.min(100, Number(item.visibility_score || 0)))}%` }} /></div><strong>{percent(item.visibility_score)}</strong><small>{Number(item.successful_runs || 0)} successful</small></div>)}{!surfaces.length ? <p className={styles.emptyMessage}>No surface measurements are available in this report period.</p> : null}</div></section> : null}
          {report.methodology ? <section className={styles.methodology}><ShieldCheck size={16} /><div><strong>How to read this report</strong><p>{String(report.methodology.visibility || '')} {String(report.methodology.association_note || '')}</p></div></section> : null}
        </> : null}

        {tab === 'Trends' ? <section className={styles.reportSection}><div className={styles.sectionTitle}><div><h2>Daily visibility trends</h2><p>Daily metrics remain separated by surface and collection method.</p></div></div><div className={styles.trendTable}><div className={styles.trendHead}><span>Date</span><span>Surface</span><span>Visibility</span><span>Share of voice</span><span>Citation share</span></div>{trendRows.slice(0, 100).map((item, index) => <div className={styles.trendRow} key={`${String(item.metric_date)}-${String(item.surface)}-${String(item.collection_method)}-${index}`}><time>{dateLabel(item.metric_date)}</time><span>{SURFACES[String(item.surface)] || String(item.surface || '').replaceAll('_', ' ')}</span><strong>{percent(item.visibility_score)}</strong><span>{percent(item.share_of_voice)}</span><span>{percent(item.citation_share)}</span></div>)}{!trendRows.length ? <p className={styles.emptyMessage}>No daily trend metrics are available in this report period.</p> : null}</div></section> : null}

        {tab === 'Prompts' ? <section className={styles.reportSection}><div className={styles.sectionTitle}><div><h2>Latest prompt measurements</h2><p>Results are grouped by prompt, surface, and collection method.</p></div><label className={styles.searchBox}><Search size={14} /><input type="search" value={query} placeholder="Search prompts" onChange={event => setQuery(event.target.value)} /></label></div><div className={styles.promptTable}><div className={styles.tableHead}><span>Prompt</span><span>Surface</span><span>Outcome</span><span>Observed</span></div>{visiblePrompts.map((item, index) => <div key={`${String(item.prompt_text)}-${String(item.surface)}-${index}`} className={styles.tableRow}><div><strong>{String(item.prompt_text || 'Tracked prompt')}</strong><small>{String(item.summary || '')}</small></div><span>{SURFACES[String(item.surface)] || String(item.surface || '').replaceAll('_', ' ')}</span><span className={item.status !== 'complete' ? styles.failed : item.brand_mentioned ? styles.mentioned : styles.notFound}>{item.status !== 'complete' ? 'Failed' : item.brand_mentioned ? 'Mentioned' : 'Not found'}</span><time>{dateLabel(item.observed_at)}</time></div>)}{!visiblePrompts.length ? <p className={styles.emptyMessage}>No matching prompt results.</p> : null}</div></section> : null}

        {tab === 'Sources' ? <section className={styles.reportSection}><div className={styles.sectionTitle}><div><h2>Citation intelligence</h2><p>Sources are classified as owned, competitor, or independent third party.</p></div></div><div className={styles.sourceStats}><div><strong>{Number(citationSummary.total_citations || 0)}</strong><span>Total citations</span></div><div><strong>{Number(citationSummary.owned || 0)}</strong><span>Owned</span></div><div><strong>{Number(citationSummary.competitor || 0)}</strong><span>Competitor</span></div><div><strong>{Number(citationSummary.third_party || 0)}</strong><span>Third party</span></div></div><div className={styles.domainRows}>{(report.citations?.top_domains || []).map(item => <div key={String(item.domain)}><span className={styles.domainIcon}><Link2 size={13} /></span><strong>{String(item.domain || '')}</strong><span>{String(item.classification || '').replaceAll('_', ' ')}</span><b>{Number(item.citation_count || 0)}</b></div>)}{!(report.citations?.top_domains || []).length ? <p className={styles.emptyMessage}>No citation domains were found in this period.</p> : null}</div></section> : null}

        {tab === 'Opportunities' ? <section className={styles.reportSection}><div className={styles.sectionTitle}><div><h2>Evidence-linked opportunities</h2><p>Advisory research is separate from measured visibility scores.</p></div></div><div className={styles.opportunityRows}>{(report.opportunities?.briefs || []).map(item => { const brief = (item.brief || {}) as ValueMap; const evidence = (item.evidence || {}) as ValueMap; const urls = Array.isArray(evidence.evidence_urls) ? evidence.evidence_urls : []; return <article key={String(item.id)}><span><Sparkles size={14} /> {String(item.source_type || '').replaceAll('_', ' ')}</span><h3>{String(brief.title || brief.opportunity || 'Content opportunity')}</h3><p>{String(brief.opportunity || brief.content_angle || '')}</p>{urls.length ? <div>{urls.slice(0, 4).map(value => { const href = safeUrl(value); return href ? <a key={href} href={href} target="_blank" rel="noreferrer">{new URL(href).hostname.replace(/^www\./, '')}<ArrowUpRight size={11} /></a> : null })}</div> : null}</article>})}{!(report.opportunities?.briefs || []).length ? <p className={styles.emptyMessage}>No evidence-linked briefs are available yet.</p> : null}</div></section> : null}

        {tab === 'Costs' ? <><section className={styles.metricRow}><article><span><BarChart3 size={14} /> Report period</span><strong>{money(report.costs?.period_actual_usd)}</strong><p>Recorded provider spend in this report</p></article><article><span><CalendarCheck size={14} /> Current month</span><strong>{money(report.costs?.month_actual_usd)}</strong><p>Recorded month-to-date spend</p></article><article><span><Target size={14} /> Priced measurements</span><strong>{Number(report.costs?.priced_measurements || 0).toLocaleString()}</strong><p>Measurements with provider cost data</p></article><article><span><FileSearch size={14} /> Unpriced measurements</span><strong>{Number(report.costs?.unpriced_measurements || 0).toLocaleString()}</strong><p>Completed without recorded price data</p></article></section><section className={styles.reportSection}><div className={styles.sectionTitle}><div><h2>Provider spend by surface</h2><p>Costs are informational and do not affect visibility scores.</p></div></div><div className={styles.costRows}>{costSurfaces.map(([surface, item]) => <div key={surface}><strong>{SURFACES[surface] || surface.replaceAll('_', ' ')}</strong><span>{money(item.actual_usd)}</span><small>{Number(item.priced_measurements || 0)} priced / {Number(item.unpriced_measurements || 0)} unpriced</small></div>)}{!costSurfaces.length ? <p className={styles.emptyMessage}>No provider cost data is available in this report period.</p> : null}</div></section></> : null}
      </div>
      <footer className={styles.publicFooter}><div className={styles.reportShell}><span>Prepared with CopyPilot GEOPilot</span><small>Visibility reflects measured prompt results, not a guarantee of future placement.</small></div></footer>
    </main>
  )
}
