'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await createClient().auth.signUp({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setDone(true)
  }

  if (done) return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-12 h-12 bg-accent/10 border border-accent/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-accent text-xl">✓</span>
        </div>
        <h2 className="text-lg font-bold mb-2">Check your email</h2>
        <p className="text-muted text-sm">We sent a confirmation link to <span className="text-text">{email}</span></p>
        <Link href="/login" className="btn-primary inline-block mt-6">Back to sign in</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 mb-6">
            <Image src="/favicon-32x32.png" alt="CopyPilot" width={24} height={24} className="w-6 h-6" />
            <span className="font-bold text-lg tracking-tight">CopyPilot</span>
          </div>
          <h1 className="text-2xl font-bold mb-1">Create account</h1>
          <p className="text-muted text-sm">Start producing SEO copy at scale</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="input-base" placeholder="you@example.com" required />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="input-base" placeholder="Min 6 characters" required minLength={6} />
          </div>
          {error && (
            <p className="text-error text-xs bg-error/10 border border-error/20 rounded-lg px-3 py-2">{error}</p>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-muted mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-accent hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
