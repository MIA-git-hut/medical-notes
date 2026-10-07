import {
  Rating as FsrsRating,
  State,
  createEmptyCard,
  fsrs,
  type Card,
} from 'ts-fsrs'

import type { Rating, ScheduleState } from './study'

/**
 * Persist this value with scheduling data whenever the storage model gains
 * algorithm migrations. Changing the package version or parameters below is
 * a scheduling-policy change and must bump this constant.
 */
export const SCHEDULER_ALGORITHM_VERSION = 'fsrs-6/ts-fsrs-5.4.2/medical-notes-v1' as const

const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 36_500,
  enable_fuzz: false,
  enable_short_term: true,
  learning_steps: ['1m', '10m'],
  relearning_steps: ['10m'],
})

const RATINGS = [
  FsrsRating.Again,
  FsrsRating.Hard,
  FsrsRating.Good,
  FsrsRating.Easy,
] as const

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

function parseISO(value: unknown, field: string): Date {
  if (typeof value !== 'string' || !ISO_DATE_TIME.test(value)) {
    throw new TypeError(`${field} must be an ISO 8601 date-time string`)
  }

  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) {
    throw new RangeError(`${field} must be a valid ISO 8601 date-time`)
  }
  return date
}

function finiteNumber(value: unknown, field: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
    throw new RangeError(`${field} must be a finite number greater than or equal to ${minimum}`)
  }
  return value
}

function nonNegativeInteger(value: unknown, field: string): number {
  const number = finiteNumber(value, field)
  if (!Number.isInteger(number)) {
    throw new RangeError(`${field} must be a non-negative integer`)
  }
  return number
}

function validateRating(rating: unknown): asserts rating is Rating {
  if (!Number.isInteger(rating) || !RATINGS.includes(rating as (typeof RATINGS)[number])) {
    throw new RangeError('rating must be one of 1 (Again), 2 (Hard), 3 (Good), or 4 (Easy)')
  }
}

function toCard(schedule: ScheduleState | undefined, now: Date): Card {
  if (schedule === undefined) return createEmptyCard(now)
  if (schedule === null || typeof schedule !== 'object' || Array.isArray(schedule)) {
    throw new TypeError('schedule must be an object or undefined')
  }

  const state = nonNegativeInteger(schedule.state, 'schedule.state')
  if (state > State.Relearning) {
    throw new RangeError('schedule.state must be between 0 (New) and 3 (Relearning)')
  }

  const due = parseISO(schedule.due, 'schedule.due')
  const lastReview = schedule.last_review === undefined
    ? undefined
    : parseISO(schedule.last_review, 'schedule.last_review')

  if (state !== State.New && lastReview === undefined) {
    throw new RangeError('schedule.last_review is required for a non-new card')
  }
  if (lastReview && now.getTime() < lastReview.getTime()) {
    throw new RangeError('nowISO cannot be earlier than schedule.last_review')
  }

  const stability = finiteNumber(schedule.stability, 'schedule.stability')
  const difficulty = finiteNumber(schedule.difficulty, 'schedule.difficulty')
  if (state !== State.New && stability <= 0) {
    throw new RangeError('schedule.stability must be greater than 0 for a non-new card')
  }
  if (state !== State.New && (difficulty < 1 || difficulty > 10)) {
    throw new RangeError('schedule.difficulty must be between 1 and 10 for a non-new card')
  }

  const reps = nonNegativeInteger(schedule.reps, 'schedule.reps')
  const lapses = nonNegativeInteger(schedule.lapses, 'schedule.lapses')
  if (lapses > reps) throw new RangeError('schedule.lapses cannot exceed schedule.reps')

  return {
    due,
    stability,
    difficulty,
    elapsed_days: nonNegativeInteger(schedule.elapsed_days, 'schedule.elapsed_days'),
    scheduled_days: nonNegativeInteger(schedule.scheduled_days, 'schedule.scheduled_days'),
    reps,
    lapses,
    state,
    last_review: lastReview,
    learning_steps: nonNegativeInteger(schedule.learning_steps, 'schedule.learning_steps'),
  }
}

function fromCard(card: Card): ScheduleState {
  const schedule: ScheduleState = {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    learning_steps: card.learning_steps,
  }
  if (card.last_review) schedule.last_review = card.last_review.toISOString()
  return schedule
}

function parseNow(nowISO: string): Date {
  return parseISO(nowISO, 'nowISO')
}

export function preview(
  schedule: ScheduleState | undefined,
  nowISO: string,
): Record<Rating, ScheduleState> {
  const now = parseNow(nowISO)
  const outcomes = scheduler.repeat(toCard(schedule, now), now)
  const result = {} as Record<Rating, ScheduleState>

  for (const rating of RATINGS) {
    result[rating as Rating] = fromCard(outcomes[rating].card)
  }
  return result
}

export function review(
  schedule: ScheduleState | undefined,
  rating: Rating,
  nowISO: string,
): ScheduleState {
  validateRating(rating)
  const now = parseNow(nowISO)
  return fromCard(scheduler.next(toCard(schedule, now), now, rating).card)
}
