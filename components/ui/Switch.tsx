'use client'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  ariaLabel: string
  disabled?: boolean
  className?: string
}

export default function Switch({ checked, onChange, ariaLabel, disabled = false, className = '' }: SwitchProps) {
  function toggle() {
    if (!disabled) onChange(!checked)
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={toggle}
      className={`cp-switch ${className}`}
      data-checked={checked ? 'true' : 'false'}
    >
      <span className="cp-switch-knob" />
    </button>
  )
}
