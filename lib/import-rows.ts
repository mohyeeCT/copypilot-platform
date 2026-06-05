import Papa from 'papaparse'

export type ImportedRow = Record<string, string>

export type RejectedImportRow = {
  rowNumber: number
  errors: string[]
  values: string[]
}

type ImportColumn = {
  key: string
  aliases: readonly string[]
  defaultValue: string
}

export type ImportSchema = {
  columns: readonly ImportColumn[]
}

export type ImportResult = {
  rows: ImportedRow[]
  rejectedRows: RejectedImportRow[]
}

const COPY_ROW_COLUMNS: readonly Omit<ImportColumn, 'defaultValue'>[] = [
  { key: 'url', aliases: ['url', 'page url', 'link'] },
  { key: 'keyword', aliases: ['keyword', 'primary keyword', 'keyword seeds'] },
  { key: 'page_type', aliases: ['page type', 'page_type', 'type', 'template'] },
  { key: 'h1', aliases: ['h1', 'h1 tag'] },
]

const TEMPLATE_KEY_COLUMN: Omit<ImportColumn, 'defaultValue'> = {
  key: 'template_key',
  aliases: ['template key', 'template_key'],
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
}

export function createCopyRowImportSchema(
  defaults: Record<string, string>,
  includeTemplateKey = false,
): ImportSchema {
  const columns = includeTemplateKey
    ? [...COPY_ROW_COLUMNS, TEMPLATE_KEY_COLUMN]
    : COPY_ROW_COLUMNS

  return {
    columns: columns.map(column => ({
      ...column,
      defaultValue: defaults[column.key] ?? '',
    })),
  }
}

function getHeaderMap(row: string[], schema: ImportSchema): Map<string, number> | null {
  const aliasToKey = new Map<string, string>()
  for (const column of schema.columns) {
    for (const alias of column.aliases) {
      aliasToKey.set(normalizeHeader(alias), column.key)
    }
  }

  const populated = row
    .map((value, index) => ({ index, alias: normalizeHeader(value) }))
    .filter(cell => cell.alias)

  if (!populated.length || !populated.every(cell => aliasToKey.has(cell.alias))) {
    return null
  }

  const headerMap = new Map<string, number>()
  for (const cell of populated) {
    headerMap.set(aliasToKey.get(cell.alias)!, cell.index)
  }

  return headerMap.has('url') ? headerMap : null
}

function isEmptyRow(row: string[]): boolean {
  return row.every(value => !value.trim())
}

function parserErrorMessage(error: Papa.ParseError): string {
  return `Malformed CSV: ${error.message}`
}

export function parseImportedRows(text: string, schema: ImportSchema): ImportResult {
  const parsed = Papa.parse<string[]>(text, {
    skipEmptyLines: false,
    transform: value => value.trim(),
  })

  const data = parsed.data
  const firstPopulatedIndex = data.findIndex(row => !isEmptyRow(row))
  const headerMap = firstPopulatedIndex >= 0 ? getHeaderMap(data[firstPopulatedIndex], schema) : null
  const parserErrors = new Map<number, string[]>()

  for (const error of parsed.errors) {
    if (error.code === 'UndetectableDelimiter') continue
    const rowIndex = error.row ?? 0
    parserErrors.set(rowIndex, [...(parserErrors.get(rowIndex) ?? []), parserErrorMessage(error)])
  }

  const rows: ImportedRow[] = []
  const rejectedRows: RejectedImportRow[] = []

  data.forEach((values, rowIndex) => {
    if (isEmptyRow(values) || (headerMap && rowIndex === firstPopulatedIndex)) return

    const errors = [...(parserErrors.get(rowIndex) ?? [])]
    const row: ImportedRow = {}

    schema.columns.forEach((column, columnIndex) => {
      const sourceIndex = headerMap?.get(column.key) ?? columnIndex
      row[column.key] = values[sourceIndex]?.trim() || column.defaultValue
    })

    if (!row.url) {
      errors.push('URL is required')
    } else if (!/^https?:\/\//i.test(row.url)) {
      errors.push('URL must begin with http:// or https://')
    }

    if (errors.length) {
      rejectedRows.push({ rowNumber: rowIndex + 1, errors, values })
    } else {
      rows.push(row)
    }
  })

  return { rows, rejectedRows }
}
