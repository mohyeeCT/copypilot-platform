'use client'

import type { MouseEvent } from 'react'
import { Check } from 'lucide-react'

interface StyledCheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  ariaLabel: string
  disabled?: boolean
  className?: string
  onClick?: (event: MouseEvent<HTMLLabelElement>) => void
}

export default function StyledCheckbox({ checked, onChange, ariaLabel, disabled = false, className = '', onClick }: StyledCheckboxProps) {
  return (
    <label className={`cp-checkbox ${className}`} data-checked={checked ? 'true' : 'false'} onClick={onClick}>
      <input
        type="checkbox"
        aria-label={ariaLabel}
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
      />
      <span className="cp-checkbox-box" aria-hidden="true">
        {checked && <Check size={12} strokeWidth={3} />}
      </span>
    </label>
  )
}
