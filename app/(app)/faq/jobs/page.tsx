'use client'
import { faqApi } from '@/lib/api/faq'
import JobsListPage from '@/components/ui/JobsListPage'
import { HelpCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <JobsListPage tool={{
      label:       'FAQ Copy',
      variant:     'faq',
      description:'Generate, review, and export search-informed FAQ copy and JSON-LD schema.',
      newHref:     '/faq/jobs/new',
      jobHref:     (id) => `/faq/jobs/${id}`,
      icon:        HelpCircle,
      accent:      '#818CF8',
      emptyTitle:  'No FAQ jobs yet',
      emptyDesc:   'Add URLs, configure settings, and generate FAQ copy with Schema.org JSON-LD at scale.',
      supportsClientProfiles: true,
      listJobs:    (token, clientProfileId) => faqApi.listJobs(token, clientProfileId),
      deleteJob:   (token, id) => faqApi.deleteJob(token, id),
      duplicateJob:(token, id) => faqApi.duplicateJob(token, id),
      renameJob:   (token, id, name) => faqApi.renameJob(token, id, name),
    }} />
  )
}
