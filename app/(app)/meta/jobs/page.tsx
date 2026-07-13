'use client'
import { metaApi } from '@/lib/api/meta'
import JobsListPage from '@/components/ui/JobsListPage'
import { Tag } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <JobsListPage tool={{
      label:       'Meta Copy',
      variant:     'meta',
      description:'Create, review, and export title tags, meta descriptions, and optimised H1s.',
      newHref:     '/meta/jobs/new',
      jobHref:     (id) => `/meta/jobs/${id}`,
      icon:        Tag,
      accent:      '#F59E0B',
      emptyTitle:  'No Meta Copy jobs yet',
      emptyDesc:   'Generate title tags, meta descriptions, and optimised H1s at scale with keyword scoring.',
      listJobs:    (token) => metaApi.listJobs(token),
      deleteJob:   (token, id) => metaApi.deleteJob(token, id),
      duplicateJob:(token, id) => metaApi.duplicateJob(token, id),
      renameJob:   (token, id, name) => metaApi.renameJob(token, id, name),
    }} />
  )
}
