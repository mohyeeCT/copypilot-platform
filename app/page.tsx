'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function RootPage() {
  const router = useRouter()
  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => {
      router.replace(data.session ? '/faq/jobs' : '/login')
    })
  }, [router])

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
