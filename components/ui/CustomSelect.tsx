'use client'
import { useRef, useState, useEffect, useId, KeyboardEvent } from 'react'
import { Check, ChevronDown } from 'lucide-react'

type OptionObject = { value: string; label: string }
type Option = string | OptionObject

function toObj(o: Option): OptionObject {
  return typeof o === 'string' ? { value: o, label: o } : o
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: Option[]
  className?: string
  placeholder?: string
}

export default function CustomSelect({ value, onChange, options, className = '', placeholder }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const id = useId()

  const opts = options.map(toObj)
  const selected = opts.find(o => o.value === value)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function handleTriggerKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen(true)
    }
    if (e.key === 'Escape') setOpen(false)
  }

  function handleOptionKey(e: KeyboardEvent<HTMLButtonElement>, optValue: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onChange(optValue)
      setOpen(false)
      triggerRef.current?.focus()
    }
    if (e.key === 'Escape') {
      setOpen(false)
      triggerRef.current?.focus()
    }
  }

  function pick(optValue: string) {
    onChange(optValue)
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className="cs-trigger"
        data-open={open ? 'true' : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen(v => !v)}
        onKeyDown={handleTriggerKey}
      >
        <span style={{ color: selected ? 'var(--text)' : 'var(--muted)', opacity: selected ? 1 : 0.7 }}>
          {selected ? selected.label : (placeholder ?? 'Select…')}
        </span>
        <ChevronDown
          size={14}
          style={{
            color: 'var(--muted)',
            flexShrink: 0,
            transition: 'transform 0.15s ease-in-out',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {open && (
        <div id={`${id}-panel`} role="listbox" className="cs-panel">
          {opts.map(opt => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              className={`cs-option${opt.value === value ? ' cs-option--active' : ''}`}
              onClick={() => pick(opt.value)}
              onKeyDown={e => handleOptionKey(e, opt.value)}
            >
              <span>{opt.label}</span>
              {opt.value === value && <Check size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
