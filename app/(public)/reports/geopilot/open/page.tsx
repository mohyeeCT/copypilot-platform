import type { Metadata } from 'next'
import ReportAccess from '@/components/geopilot/public/ReportAccess'

export const metadata: Metadata = {
  title: 'Open GEOPilot report | CopyPilot',
  robots: { index: false, follow: false, nocache: true },
}

export default function OpenGeoPilotReportPage() {
  return <ReportAccess />
}
