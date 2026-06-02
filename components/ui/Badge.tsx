import clsx from 'clsx'

const styles: Record<string, string> = {
  pending:     'bg-muted/8 text-muted border-muted/15',
  running:     'bg-warning/10 text-warning border-warning/20',
  complete:    'bg-accent/10 text-accent border-accent/20',
  failed:      'bg-error/10 text-error border-error/20',
  cancelling:  'bg-error/10 text-error border-error/20',
  cancelled:   'bg-muted/8 text-muted border-muted/15',
  gsc:         'bg-blue-500/10 text-blue-500 border-blue-500/20',
  manual:      'bg-muted/8 text-muted border-muted/15',
  fallback:    'bg-warning/10 text-warning border-warning/20',
  ai_overview: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  paa:         'bg-blue-500/10 text-blue-500 border-blue-500/20',
  generated:   'bg-muted/8 text-muted border-muted/15',
  error:       'bg-error/10 text-error border-error/20',
  ok:          'bg-accent/10 text-accent border-accent/20',
}

export default function Badge({ label }: { label: string }) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs border font-medium tracking-tight font-mono',
      styles[label] || styles.generated
    )}>
      {label === 'running' && (
        <span className="w-1.5 h-1.5 bg-warning rounded-full animate-pulse shrink-0" />
      )}
      {label === 'cancelling' && (
        <span className="w-1.5 h-1.5 bg-error rounded-full animate-pulse shrink-0" />
      )}
      {label}
    </span>
  )
}
