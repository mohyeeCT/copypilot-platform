import assert from 'node:assert/strict'
import test from 'node:test'

import { buildFaqExportRows } from './faq-export.ts'

test('FAQ exports prefer edited question and answer text over stale combined backend text', () => {
  const { rows } = buildFaqExportRows(
    [
      {
        url: 'https://example.com/page',
        selected_keyword: 'roof repair',
        keyword_source: 'gsc',
        faq_combined: 'Q: Original question\nA: Original answer',
        faq_sources: 'generated',
        faqs: [
          { question: 'Original question', answer: 'Original answer', source: 'generated' },
          { question: 'Second question', answer: 'Second answer', source: 'generated' },
        ],
        error: null,
      },
    ],
    {
      '0-0': { question: 'Edited question', answer: 'Edited answer' },
    },
  )

  assert.equal(
    rows[0]['FAQ Content'],
    'Q: Edited question\nA: Edited answer\n\nQ: Second question\nA: Second answer',
  )
})

test('FAQ exports keep backend combined text when a row has no edited FAQ text', () => {
  const { rows } = buildFaqExportRows(
    [
      {
        url: 'https://example.com/page',
        selected_keyword: 'roof repair',
        keyword_source: 'gsc',
        faq_combined: 'Q: Backend question\nA: Backend answer',
        faq_sources: 'generated',
        faqs: [
          { question: 'Array question', answer: 'Array answer', source: 'generated' },
        ],
        error: null,
      },
    ],
    {},
  )

  assert.equal(rows[0]['FAQ Content'], 'Q: Backend question\nA: Backend answer')
})
