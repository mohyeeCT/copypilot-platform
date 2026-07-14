'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Check, Copy, Database, ExternalLink, FileJson, Search } from 'lucide-react'
import * as XLSX from 'xlsx'
import AppLayout from '@/components/layout/AppLayout'
import workspaceStyles from '@/components/meta/MetaCopyWorkspace.module.css'
import schemaStyles from '@/components/schema/SchemaWorkspace.module.css'
import Badge from '@/components/ui/Badge'
import ExportMenu from '@/components/ui/ExportMenu'
import RunningJobPanel from '@/components/ui/RunningJobPanel'
import { schemaApi } from '@/lib/api/schema'
import { exportRowsToGoogleSheets, googleSheetsExportError } from '@/lib/export/googleSheets'
import { createClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface SchemaResult {
  url: string
  status: string
  schema_type: string
  schema_json?: string
  schema_script?: string
  error?: string | null
  source_summary?: {
    scraped_sections: string[]
    serp_used: boolean
  }
}

interface Job {
  id: string
  name: string
  status: string
  total_rows?: number
  completed_rows?: number
  failed_rows?: number
  current_step?: string
  logs?: { ts: string; msg: string }[]
  progress?: { total?: number; completed?: number; failed?: number }
  results?: SchemaResult[]
}

type DetailTab = 'json' | 'source' | 'validation'

function resultState(result: SchemaResult) {
  if (result.error || result.status === 'error' || result.status === 'failed') return 'error'
  if (!result.schema_json) return 'review'
  return 'ready'
}

function resultStateLabel(result: SchemaResult) {
  const state = resultState(result)
  if (state === 'error') return 'Error'
  if (state === 'review') return 'Needs review'
  return 'Ready'
}

export default function SchemaJobPage() {
  const { id } = useParams()
  const router = useRouter()
  const [job, setJob] = useState<Job | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [copied, setCopied] = useState('')
  const [exportingSheets, setExportingSheets] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [detailTab, setDetailTab] = useState<DetailTab>('json')

  const load = useCallback(async () => {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }
    setJob(await schemaApi.getJob(session.access_token, id as string))
  }, [id, router])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!job || (job.status !== 'running' && job.status !== 'cancelling')) return
    const timer = window.setInterval(() => { void load() }, 2500)
    return () => window.clearInterval(timer)
  }, [job, load])

  async function handleCancel() {
    if (!job) return
    setCancelling(true)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (session) {
        await schemaApi.cancelJob(session.access_token, job.id)
        await load()
      }
    } finally {
      setCancelling(false)
    }
  }

  function copyText(text: string, key: string) {
    void navigator.clipboard.writeText(text)
    setCopied(key)
    window.setTimeout(() => setCopied(''), 1500)
  }

  function buildExportRows() {
    const headers = ['URL', 'Status', 'Schema Type', 'Schema JSON', 'Schema Script', 'Error']
    const rows = (job?.results || []).map(result => ({
      'URL': result.url || '',
      'Status': result.status || '',
      'Schema Type': result.schema_type || '',
      'Schema JSON': result.schema_json || '',
      'Schema Script': result.schema_script || '',
      'Error': result.error || '',
    }))
    return { headers, rows }
  }

  function downloadCsv() {
    if (!job?.results?.length) return
    const { headers, rows } = buildExportRows()
    const csvRows = rows.map(row => headers.map(header => `"${String(row[header as keyof typeof row] ?? '').replace(/"/g, '""')}"`).join(','))
    const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv' })
    const anchor = document.createElement('a')
    anchor.href = URL.createObjectURL(blob)
    anchor.download = `schema_${(job.name || 'job').replace(/\s+/g, '_')}.csv`
    anchor.click()
    URL.revokeObjectURL(anchor.href)
  }

  function downloadXlsx() {
    if (!job?.results?.length) return
    const { rows } = buildExportRows()
    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Results')
    XLSX.writeFile(workbook, `schema_${(job.name || 'job').replace(/\s+/g, '_')}.xlsx`)
  }

  async function exportGoogleSheets() {
    if (!job?.results?.length || exportingSheets) return
    setExportingSheets(true)
    try {
      const { headers, rows } = buildExportRows()
      await exportRowsToGoogleSheets({
        title: `${job.name || 'Schema results'} - Schema`,
        sheet_name: 'Schema Results',
        headers,
        rows,
      })
    } catch (error) {
      alert(googleSheetsExportError(error))
    } finally {
      setExportingSheets(false)
    }
  }

  if (!job) {
    return (
      <AppLayout title="Schema Generator">
        <div className="flex h-48 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>
      </AppLayout>
    )
  }

  const results = job.results || []
  const total = job.total_rows ?? job.progress?.total ?? results.length
  const completed = job.completed_rows ?? job.progress?.completed ?? results.length
  const failed = job.failed_rows ?? job.progress?.failed ?? results.filter(result => resultState(result) === 'error').length
  const selectedIndex = results[activeIndex] ? activeIndex : 0
  const selectedResult = results[selectedIndex]
  const result = selectedResult as SchemaResult
  const ready = results.filter(result => resultState(result) === 'ready').length

  return (
    <AppLayout title="Schema Generator">
      <div className={workspaceStyles.jobPage}>
        <header className={workspaceStyles.pageHeader}>
          <div className={workspaceStyles.pageHeaderCopy}>
            <Link href="/schema/jobs" className={workspaceStyles.backButton}><ArrowLeft size={14} /> All Schema jobs</Link>
            <span className={workspaceStyles.eyebrow}>Schema Generator job</span>
            <h1>{job.name || 'Untitled job'}</h1>
            <div className={workspaceStyles.headerMeta}><Badge label={job.status} /><span>{completed}/{total} rows</span>{failed > 0 && <span className="text-error">{failed} failed</span>}</div>
          </div>
          {results.length > 0 && <div className={workspaceStyles.headerActions}><ExportMenu onCsv={downloadCsv} onXlsx={downloadXlsx} onGoogleSheets={exportGoogleSheets} sheetsLoading={exportingSheets} /></div>}
        </header>

        {(job.status === 'running' || job.status === 'cancelling') && (
          <RunningJobPanel status={job.status} completedRows={completed} totalRows={total} failedRows={failed} currentStep={job.current_step || 'Generating structured data...'} logs={job.logs} cancelling={cancelling} onCancel={handleCancel} />
        )}

        {results.length > 0 && (
          <>
            <section className={workspaceStyles.metricStrip} aria-label="Schema result summary">
              <div><span>Rows</span><strong>{results.length}</strong><small>URLs processed</small></div>
              <div><span>Ready</span><strong className={workspaceStyles.successValue}>{ready}</strong><small>JSON-LD generated</small></div>
              <div><span>Errors</span><strong className={failed ? workspaceStyles.warningValue : undefined}>{failed}</strong><small>Source or generation issue</small></div>
              <div><span>Types</span><strong>{new Set(results.map(result => result.schema_type).filter(Boolean)).size}</strong><small>Schema types generated</small></div>
            </section>

            <div className={workspaceStyles.reviewWorkspace}>
              <section className={workspaceStyles.resultQueue}>
                <header className={workspaceStyles.queueHeader}><div><h2>Schema rows</h2><p>{results.length} generated results</p></div></header>
                <div className={workspaceStyles.resultList}>
                  {results.map((result, index) => {
                    const state = resultState(result)
                    return (
                      <article key={`${result.url}-${index}`} className={`${workspaceStyles.resultRow} ${schemaStyles.resultRow} ${selectedIndex === index ? workspaceStyles.resultRowActive : ''}`}>
                        <button type="button" className={workspaceStyles.resultPrimary} onClick={() => { setActiveIndex(index); setDetailTab('json') }}>
                          <span className={workspaceStyles.resultPrimaryTop}><strong>{result.schema_type || `Row ${index + 1}`}</strong><span className={workspaceStyles.statusPill} data-state={state}>{resultStateLabel(result)}</span></span>
                          <p>{result.error || 'Structured data generated for this page.'}</p>
                          <span className={workspaceStyles.resultMeta}><span>{result.url}</span></span>
                        </button>
                      </article>
                    )
                  })}
                </div>
              </section>

              {selectedResult && (
                <section className={workspaceStyles.resultDetail}>
                  <header className={workspaceStyles.detailHeader}>
                    <div><span className={workspaceStyles.eyebrow}>Selected schema</span><h2>{selectedResult.schema_type}</h2><p>{selectedResult.url}</p></div>
                    <div className={workspaceStyles.detailHeaderActions}><span className={workspaceStyles.statusPill} data-state={resultState(selectedResult)}>{resultStateLabel(selectedResult)}</span></div>
                  </header>
                  <nav className={workspaceStyles.detailTabs} aria-label="Schema result detail">
                    {([['json', 'JSON-LD'], ['source', 'Source context'], ['validation', 'Validation']] as Array<[DetailTab, string]>).map(([value, label]) => <button type="button" key={value} aria-pressed={detailTab === value} data-active={detailTab === value ? 'true' : 'false'} onClick={() => setDetailTab(value)}>{label}</button>)}
                  </nav>

                  {detailTab === 'json' && (
                    <div className={workspaceStyles.detailBody}>
                      {selectedResult.error ? <section className={workspaceStyles.qualitySummary}><span className={workspaceStyles.qualityIcon} data-state="error"><AlertTriangle size={18} /></span><div><h3>Schema was not generated</h3><p>{selectedResult.error}</p></div></section> : (
                        <div><div className={schemaStyles.codeHeader}><span>application/ld+json</span><button type="button" className={workspaceStyles.copyButton} aria-label="Copy schema JSON" title="Copy schema JSON" onClick={() => copyText(selectedResult.schema_json || '', `json-${selectedIndex}`)}>{copied === `json-${selectedIndex}` ? <Check size={13} /> : <Copy size={13} />}</button></div><pre className={schemaStyles.codeBlock}>{selectedResult.schema_json || '// No JSON-LD was saved for this row.'}</pre></div>
                      )}
                    </div>
                  )}

                  {detailTab === 'source' && (
                    <div className={workspaceStyles.detailBody}>
                      <div className={schemaStyles.sourceGrid}>
                        <div className={schemaStyles.sourceCard}><span>Target page</span><strong>{selectedResult.url}</strong><p>Page receiving the structured data.</p></div>
                        <div className={schemaStyles.sourceCard}><span>Scraped sections</span><strong>{selectedResult.source_summary?.scraped_sections?.length || 0}</strong><p>{selectedResult.source_summary?.scraped_sections?.join(', ') || 'No page sections were recorded.'}</p></div>
                        <div className={schemaStyles.sourceCard}><span>SERP context</span><strong>{selectedResult.source_summary?.serp_used ? 'Used' : 'Not used'}</strong><p>Search-result evidence for entity details.</p></div>
                        <div className={schemaStyles.sourceCard}><span>Schema type</span><strong>{selectedResult.schema_type}</strong><p>Selected structured-data template.</p></div>
                      </div>
                      {result.source_summary?.scraped_sections?.length === 0 && (
                        <div
                          className={`${schemaStyles.sourceWarning} text-warning`}
                          style={{ background: 'rgba(198, 123, 0, 0.08)', borderColor: 'rgba(198, 123, 0, 0.22)' }}
                        >
                          <AlertTriangle size={14} />
                          <span>No page content was available for this URL. Schema was generated without owned-page source data.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {detailTab === 'validation' && (
                    <div className={workspaceStyles.detailBody}>
                      <div className={schemaStyles.validationGrid}>
                        <div className={schemaStyles.validationCard}><span>Google Rich Results</span><strong>Check search eligibility</strong><p>Open Google&apos;s validator with the target URL.</p><a href={`https://search.google.com/test/rich-results?url=${encodeURIComponent(selectedResult.url)}`} target="_blank" rel="noreferrer">Open Rich Results <ExternalLink size={12} /></a></div>
                        <div className={schemaStyles.validationCard}><span>Schema.org Validator</span><strong>Validate vocabulary</strong><p>Paste the generated JSON-LD into Schema.org&apos;s validator.</p><a href="https://validator.schema.org/" target="_blank" rel="noreferrer">Open validator <ExternalLink size={12} /></a></div>
                        <div className={schemaStyles.validationCard}><span>Ready-to-paste script</span><strong>{selectedResult.schema_script ? 'Available' : 'Not included'}</strong><p>Copy the complete script block for implementation.</p>{selectedResult.schema_script && <button type="button" className="btn-ghost mt-3 text-xs" onClick={() => copyText(selectedResult.schema_script || '', `script-${selectedIndex}`)}>{copied === `script-${selectedIndex}` ? <Check size={13} /> : <Copy size={13} />} Copy script</button>}</div>
                        <div className={schemaStyles.validationCard}><span>Generated file</span><strong>{selectedResult.schema_json ? 'JSON-LD available' : 'Unavailable'}</strong><p>Use the export menu to archive this result with the job.</p></div>
                      </div>
                    </div>
                  )}

                  <footer className={workspaceStyles.detailFooter}><span>Row {selectedIndex + 1} of {results.length}</span><div>{selectedResult.schema_json && <button type="button" className="btn-primary text-xs" onClick={() => copyText(selectedResult.schema_json || '', `footer-${selectedIndex}`)}>{copied === `footer-${selectedIndex}` ? <Check size={13} /> : <FileJson size={13} />} {copied === `footer-${selectedIndex}` ? 'Copied' : 'Copy JSON-LD'}</button>}</div></footer>
                </section>
              )}
            </div>
          </>
        )}

        {!results.length && job.status !== 'running' && <div className={workspaceStyles.emptyResults}><Search size={22} /><strong>No schema output yet</strong><p>Generated JSON-LD will appear when this job returns a result.</p></div>}
      </div>
    </AppLayout>
  )
}
