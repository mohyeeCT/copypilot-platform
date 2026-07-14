import type { GeoPilotMeasurementMethods, GeoPilotPrimarySurface } from './api/geopilot'

const PRIMARY_COST_METHOD: Record<GeoPilotPrimarySurface, string> = {
  google_ai_overview: 'google_search_result',
  chatgpt: 'model_api',
  gemini: 'model_api',
  claude: 'model_api',
}

function costKey(surface: string, method: string) {
  return `${surface}:${method}`
}

export type GeoPilotCostAverageMap = Partial<Record<string, number | null>>
export type GeoPilotFixedCostMap = Partial<Record<string, number>>

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
  measurementMethods,
  calibrationCount,
  averages,
  fixedCosts = {},
}: {
  promptCount: number
  surfaces: GeoPilotPrimarySurface[]
  measurementMethods: GeoPilotMeasurementMethods
  calibrationCount: number
  averages: GeoPilotCostAverageMap
  fixedCosts?: GeoPilotFixedCostMap
}) {
  let estimatedUsd = 0
  let pricedMeasurements = 0
  let unpricedMeasurements = 0
  let fallbackMeasurements = 0

  for (const surface of surfaces) {
    const methods = measurementMethods[surface] || [PRIMARY_COST_METHOD[surface]]
    for (const method of methods) {
      const key = costKey(surface, method)
      const historicalAverage = averages[key]
      const fixedCost = fixedCosts[key]
      const unitCost = historicalAverage ?? fixedCost
      if (unitCost == null) {
        unpricedMeasurements += promptCount
      } else {
        estimatedUsd += Number(unitCost) * promptCount
        pricedMeasurements += promptCount
        if (historicalAverage == null && fixedCost != null) fallbackMeasurements += promptCount
      }
    }
  }

  if (calibrationCount) {
    const key = costKey('chatgpt_calibration', 'consumer_ui_forced_search')
    const historicalAverage = averages[key]
    const fixedCost = fixedCosts[key]
    const unitCost = historicalAverage ?? fixedCost
    if (unitCost == null) {
      unpricedMeasurements += calibrationCount
    } else {
      estimatedUsd += Number(unitCost) * calibrationCount
      pricedMeasurements += calibrationCount
      if (historicalAverage == null && fixedCost != null) fallbackMeasurements += calibrationCount
    }
  }

  return { estimatedUsd, pricedMeasurements, unpricedMeasurements, fallbackMeasurements }
}
