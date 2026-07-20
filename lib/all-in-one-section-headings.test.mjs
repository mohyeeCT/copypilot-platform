import assert from 'node:assert/strict'
import test from 'node:test'

import { selectPageCopySectionHeadings } from './all-in-one-section-headings.ts'

test('versioned page copy displays its generated heading without duplicating it in export', () => {
  assert.deepEqual(selectPageCopySectionHeadings({
    isVersionedPageCopy: true,
    generatedHeading: 'Next Steps',
    plannedHeading: 'Book Your Free Consultation Today',
    safeFallbackHeading: 'Call to Action',
    evidenceSparse: true,
  }), {
    displayHeading: 'Next Steps',
    exportHeading: '',
  })
})

test('evidence-sparse page copy uses a safe label when no generated heading is available', () => {
  assert.deepEqual(selectPageCopySectionHeadings({
    isVersionedPageCopy: true,
    generatedHeading: '',
    plannedHeading: 'Book Your Free Consultation Today',
    safeFallbackHeading: 'Call to Action',
    evidenceSparse: true,
  }), {
    displayHeading: 'Call to Action',
    exportHeading: 'Call to Action',
  })
})

test('headingless evidence-sparse page copy remains body-only in export', () => {
  assert.deepEqual(selectPageCopySectionHeadings({
    isVersionedPageCopy: true,
    generatedHeading: '',
    plannedHeading: 'Book Your Free Consultation Today',
    safeFallbackHeading: 'Call to Action',
    evidenceSparse: true,
    headingless: true,
  }), {
    displayHeading: 'Call to Action',
    exportHeading: '',
  })
})

test('older versioned and unversioned jobs keep their established heading fallbacks', () => {
  assert.deepEqual(selectPageCopySectionHeadings({
    isVersionedPageCopy: true,
    generatedHeading: '',
    plannedHeading: 'Our Services',
    safeFallbackHeading: 'services',
    evidenceSparse: false,
  }), {
    displayHeading: 'Our Services',
    exportHeading: 'Our Services',
  })

  assert.deepEqual(selectPageCopySectionHeadings({
    isVersionedPageCopy: false,
    generatedHeading: 'Ignored legacy heading',
    plannedHeading: 'Ignored legacy plan',
    safeFallbackHeading: 'services',
    evidenceSparse: false,
  }), {
    displayHeading: 'services',
    exportHeading: 'services',
  })
})
