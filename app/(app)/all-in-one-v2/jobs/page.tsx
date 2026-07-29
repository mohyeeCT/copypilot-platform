import type { Metadata } from 'next'
import AioV2JobsWorkspace from '@/components/aio-v2/AioV2JobsWorkspace'

export const metadata: Metadata = { title: 'AIO v2 Jobs' }

export default function AioV2JobsPage() {
  return <AioV2JobsWorkspace />
}

