import type {
  GeoPilotMeasurementMethods,
  GeoPilotPrimarySurface,
} from '@/lib/api/geopilot'
import {
  collectionRunModeLabel,
  runModeForMeasurementMethods,
  surfaceLabel,
  updateCollectionRunMode,
  type GeoPilotRunMode,
} from '@/lib/geopilot-methods'

type CollectionMethodSelectorProps = {
  surfaces: GeoPilotPrimarySurface[]
  measurementMethods: GeoPilotMeasurementMethods
  consumerUiEnabled: boolean
  consumerUiSurfaces: GeoPilotPrimarySurface[]
  schedule: 'manual' | 'daily'
  onChange: (methods: GeoPilotMeasurementMethods) => void
  disabled?: boolean
}

const RUN_MODES: GeoPilotRunMode[] = ['api', 'consumer_ui', 'both']

export default function CollectionMethodSelector({
  surfaces,
  measurementMethods,
  consumerUiEnabled,
  consumerUiSurfaces,
  schedule,
  onChange,
  disabled = false,
}: CollectionMethodSelectorProps) {
  const selectableSurfaces = surfaces.filter(surface => consumerUiSurfaces.includes(surface))
  if (!consumerUiEnabled || !selectableSurfaces.length) return null

  const manualOnly = schedule === 'daily'

  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-muted">Collection method</p>
      <div className="grid gap-2">
        {selectableSurfaces.map(surface => (
          <div key={surface} className="flex min-h-10 flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
            <span className="text-sm font-medium text-text">{surfaceLabel(surface)}</span>
            <div className="inline-flex rounded-md border border-border bg-bg p-0.5" role="group" aria-label={`${surfaceLabel(surface)} collection method`}>
              {RUN_MODES.map(mode => {
                const selected = runModeForMeasurementMethods(surface, measurementMethods) === mode
                const unavailable = manualOnly && mode !== 'api'
                return (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={selected}
                    className={`h-7 rounded px-2.5 text-[11px] font-semibold transition-colors ${
                      selected
                        ? 'bg-surface-raised text-text shadow-sm ring-1 ring-border'
                        : 'text-muted hover:text-text'
                    }`}
                    onClick={() => onChange(updateCollectionRunMode(surfaces, measurementMethods, surface, mode))}
                    disabled={disabled || unavailable}
                    title={unavailable ? 'Available for manual collections during the pilot' : undefined}
                  >
                    {collectionRunModeLabel(mode)}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      {manualOnly ? <p className="mt-2 text-xs text-muted">Daily schedule: API collection only during the pilot.</p> : null}
    </div>
  )
}
