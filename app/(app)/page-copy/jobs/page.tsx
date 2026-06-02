'use client'
import { pageCopyApi } from '@/lib/api/page-copy'
import JobsListPage from '@/components/ui/JobsListPage'
import { BookOpen } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <JobsListPage tool={{
      label:       'Page Copy',
      newHref:     '/page-copy/jobs/new',
      jobHref:     (id) => `/page-copy/jobs/${id}`,
      icon:        BookOpen,
      accent:      '#F472B6',
      emptyTitle:  'No Page Copy jobs yet',
      emptyDesc:   'Generate full-page copy across 13 templates — blogs, service pages, homepages, product pages, and more.',
      listJobs:    (token) => pageCopyApi.listJobs(token),
      deleteJob:   (token, id) => pageCopyApi.deleteJob(token, id),
      duplicateJob:(token, id) => pageCopyApi.duplicateJob(token, id),
      renameJob:   (token, id, name) => pageCopyApi.renameJob(token, id, name),
    }} />
  )
}
