'use client'
import React, { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { BadgeCheck, CheckCircle, Plus, Pencil, Trash2, ChevronDown, ChevronUp, Upload, X, Sparkles, FileUp, Quote } from 'lucide-react'
import Papa from 'papaparse'
import CustomSelect from '@/components/ui/CustomSelect'
import type { ProfileDraftField, ProfileDraftResponse } from '@/lib/api/shared'

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
const IMPORTABLE_FIELDS = ['name', ...Object.keys(EMPTY_DATA)] as const

type ImportableField = typeof IMPORTABLE_FIELDS[number]

const IMPORT_ALIASES: Record<string, ImportableField> = {
  profile: 'name',
  'profile name': 'name',
  name: 'name',
  client: 'name',
  'client name': 'name',
  brand: 'brand_name',
  'brand name': 'brand_name',
  brand_name: 'brand_name',
  voice: 'brand_voice',
  'brand voice': 'brand_voice',
  brand_voice: 'brand_voice',
  tone: 'tone',
  audience: 'target_audience',
  'target audience': 'target_audience',
  target_audience: 'target_audience',
  usp: 'usps',
  usps: 'usps',
  'unique selling points': 'usps',
  messages: 'key_messages',
  'key messages': 'key_messages',
  key_messages: 'key_messages',
  services: 'products_services',
  products: 'products_services',
  'products services': 'products_services',
  'products and services': 'products_services',
  products_services: 'products_services',
  competitors: 'competitors',
  'words to avoid': 'words_to_avoid',
  words_to_avoid: 'words_to_avoid',
  'avoid words': 'words_to_avoid',
  example: 'example_copy',
  examples: 'example_copy',
  'example copy': 'example_copy',
  example_copy: 'example_copy',
}

function normalizeImportKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[:*_]/g, ' ')
    .replace(/[-/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function fieldForLabel(label: string): ImportableField | null {
  const normalized = normalizeImportKey(label)
  return IMPORT_ALIASES[normalized] || null
}

function coerceImportedValue(value: unknown) {
  if (value == null) return ''
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value).trim()
}

function mapImportedObject(input: Record<string, unknown>) {
  const imported: Record<string, string> = {}

  for (const [rawKey, rawValue] of Object.entries(input)) {
    const field = fieldForLabel(rawKey)
    if (!field) continue
    const value = coerceImportedValue(rawValue)
    if (value) imported[field] = value
  }

  if (!imported.name && imported.brand_name) imported.name = imported.brand_name
  return imported
}

function parseJsonProfile(text: string) {
  const parsed = JSON.parse(text)
  const record = Array.isArray(parsed) ? parsed[0] : parsed
  if (!record || typeof record !== 'object') throw new Error('JSON must contain a profile object.')

  const base = record as Record<string, unknown>
  const data = base.data && typeof base.data === 'object' && !Array.isArray(base.data)
    ? { ...base, ...(base.data as Record<string, unknown>) }
    : base

  return mapImportedObject(data)
}

function parseCsvProfile(text: string) {
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
  })

  if (parsed.errors.length) throw new Error('CSV could not be parsed. Check the header row and quoted values.')
  const firstRow = parsed.data.find(row => Object.values(row).some(value => coerceImportedValue(value)))
  if (!firstRow) throw new Error('CSV did not contain a profile row.')
  return mapImportedObject(firstRow)
}

function parseTextProfile(text: string) {
  const imported: Record<string, string> = {}
  let activeField: ImportableField | null = null

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([^:]{2,48}):\s*(.*)$/)
    if (match) {
      const field = fieldForLabel(match[1])
      if (field) {
        activeField = field
        const value = match[2].trim()
        if (value) imported[field] = imported[field] ? `${imported[field]}\n${value}` : value
      } else {
        activeField = null
      }
      continue
    }

    const value = line.trim()
    if (value && activeField) imported[activeField] = imported[activeField] ? `${imported[activeField]}\n${value}` : value
  }

  if (!imported.name && imported.brand_name) imported.name = imported.brand_name
  return imported
}

function parseProfileFile(fileName: string, text: string) {
  const lowerName = fileName.toLowerCase()
  if (lowerName.endsWith('.json')) return parseJsonProfile(text)
  if (lowerName.endsWith('.csv')) return parseCsvProfile(text)
  if (lowerName.endsWith('.txt')) return parseTextProfile(text)
  throw new Error('Use a JSON, CSV, or TXT file.')
}

type Props = {
  listBrandProfiles: (token: string) => Promise<BrandProfile[]>
  createBrandProfile: (token: string, name: string, data: object) => Promise<BrandProfile>
  updateBrandProfile: (token: string, id: string, name: string, data: object) => Promise<unknown>
  deleteBrandProfile: (token: string, id: string) => Promise<unknown>
  getProviderMetadata: (token: string) => Promise<{ provider?: string; api_key_status?: Record<string, boolean> }>
  draftBrandProfileFromContent: (
    token: string,
    input: { provider: string; model?: string; file?: File; content?: string },
  ) => Promise<ProfileDraftResponse>
}

export default function BrandProfilesCard({
  listBrandProfiles,
  createBrandProfile,
  updateBrandProfile,
  deleteBrandProfile,
  getProviderMetadata,
  draftBrandProfileFromContent,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [profiles, setProfiles] = useState<BrandProfile[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)  // null = closed, 'new' = creating, uuid = editing
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>({ name: '', ...EMPTY_DATA })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedId, setSavedId] = useState<string | null>(null)
  const [profilesVisible, setProfilesVisible] = useState(true)
  const [importMessage, setImportMessage] = useState('')
  const [draftEvidence, setDraftEvidence] = useState<Record<string, ProfileDraftField>>({})
  const [aiImportOpen, setAiImportOpen] = useState(false)
  const [aiProvider, setAiProvider] = useState('')
  const [configuredProviders, setConfiguredProviders] = useState<string[]>([])
  const [aiFile, setAiFile] = useState<File | null>(null)
  const [aiContent, setAiContent] = useState('')
  const [aiImporting, setAiImporting] = useState(false)
  const [aiError, setAiError] = useState('')

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
    setImportMessage('')
    setDraftEvidence({})
  }

  function openEdit(p: BrandProfile) {
    setForm({ name: p.name, ...EMPTY_DATA, ...p.data })
    setEditingId(p.id)
    setExpandedId(p.id)
    setProfilesVisible(true)
    setImportMessage('')
    setDraftEvidence({})
  }

  function cancel() {
    setEditingId(null)
    setError('')
    setImportMessage('')
    setForm({ name: '', ...EMPTY_DATA })
    setDraftEvidence({})
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
      setImportMessage('')
      setDraftEvidence({})
    } catch { setError('Failed to save') }
    setSaving(false)
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setError('')
    setImportMessage('')
    try {
      const imported = parseProfileFile(file.name, await file.text())
      const hasValues = Object.values(imported).some(Boolean)
      if (!hasValues) throw new Error('No matching profile fields were found.')

      setForm({ name: '', ...EMPTY_DATA, ...imported })
      setEditingId('new')
      setExpandedId(null)
      setProfilesVisible(true)
      setImportMessage('Imported into a new profile. Review the fields, then save.')
      setDraftEvidence({})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import this profile file.')
    }
  }

  async function openAiImport() {
    setAiImportOpen(true)
    setAiError('')
    setAiFile(null)
    setAiContent('')
    setConfiguredProviders([])
    setAiProvider('')
    try {
      const token = await getToken()
      const metadata = await getProviderMetadata(token)
      const available = Object.entries(metadata.api_key_status || {})
        .filter(([, configured]) => configured)
        .map(([provider]) => provider)
      setConfiguredProviders(available)
      setAiProvider(
        metadata.provider && available.includes(metadata.provider)
          ? metadata.provider
          : available[0] || '',
      )
      if (available.length === 0) {
        setAiError('Add an AI provider key in Settings before analysing content.')
      }
    } catch {
      setAiError('Could not load configured AI providers.')
    }
  }

  async function analyseContent() {
    if (!aiProvider) {
      setAiError('Add an AI provider key before analysing content.')
      return
    }
    if (!aiFile && !aiContent.trim()) {
      setAiError('Choose a file or paste source content.')
      return
    }

    setAiImporting(true)
    setAiError('')
    try {
      const token = await getToken()
      const draft = await draftBrandProfileFromContent(token, {
        provider: aiProvider,
        file: aiFile || undefined,
        content: aiFile ? undefined : aiContent,
      })
      const imported: Record<string, string> = {}
      for (const [field, detail] of Object.entries(draft.fields)) {
        if (detail.value) imported[field] = detail.value
      }
      setForm({ name: '', ...EMPTY_DATA, ...imported })
      setDraftEvidence(draft.fields)
      setEditingId('new')
      setExpandedId(null)
      setProfilesVisible(true)
      setImportMessage(
        `Drafted from ${draft.source_name}${draft.truncated ? ' using the supported text limit' : ''}. Review every field before saving.`,
      )
      setAiImportOpen(false)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Could not build a profile draft.')
    } finally {
      setAiImporting(false)
    }
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
    <>
    <div className="job-section">
      <div className="job-section-header">
        <div className="flex items-start gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/5 text-accent">
            <BadgeCheck size={15} />
          </div>
          <div>
            <p className="job-section-kicker">Brand context</p>
            <h2 className="job-section-title">Client profiles</h2>
            <p className="job-section-description">One profile per client or brand. Select which to use when running a job.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv,.txt"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            onClick={() => setProfilesVisible(v => !v)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors"
          >
            {profilesVisible ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {profilesVisible ? 'Hide profiles' : 'Show profiles'}
          </button>
          <button
            onClick={() => void openAiImport()}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors"
          >
            <Sparkles size={12} /> Create from content
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors"
          >
            <Upload size={12} /> Import structured file
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
          {importMessage && (
            <p className="mb-3 flex items-center gap-1.5 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-xs text-accent">
              <CheckCircle size={12} />
              {importMessage}
            </p>
          )}

          {/* New profile form */}
          {editingId === 'new' && (
            <ProfileForm
              form={form} setForm={setForm} saving={saving} error={error}
              onSave={save} onCancel={cancel} isNew draftEvidence={draftEvidence}
            />
          )}

          {/* Existing profiles */}
          {profiles.length === 0 && editingId !== 'new' && (
            <p className="text-xs text-muted text-center py-4">No client profiles yet. Create one to get started.</p>
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

    {aiImportOpen && (
      <div
        className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4"
        role="presentation"
        onMouseDown={event => {
          if (event.target === event.currentTarget && !aiImporting) setAiImportOpen(false)
        }}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-content-import-title"
          className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-surface-raised p-5 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-accent/20 bg-accent/5 text-accent">
                <FileUp size={17} />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase text-muted">Client profile</p>
                <h2 id="profile-content-import-title" className="text-base font-semibold">Create from content</h2>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close content import"
              disabled={aiImporting}
              onClick={() => setAiImportOpen(false)}
              className="rounded-md p-1.5 text-muted hover:text-text disabled:opacity-40"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase text-muted">AI provider</label>
              <CustomSelect
                ariaLabel="AI provider for profile draft"
                value={aiProvider}
                onChange={setAiProvider}
                options={configuredProviders.map(provider => ({ value: provider, label: provider }))}
                className="w-full"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase text-muted">Source file</label>
              <input
                type="file"
                accept=".pdf,.docx,.txt,.md"
                disabled={Boolean(aiContent.trim()) || aiImporting}
                onChange={event => {
                  setAiFile(event.target.files?.[0] || null)
                  setAiError('')
                }}
                className="input-base w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-accent/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-accent"
              />
            </div>

            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-border" />
              <span>or</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase text-muted">Paste content</label>
              <textarea
                rows={8}
                maxLength={200000}
                value={aiContent}
                disabled={Boolean(aiFile) || aiImporting}
                onChange={event => {
                  setAiContent(event.target.value)
                  setAiError('')
                }}
                className="input-base w-full resize-y text-sm"
                placeholder="Paste website, brief, positioning, audience, product, or service content..."
              />
            </div>

            {aiError && <p className="rounded-md border border-error/20 bg-error/5 px-3 py-2 text-xs text-error">{aiError}</p>}
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" disabled={aiImporting} className="btn-ghost" onClick={() => setAiImportOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              disabled={aiImporting || !aiProvider || (!aiFile && !aiContent.trim())}
              className="btn-primary"
              onClick={() => void analyseContent()}
            >
              <Sparkles size={14} /> {aiImporting ? 'Analysing...' : 'Create draft'}
            </button>
          </div>
        </section>
      </div>
    )}
    </>
  )
}

function ProfileForm({ form, setForm, saving, error, onSave, onCancel, isNew = false, draftEvidence = {} }: {
  form: Record<string, string>
  setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>
  saving: boolean; error: string
  onSave: () => void; onCancel: () => void; isNew?: boolean
  draftEvidence?: Record<string, ProfileDraftField>
}) {
  const evidence = (key: string) => {
    const detail = draftEvidence[key]
    if (!detail?.evidence) return null
    return (
      <p className="mt-1 flex min-w-0 items-start gap-1.5 text-[0.68rem] leading-relaxed text-muted">
        <Quote size={10} className="mt-0.5 shrink-0 text-accent" />
        <span className="min-w-0 flex-1">{detail.evidence}</span>
        <span className="shrink-0 font-semibold uppercase text-accent">{detail.confidence}</span>
      </p>
    )
  }
  const field = (key: string, placeholder = '') => (
    <>
      <input value={form[key] || ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        className="input-base text-xs w-full" placeholder={placeholder} />
      {evidence(key)}
    </>
  )
  const area = (key: string, rows = 2, placeholder = '') => (
    <>
      <textarea rows={rows} value={form[key] || ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        className="input-base text-xs w-full resize-none" placeholder={placeholder} />
      {evidence(key)}
    </>
  )

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-muted block mb-1">Profile Name <span className="text-error">*</span></label>
        <input value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          className="input-base text-xs w-full" placeholder="e.g. Ceylan Machine, Client B..." autoFocus={isNew} />
        {evidence('name')}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted block mb-1">Brand Name</label>
          {field('brand_name', 'Acme Corp')}
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">Tone</label>
          <CustomSelect size="compact" value={form.tone || ''} onChange={value => setForm(p => ({ ...p, tone: value }))}
            options={TONES.map(t => ({ value: t, label: t || 'Select tone' }))} className="w-full" />
          {evidence('tone')}
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
