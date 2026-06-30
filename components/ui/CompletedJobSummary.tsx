'use client'

import { CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import type { ReactNode } from 'react'

type SummaryStat = {
  label: string
  value: ReactNode
  tone?: 'default' | 'success' | 'error' | 'muted'
}

type CompletedJobSummaryProps = {
  stats: SummaryStat[]
  logCount?: number
  logsCollapsed?: boolean
  onToggleLogs?: () => void
  message?: string
}

function statColor(tone: SummaryStat['tone']) {
  if (tone === 'success') return 'var(--accent)'
  if (tone === 'error') return 'var(--error)'
  if (tone === 'muted') return 'var(--muted)'
  return 'var(--text)'
}

export default function CompletedJobSummary({
  stats,
  logCount,
  logsCollapsed = true,
  onToggleLogs,
  message = 'All rows complete - ready to download',
}: CompletedJobSummaryProps) {
  return (
    <section
      className="mb-6 rounded-xl p-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(stat => (
          <div
            key={stat.label}
            className="rounded-lg px-3 py-3"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
          >
            <p className="label-caps mb-1">{stat.label}</p>
            <p className="text-lg font-bold leading-tight" style={{ color: statColor(stat.tone) }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--accent)' }}>
          <CheckCircle2 size={15} />
          {message}
        </p>
        {onToggleLogs && logCount ? (
          <button
            onClick={onToggleLogs}
            className="flex items-center gap-2 text-xs text-muted hover:text-text transition-colors"
          >
            {logsCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            {logsCollapsed ? 'Show run log' : 'Hide run log'}
            <span className="text-muted/50">({logCount} steps)</span>
          </button>
        ) : null}
      </div>
    </section>
  )
}
