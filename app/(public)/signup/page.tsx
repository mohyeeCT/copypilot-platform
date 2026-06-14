import Link from 'next/link'
import Image from 'next/image'

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center gap-2 mb-6">
          <Image src="/favicon-32x32.png" alt="CopyPilot" width={24} height={24} className="w-6 h-6" />
          <span className="font-bold text-lg tracking-tight">CopyPilot</span>
        </div>
        <h1 className="text-2xl font-bold mb-2">Invite-only access</h1>
        <p className="text-muted text-sm leading-relaxed">
          CopyPilot accounts are created by invitation only.
        </p>
        <Link href="/login" className="btn-primary inline-block mt-6">Back to sign in</Link>
      </div>
    </div>
  )
}
