'use client'
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => dismiss(id), 3500)
  }, [dismiss])

  const success = useCallback((m: string) => toast(m, 'success'), [toast])
  const error   = useCallback((m: string) => toast(m, 'error'), [toast])
  const info    = useCallback((m: string) => toast(m, 'info'), [toast])

  const icons = { success: CheckCircle, error: AlertCircle, info: Info }
  const colors = {
    success: { bg: 'var(--accent-subtle)', border: 'var(--accent)', icon: 'var(--accent)' },
    error:   { bg: 'rgba(var(--error-rgb,198,40,40),0.08)', border: 'var(--error)', icon: 'var(--error)' },
    info:    { bg: 'var(--surface-raised)', border: 'var(--border)', icon: 'var(--muted)' },
  }

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      {children}

      {/* Toast container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 340 }}>
        {toasts.map(t => {
          const Icon = icons[t.type]
          const c    = colors[t.type]
          return (
            <div
              key={t.id}
              className="flex items-start gap-3 px-3.5 py-3 rounded-xl text-sm pointer-events-auto"
              style={{
                background: c.bg,
                border: `1px solid ${c.border}`,
                color: 'var(--text)',
                boxShadow: 'var(--shadow-lg)',
                animation: 'toast-in 0.2s ease-out',
              }}
            >
              <Icon size={15} style={{ color: c.icon, flexShrink: 0, marginTop: 1 }} />
              <span className="flex-1 leading-snug">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 transition-opacity opacity-50 hover:opacity-100"
                style={{ color: 'var(--muted)', marginTop: 1 }}
              >
                <X size={13} />
              </button>
            </div>
          )
        })}
      </div>

      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
