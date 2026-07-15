import assert from 'node:assert/strict'
import test from 'node:test'

import {
  GEOPILOT_EXPORT_DATASETS,
  loadGeoPilotExportTables,
} from './geopilot-exports.ts'


test('GEOPilot report tables preserve every dataset and parse quoted CSV safely', async () => {
  const requested = []
  const tables = await loadGeoPilotExportTables(async dataset => {
    requested.push(dataset)
    return dataset === 'prompt_history'
      ? 'prompt,visibility\n"Best agency, Detroit",50\n'
      : 'metric,value\nvisibility,25\n'
  })

  assert.deepEqual(requested, GEOPILOT_EXPORT_DATASETS.map(item => item.value))
  assert.deepEqual(tables.map(item => item.sheetName), [
    'Prompt History',
    'Daily Trends',
    'Method Comparison',
    'Citations',
    'Citation Gaps',
    'Costs',
  ])
  assert.deepEqual(tables[0].headers, ['prompt', 'visibility'])
  assert.deepEqual(tables[0].rows[0], {
    prompt: 'Best agency, Detroit',
    visibility: 50,
  })
})

test('GEOPilot report table loading rejects malformed CSV instead of exporting partial data', async () => {
  await assert.rejects(
    () => loadGeoPilotExportTables(async dataset => dataset === 'citations'
      ? 'url,title\n"https://example.com,Missing close quote\n'
      : 'metric,value\nvisibility,25\n'),
    /Citation history could not be prepared/,
  )
})
