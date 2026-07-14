import assert from 'node:assert/strict'
import test from 'node:test'

import { estimateRunCost, formatUsd } from './geopilot-costs.ts'

test('GEOPilot estimates known surface costs and reports missing history', () => {
  const estimate = estimateRunCost({
    promptCount: 2,
    surfaces: ['google_ai_overview', 'chatgpt'],
    measurementMethods: {
      google_ai_overview: ['google_search_result'],
      chatgpt: ['model_api'],
    },
    calibrationCount: 1,
    averages: {
      'google_ai_overview:google_search_result': 0.003,
      'chatgpt_calibration:consumer_ui_forced_search': 0.0012,
    },
  })

  assert.equal(estimate.estimatedUsd, 0.0072)
  assert.equal(estimate.pricedMeasurements, 3)
  assert.equal(estimate.unpricedMeasurements, 2)
})

test('GEOPilot prices API and Consumer UI measurements independently', () => {
  const estimate = estimateRunCost({
    promptCount: 3,
    surfaces: ['chatgpt', 'gemini'],
    measurementMethods: {
      chatgpt: ['model_api', 'consumer_ui_organic'],
      gemini: ['consumer_ui_organic'],
    },
    calibrationCount: 0,
    averages: { 'chatgpt:model_api': 0.002 },
    fixedCosts: {
      'chatgpt:consumer_ui_organic': 0.004,
      'gemini:consumer_ui_organic': 0.004,
    },
  })

  assert.ok(Math.abs(estimate.estimatedUsd - 0.03) < Number.EPSILON)
  assert.equal(estimate.pricedMeasurements, 9)
  assert.equal(estimate.fallbackMeasurements, 6)
  assert.equal(estimate.unpricedMeasurements, 0)
})

test('GEOPilot formats small recorded provider costs without rounding them to zero', () => {
  assert.equal(formatUsd(0.006), '$0.0060')
  assert.equal(formatUsd(2.5), '$2.50')
  assert.equal(formatUsd(null), '-')
})
