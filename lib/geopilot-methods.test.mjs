import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildMeasurementMethods,
  collectionMethodLabel,
  isPrimaryCollectionMethod,
  measurementCostKey,
  surfaceMethodLabel,
} from './geopilot-methods.ts'

test('GEOPilot expands API, Consumer UI, and Both without changing fixed surfaces', () => {
  assert.deepEqual(buildMeasurementMethods(
    ['google_ai_overview', 'chatgpt', 'gemini', 'claude'],
    { chatgpt: 'both', gemini: 'consumer_ui' },
  ), {
    google_ai_overview: ['google_search_result'],
    chatgpt: ['model_api', 'consumer_ui_organic'],
    gemini: ['consumer_ui_organic'],
    claude: ['model_api'],
  })
})

test('GEOPilot identifies primary methods without treating calibration as an API result', () => {
  assert.equal(isPrimaryCollectionMethod('chatgpt', 'model_api'), true)
  assert.equal(isPrimaryCollectionMethod('chatgpt', 'consumer_ui_organic'), false)
  assert.equal(isPrimaryCollectionMethod('unknown', undefined), false)
})

test('GEOPilot labels method provenance and cost keys consistently', () => {
  assert.equal(collectionMethodLabel('consumer_ui_organic'), 'Consumer UI')
  assert.equal(surfaceMethodLabel('gemini', 'model_api'), 'Gemini / Model API')
  assert.equal(measurementCostKey('gemini', 'consumer_ui_organic'), 'gemini:consumer_ui_organic')
})
