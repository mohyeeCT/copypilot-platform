import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'GEOPilot UI Preview',
  robots: {
    index: false,
    follow: false,
  },
}

export default function UiPreviewLayout({ children }: { children: React.ReactNode }) {
  return children
}
