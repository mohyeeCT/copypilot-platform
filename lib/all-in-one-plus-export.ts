export interface AioPlusImproveExistingPlanSection {
  name?: string
  label?: string
  source_heading?: string
  planned_heading?: string
  source_order?: number
  structure_role?: string
  preservation_action?: string
  is_existing_section?: boolean
  is_seo_addition?: boolean
}

export interface AioPlusImproveExistingPlan {
  sections?: AioPlusImproveExistingPlanSection[]
}

function humanise(value?: string) {
  const text = (value || '').replace(/_/g, ' ').trim()
  const sentence = text ? `${text[0].toUpperCase()}${text.slice(1)}` : ''
  return sentence.replace(/\bseo\b/i, 'SEO')
}

function plannedSections(plan?: AioPlusImproveExistingPlan) {
  return (plan?.sections || []).filter(section =>
    section.name && (section.is_existing_section || section.is_seo_addition),
  )
}

export function selectAioPlusPageCopyEntries(
  sectionResults: Record<string, string>,
  plan?: AioPlusImproveExistingPlan,
) {
  const entries = Object.entries(sectionResults)
  const byName = new Map(entries)
  const selected: Array<[string, string]> = []

  for (const section of plannedSections(plan)) {
    const name = section.name || ''
    const text = byName.get(name)
    if (!text) continue
    selected.push([name, text])
    byName.delete(name)
  }

  return [...selected, ...byName.entries()]
}

export function buildAioPlusImplementationMapLines(
  plan?: AioPlusImproveExistingPlan,
) {
  const sections = plannedSections(plan)
  if (!sections.length) return []

  return [
    'Page Structure and Implementation Map',
    ...sections.map((section, index) => {
      const label = section.source_heading
        || section.planned_heading
        || section.label
        || section.name
        || 'Section'
      const order = section.source_order || index + 1
      const action = humanise(section.preservation_action || 'keep')
      const role = humanise(section.structure_role || (section.is_seo_addition ? 'seo_addition' : 'content'))
      return `${order}. ${label} | ${action} | ${role}`
    }),
  ]
}

export function normaliseAioPlusExportText(text: string) {
  return text
    .split(/\r?\n/)
    .map(line => {
      const trimmed = line.trim()
      const candidate = trimmed.replace(/^[-*]\s+/, '').trim()
      if (!/^image(?:\s+\d+(?:\s*,\s*\d+)*)?(?::.*)?$/i.test(candidate)) return line
      return `[Keep the existing image or media in this position: ${candidate}]`
    })
    .join('\n')
}
