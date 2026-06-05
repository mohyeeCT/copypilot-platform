import assert from 'node:assert/strict'
import test from 'node:test'

import { createCopyRowImportSchema, parseImportedRows } from './import-rows.ts'

test('parses CSV headers, quoted values, blank cells, escaped quotes, and multiline values', () => {
  const text = [
    'Page URL,Primary Keyword,Page Type,H1',
    '"https://example.com/a",,"service","A ""quoted"", heading"',
    '"https://example.com/b","red, blue widgets","blog","First line',
    'second line"',
  ].join('\n')

  const result = parseImportedRows(text, createCopyRowImportSchema({ page_type: 'general' }))

  assert.deepEqual(result.rejectedRows, [])
  assert.deepEqual(result.rows, [
    {
      url: 'https://example.com/a',
      keyword: '',
      page_type: 'service',
      h1: 'A "quoted", heading',
    },
    {
      url: 'https://example.com/b',
      keyword: 'red, blue widgets',
      page_type: 'blog',
      h1: 'First line\nsecond line',
    },
  ])
})

test('auto-detects tab-separated positional rows and preserves intentionally blank cells', () => {
  const text = [
    'https://example.com/a\t\tservice\tService H1',
    'https://example.com/b\tkeyword\t\t',
  ].join('\n')

  const result = parseImportedRows(text, createCopyRowImportSchema({ page_type: 'general' }))

  assert.deepEqual(result.rejectedRows, [])
  assert.deepEqual(result.rows, [
    { url: 'https://example.com/a', keyword: '', page_type: 'service', h1: 'Service H1' },
    { url: 'https://example.com/b', keyword: 'keyword', page_type: 'general', h1: '' },
  ])
})

test('detects a URL-only header and applies optional defaults', () => {
  const result = parseImportedRows(
    'url\nhttps://example.com/a',
    createCopyRowImportSchema({ page_type: 'service_lp' }),
  )

  assert.deepEqual(result.rows, [
    { url: 'https://example.com/a', keyword: '', page_type: 'service_lp', h1: '' },
  ])
  assert.deepEqual(result.rejectedRows, [])
})

test('does not silently remove an unrecognized first row', () => {
  const result = parseImportedRows(
    'not a url\tkeyword\nhttps://example.com/a\tvalid keyword',
    createCopyRowImportSchema({ page_type: 'general' }),
  )

  assert.deepEqual(result.rows, [
    { url: 'https://example.com/a', keyword: 'valid keyword', page_type: 'general', h1: '' },
  ])
  assert.equal(result.rejectedRows[0].rowNumber, 1)
  assert.deepEqual(result.rejectedRows[0].errors, ['URL must begin with http:// or https://'])
})

test('keeps valid rows and reports missing or invalid URLs with source row numbers', () => {
  const text = [
    'url,keyword,page_type,h1',
    'https://example.com/a,valid,blog,Heading',
    ',missing,service,Heading',
    'example.com/no-protocol,invalid,service,Heading',
  ].join('\n')

  const result = parseImportedRows(text, createCopyRowImportSchema({ page_type: 'general' }))

  assert.equal(result.rows.length, 1)
  assert.deepEqual(
    result.rejectedRows.map(row => ({ rowNumber: row.rowNumber, errors: row.errors })),
    [
      { rowNumber: 3, errors: ['URL is required'] },
      { rowNumber: 4, errors: ['URL must begin with http:// or https://'] },
    ],
  )
})

test('reports malformed quoted input instead of silently accepting it', () => {
  const result = parseImportedRows(
    'url,keyword\n"https://example.com/a,keyword',
    createCopyRowImportSchema({ page_type: 'general' }),
  )

  assert.deepEqual(result.rows, [])
  assert.equal(result.rejectedRows[0].rowNumber, 2)
  assert.match(result.rejectedRows[0].errors.join(' '), /quote/i)
})

test('supports the page copy template key column and aliases', () => {
  const result = parseImportedRows(
    'link,keyword seeds,type,h1 tag,template_key\nhttps://example.com/a,seed,blog,Heading,blog_standard',
    createCopyRowImportSchema({ page_type: 'service', template_key: '' }, true),
  )

  assert.deepEqual(result.rows, [{
    url: 'https://example.com/a',
    keyword: 'seed',
    page_type: 'blog',
    h1: 'Heading',
    template_key: 'blog_standard',
  }])
})
