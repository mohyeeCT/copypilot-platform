import { CSSProperties } from 'react'

interface SkeletonProps {
  className?: string
  style?: CSSProperties
  width?: string | number
  height?: string | number
}

export function Skeleton({ className = '', style, width, height }: SkeletonProps) {
  return (
    <div
      className={`rounded-lg ${className}`}
      style={{
        width,
        height: height ?? 16,
        background: 'linear-gradient(90deg, var(--border) 25%, var(--border-subtle) 50%, var(--border) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s ease-in-out infinite',
        ...style,
      }}
    />
  )
}

export function SkeletonJobCard() {
  return (
    <div
      className="px-5 py-4 flex items-center gap-4"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      {/* Status bar */}
      <div style={{ width: 3, height: 36, borderRadius: 99, background: 'var(--border)' }} />
      <div className="flex-1 space-y-2">
        <Skeleton width="45%" height={14} />
        <Skeleton width="28%" height={11} />
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Skeleton width={52} height={20} style={{ borderRadius: 6 }} />
        <Skeleton width={70} height={12} />
        <Skeleton width={28} height={28} style={{ borderRadius: 8 }} />
      </div>
    </div>
  )
}

export function SkeletonJobList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonJobCard key={i} />
      ))}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}
