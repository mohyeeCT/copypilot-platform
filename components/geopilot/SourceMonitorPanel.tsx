import { Activity, AlertTriangle, ArrowUpRight, Clock3, FileSearch, Link2, RefreshCw, ShieldCheck } from 'lucide-react'
import type { GeoPilotContentGapBrief, GeoPilotSourceChange, GeoPilotSourceMonitor } from '@/lib/api/geopilot'
import styles from './SourceMonitorPanel.module.css'

function dateLabel(value?: string | null) {
  if (!value) return 'Not checked yet'
  return new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function safeUrl(value: unknown) {
  try { const url = new URL(String(value || '')); return ['https:', 'http:'].includes(url.protocol) ? url.toString() : '' } catch { return '' }
}

function changeSummary(change: GeoPilotSourceChange) {
  const labels = Object.keys(change.changed_output || {}).map(value => value.replaceAll('_', ' '))
  return labels.length ? `Changed: ${labels.slice(0, 4).join(', ')}${labels.length > 4 ? ` and ${labels.length - 4} more` : ''}` : 'Parallel detected a material change in the monitored page.'
}

export default function SourceMonitorPanel({
  monitors,
  changes,
  briefs,
}: {
  monitors: GeoPilotSourceMonitor[]
  changes: GeoPilotSourceChange[]
  briefs: GeoPilotContentGapBrief[]
}) {
  const active = monitors.filter(item => item.status === 'active').length
  const pending = monitors.filter(item => item.status.startsWith('baseline')).length
  const failed = monitors.filter(item => item.status === 'failed').length
  const completedBriefs = briefs.filter(item => item.status === 'complete')

  return (
    <div className={styles.intelligence}>
      <div className={styles.heading}><div><h2>Cited-page monitoring</h2><p>Weekly Parallel snapshots watch important cited pages without affecting visibility scores.</p></div><span><ShieldCheck size={14} /> Advisory only</span></div>
      <div className={styles.summary}>
        <div><Activity size={15} /><span><strong>{active}</strong><small>Active monitors</small></span></div>
        <div><Clock3 size={15} /><span><strong>{pending}</strong><small>Building baselines</small></span></div>
        <div><FileSearch size={15} /><span><strong>{changes.length}</strong><small>Material changes</small></span></div>
        <div><AlertTriangle size={15} /><span><strong>{failed}</strong><small>Needs attention</small></span></div>
      </div>

      <div className={styles.monitorGrid}>
        {monitors.slice(0, 10).map(item => {
          const href = safeUrl(item.url)
          return <article key={item.id}>
            <div className={styles.monitorHead}><span className={styles.linkIcon}><Link2 size={13} /></span><div><strong>{item.domain || item.url}</strong><small>{item.citation_classification.replaceAll('_', ' ')} / cited {item.citation_count} times</small></div><b data-status={item.status}>{item.status.replaceAll('_', ' ')}</b></div>
            {href ? <a href={href} target="_blank" rel="noreferrer">{item.url}<ArrowUpRight size={11} /></a> : <span className={styles.invalidUrl}>{item.url}</span>}
            <footer><span>Last checked {dateLabel(item.last_checked_at)}</span>{item.last_error ? <em title={item.last_error}>Provider attention needed</em> : null}</footer>
          </article>
        })}
        {!monitors.length ? <div className={styles.empty}><RefreshCw size={20} /><strong>No monitored sources yet</strong><p>GEOPilot selects highly cited pages after weekly citation research has enough evidence.</p></div> : null}
      </div>

      <div className={styles.columns}>
        <section>
          <div className={styles.subheading}><div><h3>Recent source changes</h3><p>Append-only events from Parallel snapshots.</p></div><span>{changes.length}</span></div>
          <div className={styles.eventList}>
            {changes.slice(0, 8).map(item => (
              <article key={item.id}>
                <header><strong>{changeSummary(item)}</strong><time>{dateLabel(item.detected_at)}</time></header>
                {item.evidence_urls?.length ? <div>{item.evidence_urls.slice(0, 3).map(value => { const href = safeUrl(value); return href ? <a key={href} href={href} target="_blank" rel="noreferrer">{new URL(href).hostname.replace(/^www\./, '')}<ArrowUpRight size={10} /></a> : null })}</div> : null}
              </article>
            ))}
            {!changes.length ? <p className={styles.compactEmpty}>No material source changes detected.</p> : null}
          </div>
        </section>
        <section>
          <div className={styles.subheading}><div><h3>Evidence-linked briefs</h3><p>Content opportunities grounded in weekly or change evidence.</p></div><span>{completedBriefs.length}</span></div>
          <div className={styles.briefList}>
            {briefs.slice(0, 8).map(item => (
              <article key={item.id}>
                <header><span>{item.source_type.replaceAll('_', ' ')}</span><time>{dateLabel(item.generated_at || item.created_at)}</time></header>
                {item.status === 'complete' ? <><h4>{String(item.brief?.title || item.brief?.opportunity || 'Content opportunity')}</h4><p>{String(item.brief?.opportunity || item.brief?.content_angle || '')}</p><strong>{String(item.brief?.recommended_asset || 'Review recommended content asset')}</strong></> : <div className={styles.briefState}>{item.status === 'running' ? <RefreshCw size={13} /> : null}{item.status.replaceAll('_', ' ')}</div>}
              </article>
            ))}
            {!briefs.length ? <p className={styles.compactEmpty}>Briefs appear after weekly research or a monitored source change.</p> : null}
          </div>
        </section>
      </div>
    </div>
  )
}
