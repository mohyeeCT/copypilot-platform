'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ChevronRight, Menu, Moon, Sun } from 'lucide-react'
import clsx from 'clsx'
import { createClient } from '@/lib/supabase'
import Sidebar from './Sidebar'
import styles from './AppLayout.module.css'

type Theme = 'light' | 'dark'

type Account = {
  name: string
  email: string
}

export default function AppLayout({ children, title }: { children: React.ReactNode; title?: string }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [theme, setTheme] = useState<Theme>('light')
  const [account, setAccount] = useState<Account>()

  useEffect(() => {
    const savedTheme = localStorage.getItem('cp-theme') as Theme | null
    const resolvedTheme = savedTheme || 'light'
    setTheme(resolvedTheme)
    document.documentElement.setAttribute('data-theme', resolvedTheme)

    const savedSidebar = localStorage.getItem('cp-sidebar-collapsed') === 'true'
    setSidebarCollapsed(savedSidebar)

    createClient().auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace('/login')
        return
      }

      const metadata = data.session.user.user_metadata as Record<string, unknown>
      const email = data.session.user.email || ''
      const name = String(metadata.full_name || metadata.name || email.split('@')[0] || 'CopyPilot user')
      setAccount({ name, email: email || 'Agency workspace' })
      setReady(true)
    })
  }, [router])

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('cp-theme', next)
  }

  function toggleSidebar() {
    setSidebarCollapsed(current => {
      const next = !current
      localStorage.setItem('cp-sidebar-collapsed', String(next))
      return next
    })
  }

  if (!ready) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingContent}>
          <div className={styles.loadingLogo}>
            <Image src="/favicon-32x32.png" alt="CopyPilot" width={32} height={32} />
          </div>
          <div className={styles.spinner} aria-label="Loading CopyPilot" />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      {sidebarOpen ? (
        <button type="button" className={styles.scrim} aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />
      ) : null}

      <div className={clsx(styles.sidebarDock, sidebarOpen && styles.sidebarDockOpen)}>
        <Sidebar
          account={account}
          collapsed={sidebarCollapsed}
          onClose={() => setSidebarOpen(false)}
          onCollapse={toggleSidebar}
        />
      </div>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.topbarStart}>
            <button type="button" className={styles.mobileMenu} aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>
              <Menu size={18} />
            </button>
            <div className={styles.breadcrumbs} aria-label="Breadcrumb">
              <span>CopyPilot</span>
              <ChevronRight size={13} />
              <strong>{title || 'Workspace'}</strong>
            </div>
          </div>
          <div className={styles.topbarActions}>
            <button
              type="button"
              className={styles.themeButton}
              aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'}
              title={theme === 'dark' ? 'Use light theme' : 'Use dark theme'}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </header>

        <main className={styles.main}>{children}</main>
      </div>
    </div>
  )
}
