'use client'
import { introApi } from '@/lib/api/intro'
import JobsListPage from '@/components/ui/JobsListPage'
import { FileText } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <JobsListPage tool={{
      label:       'Page Intro',
      newHref:     '/intro/jobs/new',
      jobHref:     (id) => `/intro/jobs/${id}`,
      icon:        FileText,
      accent:      '#60A5FA',
      emptyTitle:  'No Intro jobs yet',
      emptyDesc:   'Generate keyword-optimised intro paragraphs for existing pages using GSC and DFS data.',
      variant:     'intro',
      description: 'Create and review page introductions across client URLs.',
      supportsClientProfiles: true,
      listJobs:    (token, clientProfileId) => introApi.listJobs(token, clientProfileId),
      deleteJob:   (token, id) => introApi.deleteJob(token, id),
      duplicateJob:(token, id) => introApi.duplicateJob(token, id),
      renameJob:   (token, id, name) => introApi.renameJob(token, id, name),
    }} />
  )
}
