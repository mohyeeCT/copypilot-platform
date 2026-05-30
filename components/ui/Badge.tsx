import clsx from 'clsx'

const styles: Record<string, string> = {
  pending:     'bg-muted/10 text-muted border-muted/20',
  running:     'bg-warning/10 text-warning border-warning/20',
  complete:    'bg-accent/10 text-accent border-accent/20',
  failed:      'bg-error/10 text-error border-error/20',
  cancelling:  'bg-error/10 text-error border-error/20',
  cancelled:   'bg-muted/10 text-muted border-muted/20',
  gsc:         'bg-blue-500/10 text-blue-400 border-blue-500/20',
  manual:      'bg-muted/10 text-muted border-muted/20',
  fallback:    'bg-warning/10 text-warning border-warning/20',
  ai_overview: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  paa:         'bg-blue-500/10 text-blue-400 border-blue-500/20',
  generated:   'bg-muted/10 text-muted border-muted/20',
  error:       'bg-error/10 text-error border-error/20',
  ok:          'bg-accent/10 text-accent border-accent/20',
}

export default function Badge({ label }: { label: string }) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-0.5 rounded text-xs border font-mono',
      styles[label] || styles.generated
    )}>
      {label === 'running' && (
        <span className="w-1.5 h-1.5 bg-warning rounded-full mr-1.5 animate-pulse" />
      )}
      {label === 'cancelling' && (
        <span className="w-1.5 h-1.5 bg-error rounded-full mr-1.5 animate-pulse" />
      )}
      {label}
    </span>
  )
}
