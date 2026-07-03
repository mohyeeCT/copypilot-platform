type ExportCell = string | number | boolean | null | undefined

export type FaqExportItem = {
  question?: string
  answer?: string
  source?: string
}

export type FaqEditMap = Record<string, { question: string; answer: string }>

export type FaqExportRow = {
  url?: string
  keyword?: string
  selected_keyword?: string
  keyword_source?: string
  runner_up?: string
  scrape_status?: string
  ai_overview_present?: boolean
  ao_question_count?: number
  ai_overview_raw_text?: string
  paa_raw_text?: string
  paa_count?: number
  faq_count?: number
  faq_combined?: string
  faq_sources?: string
  faq_schema_json?: string
  faq_schema_script?: string
  schema_json?: string
  schema_script?: string
  qa_flags?: string[]
  status?: string
  faqs?: FaqExportItem[]
  error?: string | null
}

export function buildFaqExportRows(results: FaqExportRow[], edits: FaqEditMap) {
  const headers = [
    'URL',
    'SEO Target Keyword',
    'Keyword Source',
    'Runner Up Keyword',
    'Page Scrape Status',
    'AI Overview Content',
    'PAA Content',
    'AI Overview Present',
    'FAQs from AI Overview',
    'PAA Questions Found',
    'FAQs Generated',
    'FAQ Schema JSON-LD',
    'FAQ Status',
    'QA Flags',
    'FAQ Content',
    'FAQ Sources',
    'FAQ Schema Script',
  ]

  const rows = results.map((r, rowIndex): Record<string, ExportCell> => {
    const faqs = r.faqs || []
    const hasFaqEdits = faqs.some((_, faqIndex) => Boolean(edits[`${rowIndex}-${faqIndex}`]))
    const faqCombinedFromItems = faqs.map((f, faqIndex) => {
      const edited = edits[`${rowIndex}-${faqIndex}`]
      return `Q: ${edited?.question ?? f.question ?? ''}\nA: ${edited?.answer ?? f.answer ?? ''}`
    }).join('\n\n')
    const faqCombined = hasFaqEdits ? faqCombinedFromItems : (r.faq_combined || faqCombinedFromItems)
    const faqSources = r.faq_sources || faqs.map(f => f.source || 'generated').join(', ')

    return {
      'URL': r.url || '',
      'SEO Target Keyword': r.selected_keyword || r.keyword || '',
      'Keyword Source': r.keyword_source || '',
      'Runner Up Keyword': r.runner_up || '',
      'Page Scrape Status': r.scrape_status || '',
      'AI Overview Content': r.ai_overview_raw_text || '',
      'PAA Content': r.paa_raw_text || '',
      'AI Overview Present': r.ai_overview_present ? 'Yes' : 'No',
      'FAQs from AI Overview': r.ao_question_count ?? '',
      'PAA Questions Found': r.paa_count ?? '',
      'FAQs Generated': r.faq_count ?? (r.faqs?.length ?? ''),
      'FAQ Schema JSON-LD': r.faq_schema_json || r.schema_json || '',
      'FAQ Status': r.status || (r.error ? 'error' : 'ok'),
      'QA Flags': (r.qa_flags || []).join('; '),
      'FAQ Content': faqCombined,
      'FAQ Sources': faqSources,
      'FAQ Schema Script': r.faq_schema_script || r.schema_script || '',
    }
  })

  return { headers, rows }
}
