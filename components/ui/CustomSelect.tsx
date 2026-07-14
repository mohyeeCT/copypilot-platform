'use client'

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { displayOptionLabel } from '@/lib/option-labels'

type OptionObject = { value: string; label: string; group?: string }
type Option = string | OptionObject
export type CustomSelectSize = 'default' | 'compact'

function toObj(option: Option): OptionObject {
  return typeof option === 'string'
    ? { value: option, label: displayOptionLabel(option) }
    : option
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: Option[]
  className?: string
  placeholder?: string
  size?: CustomSelectSize
  disabled?: boolean
  ariaLabel?: string
}

export default function CustomSelect({
  value,
  onChange,
  options,
  className = '',
  placeholder,
  size = 'default',
  disabled = false,
  ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [panelSide, setPanelSide] = useState<'top' | 'bottom'>('bottom')
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({})
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const id = useId()

  const opts = options.map(toObj)
  const optionCount = opts.length
  const groupCount = new Set(opts.map(option => option.group).filter(Boolean)).size
  const selectedIndex = opts.findIndex(option => option.value === value)
  const selected = selectedIndex >= 0 ? opts[selectedIndex] : undefined

  useEffect(() => {
    if (!open) return

    function positionPanel() {
      const trigger = triggerRef.current
      if (!trigger) return

      const rect = trigger.getBoundingClientRect()
      const gap = 4
      const viewportGap = 8
      const optionHeight = size === 'compact' ? 32 : 36
      const desiredHeight = Math.min((optionCount * optionHeight) + (groupCount * 24) + 8, 320)
      const spaceBelow = window.innerHeight - rect.bottom - viewportGap
      const spaceAbove = rect.top - viewportGap
      const openAbove = spaceBelow < desiredHeight && spaceAbove > spaceBelow
      const availableSpace = openAbove ? spaceAbove : spaceBelow
      const maxHeight = Math.max(72, Math.min(desiredHeight, availableSpace - gap))
      const width = Math.min(rect.width, window.innerWidth - (viewportGap * 2))
      const left = Math.max(viewportGap, Math.min(rect.left, window.innerWidth - width - viewportGap))

      setPanelSide(openAbove ? 'top' : 'bottom')
      setPanelStyle({
        position: 'fixed',
        top: openAbove ? rect.top - maxHeight - gap : rect.bottom + gap,
        left,
        right: 'auto',
        width,
        maxHeight,
        overflowY: 'auto',
      })
    }

    function closeFromPointer(event: MouseEvent) {
      const target = event.target as Node
      if (!wrapRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false)
      }
    }

    positionPanel()
    const frame = window.requestAnimationFrame(() => optionRefs.current[activeIndex]?.focus())
    document.addEventListener('mousedown', closeFromPointer)
    window.addEventListener('resize', positionPanel)
    window.addEventListener('scroll', positionPanel, true)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('mousedown', closeFromPointer)
      window.removeEventListener('resize', positionPanel)
      window.removeEventListener('scroll', positionPanel, true)
    }
  }, [activeIndex, groupCount, open, optionCount, size])

  function openMenu(index = selectedIndex >= 0 ? selectedIndex : 0) {
    if (disabled || !opts.length) return
    setActiveIndex(Math.max(0, Math.min(opts.length - 1, index)))
    setOpen(true)
  }

  function closeMenu({ restoreFocus = true } = {}) {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  function focusOption(index: number) {
    const nextIndex = Math.max(0, Math.min(opts.length - 1, index))
    setActiveIndex(nextIndex)
    optionRefs.current[nextIndex]?.focus()
  }

  function handleTriggerKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openMenu()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      openMenu(selectedIndex >= 0 ? selectedIndex : opts.length - 1)
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  function handleOptionKey(event: KeyboardEvent<HTMLButtonElement>, optionValue: string, index: number) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      focusOption(index + (event.key === 'ArrowDown' ? 1 : -1))
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      focusOption(event.key === 'Home' ? 0 : opts.length - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      pick(optionValue)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      closeMenu()
    } else if (event.key === 'Tab') {
      closeMenu({ restoreFocus: false })
    }
  }

  function pick(optionValue: string) {
    onChange(optionValue)
    closeMenu()
  }

  return (
    <div ref={wrapRef} className={`cs-wrap ${className}`} data-size={size}>
      <button
        ref={triggerRef}
        type="button"
        className="cs-trigger"
        data-open={open ? 'true' : undefined}
        data-size={size}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        disabled={disabled}
        onClick={() => open ? closeMenu({ restoreFocus: false }) : openMenu()}
        onKeyDown={handleTriggerKey}
      >
        <span className={selected ? undefined : 'cs-placeholder'}>
          {selected ? selected.label : (placeholder ?? 'Select...')}
        </span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          id={`${id}-panel`}
          role="listbox"
          aria-label={ariaLabel}
          className="cs-panel"
          data-size={size}
          data-side={panelSide}
          style={panelStyle}
        >
          {opts.map((option, index) => (
            <div key={option.value}>
              {option.group && option.group !== opts[index - 1]?.group ? (
                <div role="presentation" className="cs-option-group">{option.group}</div>
              ) : null}
              <button
                ref={element => { optionRefs.current[index] = element }}
                type="button"
                role="option"
                tabIndex={index === activeIndex ? 0 : -1}
                aria-selected={option.value === value}
                className={`cs-option${option.value === value ? ' cs-option--active' : ''}`}
                onFocus={() => setActiveIndex(index)}
                onClick={() => pick(option.value)}
                onKeyDown={event => handleOptionKey(event, option.value, index)}
              >
                <span>{option.label}</span>
                {option.value === value ? <Check size={13} aria-hidden="true" /> : null}
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
