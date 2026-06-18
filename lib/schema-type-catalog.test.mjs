import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const EXPECTED_SCHEMA_TYPES = [
  { value: 'LocalBusiness', label: 'Local Business', group: 'Local Business' },
  { value: 'Restaurant', label: 'Restaurant', group: 'Local Business' },
  { value: 'MedicalBusiness', label: 'Medical', group: 'Local Business' },
  { value: 'Dentist', label: 'Dentist', group: 'Local Business' },
  { value: 'LegalService', label: 'Legal Service', group: 'Local Business' },
  { value: 'HomeAndConstructionBusiness', label: 'Home & Construction', group: 'Local Business' },
  { value: 'FinancialService', label: 'Financial Service', group: 'Local Business' },
  { value: 'Store', label: 'Retail Store', group: 'Local Business' },
  { value: 'LodgingBusiness', label: 'Hotel / Lodging', group: 'Local Business' },
  { value: 'AutoDealer', label: 'Auto Dealer', group: 'Local Business' },
  { value: 'RealEstateAgent', label: 'Real Estate', group: 'Local Business' },
  { value: 'BeautySalon', label: 'Beauty Salon', group: 'Local Business' },
  { value: 'FitnessCenter', label: 'Fitness', group: 'Local Business' },
  { value: 'Organization', label: 'Organization', group: 'Organization' },
  { value: 'Corporation', label: 'Corporation', group: 'Organization' },
  { value: 'EducationalOrganization', label: 'Educational', group: 'Organization' },
  { value: 'NonProfit', label: 'Non-Profit', group: 'Organization' },
  { value: 'FAQPage', label: 'FAQ Page', group: 'Content' },
  { value: 'Article', label: 'Article', group: 'Content' },
  { value: 'BlogPosting', label: 'Blog Post', group: 'Content' },
  { value: 'HowTo', label: 'How-To', group: 'Content' },
  { value: 'Recipe', label: 'Recipe', group: 'Content' },
  { value: 'NewsArticle', label: 'News Article', group: 'Content' },
  { value: 'Product', label: 'Product', group: 'E-commerce' },
  { value: 'ItemList', label: 'Item List', group: 'E-commerce' },
  { value: 'Person', label: 'Person', group: 'People & Events' },
  { value: 'Event', label: 'Event', group: 'People & Events' },
  { value: 'Service', label: 'Service', group: 'People & Events' },
  { value: 'WebSite', label: 'Website + Search', group: 'Technical' },
  { value: 'BreadcrumbList', label: 'Breadcrumb', group: 'Technical' },
  { value: 'SoftwareApplication', label: 'Software / App', group: 'Technical' },
  { value: 'VideoObject', label: 'Video', group: 'Technical' },
]

test('schema type catalog matches the canonical grouped option order exactly', async () => {
  const page = await readFile(new URL('../app/(app)/schema/jobs/new/page.tsx', import.meta.url), 'utf8')
  const catalog = page.match(/const SCHEMA_TYPES = \[([\s\S]*?)\n\]/)?.[1] ?? ''
  const options = [...catalog.matchAll(/\{([^{}]*)\}/g)].map(([, objectSource]) => {
    const option = objectSource.match(/^\s*value:\s*'([^']+)',\s*label:\s*'([^']+)',\s*group:\s*'([^']+)'\s*$/)
    assert.ok(option, `Invalid schema option object: {${objectSource}}`)

    return { value: option[1], label: option[2], group: option[3] }
  })

  assert.deepEqual(options, EXPECTED_SCHEMA_TYPES)
})

test('schema type catalog uses concise representative labels', async () => {
  const page = await readFile(new URL('../app/(app)/schema/jobs/new/page.tsx', import.meta.url), 'utf8')

  for (const label of ['Medical', 'Home & Construction', 'Website + Search', 'Software / App']) {
    assert.match(page, new RegExp(`label:\\s*['"]${label.replace(/[+]/g, '\\+')}['"]`))
  }
})

test('schema data source toggles include exact helper descriptions', async () => {
  const page = await readFile(new URL('../app/(app)/schema/jobs/new/page.tsx', import.meta.url), 'utf8')
  const dataSourcesSection = page.match(/<h2[^>]*>Data Sources<\/h2>([\s\S]*?)\r?\n\s*<\/div>\r?\n\r?\n\s*\{error &&/)?.[1]
  const descriptions = [
    'Reads content from the URL you entered.',
    'Adds business-wide details from the website homepage.',
    'Checks About and Contact pages for company and location details.',
    'Uses DataForSEO search results. Requires saved credentials.',
    'Wraps the JSON-LD in a ready-to-paste <script> tag.',
  ]

  assert.ok(dataSourcesSection, 'Data Sources section not found')
  for (const description of descriptions) {
    const escapedDescription = description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    assert.match(dataSourcesSection, new RegExp(escapedDescription))
  }
  assert.match(dataSourcesSection, /<span className="block text-xs text-muted mt-0\.5">\{description\}<\/span>/)
})
