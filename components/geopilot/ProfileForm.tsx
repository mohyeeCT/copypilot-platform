'use client'

import { useEffect, useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { JobSection } from '@/components/ui/JobLauncher'
import CustomSelect from '@/components/ui/CustomSelect'
import { createClient } from '@/lib/supabase'
import { geopilotApi, type GeoPilotCompetitor, type GeoPilotProfilePayload } from '@/lib/api/geopilot'

type BrandProfile = { id: string; name?: string; data?: Record<string, unknown> }

const DEVICE_OPTIONS = [
  { value: 'desktop', label: 'Desktop' },
  { value: 'mobile', label: 'Mobile' },
]

const EMPTY: GeoPilotProfilePayload = {
  name: '', brand_name: '', primary_domain: '', owned_domains: [], brand_aliases: [], description: '', category: '',
  country_code: 'US', location_name: 'United States', language_code: 'en', timezone: 'UTC', device: 'desktop',
  source_brand_profile_id: null, competitors: [], active: true,
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function listValue(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  if (typeof value === 'string') return value.split(/[,\n]/).map(item => item.trim()).filter(Boolean)
  return []
}

export default function ProfileForm({
  initial,
  submitting,
  onSubmit,
}: {
  initial?: GeoPilotProfilePayload
  submitting: boolean
  onSubmit: (payload: GeoPilotProfilePayload) => Promise<void>
}) {
  const [form, setForm] = useState<GeoPilotProfilePayload>(initial || EMPTY)
  const [brandProfiles, setBrandProfiles] = useState<BrandProfile[]>([])
  const [error, setError] = useState('')

  useEffect(() => { if (initial) setForm(initial) }, [initial])
  useEffect(() => {
    void createClient().auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      return geopilotApi.listBrandProfiles(session.access_token).then(data => setBrandProfiles(data.profiles || []))
    }).catch(() => undefined)
  }, [])

  function update<K extends keyof GeoPilotProfilePayload>(key: K, value: GeoPilotProfilePayload[K]) {
    setForm(current => ({ ...current, [key]: value }))
  }

  function importProfile(id: string) {
    const profile = brandProfiles.find(item => item.id === id)
    const data = profile?.data || {}
    setForm(current => ({
      ...current,
      source_brand_profile_id: id || null,
      name: current.name || profile?.name || '',
      brand_name: current.brand_name || textValue(data.brand_name) || profile?.name || '',
      description: current.description || textValue(data.brand_description) || textValue(data.guidelines),
      category: current.category || textValue(data.industry) || textValue(data.niche),
      brand_aliases: current.brand_aliases.length ? current.brand_aliases : listValue(data.brand_aliases),
    }))
  }

  function updateCompetitor(index: number, key: keyof GeoPilotCompetitor, value: string | string[]) {
    update('competitors', form.competitors.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (!form.name.trim() || !form.brand_name.trim()) {
      setError('Profile and brand names are required.')
      return
    }
    try {
      await onSubmit({ ...form, owned_domains: form.owned_domains.filter(Boolean), brand_aliases: form.brand_aliases.filter(Boolean) })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save profile.')
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <div className="rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">{error}</div>}
      <JobSection title="Client and brand">
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="text-xs font-semibold text-muted">CopyPilot brand profile
            <CustomSelect
              className="mt-1"
              ariaLabel="CopyPilot brand profile"
              value={form.source_brand_profile_id || ''}
              onChange={importProfile}
              options={[
                { value: '', label: 'Start without an import' },
                ...brandProfiles.map(profile => ({ value: profile.id, label: profile.name || 'Untitled profile' })),
              ]}
            />
          </label>
          <label className="text-xs font-semibold text-muted">Client profile name
            <input className="input-base mt-1" value={form.name} onChange={event => update('name', event.target.value)} required />
          </label>
          <label className="text-xs font-semibold text-muted">Brand name
            <input className="input-base mt-1" value={form.brand_name} onChange={event => update('brand_name', event.target.value)} required />
          </label>
          <label className="text-xs font-semibold text-muted">Primary domain
            <input className="input-base mt-1" value={form.primary_domain} onChange={event => update('primary_domain', event.target.value)} placeholder="example.com" />
          </label>
          <label className="text-xs font-semibold text-muted">Brand aliases
            <input className="input-base mt-1" value={form.brand_aliases.join(', ')} onChange={event => update('brand_aliases', listValue(event.target.value))} />
          </label>
          <label className="text-xs font-semibold text-muted">Owned domains
            <input className="input-base mt-1" value={form.owned_domains.join(', ')} onChange={event => update('owned_domains', listValue(event.target.value))} />
          </label>
          <label className="text-xs font-semibold text-muted">Category
            <input className="input-base mt-1" value={form.category} onChange={event => update('category', event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-muted lg:col-span-2">Description
            <textarea className="input-base mt-1 min-h-24" value={form.description} onChange={event => update('description', event.target.value)} />
          </label>
        </div>
      </JobSection>

      <JobSection title="Search market">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs font-semibold text-muted">Country code<input className="input-base mt-1" value={form.country_code} maxLength={2} onChange={event => update('country_code', event.target.value.toUpperCase())} /></label>
          <label className="text-xs font-semibold text-muted lg:col-span-2">Location<input className="input-base mt-1" value={form.location_name} onChange={event => update('location_name', event.target.value)} /></label>
          <label className="text-xs font-semibold text-muted">Language<input className="input-base mt-1" value={form.language_code} onChange={event => update('language_code', event.target.value)} /></label>
          <label className="text-xs font-semibold text-muted">Device<CustomSelect className="mt-1" ariaLabel="Device" value={form.device} onChange={value => update('device', value as 'desktop' | 'mobile')} options={DEVICE_OPTIONS} /></label>
          <label className="text-xs font-semibold text-muted sm:col-span-2">Timezone<input className="input-base mt-1" value={form.timezone} onChange={event => update('timezone', event.target.value)} placeholder="America/Detroit" /></label>
        </div>
      </JobSection>

      <JobSection title="Competitors">
        <div className="space-y-3">
          {form.competitors.map((competitor, index) => (
            <div key={index} className="grid gap-3 rounded-lg border border-border bg-surface p-3 md:grid-cols-[1fr_1fr_1.2fr_auto]">
              <input aria-label="Competitor name" className="input-base" value={competitor.name} onChange={event => updateCompetitor(index, 'name', event.target.value)} placeholder="Competitor name" />
              <input aria-label="Competitor domain" className="input-base" value={competitor.domain} onChange={event => updateCompetitor(index, 'domain', event.target.value)} placeholder="competitor.com" />
              <input aria-label="Competitor aliases" className="input-base" value={competitor.aliases.join(', ')} onChange={event => updateCompetitor(index, 'aliases', listValue(event.target.value))} placeholder="Aliases" />
              <button type="button" className="btn-ghost px-3" title="Remove competitor" onClick={() => update('competitors', form.competitors.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} /></button>
            </div>
          ))}
          <button type="button" className="btn-ghost gap-2" onClick={() => update('competitors', [...form.competitors, { name: '', domain: '', aliases: [] }])}><Plus size={15} /> Add competitor</button>
        </div>
      </JobSection>

      <div className="flex justify-end"><button className="btn-primary gap-2" disabled={submitting}><Save size={15} />{submitting ? 'Saving...' : 'Save Profile'}</button></div>
    </form>
  )
}
