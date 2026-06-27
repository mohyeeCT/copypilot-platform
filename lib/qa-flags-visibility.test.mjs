import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const introSource = readFileSync('app/(app)/intro/jobs/[id]/page.tsx', 'utf8')
const faqSource = readFileSync('app/(app)/faq/jobs/[id]/page.tsx', 'utf8')
const metaSource = readFileSync('app/(app)/meta/jobs/[id]/page.tsx', 'utf8')

test('job result pages surface QA flags in UI and exports', () => {
  for (const source of [introSource, faqSource, metaSource]) {
    assert.match(source, /qa_flags\?: string\[\]/)
    assert.match(source, /'QA Flags'/)
    assert.match(source, /row\.qa_flags/)
  }
})
