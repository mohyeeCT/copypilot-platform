import { exportToGoogleDocs, type GoogleDocsExportPayload } from '@/lib/api/shared'
import { createClient } from '@/lib/supabase'

export async function exportRowsToGoogleDocs(payload: GoogleDocsExportPayload) {
  const { data: { session } } = await createClient().auth.getSession()
  if (!session) throw new Error('Please sign in again before exporting to Google Docs.')

  const result = await exportToGoogleDocs(session.access_token, payload)
  if (result.document_url) window.open(result.document_url, '_blank', 'noopener,noreferrer')
  return result
}

export function googleDocsExportError(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return 'Unable to export to Google Docs. Reconnect Google in Settings and try again.'
}
