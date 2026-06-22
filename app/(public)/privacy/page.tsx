import Link from 'next/link'
import Image from 'next/image'

const sections = [
  {
    title: 'Information we collect',
    body: 'CopyPilot collects the account information needed to provide access, saved tool settings, job inputs, generated outputs, and basic operational logs. When you connect Google Search Console through OAuth, CopyPilot stores safe connection metadata such as the connected Google email and uses encrypted tokens server-side to request Search Console data.',
  },
  {
    title: 'How we use information',
    body: 'We use this information to authenticate users, run SEO copy workflows, save user preferences, troubleshoot jobs, protect the service from abuse, and provide Google Search Console context when you choose to enable it.',
  },
  {
    title: 'Google Search Console access',
    body: 'Google OAuth access is read-only and limited to Search Console data. CopyPilot may read accessible properties, permission levels, and query/page performance data for the connected Google account. You can disconnect Google access from CopyPilot settings, and you can also revoke access from your Google Account.',
  },
  {
    title: 'How we protect information',
    body: 'Sensitive credentials are stored server-side and are not returned to the browser. OAuth refresh tokens and service-account credentials are protected as server-only secrets. Access is limited to the systems required to operate CopyPilot.',
  },
  {
    title: 'Sharing and retention',
    body: 'CopyPilot does not sell user data. Data may be processed by infrastructure and API providers that support the service. We retain information as needed to provide CopyPilot, meet operational needs, and comply with applicable obligations.',
  },
  {
    title: 'Contact',
    body: 'For privacy questions or data requests, contact the CopyPilot operator using the support address listed in the Google OAuth consent screen.',
  },
]

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-bg text-text">
      <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
        <header className="mb-10">
          <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-text">
            <Image src="/favicon-32x32.png" alt="CopyPilot" width={24} height={24} className="h-6 w-6" />
            CopyPilot
          </Link>
          <p className="label-caps mt-8">Effective June 22, 2026</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
            This policy explains how CopyPilot handles information for its invite-only SEO copy
            production tools, including optional Google Search Console OAuth access.
          </p>
        </header>

        <div className="space-y-4">
          {sections.map((section) => (
            <section key={section.title} className="card p-5">
              <h2 className="text-base font-semibold">{section.title}</h2>
              <p className="mt-2 text-sm leading-7 text-muted">{section.body}</p>
            </section>
          ))}
        </div>

        <footer className="mt-10 flex flex-wrap gap-3 text-sm">
          <Link href="/login" className="btn-primary">
            Back to sign in
          </Link>
          <Link href="/home" className="btn-ghost">
            Visit homepage
          </Link>
        </footer>
      </div>
    </main>
  )
}
