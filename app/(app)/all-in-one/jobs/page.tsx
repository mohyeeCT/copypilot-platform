'use client'
import { aioApi } from '@/lib/api/all-in-one'
import JobsListPage from '@/components/ui/JobsListPage'
import { Layers } from 'lucide-react'

export default function Page() {
  return (
    <JobsListPage tool={{
      label:       'All in One',
      newHref:     '/all-in-one/jobs/new',
      jobHref:     (id) => `/all-in-one/jobs/${id}`,
      icon:        Layers,
      accent:      '#0A9B7A',
      emptyTitle:  'No All in One jobs yet',
      emptyDesc:   'Run the full pipeline — meta copy, FAQs, and page copy from a single job per URL.',
      listJobs:    (token) => aioApi.listJobs(token),
      deleteJob:   (token, id) => aioApi.deleteJob(token, id),
      duplicateJob:(token, id) => aioApi.duplicateJob(token, id),
      renameJob:   (token, id, name) => aioApi.renameJob(token, id, name),
    }} />
  )
}
