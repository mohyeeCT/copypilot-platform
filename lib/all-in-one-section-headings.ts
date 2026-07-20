interface PageCopySectionHeadingInput {
  isVersionedPageCopy: boolean
  generatedHeading: string
  plannedHeading?: string
  safeFallbackHeading: string
  evidenceSparse: boolean
  headingless?: boolean
}

interface PageCopySectionHeadingSelection {
  displayHeading: string
  exportHeading: string
}

export function selectPageCopySectionHeadings({
  isVersionedPageCopy,
  generatedHeading,
  plannedHeading,
  safeFallbackHeading,
  evidenceSparse,
  headingless = false,
}: PageCopySectionHeadingInput): PageCopySectionHeadingSelection {
  const generated = generatedHeading.trim()
  const planned = plannedHeading?.trim() || ''
  const fallback = safeFallbackHeading.trim()

  if (!isVersionedPageCopy) {
    return {
      displayHeading: fallback,
      exportHeading: fallback,
    }
  }

  const acceptedPlannedHeading = evidenceSparse ? '' : planned
  return {
    displayHeading: generated || acceptedPlannedHeading || fallback,
    exportHeading: generated || headingless
      ? ''
      : acceptedPlannedHeading || fallback,
  }
}
