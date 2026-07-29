'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { createClient } from '@/lib/supabase'


const MINIMUM_PASSWORD_LENGTH = 12

export default function AcceptInvitePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function resolveInvitationSession() {
      const fragment = new URLSearchParams(window.location.hash.slice(1))
      const accessToken = fragment.get('access_token')
      const refreshToken = fragment.get('refresh_token')
      const invitationType = fragment.get('type')

      if (invitationType && invitationType !== 'invite') {
        if (!cancelled) setError('This link is not a CopyPilot invitation.')
        return
      }

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (sessionError) {
          if (!cancelled) setError('This invitation is invalid or has expired.')
          return
        }
        window.history.replaceState(
          null,
          '',
          `${window.location.pathname}${window.location.search}`,
        )
      }

      const { data, error: sessionError } = await supabase.auth.getSession()
      if (cancelled) return
      if (sessionError || !data.session) {
        setError('This invitation is invalid or has expired.')
        return
      }
      setReady(true)
    }

    void resolveInvitationSession()
    return () => {
      cancelled = true
    }
  }, [supabase])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (password.length < MINIMUM_PASSWORD_LENGTH) {
      setError(`Use at least ${MINIMUM_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirmation) {
      setError('Passwords do not match.')
      return
    }

    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (updateError) {
      setError('Your password could not be saved. Request a new invitation.')
      return
    }
    router.replace('/all-in-one-v2/jobs')
  }

  return (
    <main className="min-h-screen bg-bg flex items-center justify-center p-4">
      <section className="w-full max-w-sm">
        <Link href="/login" className="flex items-center gap-2.5 mb-8 w-fit">
          <Image
            src="/favicon-32x32.png"
            alt="CopyPilot"
            width={32}
            height={32}
            className="w-8 h-8 rounded-xl"
          />
          <span className="font-bold tracking-tight">CopyPilot</span>
        </Link>

        <div
          className="rounded-2xl p-6"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <h1 className="text-2xl font-bold tracking-tight">Finish your invitation</h1>
          <p className="text-sm mt-2 mb-6" style={{ color: 'var(--muted)' }}>
            Create a password to activate your invite-only CopyPilot account.
          </p>

          {!ready && !error && (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Verifying your secure invitation…
            </p>
          )}

          {error && (
            <div
              className="text-xs px-3 py-2.5 rounded-lg mb-4"
              style={{
                background: 'rgba(198,40,40,0.08)',
                border: '1px solid rgba(198,40,40,0.2)',
                color: 'var(--error)',
              }}
              role="alert"
            >
              {error}
            </div>
          )}

          {ready && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="invite-password" className="label-caps block mb-1.5">
                  Password
                </label>
                <input
                  id="invite-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="input-base"
                  minLength={MINIMUM_PASSWORD_LENGTH}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div>
                <label htmlFor="invite-confirmation" className="label-caps block mb-1.5">
                  Confirm password
                </label>
                <input
                  id="invite-confirmation"
                  type="password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="input-base"
                  minLength={MINIMUM_PASSWORD_LENGTH}
                  autoComplete="new-password"
                  required
                />
              </div>
              <button type="submit" className="btn-primary w-full py-2.5" disabled={saving}>
                {saving ? 'Saving…' : 'Activate account'}
              </button>
            </form>
          )}

          {!ready && error && (
            <Link href="/login" className="btn-primary inline-block mt-2">
              Back to sign in
            </Link>
          )}
        </div>
      </section>
    </main>
  )
}
