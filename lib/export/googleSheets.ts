import { exportToGoogleSheets, type GoogleSheetsExportPayload } from '@/lib/api/shared'
import { createClient } from '@/lib/supabase'

export async function exportRowsToGoogleSheets(payload: GoogleSheetsExportPayload) {
  const sb = createClient()
  const { data: { session } } = await sb.auth.getSession()
  if (!session) throw new Error('Please sign in again before exporting to Google Sheets.')

  const result = await exportToGoogleSheets(session.access_token, payload)
  window.open(result.spreadsheet_url, '_blank', 'noopener,noreferrer')
  return result
}

export function googleSheetsExportError(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return 'Unable to export to Google Sheets. Reconnect Google in Settings and try again.'
}
