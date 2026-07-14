import type { GeoPilotPrimarySurface, GeoPilotSurface } from './api/geopilot'

export type GeoPilotCostAverageMap = Partial<Record<GeoPilotSurface, number | null>>

export function formatUsd(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return '-'
  const amount = Number(value)
  const digits = amount >= 1 ? 2 : amount >= 0.01 ? 3 : 4
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount)
}

export function estimateRunCost({
  promptCount,
  surfaces,
  calibrationCount,
  averages,
}: {
  promptCount: number
  surfaces: GeoPilotPrimarySurface[]
  calibrationCount: number
  averages: GeoPilotCostAverageMap
}) {
  let estimatedUsd = 0
  let pricedMeasurements = 0
  let unpricedMeasurements = 0

  for (const surface of surfaces) {
    const average = averages[surface]
    if (average == null) {
      unpricedMeasurements += promptCount
    } else {
      estimatedUsd += Number(average) * promptCount
      pricedMeasurements += promptCount
    }
  }

  if (calibrationCount) {
    const average = averages.chatgpt_calibration
    if (average == null) {
      unpricedMeasurements += calibrationCount
    } else {
      estimatedUsd += Number(average) * calibrationCount
      pricedMeasurements += calibrationCount
    }
  }

  return { estimatedUsd, pricedMeasurements, unpricedMeasurements }
}
