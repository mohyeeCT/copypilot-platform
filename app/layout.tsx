import type { Metadata } from 'next'
import { ToastProvider } from '@/components/ui/Toast'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', weight: ['400','500','600','700'], display: 'swap' })
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
    <html lang="en" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="bg-bg text-text font-sans antialiased">
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('cp-theme')||'light';document.documentElement.setAttribute('data-theme',t);})();` }} />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
