'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bot,
  Braces,
  BriefcaseBusiness,
  FileText,
  HelpCircle,
  Layers3,
  Link2,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Radar,
  Settings,
  Tag,
  X,
} from 'lucide-react'
import clsx from 'clsx'
import { createClient } from '@/lib/supabase'
import styles from './Sidebar.module.css'

type Tool = {
  href: string
  label: string
  icon: React.ElementType
  newHref?: string
}

type Account = {
  name: string
  email: string
}

const NAV_GROUPS: Array<{ label: string; items: Tool[] }> = [
  {
    label: 'Create',
    items: [
      { href: '/faq/jobs', label: 'FAQ Copy', icon: HelpCircle },
      { href: '/intro/jobs', label: 'Page Intro', icon: FileText },
      { href: '/meta/jobs', label: 'Meta Copy', icon: Tag },
      { href: '/all-in-one/jobs', label: 'All in One', icon: Layers3 },
    ],
  },
  {
    label: 'Insights',
    items: [
      { href: '/brand-mentions', label: 'Brand Pulse', icon: Radar, newHref: '/brand-mentions/new' },
      { href: '/geopilot', label: 'GEOPilot', icon: Bot, newHref: '/geopilot/new' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/schema/jobs', label: 'Schema Generator', icon: Braces },
      { href: '/indexer/jobs', label: 'Indexer', icon: Link2 },
    ],
  },
]

function initials(name: string, email: string) {
  const source = name.trim() || email.split('@')[0] || 'CP'
  const words = source.split(/\s+/).filter(Boolean)
  return words.slice(0, 2).map(word => word[0]?.toUpperCase()).join('') || 'CP'
}

function getWorkspaceLabel(name: string, email: string) {
  const accountName = name.trim()
  const emailName = email.includes('@') ? email.split('@')[0]?.trim() : ''
  const source = accountName && accountName !== 'CopyPilot user' ? accountName : emailName
  const firstName = source.split(/[\s._+-]+/).find(Boolean)

  if (!firstName) return 'My Workspace'

  const normalizedName = firstName === firstName.toLowerCase() || firstName === firstName.toUpperCase()
    ? firstName.toLowerCase()
    : firstName
  const displayName = normalizedName.charAt(0).toUpperCase() + normalizedName.slice(1)

  return `${displayName}'s Workspace`
}

function NavItem({ tool, active, collapsed, onClose }: {
  tool: Tool
  active: boolean
  collapsed: boolean
  onClose?: () => void
}) {
  const Icon = tool.icon
  const quickActionHref = tool.newHref ?? (tool.href.endsWith('/jobs') ? tool.href.replace('/jobs', '/jobs/new') : undefined)

  return (
    <div className={styles.navItemWrap}>
      <Link
        href={tool.href}
        className={clsx(styles.navItem, active && styles.navItemActive)}
        title={collapsed ? tool.label : undefined}
        onClick={onClose}
      >
        <Icon size={17} />
        <span>{tool.label}</span>
        {active ? <span className={styles.activeRail} /> : null}
      </Link>
      {active && quickActionHref ? (
        <Link
          href={quickActionHref}
          className={styles.quickAction}
          aria-label={`New ${tool.label}`}
          title={`New ${tool.label}`}
          onClick={event => {
            event.stopPropagation()
            onClose?.()
          }}
        >
          <Plus size={13} />
        </Link>
      ) : null}
    </div>
  )
}

export default function Sidebar({
  account,
  collapsed = false,
  onClose,
  onCollapse,
}: {
  account?: Account
  collapsed?: boolean
  onClose?: () => void
  onCollapse?: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const accountName = account?.name || 'CopyPilot user'
  const accountEmail = account?.email || 'Agency workspace'
  const workspaceLabel = getWorkspaceLabel(accountName, accountEmail)

  function isActive(href: string) {
    return pathname.startsWith(href)
  }

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/login')
  }

  return (
    <aside className={clsx(styles.sidebar, collapsed && styles.collapsed)}>
      <div className={styles.brandRow}>
        <Link href="/" className={styles.brand} aria-label="CopyPilot home">
          <Image src="/favicon-32x32.png" alt="" width={28} height={28} className={styles.logo} />
          <span className={styles.brandName}>CopyPilot</span>
        </Link>
        <button type="button" className={styles.mobileClose} aria-label="Close navigation" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className={styles.workspaceCard} title={collapsed ? workspaceLabel : undefined}>
        <span className={styles.workspaceAvatar}><BriefcaseBusiness size={15} /></span>
        <span className={styles.workspaceText}>
          <strong>{workspaceLabel}</strong>
          <small>Copy and visibility tools</small>
        </span>
      </div>

      <nav className={styles.navigation} aria-label="Main navigation">
        {NAV_GROUPS.map(group => (
          <div key={group.label} className={styles.navGroup}>
            <p className={styles.navLabel}>{group.label}</p>
            {group.items.map(tool => (
              <NavItem
                key={tool.href}
                tool={tool}
                active={isActive(tool.href)}
                collapsed={collapsed}
                onClose={onClose}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className={styles.sidebarFooter}>
        <Link href="/settings" className={clsx(styles.navItem, isActive('/settings') && styles.navItemActive)} title={collapsed ? 'Settings' : undefined} onClick={onClose}>
          <Settings size={17} />
          <span>Settings</span>
          {isActive('/settings') ? <span className={styles.activeRail} /> : null}
        </Link>

        <div className={styles.accountRow} title={collapsed ? accountName : undefined}>
          <span className={styles.accountAvatar}>{initials(accountName, accountEmail)}</span>
          <span className={styles.accountText}>
            <strong>{accountName}</strong>
            <small>{accountEmail}</small>
          </span>
          <button type="button" className={styles.signOutButton} aria-label="Sign out" title="Sign out" onClick={() => void signOut()}>
            <LogOut size={15} />
          </button>
        </div>

        <button
          type="button"
          className={styles.collapseButton}
          onClick={onCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          <span>Collapse sidebar</span>
        </button>
      </div>
    </aside>
  )
}
