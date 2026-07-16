import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { GEOPILOT_API_BASE } from '@/lib/api/geopilot'
import PublicGeoPilotReport from '@/components/geopilot/public/PublicGeoPilotReport'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'GEOPilot visibility report | CopyPilot',
  robots: { index: false, follow: false, nocache: true },
}

export default async function GeoPilotReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()
  const session = cookieStore.get(`cp_gp_report_${id}`)?.value || ''
  if (!session) return <PublicGeoPilotReport error="This report session has expired. Open the original report link again." />
  try {
    const response = await fetch(`${GEOPILOT_API_BASE}/api/geopilot/public/report-links/${encodeURIComponent(id)}`, {
      headers: { 'X-GEOPILOT-REPORT-SESSION': session },
      cache: 'no-store',
    })
    if (!response.ok) return <PublicGeoPilotReport error="This report is no longer available or the session has expired." />
    const report = await response.json()
    return <PublicGeoPilotReport report={report} />
  } catch {
    return <PublicGeoPilotReport error="This report is temporarily unavailable. Please try again shortly." />
  }
}
