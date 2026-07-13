'use client'

import { Play, X } from 'lucide-react'
import { useState } from 'react'
import type { GeoPilotPrimarySurface } from '@/lib/api/geopilot'
import SurfaceSelector from './SurfaceSelector'

export type GeoPilotRunTarget = {
  collectionId?: string
  label: string
  promptCount: number
  calibrationCount: number
  surfaces: GeoPilotPrimarySurface[]
}

type RunSurfaceDialogProps = {
  target: GeoPilotRunTarget
  busy: boolean
  onClose: () => void
  onRun: (surfaces: GeoPilotPrimarySurface[], includeCalibration: boolean) => void
}

export default function RunSurfaceDialog({ target, busy, onClose, onRun }: RunSurfaceDialogProps) {
  const [surfaces, setSurfaces] = useState<GeoPilotPrimarySurface[]>(target.surfaces)
  const [includeCalibration, setIncludeCalibration] = useState(target.calibrationCount > 0)
  const calibrationMeasurements = includeCalibration ? target.calibrationCount : 0
  const measurementCount = target.promptCount * surfaces.length + calibrationMeasurements

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose run surfaces"
        className="w-full max-w-xl rounded-lg border border-border bg-surface-raised p-5 shadow-lg"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-text">Run {target.label}</h2>
            <p className="mt-1 text-xs text-muted">Choose the sources to measure in this run.</p>
          </div>
          <button type="button" className="btn-ghost px-2" title="Close" onClick={onClose} disabled={busy}>
            <X size={15} />
          </button>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold text-muted">Sources</p>
          <SurfaceSelector selected={surfaces} onChange={setSurfaces} disabled={busy} />
        </div>

        {target.calibrationCount > 0 && (
          <label className="mt-4 flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={includeCalibration}
              onChange={event => setIncludeCalibration(event.target.checked)}
              disabled={busy}
              className="h-4 w-4 accent-accent"
            />
            Include ChatGPT consumer calibration ({target.calibrationCount})
          </label>
        )}

        <div className="mt-5 grid grid-cols-3 gap-3 border-y border-border py-4 text-center">
          <div><p className="text-lg font-semibold text-text">{target.promptCount}</p><p className="text-xs text-muted">Prompts</p></div>
          <div><p className="text-lg font-semibold text-text">{surfaces.length}</p><p className="text-xs text-muted">Sources</p></div>
          <div><p className="text-lg font-semibold text-accent">{measurementCount}</p><p className="text-xs text-muted">Measurements</p></div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            type="button"
            className="btn-primary gap-2"
            onClick={() => onRun(surfaces, includeCalibration)}
            disabled={busy || measurementCount === 0}
          >
            <Play size={14} />
            {busy ? 'Starting...' : `Start ${measurementCount} measurements`}
          </button>
        </div>
      </div>
    </div>
  )
}
