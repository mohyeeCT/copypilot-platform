import type { RejectedImportRow } from '@/lib/import-rows'

export default function ImportErrors({ rows }: { rows: RejectedImportRow[] }) {
  if (!rows.length) return null

  return (
    <div role="alert" aria-live="polite" className="my-3 border border-error/40 bg-error/5 px-3 py-2 text-xs text-error">
      <p className="font-medium mb-1">
        {rows.length} {rows.length === 1 ? 'row was' : 'rows were'} not imported
      </p>
      <ul className="space-y-0.5 max-h-28 overflow-y-auto">
        {rows.map(row => (
          <li key={`${row.rowNumber}-${row.errors.join('-')}`}>
            Row {row.rowNumber}: {row.errors.join('; ')}
          </li>
        ))}
      </ul>
    </div>
  )
}
