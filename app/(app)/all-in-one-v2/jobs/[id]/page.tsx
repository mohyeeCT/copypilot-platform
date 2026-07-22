import type { Metadata } from 'next'
import AioV2PlanWorkspace from '@/components/aio-v2/AioV2PlanWorkspace'

export const metadata: Metadata = {
  title: 'AIO v2 Page Plan',
}

export default async function AioV2JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AioV2PlanWorkspace jobId={id} />
}
