'use client'

import { Play, X } from 'lucide-react'
import { useState } from 'react'
import type { GeoPilotMeasurementMethods, GeoPilotPrimarySurface } from '@/lib/api/geopilot'
import {
  estimateRunCost,
  formatUsd,
  type GeoPilotCostAverageMap,
  type GeoPilotFixedCostMap,
} from '@/lib/geopilot-costs'
import {
  buildMeasurementMethods,
  collectionMethodLabel,
  measurementCostKey,
  runModeForMeasurementMethods,
  surfaceLabel,
  type GeoPilotRunMode,
} from '@/lib/geopilot-methods'
import SurfaceSelector from './SurfaceSelector'

export type GeoPilotRunTarget = {
  collectionId?: string
  label: string
  promptCount: number
  calibrationCount: number
  surfaces: GeoPilotPrimarySurface[]
  averageCosts: GeoPilotCostAverageMap
  fixedCosts: GeoPilotFixedCostMap
  consumerUi: {
    enabled: boolean
    surfaces: GeoPilotPrimarySurface[]
  }
  defaultMeasurementMethods?: GeoPilotMeasurementMethods
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
  onRun: (
    surfaces: GeoPilotPrimarySurface[],
    measurementMethods: GeoPilotMeasurementMethods,
    includeCalibration: boolean,
  ) => void
}

export default function RunSurfaceDialog({ target, busy, onClose, onRun }: RunSurfaceDialogProps) {
  const [surfaces, setSurfaces] = useState<GeoPilotPrimarySurface[]>(target.surfaces)
  const [runModes, setRunModes] = useState<Partial<Record<GeoPilotPrimarySurface, GeoPilotRunMode>>>(() => ({
    chatgpt: runModeForMeasurementMethods('chatgpt', target.defaultMeasurementMethods),
    gemini: runModeForMeasurementMethods('gemini', target.defaultMeasurementMethods),
  }))
  const [includeCalibration, setIncludeCalibration] = useState(target.calibrationCount > 0)
  const measurementMethods = buildMeasurementMethods(surfaces, runModes)
  const calibrationMeasurements = includeCalibration ? target.calibrationCount : 0
  const methodCount = Object.values(measurementMethods).reduce((sum, methods) => sum + (methods?.length || 0), 0)
  const measurementCount = target.promptCount * methodCount + calibrationMeasurements
  const estimate = estimateRunCost({
    promptCount: target.promptCount,
    surfaces,
    measurementMethods,
    calibrationCount: calibrationMeasurements,
    averages: target.averageCosts,
    fixedCosts: target.fixedCosts,
  })
  const projectedSpend = target.budget ? target.budget.monthActualUsd + estimate.estimatedUsd : null
  const projectedOverBudget = target.budget && projectedSpend != null && projectedSpend >= target.budget.monthlyBudgetUsd
  const selectedWithNoPrice = surfaces.flatMap(surface => (
    measurementMethods[surface] || []
  ).filter(method => {
    const key = measurementCostKey(surface, method)
    return target.averageCosts[key] == null && target.fixedCosts[key] == null
  }).map(method => `${surfaceLabel(surface)} ${collectionMethodLabel(method)}`))
  const calibrationCostKey = measurementCostKey('chatgpt_calibration', 'consumer_ui_forced_search')
  if (
    calibrationMeasurements
    && target.averageCosts[calibrationCostKey] == null
    && target.fixedCosts[calibrationCostKey] == null
  ) selectedWithNoPrice.push('ChatGPT consumer calibration')
  const consumerUiChoices = surfaces.filter(surface => (
    target.consumerUi.enabled && target.consumerUi.surfaces.includes(surface)
  ))

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
            <p className="mt-1 text-xs text-muted">Choose the engines and collection method for this run.</p>
          </div>
          <button type="button" className="btn-ghost px-2" title="Close" onClick={onClose} disabled={busy}>
            <X size={15} />
          </button>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold text-muted">Engines</p>
          <SurfaceSelector selected={surfaces} onChange={setSurfaces} disabled={busy} />
        </div>

        {consumerUiChoices.length ? (
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-2 text-xs font-semibold text-muted">Collection method</p>
            <div className="grid gap-2">
              {consumerUiChoices.map(surface => (
                <div key={surface} className="flex min-h-10 flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
                  <span className="text-sm font-medium text-text">{surfaceLabel(surface)}</span>
                  <div className="inline-flex rounded-md border border-border bg-bg p-0.5" role="group" aria-label={`${surfaceLabel(surface)} collection method`}>
                    {([
                      ['api', 'API'],
                      ['consumer_ui', 'Consumer UI'],
                      ['both', 'Both'],
                    ] as Array<[GeoPilotRunMode, string]>).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={(runModes[surface] || 'api') === value}
                        className={`h-7 rounded px-2.5 text-[11px] font-semibold transition-colors ${
                          (runModes[surface] || 'api') === value
                            ? 'bg-surface-raised text-text shadow-sm ring-1 ring-border'
                            : 'text-muted hover:text-text'
                        }`}
                        onClick={() => setRunModes(current => ({ ...current, [surface]: value }))}
                        disabled={busy}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

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
          <div><p className="text-lg font-semibold text-text">{surfaces.length}</p><p className="text-xs text-muted">Engines</p></div>
          <div><p className="text-lg font-semibold text-accent">{measurementCount}</p><p className="text-xs text-muted">Measurements</p></div>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-bg p-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-text">Estimated provider cost</p>
              <p className="mt-1 text-xs text-muted">Uses the profile&apos;s 90-day method average, then the published live rate when available.</p>
            </div>
            <strong className="shrink-0 text-sm text-text">
              {estimate.pricedMeasurements ? `${estimate.unpricedMeasurements ? 'At least ' : ''}${formatUsd(estimate.estimatedUsd)}` : 'Not available'}
            </strong>
          </div>
          {selectedWithNoPrice.length ? (
            <p className="mt-2 text-xs text-warning">No recorded or published price for {selectedWithNoPrice.join(', ')}. The final charge may be higher.</p>
          ) : null}
          {estimate.fallbackMeasurements ? (
            <p className="mt-2 text-xs text-muted">{estimate.fallbackMeasurements} Consumer UI measurement{estimate.fallbackMeasurements === 1 ? '' : 's'} estimated at the published live rate.</p>
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
            onClick={() => onRun(surfaces, measurementMethods, includeCalibration)}
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
