'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  HelpCircle, FileText, Tag, BookOpen, Zap, Link2, Settings, LogOut, Plus
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import ThemeToggle from '@/components/ui/ThemeToggle'
import clsx from 'clsx'

type Tool = {
  href: string
  label: string
  icon: React.ElementType
  soon?: boolean
  accent?: string
}

const tools: Tool[] = [
  { href: '/faq/jobs',        label: 'FAQ Copy',   icon: HelpCircle, accent: '#818CF8' },
  { href: '/intro/jobs',      label: 'Page Intro', icon: FileText,   accent: '#60A5FA' },
  { href: '/meta/jobs',       label: 'Meta Copy',  icon: Tag,        accent: '#F59E0B', soon: true },
  { href: '/page-copy/jobs',  label: 'Page Copy',  icon: BookOpen,   accent: '#F472B6', soon: true },
  { href: '/all-in-one/jobs', label: 'All in One', icon: Zap,        accent: '#00c9a7', soon: true },
]

const other: Tool[] = [
  { href: 'https://indexer.copypilot.app', label: 'Indexer', icon: Link2 },
  { href: '/settings',                     label: 'Settings', icon: Settings },
]

export default function Sidebar({ onClose }: { onClose?: () => void } = {}) {
  const pathname = usePathname()
  const router   = useRouter()

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/login')
  }

  function isActive(href: string) {
    if (href.startsWith('http')) return false
    return pathname.startsWith(href)
  }

  return (
    <aside className="w-56 min-h-screen bg-surface border-r border-border flex flex-col shrink-0">
      {/* Logo */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-2">
          <img src="/favicon-32x32.png" alt="CopyPilot" className="w-5 h-5" />
          <span className="font-bold text-sm tracking-tight">CopyPilot</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-5 overflow-y-auto">
        {/* Tools section */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider px-3 mb-2"
            style={{ color: 'var(--muted)', fontSize: 10 }}>
            Tools
          </p>
          <div className="space-y-0.5">
            {tools.map(({ href, label, icon: Icon, soon, accent }) => (
              soon ? (
                <div
                  key={href}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm opacity-40 cursor-not-allowed select-none"
                  style={{ color: 'var(--muted)' }}
                  title="Coming soon"
                >
                  <Icon size={15} />
                  <span>{label}</span>
                  <span className="ml-auto text-xs font-mono"
                    style={{ fontSize: 9, color: 'var(--muted)', background: 'var(--border)', borderRadius: 4, padding: '1px 5px' }}>
                    soon
                  </span>
                </div>
              ) : (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                    isActive(href)
                      ? 'bg-accent/10 text-accent font-medium'
                      : 'text-muted hover:text-text hover:bg-border/50'
                  )}
                >
                  <Icon size={15} style={isActive(href) ? { color: accent } : undefined} />
                  {label}
                  {isActive(href) && (
                    <Link
                      href={href.replace('/jobs', '/jobs/new')}
                      onClick={e => e.stopPropagation()}
                      className="ml-auto p-0.5 rounded transition-colors hover:bg-accent/20"
                      title={`New ${label} job`}
                    >
                      <Plus size={12} />
                    </Link>
                  )}
                </Link>
              )
            ))}
          </div>
        </div>

        {/* Other section */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider px-3 mb-2"
            style={{ color: 'var(--muted)', fontSize: 10 }}>
            Other
          </p>
          <div className="space-y-0.5">
            {other.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                target={href.startsWith('http') ? '_blank' : undefined}
                rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive(href)
                    ? 'bg-accent/10 text-accent font-medium'
                    : 'text-muted hover:text-text hover:bg-border/50'
                )}
              >
                <Icon size={15} />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-0.5">
        <ThemeToggle />
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors w-full"
          style={{ color: 'var(--muted)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--error)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)' }}
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
