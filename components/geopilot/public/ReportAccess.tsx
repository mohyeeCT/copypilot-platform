'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { ArrowRight, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import styles from './PublicGeoPilotReport.module.css'

export default function ReportAccess() {
  const router = useRouter()
  const attempted = useRef(false)
  const tokenRef = useRef('')
  const [passcodeRequired, setPasscodeRequired] = useState(false)
  const [passcode, setPasscode] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function exchange(token: string, value?: string) {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/public/geopilot/report-exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...(value ? { passcode: value } : {}) }),
      })
      const payload = await response.json().catch(() => ({ detail: 'Report access is unavailable.' }))
      if (!response.ok) {
        if (payload.detail === 'passcode_required') {
          setPasscodeRequired(true)
          return
        }
        throw new Error(payload.detail || 'Report access was denied.')
      }
      router.replace(`/reports/geopilot/${payload.report_id}`)
    } catch (accessError) {
      setError(accessError instanceof Error ? accessError.message : 'Report access is unavailable.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (attempted.current) return
    attempted.current = true
    let token = ''
    try {
      token = decodeURIComponent(window.location.hash.slice(1))
    } catch {
      token = ''
    }
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`)
    if (token.length < 20 || token.length > 300) {
      setError('Report access denied')
      setLoading(false)
      return
    }
    tokenRef.current = token
    void exchange(token)
  // The fragment keeps the opaque token out of hosting access logs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (passcode.length >= 4 && tokenRef.current) void exchange(tokenRef.current, passcode)
  }

  return (
    <main className={styles.accessPage}>
      <section className={styles.accessPanel}>
        <div className={styles.accessBrand}><span>CP</span><strong>CopyPilot</strong></div>
        <div className={styles.accessIcon}>{passcodeRequired ? <LockKeyhole size={22} /> : <ShieldCheck size={22} />}</div>
        <h1>{passcodeRequired ? 'Enter report passcode' : 'Opening your report'}</h1>
        <p>{passcodeRequired ? 'This client report is protected by the account owner.' : 'Verifying this private, read-only link.'}</p>
        {passcodeRequired ? (
          <form onSubmit={submit}>
            <label htmlFor="report-passcode">Passcode</label>
            <input id="report-passcode" type="password" minLength={4} maxLength={128} autoFocus autoComplete="current-password" value={passcode} onChange={event => setPasscode(event.target.value)} />
            <button type="submit" disabled={loading || passcode.length < 4}>{loading ? <RefreshCw size={15} className={styles.spin} /> : <ArrowRight size={15} />}{loading ? 'Checking' : 'Open report'}</button>
          </form>
        ) : loading ? <RefreshCw size={22} className={styles.spin} /> : null}
        {error ? <div className={styles.accessError} role="alert">{error}</div> : null}
        <small>Read-only access / no CopyPilot account required</small>
      </section>
    </main>
  )
}
