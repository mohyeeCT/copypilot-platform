export type AioOutputField = 'gen_page_copy' | 'gen_meta' | 'gen_faqs'

type AioOutputSelection = Record<AioOutputField, boolean>

export function applyAioOutputSelection<Row extends AioOutputSelection>(
  rows: readonly Row[],
  field: AioOutputField,
  enabled: boolean,
): Row[] {
  return rows.map(row => ({ ...row, [field]: enabled })) as Row[]
}
