'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Clipboard, Link2, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react'
import CustomSelect from '@/components/ui/CustomSelect'
import {
  geopilotApi,
  type GeoPilotPrimarySurface,
  type GeoPilotReportLink,
  type GeoPilotReportLinkPayload,
  type GeoPilotReportSections,
} from '@/lib/api/geopilot'
import styles from './ReportShareDialog.module.css'

type CollectionOption = { id: string; name: string }

const SURFACES: Array<{ value: GeoPilotPrimarySurface; label: string }> = [
  { value: 'google_ai_overview', label: 'Google AI Overview' },
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'claude', label: 'Claude' },
]

const SECTION_OPTIONS: Array<{ value: keyof GeoPilotReportSections; label: string }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'trends', label: 'Trends' },
  { value: 'surfaces', label: 'Surface comparison' },
  { value: 'prompts', label: 'Prompt results' },
  { value: 'citations', label: 'Citation intelligence' },
  { value: 'opportunities', label: 'Opportunities' },
  { value: 'costs', label: 'Provider costs' },
]

const DEFAULT_SECTIONS: GeoPilotReportSections = {
  overview: true,
  trends: true,
  surfaces: true,
  prompts: true,
  citations: true,
  opportunities: true,
  costs: false,
}

function dateLabel(value?: string | null) {
  if (!value) return 'No expiry'
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ReportShareDialog({
  open,
  token,
  profileId,
  profileName,
  collections,
  onClose,
}: {
  open: boolean
  token: string
  profileId: string
  profileName: string
  collections: CollectionOption[]
  onClose: () => void
}) {
  const [links, setLinks] = useState<GeoPilotReportLink[]>([])
  const [name, setName] = useState(`${profileName} client report`)
  const [periodDays, setPeriodDays] = useState(30)
  const [expiry, setExpiry] = useState('30')
  const [passcode, setPasscode] = useState('')
  const [selectedCollections, setSelectedCollections] = useState<string[]>([])
  const [selectedSurfaces, setSelectedSurfaces] = useState<GeoPilotPrimarySurface[]>([])
  const [sections, setSections] = useState<GeoPilotReportSections>(DEFAULT_SECTIONS)
  const [createdUrl, setCreatedUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const activeLinks = useMemo(() => links.filter(item => item.active && !item.revoked_at), [links])
  const hasVisibleSection = Object.values(sections).some(Boolean)

  useEffect(() => {
    if (!open || !token) return
    let active = true
    setError('')
    geopilotApi.listReportLinks(token, profileId)
      .then(data => { if (active) setLinks(data.report_links || []) })
      .catch(loadError => { if (active) setError(loadError instanceof Error ? loadError.message : 'Failed to load report links.') })
    return () => { active = false }
  }, [open, profileId, token])

  if (!open) return null

  function toggleCollection(id: string) {
    setSelectedCollections(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  function toggleSurface(value: GeoPilotPrimarySurface) {
    setSelectedSurfaces(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value])
  }

  async function createLink() {
    if (!name.trim()) return
    setBusy('create')
    setError('')
    setCreatedUrl('')
    try {
      const payload: GeoPilotReportLinkPayload = {
        name: name.trim(),
        period_days: periodDays,
        sections,
        collection_ids: selectedCollections,
        surfaces: selectedSurfaces,
        expires_in_days: expiry === 'never' ? null : Number(expiry),
        ...(passcode ? { passcode } : {}),
      }
      const data = await geopilotApi.createReportLink(token, profileId, payload)
      setLinks(current => [data.report_link, ...current])
      setCreatedUrl(`${window.location.origin}/reports/geopilot/open#${encodeURIComponent(data.token)}`)
      setPasscode('')
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create the report link.')
    } finally {
      setBusy('')
    }
  }

  async function copyCreatedUrl() {
    if (!createdUrl) return
    await navigator.clipboard.writeText(createdUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  async function revoke(linkId: string) {
    setBusy(linkId)
    setError('')
    try {
      await geopilotApi.revokeReportLink(token, linkId)
      setLinks(current => current.map(item => item.id === linkId ? { ...item, active: false, revoked_at: new Date().toISOString() } : item))
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'Failed to revoke the report link.')
    } finally {
      setBusy('')
    }
  }

  function applyLinkSettings(item: GeoPilotReportLink) {
    setName(`${item.name} replacement`)
    setPeriodDays(item.period_days)
    setSections(item.sections)
    setSelectedCollections(item.collection_ids || [])
    setSelectedSurfaces(item.surfaces || [])
    setCreatedUrl('')
  }

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="report-share-title">
        <header className={styles.header}>
          <div><span>Client access</span><h2 id="report-share-title">Share a read-only report</h2><p>Create a live report without exposing your account or raw provider data.</p></div>
          <button type="button" aria-label="Close report sharing" onClick={onClose}><X size={18} /></button>
        </header>

        <div className={styles.body}>
          {error ? <div className={styles.error} role="alert">{error}</div> : null}
          {createdUrl ? (
            <div className={styles.created}>
              <div><Check size={16} /><span><strong>Report link created</strong><small>This full link is shown once. Save it before closing.</small></span></div>
              <div className={styles.urlRow}><input readOnly value={createdUrl} /><button type="button" onClick={() => void copyCreatedUrl()}>{copied ? <Check size={15} /> : <Clipboard size={15} />}{copied ? 'Copied' : 'Copy'}</button></div>
            </div>
          ) : null}

          <div className={styles.grid}>
            <div className={styles.formPane}>
              <label>Report name<input value={name} maxLength={120} onChange={event => setName(event.target.value)} /></label>
              <div className={styles.fieldGroup}>
                <span>Reporting period</span>
                <div className={styles.segmented}>{[7, 30, 90].map(value => <button key={value} type="button" className={periodDays === value ? styles.active : undefined} onClick={() => setPeriodDays(value)}>{value} days</button>)}</div>
              </div>
              <label>Link expiry<CustomSelect ariaLabel="Report link expiry" value={expiry} onChange={setExpiry} options={[
                { value: '7', label: '7 days' },
                { value: '30', label: '30 days' },
                { value: '90', label: '90 days' },
                { value: 'never', label: 'No expiry' },
              ]} /></label>
              <label>Passcode <small>Optional</small><input type="password" value={passcode} minLength={4} maxLength={128} placeholder="At least 4 characters" onChange={event => setPasscode(event.target.value)} /></label>

              <fieldset><legend>Collections <small>All when none are selected</small></legend><div className={styles.checkGrid}>{collections.map(item => <label key={item.id}><input type="checkbox" checked={selectedCollections.includes(item.id)} onChange={() => toggleCollection(item.id)} /><span>{item.name}</span></label>)}</div></fieldset>
              <fieldset><legend>Surfaces <small>All when none are selected</small></legend><div className={styles.checkGrid}>{SURFACES.map(item => <label key={item.value}><input type="checkbox" checked={selectedSurfaces.includes(item.value)} onChange={() => toggleSurface(item.value)} /><span>{item.label}</span></label>)}</div></fieldset>
              <fieldset><legend>Visible sections</legend><div className={styles.checkGrid}>{SECTION_OPTIONS.map(item => <label key={item.value}><input type="checkbox" checked={sections[item.value]} onChange={event => setSections(current => ({ ...current, [item.value]: event.target.checked }))} /><span>{item.label}</span></label>)}</div></fieldset>
            </div>

            <aside className={styles.linksPane}>
              <div className={styles.linksTitle}><div><h3>Active links</h3><p>{activeLinks.length} available</p></div><ShieldCheck size={18} /></div>
              <div className={styles.linkList}>
                {activeLinks.map(item => (
                  <article key={item.id}>
                    <div><span className={styles.linkIcon}><Link2 size={14} /></span><span><strong>{item.name}</strong><small>{item.period_days} days / expires {dateLabel(item.expires_at)}</small></span></div>
                    <dl><div><dt>Views</dt><dd>{item.access_count || 0}</dd></div><div><dt>Last opened</dt><dd>{item.last_accessed_at ? dateLabel(item.last_accessed_at) : 'Never'}</dd></div></dl>
                    <div className={styles.linkActions}>
                      <button type="button" onClick={() => applyLinkSettings(item)}><RefreshCw size={13} /> Use settings</button>
                      <button type="button" className={styles.danger} onClick={() => void revoke(item.id)} disabled={busy === item.id}><Trash2 size={13} />{busy === item.id ? 'Revoking' : 'Revoke'}</button>
                    </div>
                  </article>
                ))}
                {!activeLinks.length ? <div className={styles.empty}><Link2 size={20} /><strong>No active report links</strong><p>Create one for a client or teammate.</p></div> : null}
              </div>
            </aside>
          </div>
        </div>

        <footer className={styles.footer}>
          <p><ShieldCheck size={14} /> Revoking a link ends every active viewer session.</p>
          <div><button type="button" className={styles.secondary} onClick={onClose}>Done</button><button type="button" className={styles.primary} onClick={() => void createLink()} disabled={busy === 'create' || !name.trim() || !hasVisibleSection || (passcode.length > 0 && passcode.length < 4)}>{busy === 'create' ? <RefreshCw size={14} className={styles.spin} /> : <Link2 size={14} />}{busy === 'create' ? 'Creating' : 'Create link'}</button></div>
        </footer>
      </section>
    </div>
  )
}
