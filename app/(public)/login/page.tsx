'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { HelpCircle, FileText, Tag, BookOpen, Layers, ArrowRight } from 'lucide-react'

const tools = [
  { icon: HelpCircle, label: 'FAQ Copy',   desc: 'Schema.org JSON-LD at scale', accent: '#818CF8' },
  { icon: Tag,        label: 'Meta Copy',   desc: 'Title tags and H1s from GSC data', accent: '#F59E0B' },
  { icon: BookOpen,   label: 'Page Copy',   desc: '13 page templates, section-by-section', accent: '#F472B6' },
  { icon: Layers,     label: 'All in One',  desc: 'Meta + FAQs + full copy, one pipeline', accent: '#0A9B7A' },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await createClient().auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    router.push('/faq/jobs')
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>

      {/* Left panel — form */}
      <div className="flex-1 flex flex-col justify-center px-8 py-12 max-w-md">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 mb-12 group w-fit">
          <div className="w-8 h-8 rounded-xl overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <img src="/favicon-32x32.png" alt="CopyPilot" className="w-full h-full object-cover" />
          </div>
          <span style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)' }}>CopyPilot</span>
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight mb-1.5">Sign in</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Welcome back to your workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-caps block mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input-base"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label-caps block mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input-base"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div
              className="text-xs px-3 py-2.5 rounded-lg"
              style={{
                background: 'rgba(198,40,40,0.08)',
                border: '1px solid rgba(198,40,40,0.2)',
                color: 'var(--error)',
              }}
            >
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 mt-1">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="text-sm mt-6" style={{ color: 'var(--muted)' }}>
          No account?{' '}
          <Link href="/signup" className="font-medium" style={{ color: 'var(--accent)' }}>
            Request access
          </Link>
        </p>
      </div>

      {/* Right panel — tool preview (hidden on mobile) */}
      <div
        className="hidden md:flex flex-1 flex-col justify-center px-12 py-12"
        style={{
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
        }}
      >
        <div className="max-w-sm">
          <p className="label-caps mb-5">What you can generate</p>
          <div className="space-y-3">
            {tools.map(({ icon: Icon, label, desc, accent }) => (
              <div
                key={label}
                className="flex items-start gap-3.5 p-3.5 rounded-xl transition-colors"
                style={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-xs)',
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: `${accent}15`, border: `1px solid ${accent}25` }}
                >
                  <Icon size={14} style={{ color: accent }} />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight">{label}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div
            className="mt-6 p-4 rounded-xl flex items-center gap-3"
            style={{ background: 'var(--accent-subtle)', border: '1px solid rgba(10,155,122,0.3)' }}
          >
            <p className="text-xs flex-1 leading-relaxed" style={{ color: 'var(--text)' }}>
              Built for SEO teams and agencies running copy production at scale. One pipeline, multiple outputs.
            </p>
            <ArrowRight size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          </div>
        </div>
      </div>
    </div>
  )
}
