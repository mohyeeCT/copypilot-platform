import { NextResponse } from 'next/server'
import { GEOPILOT_API_BASE } from '@/lib/api/geopilot'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { token?: unknown; passcode?: unknown }
  const token = typeof body.token === 'string' ? body.token : ''
  const passcode = typeof body.passcode === 'string' ? body.passcode : undefined
  if (token.length < 20 || token.length > 300 || (passcode && passcode.length > 128)) {
    return NextResponse.json({ detail: 'Report access denied' }, { status: 400 })
  }
  let upstream: Response
  try {
    upstream = await fetch(`${GEOPILOT_API_BASE}/api/geopilot/public/report-links/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...(passcode ? { passcode } : {}) }),
      cache: 'no-store',
    })
  } catch {
    return NextResponse.json({ detail: 'Report access is temporarily unavailable' }, { status: 503 })
  }
  const payload = await upstream.json().catch(() => ({ detail: 'Report access is temporarily unavailable' }))
  if (!upstream.ok) {
    const passcodeRequired = upstream.status === 401 && payload.detail === 'passcode_required'
    const rateLimited = upstream.status === 429
    const unavailable = upstream.status >= 500 || upstream.status === 404
    return NextResponse.json(
      {
        detail: passcodeRequired
          ? 'passcode_required'
          : rateLimited
            ? 'Too many report access attempts. Please wait and try again.'
            : unavailable
              ? 'Report access is temporarily unavailable'
              : 'Report access denied',
      },
      { status: passcodeRequired ? 401 : rateLimited ? 429 : unavailable ? 503 : 401 },
    )
  }
  const reportId = String(payload.report_link?.id || '')
  const sessionToken = String(payload.session_token || '')
  const expiresAt = Date.parse(String(payload.session_expires_at || ''))
  if (!reportId || !sessionToken || !Number.isFinite(expiresAt)) {
    return NextResponse.json({ detail: 'Report access is temporarily unavailable' }, { status: 502 })
  }
  const response = NextResponse.json({ report_id: reportId })
  response.cookies.set(`cp_gp_report_${reportId}`, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: `/reports/geopilot/${reportId}`,
    maxAge: Math.max(60, Math.floor((expiresAt - Date.now()) / 1000)),
  })
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}
