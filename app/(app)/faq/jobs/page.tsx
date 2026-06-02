'use client'
import { faqApi } from '@/lib/api/faq'
import JobsListPage from '@/components/ui/JobsListPage'
import { HelpCircle } from 'lucide-react'

export default function Page() {
  return (
    <JobsListPage tool={{
      label:       'FAQ Copy',
      newHref:     '/faq/jobs/new',
      jobHref:     (id) => `/faq/jobs/${id}`,
      icon:        HelpCircle,
      accent:      '#818CF8',
      emptyTitle:  'No FAQ jobs yet',
      emptyDesc:   'Add URLs, configure settings, and generate FAQ copy with Schema.org JSON-LD at scale.',
      listJobs:    (token) => faqApi.listJobs(token),
      deleteJob:   (token, id) => faqApi.deleteJob(token, id),
      duplicateJob:(token, id) => faqApi.duplicateJob(token, id),
      renameJob:   (token, id, name) => faqApi.renameJob(token, id, name),
    }} />
  )
}
