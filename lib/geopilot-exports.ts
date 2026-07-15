import type { GeoPilotExportDataset } from './api/geopilot'

export type GeoPilotCsvDataset = Exclude<GeoPilotExportDataset, 'all'>

export type GeoPilotExportTable = {
  dataset: GeoPilotCsvDataset
  label: string
  sheetName: string
  headers: string[]
  rows: Record<string, unknown>[]
}

export const GEOPILOT_EXPORT_DATASETS: Array<{
  value: GeoPilotCsvDataset
  label: string
  sheetName: string
  description: string
}> = [
  {
    value: 'prompt_history',
    label: 'Prompt-level history',
    sheetName: 'Prompt History',
    description: 'Every tracked measurement and outcome',
  },
  {
    value: 'trends',
    label: 'Daily trends',
    sheetName: 'Daily Trends',
    description: 'Visibility metrics across the selected period',
  },
  {
    value: 'method_comparison',
    label: 'Method comparisons',
    sheetName: 'Method Comparison',
    description: 'API and Consumer UI performance by surface',
  },
  {
    value: 'citations',
    label: 'Citation history',
    sheetName: 'Citations',
    description: 'Owned, competitor, and third-party sources',
  },
  {
    value: 'citation_gaps',
    label: 'Verified citation gaps',
    sheetName: 'Citation Gaps',
    description: 'Competitor citations where the brand was absent',
  },
  {
    value: 'costs',
    label: 'Provider costs',
    sheetName: 'Costs',
    description: 'Recorded spend and token usage by measurement',
  },
]

export async function loadGeoPilotExportTables(
  fetchCsv: (dataset: GeoPilotCsvDataset) => Promise<string>,
): Promise<GeoPilotExportTable[]> {
  const [papaModule, csvFiles] = await Promise.all([
    import('papaparse'),
    Promise.all(GEOPILOT_EXPORT_DATASETS.map(async definition => ({
      definition,
      csv: await fetchCsv(definition.value),
    }))),
  ])
  const Papa = papaModule.default

  return csvFiles.map(({ definition, csv }) => {
    const parsed = Papa.parse<Record<string, unknown>>(csv, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: 'greedy',
    })
    const headers = (parsed.meta.fields || []).filter(Boolean)
    if (parsed.errors.length || !headers.length) {
      throw new Error(`${definition.label} could not be prepared for export.`)
    }
    return {
      dataset: definition.value,
      label: definition.label,
      sheetName: definition.sheetName,
      headers,
      rows: parsed.data,
    }
  })
}

export async function downloadGeoPilotWorkbook(tables: GeoPilotExportTable[], filename: string) {
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()
  for (const table of tables) {
    const worksheet = table.rows.length
      ? XLSX.utils.json_to_sheet(table.rows, { header: table.headers })
      : XLSX.utils.aoa_to_sheet([table.headers])
    XLSX.utils.book_append_sheet(workbook, worksheet, table.sheetName)
  }
  XLSX.writeFile(workbook, filename)
}
