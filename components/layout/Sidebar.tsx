'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  HelpCircle, FileText, Tag, BookOpen, Layers,
  Link2, Settings, LogOut, Plus, Sun, Moon
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import clsx from 'clsx'

type Tool = {
  href: string
  label: string
  icon: React.ElementType
  accent: string
  soon?: boolean
}

const tools: Tool[] = [
  { href: '/faq/jobs',        label: 'FAQ Copy',   icon: HelpCircle, accent: '#818CF8' },
  { href: '/intro/jobs',      label: 'Page Intro', icon: FileText,   accent: '#60A5FA' },
  { href: '/meta/jobs',       label: 'Meta Copy',  icon: Tag,        accent: '#F59E0B' },
  { href: '/page-copy/jobs',  label: 'Page Copy',  icon: BookOpen,   accent: '#F472B6' },
  { href: '/all-in-one/jobs', label: 'All in One', icon: Layers,     accent: '#0A9B7A' },
]

const other: Tool[] = [
  { href: 'https://indexer.copypilot.app', label: 'Indexer',  icon: Link2,    accent: '#94A3B8' },
  { href: '/settings',                     label: 'Settings', icon: Settings, accent: '#94A3B8' },
]

function NavItem({ href, label, icon: Icon, accent, soon, active, onClose }: {
  href: string; label: string; icon: React.ElementType
  accent: string; soon?: boolean; active: boolean; onClose?: () => void
}) {
  const isExternal = href.startsWith('http')

  if (soon) return (
    <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs opacity-35 cursor-not-allowed select-none" style={{ color: 'var(--muted)' }}>
      <Icon size={14} />
      <span className="flex-1 font-medium">{label}</span>
      <span style={{
        fontSize: 9, fontWeight: 600, letterSpacing: '0.05em',
        padding: '1px 5px', borderRadius: 4,
        background: 'var(--border)', color: 'var(--muted)',
      }}>SOON</span>
    </div>
  )

  return (
    <Link
      href={href}
      onClick={onClose}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className={clsx(
        'group flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-all duration-100',
        active
          ? 'font-semibold'
          : 'font-medium hover:bg-black/5 [data-theme=dark_]:hover:bg-white/5'
      )}
      style={active ? {
        background: `${accent}14`,
        color: accent,
      } : { color: 'var(--muted)' }}
    >
      <Icon
        size={14}
        style={{ color: active ? accent : 'var(--muted)', flexShrink: 0 }}
        className="transition-colors"
      />
      <span className="flex-1 leading-none">{label}</span>
      {active && !isExternal && (
        <Link
          href={href.replace('/jobs', '/jobs/new')}
          onClick={e => e.stopPropagation()}
          title={`New ${label} job`}
          className="p-1 rounded-md transition-colors opacity-60 hover:opacity-100"
          style={{ color: accent }}
        >
          <Plus size={12} />
        </Link>
      )}
    </Link>
  )
}

export default function Sidebar({ onClose }: { onClose?: () => void } = {}) {
  const pathname = usePathname()
  const router   = useRouter()
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const saved = localStorage.getItem('cp-theme') as 'light' | 'dark' | null
    const resolved = saved || 'light'
    setTheme(resolved)
    document.documentElement.setAttribute('data-theme', resolved)
  }, [])

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('cp-theme', next)
  }

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/login')
  }

  function isActive(href: string) {
    if (href.startsWith('http')) return false
    return pathname.startsWith(href)
  }

  return (
    <aside
      className="w-56 min-h-screen flex flex-col shrink-0"
      style={{
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Logo */}
      <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <Link href="/" className="flex items-center gap-2.5 group">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--accent)', boxShadow: 'var(--shadow-accent)' }}
          >
            <span style={{ color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: '-0.04em' }}>CP</span>
          </div>
          <span style={{
            fontSize: '0.9375rem',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: 'var(--text)',
          }}>
            CopyPilot
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto">
        {/* Tools */}
        <div>
          <p className="px-2.5 mb-1.5 label-caps">Tools</p>
          <div className="space-y-0.5">
            {tools.map(t => (
              <NavItem key={t.href} {...t} active={isActive(t.href)} onClose={onClose} />
            ))}
          </div>
        </div>

        {/* Other */}
        <div>
          <p className="px-2.5 mb-1.5 label-caps">Other</p>
          <div className="space-y-0.5">
            {other.map(t => (
              <NavItem key={t.href} {...t} active={isActive(t.href)} onClose={onClose} />
            ))}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div
        className="px-2.5 py-3 space-y-0.5"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm font-medium w-full transition-all hover:bg-black/5"
          style={{ color: 'var(--muted)' }}
        >
          {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
        </button>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm font-medium w-full transition-all hover:bg-black/5 group"
          style={{ color: 'var(--muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--error)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
        >
          <LogOut size={14} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}
