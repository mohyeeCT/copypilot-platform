'use client'
import { aioPlusApi } from '@/lib/api/all-in-one-plus'
import JobsListPage from '@/components/ui/JobsListPage'
import { Layers } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <JobsListPage tool={{
      label:       'AIO+',
      newHref:     '/all-in-one-plus/jobs/new',
      jobHref:     (id) => `/all-in-one-plus/jobs/${id}`,
      icon:        Layers,
      accent:      '#0B7A5C',
      emptyTitle:  'No AIO+ jobs yet',
      emptyDesc:   'Run the full pipeline — meta copy, FAQs, and page copy from a single job per URL.',
      variant:     'aio',
      description: 'Coordinate meta, FAQ, and page-copy production in one workflow.',
      supportsClientProfiles: true,
      listJobs:    (token, clientProfileId) => aioPlusApi.listJobs(token, clientProfileId),
      deleteJob:   (token, id) => aioPlusApi.deleteJob(token, id),
      duplicateJob:(token, id) => aioPlusApi.duplicateJob(token, id),
      renameJob:   (token, id, name) => aioPlusApi.renameJob(token, id, name),
    }} />
  )
}
