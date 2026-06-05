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

function countLineBreaks(value: string): number {
  return value.match(/\r\n|\r|\n/g)?.length ?? 0
}

export function parseImportedRows(text: string, schema: ImportSchema): ImportResult {
  const records: { values: string[]; rowNumber: number; errors: string[] }[] = []
  let cursor = 0
  let rowNumber = 1

  Papa.parse<string[]>(text, {
    skipEmptyLines: false,
    transform: value => value.trim(),
    step: result => {
      records.push({
        values: result.data,
        rowNumber,
        errors: result.errors
          .filter(error => error.code !== 'UndetectableDelimiter')
          .map(parserErrorMessage),
      })
      const consumed = text.slice(cursor, result.meta.cursor)
      rowNumber += countLineBreaks(consumed)
      cursor = result.meta.cursor
    },
  })

  const firstPopulatedIndex = records.findIndex(record => !isEmptyRow(record.values))
  const headerMap = firstPopulatedIndex >= 0
    ? getHeaderMap(records[firstPopulatedIndex].values, schema)
    : null

  const rows: ImportedRow[] = []
  const rejectedRows: RejectedImportRow[] = []

  records.forEach((record, rowIndex) => {
    const { values, rowNumber: sourceRowNumber } = record
    if (isEmptyRow(values) || (headerMap && rowIndex === firstPopulatedIndex)) return

    const errors = [...record.errors]
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
      rejectedRows.push({ rowNumber: sourceRowNumber, errors, values })
    } else {
      rows.push(row)
    }
  })

  return { rows, rejectedRows }
}
