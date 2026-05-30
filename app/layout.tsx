import type { Metadata } from 'next'
import { Syne, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const syne = Syne({ subsets: ['latin'], variable: '--font-syne', display: 'swap' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'CopyPilot', template: '%s — CopyPilot' },
  description: 'AI-powered SEO copy production tools for agencies.',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
    shortcut: '/favicon.ico',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${mono.variable}`}>
      <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('cp-theme')||'light';document.documentElement.setAttribute('data-theme',t);})();` }} />
      <body className="bg-bg text-text font-sans antialiased">{children}</body>
    </html>
  )
}
