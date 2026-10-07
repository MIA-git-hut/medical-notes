import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
// @ts-expect-error Browser utility is intentionally plain JavaScript.
import { parseOldRecords } from '../docs/.vitepress/theme/old-record-store.js'

describe('legacy flashcard record storage', () => {
  it('rejects null, arrays and non-object JSON values', () => {
    assert.deepEqual(parseOldRecords('null'), {})
    assert.deepEqual(parseOldRecords('[]'), {})
    assert.deepEqual(parseOldRecords('42'), {})
    assert.deepEqual(parseOldRecords('"know"'), {})
  })

  it('rejects malformed JSON', () => {
    assert.deepEqual(parseOldRecords('{broken'), {})
    assert.deepEqual(parseOldRecords(null), {})
  })

  it('keeps only own entries with know or unknown values', () => {
    assert.deepEqual(
      parseOldRecords('{"麻黄":"know","桂枝":"unknown","甘草":"maybe","nested":{"status":"know"},"count":1}'),
      { 麻黄: 'know', 桂枝: 'unknown' }
    )
  })

  it('drops prototype pollution keys', () => {
    const records = parseOldRecords('{"__proto__":"know","constructor":"know","麻黄":"know"}')
    assert.equal(Object.hasOwn(records, '__proto__'), false)
    assert.equal(Object.hasOwn(records, 'constructor'), false)
    assert.equal(records.麻黄, 'know')
    assert.equal(({} as { polluted?: unknown }).polluted, undefined)
  })
})
