'use client'

import { Activity, AlertCircle, CheckCircle2, CircleDot, Clock3, ListChecks, Square, Terminal } from 'lucide-react'

type LogEntry = { ts: string; msg: string }

export type RunningJobPreviewItem = {
  title: string
  meta?: string
  status?: string
  flags?: string[]
}

type RunningJobPanelProps = {
  status: string
  completedRows: number
  totalRows: number
  failedRows?: number
  currentStep?: string
  logs?: LogEntry[]
  previewItems?: RunningJobPreviewItem[]
  helperText?: string
  cancelling?: boolean
  onCancel?: () => void
}

function clampProgress(completedRows: number, totalRows: number) {
  if (totalRows <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((completedRows / totalRows) * 100)))
}

function elapsedSeconds(logs: LogEntry[], entry: LogEntry, index: number) {
  const chapterStart = [...logs]
    .slice(0, index + 1)
    .reverse()
    .find(log => log.msg.includes('starting') || log.msg.startsWith('==='))
  const baseTs = chapterStart ? new Date(chapterStart.ts).getTime() : new Date(logs[0]?.ts || entry.ts).getTime()
  return Math.max(0, Math.round((new Date(entry.ts).getTime() - baseTs) / 1000))
}

function Stat({ label, value, tone = 'default' }: { label: string; value: string | number; tone?: 'default' | 'success' | 'warning' | 'error' }) {
  const colorClass = {
    default: 'text-text',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error',
  }[tone]

  return (
    <div className="rounded-lg border border-border bg-surface/70 px-3 py-2">
      <p className={`text-base font-semibold leading-none ${colorClass}`}>{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-muted">{label}</p>
    </div>
  )
}

export default function RunningJobPanel({
  status,
  completedRows,
  totalRows,
  failedRows = 0,
  currentStep,
  logs = [],
  previewItems = [],
  helperText,
  cancelling = false,
  onCancel,
}: RunningJobPanelProps) {
  const progress = clampProgress(completedRows, totalRows)
  const remainingRows = Math.max(totalRows - completedRows, 0)
  const isStopping = status === 'cancelling' || cancelling
  const visibleLogs = logs.slice(-14)
  const logOffset = logs.length - visibleLogs.length

  return (
    <section className="card mb-6 overflow-hidden p-0">
      <div className="flex flex-col gap-4 border-b border-border px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
              <CircleDot size={12} className={status === 'running' ? 'animate-pulse' : ''} />
              {isStopping ? 'Stopping job' : 'Job running'}
            </span>
            <span className="text-xs text-muted">{completedRows} of {totalRows} rows complete</span>
          </div>
          <h2 className="mt-3 text-lg font-semibold">Generation progress</h2>
          <p className="mt-1 text-sm text-muted">
            {isStopping
              ? 'Stopping after the current row or batch finishes. Completed results stay saved.'
              : currentStep || 'Waiting for the next job update...'}
          </p>
          {helperText && <p className="mt-1 text-xs text-muted">{helperText}</p>}
        </div>

        {onCancel && (
          <button
            onClick={onCancel}
            disabled={isStopping}
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-error/30 bg-error/8 px-3 py-2 text-xs text-error transition-colors hover:bg-error/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Square size={12} fill="currentColor" />
            {isStopping ? 'Stopping...' : 'Stop job'}
          </button>
        )}
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">Overall progress</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">{progress}%</p>
              </div>
              <p className="pb-1 text-xs font-mono text-muted">{completedRows}/{totalRows}</p>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Stat label="Complete" value={completedRows} tone="success" />
            <Stat label="Remaining" value={remainingRows} tone={remainingRows > 0 ? 'warning' : 'default'} />
            <Stat label="Failed" value={failedRows} tone={failedRows > 0 ? 'error' : 'default'} />
            <Stat label="Status" value={isStopping ? 'Stopping' : 'Active'} tone={isStopping ? 'error' : 'success'} />
          </div>

          <div className="rounded-lg border border-border bg-surface/70 p-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
              <Activity size={13} />
              Current step
            </div>
            <p className="mt-2 text-sm text-text">{currentStep || 'Preparing the next update...'}</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-lg border border-border bg-surface/70">
            <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
                <Terminal size={13} />
                Live activity
              </div>
              <span className="text-[11px] text-muted">{logs.length} updates</span>
            </div>
            <div className="max-h-56 overflow-y-auto px-3 py-2 font-mono text-xs">
              {visibleLogs.length === 0 ? (
                <p className="py-3 text-muted">Waiting for first update...</p>
              ) : (
                visibleLogs.map((entry, index) => {
                  const realIndex = logOffset + index
                  return (
                    <div key={`${entry.ts}-${realIndex}`} className="flex gap-2 border-b border-border/40 py-1.5 last:border-0">
                      <span className="shrink-0 text-muted" style={{ minWidth: 38 }}>+{elapsedSeconds(logs, entry, realIndex)}s</span>
                      <span className="min-w-0 break-words text-text">{entry.msg}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface/70">
            <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
                <ListChecks size={13} />
                Latest rows
              </div>
              <span className="text-[11px] text-muted">{previewItems.length ? 'Live preview' : 'No rows yet'}</span>
            </div>
            <div className="divide-y divide-border/50">
              {previewItems.length === 0 ? (
                <p className="px-3 py-5 text-sm text-muted">Completed rows will appear here as the job runs.</p>
              ) : (
                previewItems.slice(0, 5).map((item, index) => {
                  const hasIssue = item.status === 'error' || item.status === 'failed' || item.flags?.length
                  const Icon = hasIssue ? AlertCircle : CheckCircle2
                  return (
                    <div key={`${item.title}-${index}`} className="flex items-start gap-2 px-3 py-2.5">
                      <Icon size={14} className={hasIssue ? 'mt-0.5 shrink-0 text-warning' : 'mt-0.5 shrink-0 text-success'} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text">{item.title || 'Untitled row'}</p>
                        {item.meta && <p className="mt-0.5 truncate text-xs text-muted">{item.meta}</p>}
                        {item.flags?.length ? <p className="mt-1 truncate text-xs text-warning">{item.flags.join('; ')}</p> : null}
                      </div>
                      {item.status && <span className="shrink-0 rounded-md bg-border/60 px-1.5 py-0.5 text-[11px] text-muted">{item.status}</span>}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border px-5 py-3 text-xs text-muted">
        <Clock3 size={13} />
        This view refreshes automatically while the job is active.
      </div>
    </section>
  )
}
