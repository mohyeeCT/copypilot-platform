'use client'
import { Braces } from 'lucide-react'
import JobsListPage from '@/components/ui/JobsListPage'
import { schemaApi } from '@/lib/api/schema'

export const dynamic = 'force-dynamic'

export default function SchemaJobsPage() {
  return (
    <JobsListPage tool={{
      label:       'Schema Generator',
      newHref:     '/schema/jobs/new',
      jobHref:     (id) => `/schema/jobs/${id}`,
      icon:        Braces,
      accent:      '#4F9EFF',
      emptyTitle:  'No Schema Generator jobs yet',
      emptyDesc:   'Generate schema.org JSON-LD from URLs, page content, and optional SERP context.',
      listJobs:    (token) => schemaApi.listJobs(token),
      deleteJob:   (token, id) => schemaApi.deleteJob(token, id),
      duplicateJob:(token, id) => schemaApi.duplicateJob(token, id),
      renameJob:   (token, id, name) => schemaApi.renameJob(token, id, name),
    }} />
  )
}
