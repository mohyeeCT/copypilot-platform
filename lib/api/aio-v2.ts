export type AioV2Workflow = 'create_new' | 'improve_existing'
export type AioV2JobState =
  | 'planning_queued'
  | 'acquiring'
  | 'planning'
  | 'plan_ready'
  | 'generation_queued'
  | 'generating'
  | 'complete'
  | 'partial'
  | 'failed'
  | 'cancelling'
  | 'cancelled'

export type AioV2RequestedOutputs = {
  page_copy: boolean
  meta: boolean
  aio_faq: boolean
}

export type AioV2JobSummary = {
  job_id: string
  workflow: AioV2Workflow
  state: AioV2JobState
  client_profile_id: string
  target_url: string
  page_type: 'homepage' | 'service' | 'blog'
  guidance_profile_id: string
  guidance_profile_version: string
  depth_preference_id: 'standard'
  depth_preference_version: 'standard-v1'
  improve_approach: 'preserve' | 'hybrid' | 'research_led' | null
  provider: 'anthropic' | 'openai'
  model: 'claude-sonnet-5' | 'gpt-5.6-terra'
  requested_outputs: AioV2RequestedOutputs
  created_at: string
  updated_at: string
  archived_at: string | null
}

export type AioV2JobDetail = AioV2JobSummary & {
  niche_context: string
  page_goal: string
  manual_primary_keyword: string | null
}

export type AioV2Capabilities = {
  schema_version: 'aio-v2.capabilities.v1'
  workflows: Array<{ id: AioV2Workflow; label: string }>
  page_types: Array<{ id: 'homepage' | 'service' | 'blog'; label: string }>
  guidance_profiles: Array<{ id: string; label: string; version: string }>
  improve_approaches: Array<{ id: 'preserve' | 'hybrid' | 'research_led'; label: string }>
  default_improve_approach: 'hybrid'
  provider_models: Array<{
    provider: 'anthropic' | 'openai'
    model: 'claude-sonnet-5' | 'gpt-5.6-terra'
    available: boolean
  }>
  provider_calls_enabled: boolean
  max_job_cost_usd: number
  limits: {
    active_external_work_per_user: 1
    plan_ready_counts_as_active: false
    raw_source_retention_days: 30
    generated_artifact_retention_days: 30
    parsed_owned_page_max_characters: 250000
  }
}

export type AioV2JobCreate = {
  workflow: AioV2Workflow
  client_profile_id: string
  target_url: string
  page_type: 'homepage' | 'service' | 'blog'
  niche_context: string
  page_goal: string
  manual_primary_keyword: string | null
  requested_outputs: AioV2RequestedOutputs
  guidance_profile_id: string
  depth_preference_id: 'standard'
  improve_approach: 'preserve' | 'hybrid' | 'research_led' | null
  provider: 'anthropic' | 'openai'
  model: 'claude-sonnet-5' | 'gpt-5.6-terra'
}

export type AioV2JobCreated = {
  disposition: 'accepted' | 'idempotent_replay'
  operation_id: string
  task_id: string
  job: AioV2JobSummary
}

export type AioV2Operation = {
  operation_id: string
  operation_type: 'create_job' | 'plan_revision' | 'approve' | 'retry_planning' | 'retry_generation' | 'regeneration' | 'export' | 'duplicate' | 'replan' | 'cancel_primary' | 'archive' | 'cancel_operation'
  status: 'queued' | 'running' | 'complete' | 'failed' | 'cancelling' | 'cancelled'
  safe_error_code: string | null
  cancel_requested_at: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}

export type AioV2Event = {
  event_id: number
  event_code: string
  stage: string
  safe_metadata: Record<string, string | number | boolean | null>
  created_at: string
}
export type AioV2PlanAction = 'create' | 'keep' | 'refine' | 'expand' | 'merge' | 'reorder' | 'remove' | 'add'
export type AioV2KeywordRole = 'primary' | 'supporting' | 'lsi' | 'none'
export type AioV2UserLockedField =
  | 'action'
  | 'order'
  | 'included'
  | 'proposed_heading'
  | 'responsibility'
  | 'coverage_points'
  | 'target_words_min'
  | 'target_words_max'
  | 'cta_direction'

export type AioV2Warning = {
  code: string
  severity: 'info' | 'warning' | 'blocking'
  message: string
}

export type AioV2PlanSection = {
  id: string
  parent_id: string | null
  order: number
  included: boolean
  module_role: string
  action: AioV2PlanAction
  source_section_ids: string[]
  action_reason: string
  heading_level: 'h1' | 'h2' | 'h3' | 'none'
  current_heading: string | null
  proposed_heading: string | null
  responsibility: string
  audience_question: string | null
  coverage_points: string[]
  target_words_min: number
  target_words_max: number
  keyword_role: AioV2KeywordRole
  keyword_candidate_ids: string[]
  evidence_item_ids: string[]
  preserve_exact_node_ids: string[]
  preserve_fact_ids: string[]
  preserve_link_ids: string[]
  preserve_cta_ids: string[]
  proof_policy: string
  cta_direction: string | null
  user_locked_fields: AioV2UserLockedField[]
  planner_warnings: AioV2Warning[]
}

export type AioV2SourceDisposition = {
  source_section_id: string
  action: Exclude<AioV2PlanAction, 'create' | 'add'>
  destination_section_ids: string[]
  reason: string
  approved_removal: boolean
  preserved_node_ids: string[]
  preserved_fact_ids: string[]
  preserved_link_ids: string[]
  preserved_cta_ids: string[]
}

export type AioV2PagePlan = {
  schema_version: 'aio-v2.page-plan.v1'
  job_id: string
  plan_version: number
  workflow: AioV2Workflow
  approach: 'preserve' | 'hybrid' | 'research_led' | null
  source_snapshot_ids_and_hashes: Array<{ kind: string; id: string; sha256: string }>
  guidance_profile: { id: string; version: string }
  page_type: 'homepage' | 'service' | 'blog'
  niche_context: string
  primary_goal: string
  audience_need: string
  page_through_line: string
  metadata_plan: { requested: boolean; title_intent: string | null; description_intent: string | null }
  page_words_min: number
  page_words_max: number
  sections: AioV2PlanSection[]
  source_dispositions: AioV2SourceDisposition[]
  faq_plan: { requested: boolean; on_page_module_included: boolean; question_intents: string[] }
  validation_summary: {
    draft_valid: boolean
    approval_valid: boolean
    error_codes: string[]
    warning_codes: string[]
  }
  warnings: AioV2Warning[]
  created_at: string
  created_by: 'planner' | 'user_revision' | 'server'
}

export type AioV2PlanDetail = {
  plan_id: string
  plan_hash: string
  approved: boolean
  plan: AioV2PagePlan
  approval: {
    approval_hash: string
    approved_payload_hash: string
    acknowledged_removal_ids: string[]
    approved_by: string
    approved_at: string
  } | null
}

export type AioV2ApprovalQueued = {
  disposition: 'approved' | 'idempotent_replay'
  operation_id: string
  generation_task_id: string
  plan: AioV2PlanDetail
}

export type AioV2JobCancellation = {
  disposition: 'accepted' | 'idempotent_replay'
  state: 'cancelling' | 'cancelled'
  operation_id: string
}

export type AioV2PlanSummary = {
  plan_id: string
  plan_version: number
  plan_hash: string
  draft_valid: boolean
  approval_valid: boolean
  approved: boolean
  created_by: 'planner' | 'user_revision' | 'server'
  created_at: string
}

export type AioV2Sources = {
  job_id: string
  snapshots: Array<{
    kind: string
    id: string
    schema_version: string
    sha256: string
    captured_at: string
    warning_codes: string[]
  }>
  keyword_candidates: Array<{
    id: string
    keyword: string
    source: string | null
    primary: boolean
  }>
  owned_source_url: string | null
  owned_retained_characters: number | null
  owned_truncated: boolean | null
  owned_sections: Array<{
    id: string
    heading: string
    content_hash: string
    node_count: number
    fact_count: number
    link_count: number
    cta_count: number
  }>
  research_sources: Array<{
    id: string
    source_type: string
    canonical_url: string
    capture_provider: string
    captured_at: string
    content_hash: string
    warning_codes: string[]
  }>
  evidence_items: Array<{
    id: string
    classification: 'client_verified' | 'topic_verified' | 'competitor_pattern' | 'serp_signal' | 'unsupported'
    scope: string
    source_type: string
    source_url: string
    captured_excerpt: string
    eligibility_reason: string
    target_section_ids: string[]
    display_citation: string | null
  }>
}

export type AioV2SectionRevision = Pick<
  AioV2PlanSection,
  | 'id'
  | 'order'
  | 'included'
  | 'action'
  | 'proposed_heading'
  | 'responsibility'
  | 'audience_question'
  | 'coverage_points'
  | 'target_words_min'
  | 'target_words_max'
  | 'keyword_role'
  | 'keyword_candidate_ids'
  | 'evidence_item_ids'
  | 'preserve_exact_node_ids'
  | 'preserve_fact_ids'
  | 'preserve_link_ids'
  | 'preserve_cta_ids'
  | 'cta_direction'
  | 'user_locked_fields'
>

export type AioV2GeneratedSection = {
  schema_version: 'aio-v2.generated-section.v1'
  section_id: string
  ordinal: number
  action: AioV2PlanAction
  heading_level: 'h1' | 'h2' | 'h3' | 'none'
  approved_heading: string | null
  content_markdown: string
  content_hash: string
  word_count: number
  request_hash: string
  call_required: boolean
  source_section_ids: string[]
  preserved_node_ids: string[]
  preserved_fact_ids: string[]
  preserved_link_ids: string[]
  preserved_cta_ids: string[]
  evidence_item_ids: string[]
}

export type AioV2GeneratedMeta = {
  schema_version: 'aio-v2.generated-meta.v1'
  request_hash: string
  approved_h1: string
  title: string
  description: string
  title_characters: number
  description_characters: number
  evidence_item_ids: string[]
  content_hash: string
}

export type AioV2GeneratedFaq = {
  schema_version: 'aio-v2.generated-aio-faq.v1'
  request_hash: string
  items: Array<{
    id: string
    intent: string
    question: string
    answer: string
    evidence_item_ids: string[]
    content_hash: string
  }>
  content_hash: string
}

export type AioV2OutputBundle = {
  schema_version: 'aio-v2.generation-output-bundle.v1'
  job_id: string
  plan_id: string
  plan_hash: string
  approval_hash: string
  manifest_hash: string
  requested_outputs: AioV2RequestedOutputs
  page_content_hash: string | null
  meta: AioV2GeneratedMeta | null
  aio_faq: AioV2GeneratedFaq | null
  output_hash: string
}

export type AioV2OutputsView = {
  job_id: string
  state: AioV2JobState
  requested_outputs: AioV2RequestedOutputs
  final_available: boolean
  meta: AioV2GeneratedMeta | null
  aio_faq: AioV2GeneratedFaq | null
  bundle: AioV2OutputBundle | null
}

export type AioV2SectionsView = {
  job_id: string
  state: AioV2JobState
  plan_id: string
  manifest_hash: string
  requested_section_ids: string[]
  failed_section_ids: string[]
  sections: Array<{
    revision: number
    completed_at: string
    section: AioV2GeneratedSection
  }>
  page: {
    schema_version: 'aio-v2.assembled-page.v1'
    job_id: string
    plan_id: string
    manifest_hash: string
    sections: AioV2GeneratedSection[]
    content_hash: string
    total_word_count: number
  } | null
}

export type AioV2QaView = {
  job_id: string
  state: AioV2JobState
  available: boolean
  report: null | {
    schema_version: 'aio-v2.qa-report.v1'
    output_hash: string
    page_content_hash: string | null
    findings: Array<{
      code: string
      severity: 'info' | 'warning' | 'blocking'
      section_id: string | null
    }>
    blocking_count: number
    warning_count: number
    info_count: number
    semantic_truth_checked: false
    responsibility_fulfillment_checked: false
    report_hash: string
  }
}

export type AioV2ChangesView = {
  job_id: string
  state: AioV2JobState
  available: boolean
  change_set: null | {
    schema_version: 'aio-v2.change-set.v1'
    page_content_hash: string
    source_changes: Array<{
      source_section_id: string
      action: AioV2PlanAction
      destination_section_ids: string[]
      approved_removal: boolean
    }>
    final_section_changes: Array<{
      section_id: string
      action: AioV2PlanAction
      label: string
      source_section_ids: string[]
      content_hash: string
      word_count: number
    }>
    counts: Array<{ label: string; count: number }>
    change_set_hash: string
  }
}

export type AioV2ExportOperation = {
  operation_id: string
  job_id: string
  format: 'docx' | 'google_docs'
  google_auth_method: 'google_oauth' | 'service_account' | null
  status: 'queued' | 'running' | 'complete' | 'failed' | 'cancelling' | 'cancelled'
  safe_error_code: string | null
  artifact: null | {
    artifact_id: string
    operation_id: string
    format: 'docx' | 'google_docs'
    source_hash: string
    content_hash: string
    size_bytes: number
    mime_type: string
    google_auth_method: 'google_oauth' | 'service_account' | null
    access_url: string | null
    access_url_expires_at: string | null
    artifact_expires_at: string
    created_at: string
  }
  created_at: string
  finished_at: string | null
}

function baseUrl() {
  const configured = process.env.NEXT_PUBLIC_AIO_V2_API_URL?.replace(/\/+$/, '')
  if (!configured) throw new Error('AIO v2 is not connected in this environment.')
  return configured
}

const AIO_V2_RETRY_DELAYS_MS = [500, 1500]
const AIO_V2_RETRYABLE_STATUSES = new Set([502, 503, 504])

export class AioV2ApiError extends Error {
  readonly status: number
  readonly code: string | null

  constructor(message: string, status: number, code: string | null = null) {
    super(message)
    this.name = 'AioV2ApiError'
    this.status = status
    this.code = code
  }
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function request<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const safeRead = !options.method || options.method.toUpperCase() === 'GET'
  for (let attempt = 0; attempt <= AIO_V2_RETRY_DELAYS_MS.length; attempt += 1) {
    const response = await fetch(`${baseUrl()}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    })
    if (response.ok) return response.json() as Promise<T>

    const payload = await response.json().catch(() => ({}))
    if (
      safeRead
      && AIO_V2_RETRYABLE_STATUSES.has(response.status)
      && attempt < AIO_V2_RETRY_DELAYS_MS.length
    ) {
      await wait(AIO_V2_RETRY_DELAYS_MS[attempt])
      continue
    }
    throw new AioV2ApiError(
      payload?.error?.message || 'The AIO v2 request could not be completed.',
      response.status,
      typeof payload?.error?.code === 'string' ? payload.error.code : null,
    )
  }
  throw new AioV2ApiError('The AIO v2 request could not be completed.', 500)
}

export const aioV2Api = {
  getAccess: (token: string) =>
    request<{ enabled: boolean }>('/api/aio-v2/access', token, { cache: 'no-store' }),
  getCapabilities: (token: string) =>
    request<AioV2Capabilities>('/api/aio-v2/capabilities', token, { cache: 'no-store' }),
  listJobs: (token: string) =>
    request<{ jobs: AioV2JobSummary[] }>('/api/aio-v2/jobs', token, { cache: 'no-store' }),
  getJob: (token: string, jobId: string) =>
    request<AioV2JobDetail>(`/api/aio-v2/jobs/${encodeURIComponent(jobId)}`, token, { cache: 'no-store' }),
  createJob: (token: string, payload: AioV2JobCreate, idempotencyKey: string) =>
    request<AioV2JobCreated>('/api/aio-v2/jobs', token, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(payload),
    }),
  retryPlanning: (token: string, jobId: string, idempotencyKey: string) =>
    request<{ disposition: 'accepted' | 'idempotent_replay'; operation_id: string; task_id: string; job: AioV2JobSummary }>(
      `/api/aio-v2/jobs/${encodeURIComponent(jobId)}/retry-planning`,
      token,
      { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey } },
    ),
  archiveJob: (token: string, jobId: string, idempotencyKey: string) =>
    request<{ disposition: 'archived' | 'idempotent_replay'; job_id: string; archived_at: string }>(
      `/api/aio-v2/jobs/${encodeURIComponent(jobId)}/archive`,
      token,
      { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey } },
    ),
  duplicateJob: (token: string, jobId: string, idempotencyKey: string) =>
    request<AioV2JobCreated>(
      `/api/aio-v2/jobs/${encodeURIComponent(jobId)}/duplicate`,
      token,
      { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey } },
    ),
  replanJob: (token: string, jobId: string, idempotencyKey: string) =>
    request<{ disposition: 'accepted' | 'idempotent_replay'; operation_id: string; task_id: string; job: AioV2JobSummary }>(
      `/api/aio-v2/jobs/${encodeURIComponent(jobId)}/replan`,
      token,
      { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey } },
    ),
  regenerateSection: (
    token: string,
    jobId: string,
    sectionId: string,
    editorialCorrection: string | null,
    idempotencyKey: string,
  ) => request<{ disposition: 'accepted' | 'idempotent_replay'; operation_id: string; task_id: string; status: 'queued' | 'running' }>(
    `/api/aio-v2/jobs/${encodeURIComponent(jobId)}/sections/${encodeURIComponent(sectionId)}/regenerate`,
    token,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ editorial_correction: editorialCorrection }),
    },
  ),
  listEvents: (token: string, jobId: string) =>
    request<{ job_id: string; events: AioV2Event[] }>(`/api/aio-v2/jobs/${encodeURIComponent(jobId)}/events`, token, { cache: 'no-store' }),
  listOperations: (token: string, jobId: string) =>
    request<{ job_id: string; operations: AioV2Operation[] }>(`/api/aio-v2/jobs/${encodeURIComponent(jobId)}/operations`, token, { cache: 'no-store' }),
  cancelOperation: (token: string, jobId: string, operationId: string, idempotencyKey: string) =>
    request<{ disposition: 'accepted' | 'idempotent_replay'; operation_id: string; status: 'cancelling' | 'cancelled' }>(
      `/api/aio-v2/jobs/${encodeURIComponent(jobId)}/operations/${encodeURIComponent(operationId)}/cancel`,
      token,
      { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey } },
    ),
  getSources: (token: string, jobId: string) =>
    request<AioV2Sources>(`/api/aio-v2/jobs/${encodeURIComponent(jobId)}/sources`, token, { cache: 'no-store' }),
  listPlans: (token: string, jobId: string) =>
    request<{ plans: AioV2PlanSummary[] }>(`/api/aio-v2/jobs/${encodeURIComponent(jobId)}/plans`, token, { cache: 'no-store' }),
  getPlan: (token: string, jobId: string, version: number) =>
    request<AioV2PlanDetail>(`/api/aio-v2/jobs/${encodeURIComponent(jobId)}/plans/${version}`, token, { cache: 'no-store' }),
  revisePlan: (
    token: string,
    jobId: string,
    baseVersion: number,
    sections: AioV2SectionRevision[],
    idempotencyKey: string,
  ) => request<AioV2PlanDetail>(
    `/api/aio-v2/jobs/${encodeURIComponent(jobId)}/plans/${baseVersion}/revision`,
    token,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ sections }),
    },
  ),
  approveAndGenerate: (
    token: string,
    jobId: string,
    version: number,
    acknowledgedRemovalIds: string[],
    idempotencyKey: string,
  ) => request<AioV2ApprovalQueued>(
    `/api/aio-v2/jobs/${encodeURIComponent(jobId)}/plans/${version}/approve-and-generate`,
    token,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ acknowledged_removal_ids: acknowledgedRemovalIds }),
    },
  ),
  cancelJob: (
    token: string,
    jobId: string,
    idempotencyKey: string,
  ) => request<AioV2JobCancellation>(
    `/api/aio-v2/jobs/${encodeURIComponent(jobId)}/cancel`,
    token,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
    },
  ),
  getOutputs: (token: string, jobId: string) =>
    request<AioV2OutputsView>(`/api/aio-v2/jobs/${encodeURIComponent(jobId)}/outputs`, token, { cache: 'no-store' }),
  getSections: (token: string, jobId: string) =>
    request<AioV2SectionsView>(`/api/aio-v2/jobs/${encodeURIComponent(jobId)}/sections`, token, { cache: 'no-store' }),
  getQa: (token: string, jobId: string) =>
    request<AioV2QaView>(`/api/aio-v2/jobs/${encodeURIComponent(jobId)}/qa`, token, { cache: 'no-store' }),
  getChanges: (token: string, jobId: string) =>
    request<AioV2ChangesView>(`/api/aio-v2/jobs/${encodeURIComponent(jobId)}/changes`, token, { cache: 'no-store' }),
  listExports: (token: string, jobId: string) =>
    request<{ job_id: string; exports: AioV2ExportOperation[] }>(`/api/aio-v2/jobs/${encodeURIComponent(jobId)}/exports`, token, { cache: 'no-store' }),
  requestExport: (
    token: string,
    jobId: string,
    exportRequest: {
      format: 'docx' | 'google_docs'
      google_auth_method: 'google_oauth' | 'service_account' | null
    },
    idempotencyKey: string,
  ) => request<AioV2ExportOperation>(
    `/api/aio-v2/jobs/${encodeURIComponent(jobId)}/exports`,
    token,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(exportRequest),
    },
  ),
}

export function toAioV2Revision(section: AioV2PlanSection): AioV2SectionRevision {
  return {
    id: section.id,
    order: section.order,
    included: section.included,
    action: section.action,
    proposed_heading: section.proposed_heading,
    responsibility: section.responsibility,
    audience_question: section.audience_question,
    coverage_points: section.coverage_points,
    target_words_min: section.target_words_min,
    target_words_max: section.target_words_max,
    keyword_role: section.keyword_role,
    keyword_candidate_ids: section.keyword_candidate_ids,
    evidence_item_ids: section.evidence_item_ids,
    preserve_exact_node_ids: section.preserve_exact_node_ids,
    preserve_fact_ids: section.preserve_fact_ids,
    preserve_link_ids: section.preserve_link_ids,
    preserve_cta_ids: section.preserve_cta_ids,
    cta_direction: section.cta_direction,
    user_locked_fields: section.user_locked_fields,
  }
}
