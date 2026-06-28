type BadgeStyle = { bg: string; fg: string; bd: string; dot?: string }

const BADGE_STYLES: Record<string, BadgeStyle> = {
  // Status badges — explicit rgba so opacity works regardless of CSS var format
  pending:    { bg: 'rgba(124,118,111,0.10)', fg: '#7C766F', bd: 'rgba(124,118,111,0.18)' },
  running:    { bg: 'rgba(198,123,0,0.14)',   fg: '#A8690A', bd: 'rgba(198,123,0,0.30)',   dot: '#C67B00' },
  complete:   { bg: 'rgba(11,122,92,0.12)',   fg: '#0B7A5C', bd: 'rgba(11,122,92,0.24)' },
  failed:     { bg: 'rgba(198,40,40,0.10)',   fg: '#C62828', bd: 'rgba(198,40,40,0.20)' },
  cancelling: { bg: 'rgba(198,40,40,0.10)',   fg: '#C62828', bd: 'rgba(198,40,40,0.20)',   dot: '#C62828' },
  cancelled:  { bg: 'rgba(124,118,111,0.10)', fg: '#7C766F', bd: 'rgba(124,118,111,0.18)' },
  error:      { bg: 'rgba(198,40,40,0.10)',   fg: '#C62828', bd: 'rgba(198,40,40,0.20)' },
  ok:         { bg: 'rgba(11,122,92,0.12)',   fg: '#0B7A5C', bd: 'rgba(11,122,92,0.24)' },
  // Keyword source badges
  manual:     { bg: 'rgba(124,118,111,0.10)', fg: '#7C766F', bd: 'rgba(124,118,111,0.18)' },
  fallback:   { bg: 'rgba(198,123,0,0.14)',   fg: '#A8690A', bd: 'rgba(198,123,0,0.30)' },
  generated:  { bg: 'rgba(124,118,111,0.10)', fg: '#7C766F', bd: 'rgba(124,118,111,0.18)' },
  // SERP signal badges
  gsc:        { bg: 'rgba(96,165,250,0.12)',  fg: '#3B82F6', bd: 'rgba(96,165,250,0.22)' },
  paa:        { bg: 'rgba(96,165,250,0.12)',  fg: '#3B82F6', bd: 'rgba(96,165,250,0.22)' },
  ai_overview:{ bg: 'rgba(168,85,247,0.12)',  fg: '#9333EA', bd: 'rgba(168,85,247,0.22)' },
}

const FALLBACK_STYLE: BadgeStyle = {
  bg: 'rgba(124,118,111,0.10)', fg: '#7C766F', bd: 'rgba(124,118,111,0.18)',
}

export default function Badge({ label }: { label: string }) {
  const s = BADGE_STYLES[label] ?? FALLBACK_STYLE
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 7px',
        borderRadius: 6,
        fontSize: '0.6875rem',
        fontWeight: 500,
        fontFamily: 'var(--font-mono), "JetBrains Mono", ui-monospace, monospace',
        border: `1px solid ${s.bd}`,
        background: s.bg,
        color: s.fg,
        whiteSpace: 'nowrap',
      }}
    >
      {s.dot && (
        <span
          className="status-pulse"
          style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }}
        />
      )}
      {label}
    </span>
  )
}
