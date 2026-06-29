'use client'

type SegmentedOption<T extends string> = {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  ariaLabel: string
  className?: string
}

export default function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className = '',
}: SegmentedControlProps<T>) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={`cp-segmented ${className}`}>
      {options.map(option => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            className="cp-segment"
            data-active={active ? 'true' : 'false'}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
