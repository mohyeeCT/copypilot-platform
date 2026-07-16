'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Activity, ArrowUpRight, CalendarCheck, Check, Link2, RefreshCw, Save, Search, Settings, Trash2, Unplug } from 'lucide-react'
import CustomSelect from '@/components/ui/CustomSelect'
import { geopilotApi, type GeoPilotAttribution, type GeoPilotGoogleProperties } from '@/lib/api/geopilot'
import styles from './AttributionPanel.module.css'

function number(value: unknown, digits = 0) {
  const parsed = Number(value || 0)
  return parsed.toLocaleString('en-US', { maximumFractionDigits: digits })
}

function dateLabel(value: unknown) {
  const date = new Date(String(value || ''))
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AttributionPanel({
  token,
  profileId,
  data,
  onRefresh,
}: {
  token: string
  profileId: string
  data: GeoPilotAttribution | null
  onRefresh: () => Promise<void>
}) {
  const [method, setMethod] = useState<'google_oauth' | 'service_account'>(data?.integration?.auth_method || 'google_oauth')
  const [properties, setProperties] = useState<GeoPilotGoogleProperties | null>(null)
  const [gscSite, setGscSite] = useState(data?.integration?.gsc_site_url || '')
  const [ga4Property, setGa4Property] = useState(data?.integration?.ga4_property_id || '')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [showConfigure, setShowConfigure] = useState(!data?.integration)
  const [actionForm, setActionForm] = useState({ title: '', target_url: '', published_at: new Date().toISOString().slice(0, 10), notes: '' })

  useEffect(() => {
    if (!showConfigure || !token) return
    let active = true
    setBusy('properties')
    setError('')
    geopilotApi.googleProperties(token, method)
      .then(result => { if (active) setProperties(result) })
      .catch(loadError => { if (active) { setProperties(null); setError(loadError instanceof Error ? loadError.message : 'Failed to load Google properties.') } })
      .finally(() => { if (active) setBusy('') })
    return () => { active = false }
  }, [method, showConfigure, token])

  useEffect(() => {
    setGscSite(data?.integration?.gsc_site_url || '')
    setGa4Property(data?.integration?.ga4_property_id || '')
  }, [data?.integration?.gsc_site_url, data?.integration?.ga4_property_id])

  const selectedGa4 = useMemo(() => properties?.analytics.find(item => item.property_id === ga4Property), [ga4Property, properties?.analytics])

  async function saveConnection() {
    if (!gscSite && !ga4Property) return
    setBusy('save')
    setError('')
    try {
      await geopilotApi.saveGoogleIntegration(token, profileId, {
        auth_method: method,
        gsc_site_url: gscSite || null,
        ga4_property_id: ga4Property || null,
        ga4_property_name: selectedGa4?.display_name || null,
        active: true,
      })
      setShowConfigure(false)
      await onRefresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save the Google properties.')
    } finally { setBusy('') }
  }

  async function sync() {
    setBusy('sync')
    setError('')
    try { await geopilotApi.syncAttribution(token, profileId, 30); await onRefresh() }
    catch (syncError) { setError(syncError instanceof Error ? syncError.message : 'Failed to sync attribution data.') }
    finally { setBusy('') }
  }

  async function disconnect() {
    setBusy('disconnect')
    setError('')
    try { await geopilotApi.deleteGoogleIntegration(token, profileId); setShowConfigure(true); await onRefresh() }
    catch (disconnectError) { setError(disconnectError instanceof Error ? disconnectError.message : 'Failed to disconnect attribution.') }
    finally { setBusy('') }
  }

  async function addAction() {
    if (!actionForm.title || !actionForm.target_url || !actionForm.published_at) return
    setBusy('action')
    setError('')
    try {
      await geopilotApi.createContentAction(token, profileId, { ...actionForm, published_at: new Date(`${actionForm.published_at}T12:00:00Z`).toISOString(), status: 'published' })
      setActionForm({ title: '', target_url: '', published_at: new Date().toISOString().slice(0, 10), notes: '' })
      await onRefresh()
    } catch (actionError) { setError(actionError instanceof Error ? actionError.message : 'Failed to add the publication marker.') }
    finally { setBusy('') }
  }

  async function archiveAction(id: string) {
    setBusy(id)
    try { await geopilotApi.archiveContentAction(token, id); await onRefresh() }
    catch (archiveError) { setError(archiveError instanceof Error ? archiveError.message : 'Failed to archive the publication marker.') }
    finally { setBusy('') }
  }

  const totals = data?.totals
  const integration = data?.integration
  const actions = data?.content_actions || []

  return (
    <section className={styles.attribution}>
      <div className={styles.heading}><div><h2>Search and site attribution</h2><p>Observe Search Console and GA4 trends alongside GEOPilot actions without claiming causation.</p></div>{integration ? <div className={styles.headingActions}><button type="button" onClick={() => setShowConfigure(current => !current)}><Settings size={13} /> Configure</button><button type="button" onClick={() => void sync()} disabled={Boolean(busy)}><RefreshCw size={13} className={busy === 'sync' ? styles.spin : undefined} /> Sync now</button></div> : null}</div>
      {error ? <div className={styles.error} role="alert">{error}</div> : null}

      {showConfigure ? <div className={styles.configure}>
        <div className={styles.methodChoice}><button type="button" className={method === 'google_oauth' ? styles.selected : undefined} onClick={() => setMethod('google_oauth')}><Check size={13} /><span><strong>Google OAuth</strong><small>Recommended / uses the Google account in Settings</small></span></button><button type="button" className={method === 'service_account' ? styles.selected : undefined} onClick={() => setMethod('service_account')}><Check size={13} /><span><strong>Service account</strong><small>Uses the existing fallback credential</small></span></button></div>
        {busy === 'properties' ? <div className={styles.loading}><RefreshCw size={15} className={styles.spin} /> Loading accessible properties</div> : properties ? <div className={styles.propertyGrid}><label>Search Console property<CustomSelect ariaLabel="Search Console property" value={gscSite} onChange={setGscSite} options={[{ value: '', label: 'Do not connect Search Console' }, ...properties.search_console.map(item => ({ value: item.site_url, label: item.site_url }))]} /></label><label>GA4 property<CustomSelect ariaLabel="Google Analytics property" value={ga4Property} onChange={setGa4Property} options={[{ value: '', label: properties.analytics_reconnect_required ? 'Reconnect Google to enable GA4' : 'Do not connect GA4' }, ...properties.analytics.map(item => ({ value: item.property_id, label: `${item.display_name} / ${item.account_name}` }))]} /></label></div> : <div className={styles.connectHelp}><Settings size={17} /><div><strong>Google connection unavailable</strong><p>Connect Google OAuth or save a service account in Settings, then return here.</p><Link href="/settings">Open Settings<ArrowUpRight size={11} /></Link></div></div>}
        {properties?.analytics_reconnect_required ? <div className={styles.reconnect}><Activity size={14} /><span>Your current OAuth connection still supports Search Console. Reconnect once in Settings to grant the additional Analytics read-only permission.</span></div> : null}
        {properties?.analytics_error ? <div className={styles.reconnect}><Activity size={14} /><span>{properties.analytics_error}. Search Console remains available.</span></div> : null}
        <div className={styles.configureFooter}>{integration ? <button type="button" className={styles.dangerButton} onClick={() => void disconnect()} disabled={Boolean(busy)}><Unplug size={13} /> Disconnect</button> : <span />}<button type="button" className={styles.primaryButton} onClick={() => void saveConnection()} disabled={Boolean(busy) || (!gscSite && !ga4Property)}><Save size={13} />{busy === 'save' ? 'Saving' : 'Save properties'}</button></div>
      </div> : null}

      {integration ? <>
        <div className={styles.connectionBar}><span data-status={integration.status}><i />{integration.status.replaceAll('_', ' ')}</span><p>{integration.gsc_site_url || 'No Search Console'} / {integration.ga4_property_name || 'No GA4 property'}</p><small>Last synced {dateLabel(integration.last_synced_at)}</small></div>
        <div className={styles.metrics}>
          <article><span><Search size={14} /> Organic clicks</span><strong>{number(totals?.gsc_clicks)}</strong><small>{number(totals?.gsc_impressions)} impressions</small></article>
          <article><span><Activity size={14} /> Site sessions</span><strong>{number(totals?.ga4_sessions)}</strong><small>{number(totals?.ga4_engaged_sessions)} engaged</small></article>
          <article><span><Link2 size={14} /> AI referral sessions</span><strong>{number(totals?.ai_referral_sessions)}</strong><small>Recognized AI source names</small></article>
          <article><span><CalendarCheck size={14} /> Key events</span><strong>{number(totals?.ga4_key_events, 1)}</strong><small>GA4 key events in period</small></article>
        </div>

        <div className={styles.actionArea}>
          <div className={styles.actionForm}><div><h3>Add publication marker</h3><p>Associate an AIO or content change with its live URL and publication date.</p></div><div className={styles.formGrid}><label>Action title<input value={actionForm.title} placeholder="Published Detroit location guide" onChange={event => setActionForm(current => ({ ...current, title: event.target.value }))} /></label><label>Live URL<input type="url" value={actionForm.target_url} placeholder="https://example.com/page" onChange={event => setActionForm(current => ({ ...current, target_url: event.target.value }))} /></label><label>Published<input type="date" value={actionForm.published_at} onChange={event => setActionForm(current => ({ ...current, published_at: event.target.value }))} /></label><button type="button" onClick={() => void addAction()} disabled={busy === 'action' || !actionForm.title || !actionForm.target_url}><CalendarCheck size={13} />{busy === 'action' ? 'Adding' : 'Add marker'}</button></div></div>
          <div className={styles.actionList}>{actions.map(item => { const id = String(item.id || ''); const before = (item.before || {}) as Record<string, unknown>; const after = (item.after || {}) as Record<string, unknown>; return <article key={id}><header><div><strong>{String(item.title || 'Published content')}</strong><a href={String(item.target_url || '')} target="_blank" rel="noreferrer">{String(item.target_url || '')}<ArrowUpRight size={10} /></a></div><button type="button" aria-label="Archive publication marker" onClick={() => void archiveAction(id)} disabled={busy === id}><Trash2 size={13} /></button></header><div className={styles.comparison}><span><small>28 days before</small><strong>{number(before.clicks)} clicks / {number(before.sessions)} sessions</strong></span><i>Observed association</i><span><small>Up to 28 days after</small><strong>{number(after.clicks)} clicks / {number(after.sessions)} sessions</strong></span></div></article> })}{!actions.length ? <div className={styles.empty}><CalendarCheck size={19} /><strong>No publication markers yet</strong><p>Add one after a content recommendation goes live.</p></div> : null}</div>
        </div>
        <p className={styles.methodology}>{data?.methodology}</p>
      </> : !showConfigure ? <div className={styles.empty}><Link2 size={21} /><strong>No attribution connection</strong><p>Connect Search Console, GA4, or both to add observed traffic context.</p><button type="button" onClick={() => setShowConfigure(true)}>Connect Google properties</button></div> : null}
    </section>
  )
}
