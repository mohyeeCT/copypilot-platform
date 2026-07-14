import assert from 'node:assert/strict'
import test from 'node:test'

import { estimateRunCost, formatUsd } from './geopilot-costs.ts'

test('GEOPilot estimates known surface costs and reports missing history', () => {
  const estimate = estimateRunCost({
    promptCount: 2,
    surfaces: ['google_ai_overview', 'chatgpt'],
    calibrationCount: 1,
    averages: { google_ai_overview: 0.003, chatgpt_calibration: 0.0012 },
  })

  assert.equal(estimate.estimatedUsd, 0.0072)
  assert.equal(estimate.pricedMeasurements, 3)
  assert.equal(estimate.unpricedMeasurements, 2)
})

test('GEOPilot formats small recorded provider costs without rounding them to zero', () => {
  assert.equal(formatUsd(0.006), '$0.0060')
  assert.equal(formatUsd(2.5), '$2.50')
  assert.equal(formatUsd(null), '-')
})
