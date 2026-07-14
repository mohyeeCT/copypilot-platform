import type {
  GeoPilotCollectionMethod,
  GeoPilotMeasurementMethods,
  GeoPilotPrimarySurface,
  GeoPilotSurface,
} from './api/geopilot'

export type GeoPilotRunMode = 'api' | 'consumer_ui' | 'both'

export const PRIMARY_METHOD_BY_SURFACE: Record<GeoPilotSurface, GeoPilotCollectionMethod> = {
  google_ai_overview: 'google_search_result',
  chatgpt: 'model_api',
  gemini: 'model_api',
  claude: 'model_api',
  chatgpt_calibration: 'consumer_ui_forced_search',
}

export const CONSUMER_UI_SURFACES: GeoPilotPrimarySurface[] = ['chatgpt', 'gemini']

export function collectionMethodLabel(method?: string | null) {
  if (method === 'model_api') return 'Model API'
  if (method === 'consumer_ui_organic') return 'Consumer UI'
  if (method === 'consumer_ui_forced_search') return 'Consumer calibration'
  if (method === 'google_search_result') return 'Google search result'
  return 'Measurement method'
}

export function surfaceLabel(surface: string) {
  if (surface === 'google_ai_overview') return 'Google AI Overview'
  if (surface === 'chatgpt') return 'ChatGPT'
  if (surface === 'gemini') return 'Gemini'
  if (surface === 'claude') return 'Claude'
  if (surface === 'chatgpt_calibration') return 'ChatGPT calibration'
  return surface.replaceAll('_', ' ').replace(/^./, character => character.toUpperCase())
}

export function surfaceMethodLabel(surface: string, method?: string | null) {
  return `${surfaceLabel(surface)} / ${collectionMethodLabel(method || PRIMARY_METHOD_BY_SURFACE[surface as GeoPilotSurface])}`
}

export function deliveryMethodLabel(method?: string | null) {
  if (method === 'live') return 'Live request'
  if (method === 'standard') return 'Scheduled request'
  return method ? method.replaceAll('_', ' ').replace(/^./, character => character.toUpperCase()) : 'Provider request'
}

export function isPrimaryCollectionMethod(surface: string, method?: string | null) {
  const primaryMethod = PRIMARY_METHOD_BY_SURFACE[surface as GeoPilotSurface]
  return Boolean(primaryMethod && primaryMethod === (method || primaryMethod))
}

export function methodsForRunMode(surface: GeoPilotPrimarySurface, mode: GeoPilotRunMode) {
  if (!CONSUMER_UI_SURFACES.includes(surface)) return [PRIMARY_METHOD_BY_SURFACE[surface]]
  if (mode === 'consumer_ui') return ['consumer_ui_organic'] satisfies GeoPilotCollectionMethod[]
  if (mode === 'both') return ['model_api', 'consumer_ui_organic'] satisfies GeoPilotCollectionMethod[]
  return ['model_api'] satisfies GeoPilotCollectionMethod[]
}

export function buildMeasurementMethods(
  surfaces: GeoPilotPrimarySurface[],
  modes: Partial<Record<GeoPilotPrimarySurface, GeoPilotRunMode>>,
): GeoPilotMeasurementMethods {
  return Object.fromEntries(
    surfaces.map(surface => [surface, methodsForRunMode(surface, modes[surface] || 'api')]),
  ) as GeoPilotMeasurementMethods
}

export function runModeForMeasurementMethods(
  surface: GeoPilotPrimarySurface,
  measurementMethods?: GeoPilotMeasurementMethods,
): GeoPilotRunMode {
  const methods = measurementMethods?.[surface] || [PRIMARY_METHOD_BY_SURFACE[surface]]
  const hasApi = methods.includes('model_api')
  const hasConsumerUi = methods.includes('consumer_ui_organic')
  if (hasApi && hasConsumerUi) return 'both'
  if (hasConsumerUi) return 'consumer_ui'
  return 'api'
}

export function normalizeCollectionMeasurementMethods(
  surfaces: GeoPilotPrimarySurface[],
  measurementMethods?: GeoPilotMeasurementMethods,
): GeoPilotMeasurementMethods {
  return Object.fromEntries(surfaces.map(surface => [
    surface,
    methodsForRunMode(surface, runModeForMeasurementMethods(surface, measurementMethods)),
  ])) as GeoPilotMeasurementMethods
}

export function updateCollectionRunMode(
  surfaces: GeoPilotPrimarySurface[],
  measurementMethods: GeoPilotMeasurementMethods,
  surface: GeoPilotPrimarySurface,
  mode: GeoPilotRunMode,
): GeoPilotMeasurementMethods {
  return {
    ...normalizeCollectionMeasurementMethods(surfaces, measurementMethods),
    [surface]: methodsForRunMode(surface, mode),
  }
}

export function collectionRunModeLabel(mode: GeoPilotRunMode) {
  if (mode === 'consumer_ui') return 'Consumer UI'
  if (mode === 'both') return 'Both'
  return 'API'
}

export function measurementCostKey(surface: string, method: string) {
  return `${surface}:${method}`
}
