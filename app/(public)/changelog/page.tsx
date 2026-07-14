'use client'
import { useState } from 'react'
import Image from 'next/image'
import CustomSelect from '@/components/ui/CustomSelect'
import { changelog } from './data'
import type { ChangeType } from './data'

const typeStyles: Record<ChangeType, { label: string; color: string; bg: string; border: string }> = {
  feature:     { label: 'Feature',     color: '#00c9a7', bg: 'rgba(0,201,167,0.08)',   border: 'rgba(0,201,167,0.2)' },
  fix:         { label: 'Fix',         color: '#f97316', bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.2)' },
  improvement: { label: 'Improvement', color: '#818cf8', bg: 'rgba(129,140,248,0.08)', border: 'rgba(129,140,248,0.2)' },
}

const toolStyles: Record<string, { color: string; bg: string; border: string }> = {
  FAQ:      { color: '#00c9a7', bg: 'rgba(0,201,167,0.06)',   border: 'rgba(0,201,167,0.18)' },
  Intro:    { color: '#60a5fa', bg: 'rgba(96,165,250,0.06)',  border: 'rgba(96,165,250,0.18)' },
  Indexer:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.06)',  border: 'rgba(245,158,11,0.18)' },
  Platform: { color: '#818cf8', bg: 'rgba(129,140,248,0.06)', border: 'rgba(129,140,248,0.18)' },
}

const ALL_TOOLS = ['All', 'FAQ', 'Intro', 'Indexer', 'Platform']
const ALL_TYPES: (ChangeType | 'All')[] = ['All', 'feature', 'fix', 'improvement']

export default function ChangelogPage() {
  const [toolFilter, setToolFilter] = useState<string>('All')
  const [typeFilter, setTypeFilter] = useState<ChangeType | 'All'>('All')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const filtered = changelog.filter(e =>
    (toolFilter === 'All' || e.tool === toolFilter) &&
    (typeFilter === 'All' || e.type === typeFilter)
  )

  function toggle(version: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(version) ? next.delete(version) : next.add(version)
      return next
    })
  }

  function expandAll() { setExpanded(new Set(filtered.map(e => e.version))) }
  function collapseAll() { setExpanded(new Set()) }

  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .changelog-filter { width: 118px; }
        .changelog-filter .cs-trigger {
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 5px 8px 5px 10px;
          font-size: 12px;
          font-family: inherit;
          transition: border-color 0.15s, color 0.15s;
          box-shadow: none;
          transform: none;
        }
        .changelog-filter .cs-trigger > span { color: #9090a8 !important; }
        .changelog-filter .cs-trigger:hover { border-color: var(--muted); box-shadow: none; transform: none; }
        .changelog-filter .cs-trigger:focus, .changelog-filter .cs-trigger[data-open="true"] { border-color: var(--muted); box-shadow: none; transform: none; }
        .changelog-filter.active .cs-trigger { border-color: #00c9a7; }
        .changelog-filter.active .cs-trigger > span { color: #e8e8f0 !important; }
        .action-btn { background: transparent; border: 1px solid var(--border); border-radius: 6px; padding: 5px 12px; font-size: 12px; cursor: pointer; transition: all 0.15s; color: var(--muted); font-family: inherit; }
        .action-btn:hover { border-color: var(--muted); color: #e8e8f0; }
        .entry-row { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; margin-bottom: 8px; transition: border-color 0.15s; }
        .entry-row:hover { border-color: #2e2e3a; }
        .entry-header { display: flex; align-items: center; gap: 12px; padding: 14px 18px; cursor: pointer; user-select: none; }
        .entry-body { padding: 14px 18px 16px; border-top: 1px solid var(--border); }
        .chevron { transition: transform 0.2s; color: var(--muted); font-size: 12px; }
        .chevron.open { transform: rotate(180deg); }
        .nav-link { font-size: 13px; color: var(--muted); text-decoration: none; transition: color 0.15s; }
        .nav-link:hover { color: #e8e8f0; }
      `}</style>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--bg) 92%, transparent)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="https://copypilot.app" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'inherit' }}>
            <Image src="/favicon-32x32.png" alt="CopyPilot" width={20} height={20} />
            <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.02em' }}>CopyPilot</span>
          </a>
          <div style={{ display: 'flex', gap: 20 }}>
            <a href="https://copypilot.app" className="nav-link">Home</a>
            <a href="https://faq.copypilot.app" className="nav-link">FAQ tool</a>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 8 }}>Changelog</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)' }}>All changes shipped across CopyPilot tools.</p>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>App</span>
            <CustomSelect
              size="compact"
              className={`changelog-filter ${toolFilter !== 'All' ? 'active' : ''}`}
              value={toolFilter}
              onChange={setToolFilter}
              options={ALL_TOOLS}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Type</span>
            <CustomSelect
              size="compact"
              className={`changelog-filter ${typeFilter !== 'All' ? 'active' : ''}`}
              value={typeFilter}
              onChange={value => setTypeFilter(value as ChangeType | 'All')}
              options={ALL_TYPES.map(t => ({
                value: t,
                label: t === 'All' ? 'All' : typeStyles[t as ChangeType].label,
              }))}
            />
          </div>

          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            <button className="action-btn" onClick={expandAll}>Expand all</button>
            <button className="action-btn" onClick={collapseAll}>Collapse all</button>
          </div>
        </div>

        {/* Count + clear */}
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
          {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
          {(toolFilter !== 'All' || typeFilter !== 'All') && (
            <button
              onClick={() => { setToolFilter('All'); setTypeFilter('All') }}
              style={{ marginLeft: 10, fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}
            >
              Clear filters
            </button>
          )}
        </p>

        {/* Entries */}
        {filtered.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: 14, textAlign: 'center', padding: '40px 0' }}>No entries match.</p>
        )}

        {filtered.map(entry => {
          const ts = typeStyles[entry.type]
          const tool = toolStyles[entry.tool] || toolStyles['Platform']
          const isOpen = expanded.has(entry.version)
          return (
            <div key={entry.version} className="entry-row">
              <div className="entry-header" onClick={() => toggle(entry.version)}>
                <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#00c9a7', minWidth: 52 }}>
                  {entry.version}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', flex: 1 }}>
                  {entry.title}
                </span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: tool.color, background: tool.bg, border: `1px solid ${tool.border}`, borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap' }}>
                    {entry.tool}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: ts.color, background: ts.bg, border: `1px solid ${ts.border}`, borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap' }}>
                    {ts.label}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{entry.date}</span>
                  <span className={`chevron ${isOpen ? 'open' : ''}`}>▾</span>
                </div>
              </div>
              {isOpen && (
                <div className="entry-body">
                  <p style={{ fontSize: 13, color: '#9090a8', lineHeight: 1.65 }}>{entry.description}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '20px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>CopyPilot - AI-powered SEO copy production</p>
      </footer>
    </main>
  )
}
