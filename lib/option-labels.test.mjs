import assert from 'node:assert/strict'
import test from 'node:test'
import { displayOptionLabel, toDisplayOptions } from './option-labels.ts'

test('shared option labels display friendly labels while preserving values', () => {
  assert.equal(displayOptionLabel('b2b'), 'B2B')
  assert.equal(displayOptionLabel('ecommerce'), 'Ecommerce')
  assert.equal(displayOptionLabel('case_study'), 'Case Study')
  assert.equal(displayOptionLabel('unknown_value'), 'unknown_value')

  assert.deepEqual(toDisplayOptions(['general', 'b2b']), [
    { value: 'general', label: 'General' },
    { value: 'b2b', label: 'B2B' },
  ])
})
