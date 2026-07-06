'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import Sidebar from './Sidebar'
import { Menu } from 'lucide-react'

export default function AppLayout({ children, title }: { children: React.ReactNode; title?: string }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/login')
      else setReady(true)
    })
  }, [router])

  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-xl overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <Image src="/favicon-32x32.png" alt="CopyPilot" width={32} height={32} className="w-full h-full object-cover" />
        </div>
        <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
      </div>
    </div>
  )

  return (
    <div
      className="flex gap-2.5 p-3 md:gap-0 md:p-0"
      style={{
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg)',
      }}
    >
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-20 md:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`
          fixed top-0 left-0 h-full z-30 transition-transform duration-200 ease-out
          md:static md:translate-x-0 md:z-auto md:flex md:flex-shrink-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile top bar */}
          <div
            className="flex items-center gap-3 px-4 py-3 md:hidden"
            style={{ background: 'var(--sidebar-bg)', borderBottom: '1px solid var(--border)' }}
          >
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1 rounded-lg transition-colors"
              style={{ color: 'var(--muted)' }}
            >
              <Menu size={18} />
            </button>
            <span className="font-semibold text-sm">{title || 'CopyPilot'}</span>
          </div>

          <main className="flex-1 p-5 md:p-8" style={{ overflowY: 'auto' }}>{children}</main>
        </div>
    </div>
  )
}
