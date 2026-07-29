import type { Metadata } from 'next'
import AioV2NewJobWorkspace from '@/components/aio-v2/AioV2NewJobWorkspace'

export const metadata: Metadata = { title: 'New AIO v2 Job' }

export default function AioV2NewJobPage() {
  return <AioV2NewJobWorkspace />
}

