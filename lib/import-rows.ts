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
  acceptedValues?: readonly string[]
}

type PositionalLayout = {
  keys: readonly string[]
  match?: readonly { index: number; columnKey: string }[]
  notice?: string
}

export type ImportSchema = {
  columns: readonly ImportColumn[]
  positionalLayouts?: readonly PositionalLayout[]
}

export type ImportNotice = {
  rowNumber: number
  message: string
}

export type ImportResult = {
  rows: ImportedRow[]
  rejectedRows: RejectedImportRow[]
  notices: ImportNotice[]
}

const COPY_ROW_COLUMNS: readonly Omit<ImportColumn, 'defaultValue'>[] = [
  { key: 'url', aliases: ['url', 'page url', 'link'] },
  { key: 'keyword', aliases: ['keyword', 'primary keyword', 'keyword seeds'] },
  { key: 'page_type', aliases: ['page type', 'page_type', 'type', 'template', 'page template'] },
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
  options: {
    pageTypeValues?: readonly string[]
    positionalLayouts?: readonly PositionalLayout[]
  } = {},
): ImportSchema {
  const columns = includeTemplateKey
    ? [...COPY_ROW_COLUMNS, TEMPLATE_KEY_COLUMN]
    : COPY_ROW_COLUMNS

  return {
    columns: columns.map(column => ({
      ...column,
      defaultValue: defaults[column.key] ?? '',
      acceptedValues: column.key === 'page_type' ? options.pageTypeValues : undefined,
    })),
    positionalLayouts: options.positionalLayouts,
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

function withoutTrailingEmptyValues(values: string[]): string[] {
  let end = values.length
  while (end > 0 && !values[end - 1].trim()) end -= 1
  return values.slice(0, end)
}

function columnAcceptsValue(schema: ImportSchema, columnKey: string, value: string): boolean {
  const column = schema.columns.find(candidate => candidate.key === columnKey)
  if (!column?.acceptedValues?.length) return true
  const normalizedValue = normalizeHeader(value)
  return column.acceptedValues.some(accepted => normalizeHeader(accepted) === normalizedValue)
}

function getPositionalLayout(values: string[], schema: ImportSchema): PositionalLayout | null {
  const populatedValues = withoutTrailingEmptyValues(values)

  for (const layout of schema.positionalLayouts ?? []) {
    if (layout.keys.length !== populatedValues.length) continue
    const matches = (layout.match ?? []).every(rule => (
      columnAcceptsValue(schema, rule.columnKey, populatedValues[rule.index] ?? '')
    ))
    if (matches) return layout
  }

  return null
}

function buildRowFromPositionalLayout(values: string[], schema: ImportSchema, layout: PositionalLayout): ImportedRow {
  const row: ImportedRow = {}
  for (const column of schema.columns) {
    row[column.key] = column.defaultValue
  }
  layout.keys.forEach((key, index) => {
    row[key] = values[index]?.trim() || schema.columns.find(column => column.key === key)?.defaultValue || ''
  })
  return row
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
  const notices: ImportNotice[] = []

  records.forEach((record, rowIndex) => {
    const { values, rowNumber: sourceRowNumber } = record
    if (isEmptyRow(values) || (headerMap && rowIndex === firstPopulatedIndex)) return

    const errors = [...record.errors]
    const layout = headerMap ? null : getPositionalLayout(values, schema)
    const row: ImportedRow = layout
      ? buildRowFromPositionalLayout(values, schema, layout)
      : {}

    if (!layout) {
      schema.columns.forEach((column, columnIndex) => {
        const sourceIndex = headerMap ? headerMap.get(column.key) : columnIndex
        row[column.key] = sourceIndex === undefined
          ? column.defaultValue
          : values[sourceIndex]?.trim() || column.defaultValue
      })
    }

    if (!row.url) {
      errors.push('URL is required')
    } else if (!/^https?:\/\//i.test(row.url)) {
      errors.push('URL must begin with http:// or https://')
    }

    if (errors.length) {
      rejectedRows.push({ rowNumber: sourceRowNumber, errors, values })
    } else {
      rows.push(row)
      if (layout?.notice) {
        notices.push({ rowNumber: sourceRowNumber, message: layout.notice })
      }
    }
  })

  return { rows, rejectedRows, notices }
}
