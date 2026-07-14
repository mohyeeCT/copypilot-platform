import assert from 'node:assert/strict'
import test from 'node:test'

import {
  availableSurfaceMethods,
  buildDashboardTrend,
} from './geopilot-dashboard.ts'

const displayMethods = {
  google_ai_overview: 'google_search_result',
  chatgpt: 'consumer_ui_organic',
  gemini: 'model_api',
  claude: 'model_api',
}

test('GEOPilot trend uses only the displayed method for each surface', () => {
  const points = buildDashboardTrend({
    metric: 'visibility_score',
    displayMethods,
    timeline: [
      { metric_date: '2026-07-14', surface: 'google_ai_overview', collection_method: 'google_search_result', visibility_score: 60, successful_runs: 4 },
      { metric_date: '2026-07-14', surface: 'chatgpt', collection_method: 'model_api', visibility_score: 20, successful_runs: 4 },
      { metric_date: '2026-07-14', surface: 'chatgpt', collection_method: 'consumer_ui_organic', visibility_score: 80, successful_runs: 4 },
    ],
  })

  assert.equal(points.length, 1)
  assert.equal(points[0].value, 70)
  assert.equal(points[0].successfulRuns, 8)
  assert.deepEqual(points[0].methods, ['google_search_result', 'consumer_ui_organic'])
})

test('GEOPilot selected surface trend never combines API and Consumer UI', () => {
  const points = buildDashboardTrend({
    metric: 'visibility_score',
    surface: 'chatgpt',
    method: 'model_api',
    displayMethods,
    timeline: [
      { metric_date: '2026-07-14', surface: 'chatgpt', collection_method: 'model_api', visibility_score: 25, successful_runs: 4 },
      { metric_date: '2026-07-14', surface: 'chatgpt', collection_method: 'consumer_ui_organic', visibility_score: 75, successful_runs: 4 },
    ],
  })

  assert.equal(points[0].value, 25)
  assert.deepEqual(points[0].methods, ['model_api'])
})

test('GEOPilot combines collections before averaging surfaces equally', () => {
  const points = buildDashboardTrend({
    metric: 'visibility_score',
    displayMethods,
    timeline: [
      { metric_date: '2026-07-14', surface: 'chatgpt', collection_method: 'consumer_ui_organic', visibility_score: 0, successful_runs: 1 },
      { metric_date: '2026-07-14', surface: 'chatgpt', collection_method: 'consumer_ui_organic', visibility_score: 100, successful_runs: 3 },
      { metric_date: '2026-07-14', surface: 'gemini', collection_method: 'model_api', visibility_score: 25, successful_runs: 10 },
    ],
  })

  assert.equal(points[0].value, 50)
  assert.equal(points[0].successfulRuns, 14)
})

test('GEOPilot AI Overview trend ignores non-Google rows', () => {
  const points = buildDashboardTrend({
    metric: 'ai_overview_coverage',
    displayMethods,
    timeline: [
      { metric_date: '2026-07-14', surface: 'google_ai_overview', collection_method: 'google_search_result', ai_overview_coverage: 75 },
      { metric_date: '2026-07-14', surface: 'chatgpt', collection_method: 'consumer_ui_organic', ai_overview_coverage: 10 },
    ],
  })

  assert.equal(points[0].value, 75)
  assert.deepEqual(points[0].methods, ['google_search_result'])
})

test('GEOPilot discovers method controls from history and current runs', () => {
  assert.deepEqual(availableSurfaceMethods(
    [{ surface: 'chatgpt', collection_method: 'model_api' }],
    [{ surface: 'chatgpt', collection_method: 'consumer_ui_organic' }],
    'chatgpt',
  ), ['model_api', 'consumer_ui_organic'])
})
