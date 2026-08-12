import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildAioPlusImplementationMapLines,
  normaliseAioPlusExportText,
  selectAioPlusPageCopyEntries,
} from './all-in-one-plus-export.ts'

const plan = {
  sections: [
    {
      name: 'existing_01',
      label: 'Opening content',
      source_order: 1,
      structure_role: 'global_header',
      preservation_action: 'keep',
      is_existing_section: true,
    },
    {
      name: 'existing_02',
      label: 'About Attorney Saman Dhukka',
      source_heading: 'About Attorney Saman Dhukka',
      source_order: 2,
      structure_role: 'profile',
      preservation_action: 'improve',
      is_existing_section: true,
    },
    {
      name: 'seo_addition_1',
      label: 'SEO content opportunity 1',
      planned_heading: 'What to Bring to a Consultation',
      source_order: 3,
      structure_role: 'seo_addition',
      preservation_action: 'add',
      is_seo_addition: true,
    },
  ],
}

test('AIO+ export follows the stored current-page order', () => {
  const sectionResults = {
    seo_addition_1: '## What to Bring to a Consultation\n\nNew section.',
    existing_02: '## About Attorney Saman Dhukka\n\nImproved profile.',
    existing_01: 'Call 832-804-3500',
  }

  assert.deepEqual(
    selectAioPlusPageCopyEntries(sectionResults, plan).map(([name]) => name),
    ['existing_01', 'existing_02', 'seo_addition_1'],
  )
})

test('AIO+ export includes a readable implementation map', () => {
  assert.deepEqual(buildAioPlusImplementationMapLines(plan), [
    'Page Structure and Implementation Map',
    '1. Opening content | Keep | Global header',
    '2. About Attorney Saman Dhukka | Improve | Profile',
    '3. What to Bring to a Consultation | Add | SEO addition',
  ])
})

test('AIO+ export turns scraper image markers into placement notes', () => {
  assert.equal(
    normaliseAioPlusExportText('#### Current media\n\nImage 5'),
    '#### Current media\n\n[Keep the existing image or media in this position: Image 5]',
  )
})
