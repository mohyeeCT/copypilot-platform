'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  HelpCircle, FileText, Tag, Layers, Braces,
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
  { href: '/faq/jobs',        label: 'FAQ Copy',   icon: HelpCircle, accent: '#0B7A5C' },
  { href: '/intro/jobs',      label: 'Page Intro', icon: FileText,   accent: '#0B7A5C' },
  { href: '/meta/jobs',       label: 'Meta Copy',  icon: Tag,        accent: '#0B7A5C' },
  { href: '/all-in-one/jobs', label: 'All in One', icon: Layers,     accent: '#0B7A5C' },
]

const other: Tool[] = [
  { href: '/schema/jobs',     label: 'Schema Generator', icon: Braces, accent: '#94A3B8' },
  { href: '/indexer/jobs',    label: 'Indexer',  icon: Link2,    accent: '#94A3B8' },
  { href: '/settings',        label: 'Settings', icon: Settings, accent: '#94A3B8' },
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
    <div className="group/nav relative">
      <Link
        href={href}
        onClick={onClose}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
        className={clsx(
          'nav-item flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-100',
          active ? 'font-semibold pr-9' : 'font-medium'
        )}
        style={active ? {
          background: `${accent}14`,
          color: accent,
        } : { color: 'var(--sidebar-nav-text)' }}
      >
        <Icon
          size={14}
          style={{ color: active ? accent : 'var(--muted)', flexShrink: 0 }}
          className="transition-colors"
        />
        <span className="flex-1 truncate leading-none">{label}</span>
      </Link>
      {active && !isExternal && (
        <Link
          href={href.replace('/jobs', '/jobs/new')}
          onClick={e => { e.stopPropagation(); onClose?.() }}
          title={`New ${label} job`}
          aria-label={`New ${label} job`}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 opacity-0 transition-opacity hover:opacity-100 focus:opacity-100 group-hover/nav:opacity-100"
          style={{ color: accent }}
        >
          <Plus size={12} />
        </Link>
      )}
    </div>
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
      className="rounded-2xl border border-[var(--border)] border-t-[var(--surface-raised)] shadow-[0_2px_8px_rgba(0,0,0,0.08),0_8px_32px_rgba(0,0,0,0.10)] md:rounded-none md:border-0 md:border-r md:border-r-[var(--border)] md:shadow-none"
      style={{
        width: 224,
        height: '100%',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--sidebar-bg)',
        overflow: 'hidden',
        alignSelf: 'stretch',
      }}
    >
      {/* Logo */}
      <div className="px-4 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-6 h-6 rounded-lg overflow-hidden shrink-0" style={{ boxShadow: 'var(--shadow-xs)' }}>
            <Image src="/favicon-32x32.png" alt="CopyPilot" width={32} height={32} className="w-full h-full object-cover" />
          </div>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 24,
            fontSize: '0.9375rem',
            fontWeight: 700,
            lineHeight: '24px',
            letterSpacing: '-0.03em',
            paddingBottom: 3,
            color: 'var(--text)',
          }}>
            CopyPilot
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
        {/* Tools */}
        <div>
          <p className="px-3 mb-1.5 label-caps">Tools</p>
          <div className="space-y-1.5">
            {tools.map(t => (
              <NavItem key={t.href} {...t} active={isActive(t.href)} onClose={onClose} />
            ))}
          </div>
        </div>

        {/* Other */}
        <div>
          <p className="px-3 mb-1.5 label-caps">Other</p>
          <div className="space-y-1.5">
            {other.map(t => (
              <NavItem key={t.href} {...t} active={isActive(t.href)} onClose={onClose} />
            ))}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div
        className="px-3 pt-3 pb-5 space-y-1.5"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="nav-item flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium w-full transition-all hover:bg-black/5"
          style={{ color: 'var(--sidebar-footer-text)' }}
        >
          {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
        </button>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="nav-item flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium w-full transition-all hover:bg-black/5 group"
          style={{ color: 'var(--sidebar-footer-text)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--error)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--sidebar-footer-text)')}
        >
          <LogOut size={14} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}
