'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bot,
  Braces,
  BriefcaseBusiness,
  ChevronRight,
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

type SubmenuItem = {
  href: string
  label: string
}

type Tool = {
  href: string
  label: string
  icon: React.ElementType
  submenu?: SubmenuItem[]
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
      {
        href: '/brand-mentions',
        label: 'Brand Pulse',
        icon: Radar,
        submenu: [
          { href: '/brand-mentions', label: 'Profiles' },
          { href: '/brand-mentions/new', label: 'New profile' },
        ],
      },
      {
        href: '/geopilot',
        label: 'GEOPilot',
        icon: Bot,
        submenu: [
          { href: '/geopilot', label: 'Client profiles' },
          { href: '/geopilot/new', label: 'New profile' },
        ],
      },
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

function NavItem({
  tool,
  active,
  pathname,
  compactSubmenu,
  submenuOpen,
  onToggleSubmenu,
  onNavigate,
}: {
  tool: Tool
  active: boolean
  pathname: string
  compactSubmenu: boolean
  submenuOpen: boolean
  onToggleSubmenu: () => void
  onNavigate: () => void
}) {
  const Icon = tool.icon
  const submenuId = useId()
  const rowRef = useRef<HTMLDivElement>(null)
  const [flyoutPosition, setFlyoutPosition] = useState<{ top: number; left: number } | null>(null)
  const submenuItems = tool.submenu ?? []
  const hasSubmenu = submenuItems.length > 0
  const quickActionHref = !hasSubmenu && tool.href.endsWith('/jobs')
    ? tool.href.replace('/jobs', '/jobs/new')
    : undefined

  useEffect(() => {
    if (!compactSubmenu || !submenuOpen || !rowRef.current) {
      setFlyoutPosition(null)
      return
    }

    const flyoutWidth = 196
    const flyoutHeight = 48 + submenuItems.length * 32
    const viewportGap = 8

    function updatePosition() {
      const rect = rowRef.current?.getBoundingClientRect()
      if (!rect) return

      const preferredLeft = rect.right + viewportGap
      const left = preferredLeft + flyoutWidth <= window.innerWidth - viewportGap
        ? preferredLeft
        : Math.max(viewportGap, rect.left - flyoutWidth - viewportGap)
      const top = Math.min(
        Math.max(viewportGap, rect.top - 4),
        Math.max(viewportGap, window.innerHeight - flyoutHeight - viewportGap),
      )

      setFlyoutPosition({ top, left })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [compactSubmenu, submenuItems.length, submenuOpen])

  function renderSubmenuLinks(focusable: boolean) {
    return submenuItems.map(item => {
      const itemActive = item.href === tool.href
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(`${item.href}/`)
      return (
        <Link
          key={item.href}
          href={item.href}
          className={clsx(styles.submenuLink, itemActive && styles.submenuLinkActive)}
          aria-current={itemActive ? 'page' : undefined}
          tabIndex={focusable ? undefined : -1}
          onClick={onNavigate}
        >
          {item.label}
        </Link>
      )
    })
  }

  const compactFlyout = compactSubmenu
    && submenuOpen
    && flyoutPosition
    && typeof document !== 'undefined'
    ? createPortal(
        <div
          id={submenuId}
          className={styles.submenuFlyout}
          style={flyoutPosition}
          data-sidebar-submenu={tool.href}
          aria-label={`${tool.label} submenu`}
        >
          <p className={styles.submenuFlyoutLabel}>{tool.label}</p>
          <div className={styles.submenuList}>{renderSubmenuLinks(true)}</div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <div className={styles.navItemWrap} data-sidebar-submenu={hasSubmenu ? tool.href : undefined}>
        <div className={styles.navItemRow} ref={rowRef}>
          <Link
            href={tool.href}
            className={clsx(
              styles.navItem,
              hasSubmenu && styles.navItemWithSubmenu,
              active && styles.navItemActive,
            )}
            title={compactSubmenu ? tool.label : undefined}
            onClick={onNavigate}
          >
            <Icon size={17} />
            <span>{tool.label}</span>
            {active ? <span className={styles.activeRail} /> : null}
          </Link>
          {hasSubmenu ? (
            <button
              type="button"
              className={clsx(styles.submenuToggle, submenuOpen && styles.submenuToggleOpen)}
              aria-label={`${submenuOpen ? 'Hide' : 'Show'} ${tool.label} menu`}
              aria-expanded={submenuOpen}
              aria-controls={!compactSubmenu || submenuOpen ? submenuId : undefined}
              title={`${submenuOpen ? 'Hide' : 'Show'} ${tool.label} menu`}
              onClick={onToggleSubmenu}
            >
              <ChevronRight size={14} />
            </button>
          ) : null}
          {active && quickActionHref ? (
            <Link
              href={quickActionHref}
              className={styles.quickAction}
              aria-label={`New ${tool.label}`}
              title={`New ${tool.label}`}
              onClick={event => {
                event.stopPropagation()
                onNavigate()
              }}
            >
              <Plus size={13} />
            </Link>
          ) : null}
        </div>

        {hasSubmenu && !compactSubmenu ? (
          <div
            id={submenuId}
            className={clsx(styles.submenu, submenuOpen && styles.submenuOpen)}
            aria-hidden={!submenuOpen}
          >
            <div className={styles.submenuClip}>
              <div className={styles.submenuList}>{renderSubmenuLinks(submenuOpen)}</div>
            </div>
          </div>
        ) : null}
      </div>
      {compactFlyout}
    </>
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
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null)
  const [mobileViewport, setMobileViewport] = useState(false)
  const accountName = account?.name || 'CopyPilot user'
  const accountEmail = account?.email || 'Agency workspace'
  const workspaceLabel = getWorkspaceLabel(accountName, accountEmail)
  const compactSubmenu = collapsed && !mobileViewport

  useEffect(() => {
    const query = window.matchMedia('(max-width: 900px)')
    const updateViewport = () => setMobileViewport(query.matches)
    updateViewport()
    query.addEventListener('change', updateViewport)
    return () => query.removeEventListener('change', updateViewport)
  }, [])

  useEffect(() => {
    setOpenSubmenu(null)
  }, [pathname])

  useEffect(() => {
    if (!openSubmenu) return

    function handlePointerDown(event: PointerEvent) {
      if (!(event.target instanceof Element)) return
      const owner = event.target.closest('[data-sidebar-submenu]')
      if (owner?.getAttribute('data-sidebar-submenu') !== openSubmenu) setOpenSubmenu(null)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenSubmenu(null)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openSubmenu])

  function isActive(href: string) {
    return pathname.startsWith(href)
  }

  function handleNavigate() {
    setOpenSubmenu(null)
    onClose?.()
  }

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/login')
  }

  return (
    <aside className={clsx(styles.sidebar, collapsed && styles.collapsed)}>
      <div className={styles.brandRow}>
        <Link href="/" className={styles.brand} aria-label="CopyPilot home" onClick={handleNavigate}>
          <Image src="/favicon-32x32.png" alt="" width={28} height={28} className={styles.logo} />
          <span className={styles.brandName}>CopyPilot</span>
        </Link>
        <button type="button" className={styles.mobileClose} aria-label="Close navigation" onClick={handleNavigate}>
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
                pathname={pathname}
                compactSubmenu={compactSubmenu}
                submenuOpen={openSubmenu === tool.href}
                onToggleSubmenu={() => setOpenSubmenu(current => current === tool.href ? null : tool.href)}
                onNavigate={handleNavigate}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className={styles.sidebarFooter}>
        <Link href="/settings" className={clsx(styles.navItem, isActive('/settings') && styles.navItemActive)} title={collapsed ? 'Settings' : undefined} onClick={handleNavigate}>
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
          onClick={() => {
            setOpenSubmenu(null)
            onCollapse?.()
          }}
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
