import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  SCHEDULER_ALGORITHM_VERSION,
  preview,
  review,
} from '../shared/scheduler'
import type { Rating, ScheduleState } from '../shared/study'

const START = '2026-01-01T00:00:00.000Z'

describe('FSRS scheduler adapter', () => {
  it('pins the algorithm, package, and application policy version', () => {
    assert.equal(SCHEDULER_ALGORITHM_VERSION, 'fsrs-6/ts-fsrs-5.4.2/medical-notes-v1')
  })

  it('previews deterministic outcomes for all four ratings', () => {
    const outcomes = preview(undefined, START)

    assert.deepEqual(Object.keys(outcomes), ['1', '2', '3', '4'])
    assert.deepEqual(
      ([1, 2, 3, 4] as Rating[]).map((rating) => outcomes[rating].due),
      [
        '2026-01-01T00:01:00.000Z',
        '2026-01-01T00:06:00.000Z',
        '2026-01-01T00:10:00.000Z',
        '2026-01-09T00:00:00.000Z',
      ],
    )
    assert.deepEqual(
      ([1, 2, 3, 4] as Rating[]).map((rating) => outcomes[rating].state),
      [1, 1, 1, 2],
    )
    for (const rating of [1, 2, 3, 4] as Rating[]) {
      assert.equal(outcomes[rating].last_review, START)
      assert.equal(outcomes[rating].reps, 1)
    }
  })

  it('uses the supplied due time for an on-time review', () => {
    const first = review(undefined, 4, START)
    const next = review(first, 3, first.due)

    assert.equal(first.due, '2026-01-09T00:00:00.000Z')
    assert.equal(next.last_review, first.due)
    assert.equal(next.elapsed_days, 8)
    assert.equal(next.state, 2)
    assert.equal(next.reps, 2)
    assert.ok(Date.parse(next.due) > Date.parse(first.due))
  })

  it('enters relearning after an Again rating on a review card', () => {
    const learned = review(undefined, 4, START)
    const relearning = review(learned, 1, learned.due)

    assert.equal(relearning.state, 3)
    assert.equal(relearning.lapses, 1)
    assert.equal(relearning.reps, 2)
    assert.equal(relearning.last_review, learned.due)
    assert.equal(relearning.due, '2026-01-09T00:10:00.000Z')
  })

  it('returns JSON-safe ISO state that survives a persistence round trip', () => {
    const first = review(undefined, 3, '2026-01-01T08:00:00+08:00')
    const restored = JSON.parse(JSON.stringify(first)) as ScheduleState
    const outcomes = preview(restored, first.due)

    assert.deepEqual(restored, first)
    assert.match(first.due, /^\d{4}-\d{2}-\d{2}T.*Z$/)
    assert.equal(first.last_review, START)
    assert.equal(outcomes[3].last_review, first.due)
  })

  it('rejects malformed dates, ratings, and persisted schedules', () => {
    assert.throws(() => preview(undefined, '2026-01-01'), /ISO 8601 date-time/)
    assert.throws(() => review(undefined, 0 as Rating, START), /rating must be one of/)

    const valid = review(undefined, 4, START)
    assert.throws(
      () => preview({ ...valid, due: 'not-a-date' }, valid.due),
      /schedule\.due must be an ISO 8601 date-time string/,
    )
    assert.throws(
      () => review({ ...valid, stability: Number.NaN }, 3, valid.due),
      /schedule\.stability must be a finite number/,
    )
    assert.throws(
      () => review(valid, 3, '2025-12-31T23:59:59.000Z'),
      /nowISO cannot be earlier than schedule\.last_review/,
    )
  })
})
