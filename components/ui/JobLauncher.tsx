import type { ReactNode } from 'react'

type SummaryItem = {
  label: string
  value: ReactNode
}

type JobLauncherShellProps = {
  children: ReactNode
  eyebrow?: string
  title: string
  description?: string
  summary?: ReactNode
  actions?: ReactNode
}

export function JobLauncherShell({
  children,
  eyebrow = 'Job launcher',
  title,
  description,
  summary,
  actions,
}: JobLauncherShellProps) {
  return (
    <div className="job-launcher">
      <div className="job-launcher-hero">
        <div>
          <p className="job-launcher-eyebrow">{eyebrow}</p>
          <h1 className="job-launcher-title">{title}</h1>
          {description && <p className="job-launcher-description">{description}</p>}
        </div>
        {(summary || actions) && (
          <div className="job-launcher-hero-panel">
            {summary}
            {actions && <div className="job-launcher-actions">{actions}</div>}
          </div>
        )}
      </div>
      <div className="job-launcher-body">{children}</div>
    </div>
  )
}

type JobSectionProps = {
  children: ReactNode
  title: string
  description?: string
  kicker?: string
  className?: string
}

export function JobSection({ children, title, description, kicker, className = '' }: JobSectionProps) {
  return (
    <section className={`job-section ${className}`}>
      <div className="job-section-header">
        <div>
          {kicker && <p className="job-section-kicker">{kicker}</p>}
          <h2 className="job-section-title">{title}</h2>
          {description && <p className="job-section-description">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

type JobSummaryBarProps = {
  summaryItems: SummaryItem[]
}

export function JobSummaryBar({ summaryItems }: JobSummaryBarProps) {
  return (
    <dl className="job-summary-bar">
      {summaryItems.map(item => (
        <div key={item.label} className="job-summary-item">
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
