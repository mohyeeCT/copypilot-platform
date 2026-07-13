import type { GeoPilotPrimarySurface } from '@/lib/api/geopilot'

export const GEOPILOT_SURFACES: Array<{ value: GeoPilotPrimarySurface; label: string }> = [
  { value: 'google_ai_overview', label: 'Google AI Overview' },
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'claude', label: 'Claude' },
]

export const ALL_GEOPILOT_SURFACES = GEOPILOT_SURFACES.map(option => option.value)

type SurfaceSelectorProps = {
  selected: GeoPilotPrimarySurface[]
  onChange: (surfaces: GeoPilotPrimarySurface[]) => void
  disabled?: boolean
}

export default function SurfaceSelector({ selected, onChange, disabled = false }: SurfaceSelectorProps) {
  function toggle(surface: GeoPilotPrimarySurface) {
    if (selected.includes(surface)) {
      if (selected.length === 1) return
      onChange(selected.filter(value => value !== surface))
      return
    }
    onChange([...selected, surface])
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {GEOPILOT_SURFACES.map(option => (
        <label
          key={option.value}
          className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text"
        >
          <input
            type="checkbox"
            checked={selected.includes(option.value)}
            onChange={() => toggle(option.value)}
            disabled={disabled || (selected.length === 1 && selected.includes(option.value))}
            className="h-4 w-4 accent-accent"
          />
          {option.label}
        </label>
      ))}
    </div>
  )
}
