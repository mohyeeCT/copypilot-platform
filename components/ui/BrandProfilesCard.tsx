'use client'
import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { BadgeCheck, CheckCircle, Plus, Pencil, Trash2, ChevronDown, ChevronUp, X } from 'lucide-react'
import CustomSelect from '@/components/ui/CustomSelect'

type BrandProfile = {
  id: string
  name: string
  data: Record<string, string>
}

const EMPTY_DATA = {
  brand_name: '', brand_voice: '', tone: '', target_audience: '',
  usps: '', key_messages: '', products_services: '',
  competitors: '', words_to_avoid: '', example_copy: '',
}

const TONES = ['', 'Professional', 'Conversational', 'Friendly', 'Authoritative', 'Technical', 'Casual']

type Props = {
  listBrandProfiles: (token: string) => Promise<BrandProfile[]>
  createBrandProfile: (token: string, name: string, data: object) => Promise<BrandProfile>
  updateBrandProfile: (token: string, id: string, name: string, data: object) => Promise<unknown>
  deleteBrandProfile: (token: string, id: string) => Promise<unknown>
}

export default function BrandProfilesCard({ listBrandProfiles, createBrandProfile, updateBrandProfile, deleteBrandProfile }: Props) {
  const [profiles, setProfiles] = useState<BrandProfile[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)  // null = closed, 'new' = creating, uuid = editing
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>({ name: '', ...EMPTY_DATA })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedId, setSavedId] = useState<string | null>(null)
  const [profilesVisible, setProfilesVisible] = useState(true)

  async function getToken() {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    return session?.access_token || ''
  }

  useEffect(() => {
    async function load() {
      const token = await getToken()
      if (!token) return
      try {
        const data = await listBrandProfiles(token)
        setProfiles(Array.isArray(data) ? data : [])
      } catch {}
    }
    load()
  }, [listBrandProfiles])

  function openNew() {
    setForm({ name: '', ...EMPTY_DATA })
    setEditingId('new')
    setExpandedId(null)
    setProfilesVisible(true)
  }

  function openEdit(p: BrandProfile) {
    setForm({ name: p.name, ...EMPTY_DATA, ...p.data })
    setEditingId(p.id)
    setExpandedId(p.id)
    setProfilesVisible(true)
  }

  function cancel() {
    setEditingId(null)
    setError('')
    setForm({ name: '', ...EMPTY_DATA })
  }

  async function save() {
    if (!form.name.trim()) { setError('Profile name is required'); return }
    setSaving(true)
    setError('')
    try {
      const token = await getToken()
      const { name, ...data } = form
      if (editingId === 'new') {
        const created = await createBrandProfile(token, name, data)
        setProfiles(prev => [...prev, created])
        setSavedId(created.id)
        setTimeout(() => setSavedId(null), 2000)
      } else if (editingId) {
        await updateBrandProfile(token, editingId, name, data)
        setProfiles(prev => prev.map(p => p.id === editingId ? { ...p, name, data } : p))
        setSavedId(editingId)
        setTimeout(() => setSavedId(null), 2000)
      }
      setEditingId(null)
    } catch { setError('Failed to save') }
    setSaving(false)
  }

  async function remove(id: string) {
    const token = await getToken()
    await deleteBrandProfile(token, id)
    setProfiles(prev => prev.filter(p => p.id !== id))
    if (editingId === id) setEditingId(null)
    if (expandedId === id) setExpandedId(null)
  }

  const f = (key: keyof typeof EMPTY_DATA) => (
    <input
      value={form[key]}
      onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
      className="input-base text-xs w-full"
    />
  )

  const ta = (key: keyof typeof EMPTY_DATA, rows = 2) => (
    <textarea
      rows={rows}
      value={form[key]}
      onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
      className="input-base text-xs w-full resize-none"
    />
  )

  return (
    <div className="job-section">
      <div className="job-section-header">
        <div className="flex items-start gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/5 text-accent">
            <BadgeCheck size={15} />
          </div>
          <div>
            <p className="job-section-kicker">Brand context</p>
            <h2 className="job-section-title">Brand profiles</h2>
            <p className="job-section-description">One profile per client or brand. Select which to use when running a job.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setProfilesVisible(v => !v)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors"
          >
            {profilesVisible ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {profilesVisible ? 'Hide profiles' : 'Show profiles'}
          </button>
          {editingId !== 'new' && (
            <button onClick={openNew} className="flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors">
              <Plus size={12} /> New profile
            </button>
          )}
        </div>
      </div>

      {profilesVisible && (
        <>
          {/* New profile form */}
          {editingId === 'new' && (
            <ProfileForm
              form={form} setForm={setForm} saving={saving} error={error}
              onSave={save} onCancel={cancel} isNew
            />
          )}

          {/* Existing profiles */}
          {profiles.length === 0 && editingId !== 'new' && (
            <p className="text-xs text-muted text-center py-4">No brand profiles yet. Create one to get started.</p>
          )}

          <div className="space-y-2 mt-2">
            {profiles.map(p => (
              <div key={p.id} className="border border-border rounded-lg overflow-hidden">
                {/* Profile header */}
                <div className="flex items-center justify-between px-4 py-3 bg-surface/50">
                  <div className="flex items-center gap-3">
                    {savedId === p.id && <CheckCircle size={13} className="text-accent shrink-0" />}
                    <span className="text-sm font-medium">{p.name}</span>
                    {p.data.brand_name && p.data.brand_name !== p.name && (
                      <span className="text-xs text-muted font-mono">{p.data.brand_name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(p)} className="p-1.5 text-muted hover:text-accent transition-colors" title="Edit">
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => remove(p.id)} className="p-1.5 text-muted hover:text-error transition-colors" title="Delete">
                      <Trash2 size={12} />
                    </button>
                    <button onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                      className="p-1.5 text-muted hover:text-text transition-colors">
                      {expandedId === p.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>
                </div>

                {/* Edit form */}
                {editingId === p.id && (
                  <div className="px-4 pb-4 pt-3 border-t border-border">
                    <ProfileForm
                      form={form} setForm={setForm} saving={saving} error={error}
                      onSave={save} onCancel={cancel}
                    />
                  </div>
                )}

                {/* Summary view */}
                {expandedId === p.id && editingId !== p.id && (
                  <div className="px-4 pb-3 pt-2 border-t border-border grid grid-cols-2 gap-2">
                    {(Object.entries(p.data) as [string, string][]).filter(([, v]) => v).map(([k, v]) => (
                      <div key={k}>
                        <p className="text-xs text-muted capitalize">{k.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-text truncate">{v}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ProfileForm({ form, setForm, saving, error, onSave, onCancel, isNew = false }: {
  form: Record<string, string>
  setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>
  saving: boolean; error: string
  onSave: () => void; onCancel: () => void; isNew?: boolean
}) {
  const field = (key: string, placeholder = '') => (
    <input value={form[key] || ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
      className="input-base text-xs w-full" placeholder={placeholder} />
  )
  const area = (key: string, rows = 2, placeholder = '') => (
    <textarea rows={rows} value={form[key] || ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
      className="input-base text-xs w-full resize-none" placeholder={placeholder} />
  )

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-muted block mb-1">Profile Name <span className="text-error">*</span></label>
        <input value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          className="input-base text-xs w-full" placeholder="e.g. Ceylan Machine, Client B..." autoFocus={isNew} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted block mb-1">Brand Name</label>
          {field('brand_name', 'Acme Corp')}
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">Tone</label>
          <CustomSelect value={form.tone || ''} onChange={value => setForm(p => ({ ...p, tone: value }))}
            options={TONES.map(t => ({ value: t, label: t || 'Select tone' }))} className="text-xs w-full" />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted block mb-1">Brand Voice</label>
        {field('brand_voice', 'e.g. Expert but approachable. Straight-talking. Never jargon-heavy.')}
      </div>
      <div>
        <label className="text-xs text-muted block mb-1">Target Audience</label>
        {field('target_audience', 'e.g. Mid-market B2B procurement managers, 30-50')}
      </div>
      <div>
        <label className="text-xs text-muted block mb-1">Unique Selling Points</label>
        {area('usps', 2, 'e.g. 2-year guarantee, UK-manufactured, same-day dispatch')}
      </div>
      <div>
        <label className="text-xs text-muted block mb-1">Key Messages</label>
        {area('key_messages', 2, 'e.g. Industry-leading lead times. ISO 9001 certified.')}
      </div>
      <div>
        <label className="text-xs text-muted block mb-1">Products / Services</label>
        {area('products_services', 2, 'e.g. Industrial dosing systems, granulation equipment')}
      </div>
      <div>
        <label className="text-xs text-muted block mb-1">Competitors</label>
        {field('competitors', 'e.g. Acme Rival, GlobalDoser')}
      </div>
      <div>
        <label className="text-xs text-muted block mb-1">Words / Phrases to Avoid</label>
        {field('words_to_avoid', 'e.g. cheap, budget, cutting-edge')}
      </div>
      <div>
        <label className="text-xs text-muted block mb-1">Example Copy <span className="text-muted/50">(style reference)</span></label>
        {area('example_copy', 3, 'Paste a sample paragraph of existing brand copy...')}
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button onClick={onSave} disabled={saving} className="btn-primary text-xs px-4 py-2">
          {saving ? 'Saving...' : isNew ? 'Create profile' : 'Save changes'}
        </button>
        <button onClick={onCancel} className="text-xs text-muted hover:text-text transition-colors flex items-center gap-1">
          <X size={11} /> Cancel
        </button>
      </div>
      {error && <p className="text-error text-xs">{error}</p>}
    </div>
  )
}
