'use client'

import { Play, X } from 'lucide-react'
import { useState } from 'react'
import type { GeoPilotPrimarySurface, GeoPilotSurface } from '@/lib/api/geopilot'
import { estimateRunCost, formatUsd, type GeoPilotCostAverageMap } from '@/lib/geopilot-costs'
import SurfaceSelector from './SurfaceSelector'

export type GeoPilotRunTarget = {
  collectionId?: string
  label: string
  promptCount: number
  calibrationCount: number
  surfaces: GeoPilotPrimarySurface[]
  averageCosts: GeoPilotCostAverageMap
  budget?: {
    monthlyBudgetUsd: number
    monthActualUsd: number
    state: 'ok' | 'near' | 'over'
  }
  profileBudgetWarnings?: number
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
  const estimate = estimateRunCost({
    promptCount: target.promptCount,
    surfaces,
    calibrationCount: calibrationMeasurements,
    averages: target.averageCosts,
  })
  const projectedSpend = target.budget ? target.budget.monthActualUsd + estimate.estimatedUsd : null
  const projectedOverBudget = target.budget && projectedSpend != null && projectedSpend >= target.budget.monthlyBudgetUsd
  const selectedWithNoHistory = (surfaces as GeoPilotSurface[]).filter(surface => target.averageCosts[surface] == null)
  if (calibrationMeasurements && target.averageCosts.chatgpt_calibration == null) selectedWithNoHistory.push('chatgpt_calibration')

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

        <div className="mt-4 rounded-lg border border-border bg-bg p-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-text">Estimated provider cost</p>
              <p className="mt-1 text-xs text-muted">Based on this profile&apos;s recorded 90-day average for each source.</p>
            </div>
            <strong className="shrink-0 text-sm text-text">
              {estimate.pricedMeasurements ? `${estimate.unpricedMeasurements ? 'At least ' : ''}${formatUsd(estimate.estimatedUsd)}` : 'Not available'}
            </strong>
          </div>
          {selectedWithNoHistory.length ? (
            <p className="mt-2 text-xs text-warning">No cost history yet for {selectedWithNoHistory.map(surface => surface.replaceAll('_', ' ')).join(', ')}. The final charge may be higher.</p>
          ) : null}
          {target.budget ? (
            <p className={`mt-2 text-xs ${projectedOverBudget || target.budget.state === 'over' ? 'text-error' : target.budget.state === 'near' ? 'text-warning' : 'text-muted'}`}>
              Monthly collection spend: {formatUsd(target.budget.monthActualUsd)} of {formatUsd(target.budget.monthlyBudgetUsd)}
              {projectedOverBudget ? ' / this run may reach or exceed the budget' : ''}
            </p>
          ) : target.profileBudgetWarnings ? (
            <p className="mt-2 text-xs text-warning">{target.profileBudgetWarnings} collection{target.profileBudgetWarnings === 1 ? '' : 's'} already near or over the monthly budget.</p>
          ) : null}
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
