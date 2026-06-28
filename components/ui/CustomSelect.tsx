'use client'
import { useRef, useState, useEffect, useId, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { displayOptionLabel } from '@/lib/option-labels'

type OptionObject = { value: string; label: string; group?: string }
type Option = string | OptionObject

function toObj(o: Option): OptionObject {
  return typeof o === 'string' ? { value: o, label: displayOptionLabel(o) } : o
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
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const id = useId()

  const opts = options.map(toObj)
  const selected = opts.find(o => o.value === value)

  useEffect(() => {
    if (!open) return

    function positionPanel() {
      const trigger = triggerRef.current
      if (!trigger) return

      const rect = trigger.getBoundingClientRect()
      const gap = 4
      const viewportGap = 8
      const desiredHeight = Math.min(opts.length * 40, 320)
      const spaceBelow = window.innerHeight - rect.bottom - viewportGap
      const spaceAbove = rect.top - viewportGap
      const openAbove = spaceBelow < desiredHeight && spaceAbove > spaceBelow
      const maxHeight = Math.max(80, Math.min(desiredHeight, openAbove ? spaceAbove - gap : spaceBelow - gap))

      setPanelStyle({
        position: 'fixed',
        top: openAbove ? rect.top - Math.min(desiredHeight, maxHeight) - gap : rect.bottom + gap,
        left: rect.left,
        right: 'auto',
        width: rect.width,
        maxHeight,
        overflowY: 'auto',
      })
    }

    function onDown(e: MouseEvent) {
      const target = e.target as Node
      if (!wrapRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false)
      }
    }

    positionPanel()
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', positionPanel)
    window.addEventListener('scroll', positionPanel, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', positionPanel)
      window.removeEventListener('scroll', positionPanel, true)
    }
  }, [open, opts.length])

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
    <div ref={wrapRef} className={`cs-wrap relative ${className}`}>
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

      {open && createPortal(
        <div ref={panelRef} id={`${id}-panel`} role="listbox" className="cs-panel" style={panelStyle}>
          {opts.map((opt, index) => (
            <div key={opt.value}>
              {opt.group && opt.group !== opts[index - 1]?.group && (
                <div role="presentation" className="cs-option-group">{opt.group}</div>
              )}
              <button
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
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
