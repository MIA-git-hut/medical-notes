import type { Pool, PoolClient } from 'pg'
import { randomUUID } from 'node:crypto'
import type { StudyCard, StudySnapshot, ReviewInput, Progress, Review, StudyNote, ScheduleState } from '../shared/study'
import { review as scheduleReview, SCHEDULER_ALGORITHM_VERSION } from '../shared/scheduler'
import { transaction } from './db'
import { HttpError } from './errors'

const ALGORITHM = SCHEDULER_ALGORITHM_VERSION
const iso = (value: Date | string) => new Date(value).toISOString()
function reviewRow(row: any): Review { return { id: row.id, cardId: row.card_id, rating: row.rating, reviewedAt: iso(row.reviewed_at), due: iso(row.due) } }
export class StudyService {
  private cards: Map<string, StudyCard>
  constructor(private db: Pool, cards: StudyCard[], private now = () => new Date()) { this.cards = new Map(cards.map(c => [c.id, c])) }
  private card(id: string) { if (!this.cards.has(id)) throw new HttpError(400, '该卡片不在已核对的学习内容中') }
  private async lock(client: PoolClient, userId: string) {
    const result = await client.query('SELECT daily_new_limit,timezone FROM users WHERE id=$1 FOR UPDATE', [userId])
    if (!result.rowCount) throw new HttpError(401, '请重新登录')
    return result.rows[0]
  }
  private async newToday(client: Pool | PoolClient, userId: string, timezone: string) {
    const result = await client.query(`SELECT COUNT(DISTINCT card_id)::int AS count FROM reviews
      WHERE user_id=$1 AND was_new=true AND (reviewed_at AT TIME ZONE $2)::date = ($3::timestamptz AT TIME ZONE $2)::date`, [userId, timezone, this.now()])
    return result.rows[0].count as number
  }
  async snapshot(userId: string): Promise<StudySnapshot> {
    const [users, progress, reviews, notes] = await Promise.all([
      this.db.query('SELECT daily_new_limit,timezone FROM users WHERE id=$1', [userId]),
      this.db.query('SELECT card_id,version,schedule FROM card_progress WHERE user_id=$1', [userId]),
      this.db.query('SELECT * FROM reviews WHERE user_id=$1 ORDER BY reviewed_at DESC LIMIT 200', [userId]),
      this.db.query('SELECT card_id,text,version,updated_at FROM study_notes WHERE user_id=$1', [userId]),
    ])
    const settings = { dailyNewLimit: users.rows[0].daily_new_limit, timezone: users.rows[0].timezone }
    return {
      progress: progress.rows.map(r => ({ cardId: r.card_id, version: r.version, schedule: r.schedule })),
      reviews: reviews.rows.map(reviewRow),
      notes: notes.rows.map(r => ({ cardId: r.card_id, text: r.text, version: r.version, updatedAt: iso(r.updated_at) })),
      settings, newCardsStudiedToday: await this.newToday(this.db, userId, settings.timezone),
    }
  }
  async review(userId: string, input: ReviewInput): Promise<{progress: Progress; review: Review}> {
    this.card(input.cardId)
    return transaction(this.db, async client => {
      const settings = await this.lock(client, userId)
      const duplicate = await client.query('SELECT * FROM reviews WHERE user_id=$1 AND request_id=$2', [userId, input.requestId])
      if (duplicate.rowCount) {
        const row = duplicate.rows[0]
        if (row.card_id !== input.cardId || row.rating !== input.rating || row.expected_version !== input.expectedVersion) throw new HttpError(409, '重复请求的内容不一致')
        return { progress: { cardId: row.card_id, version: row.result_version, schedule: row.after_schedule }, review: reviewRow(row) }
      }
      const current = await client.query('SELECT schedule,version FROM card_progress WHERE user_id=$1 AND card_id=$2', [userId, input.cardId])
      const previous = current.rows[0]
      if ((previous?.version || 0) !== input.expectedVersion) throw new HttpError(409, '进度已在其他设备更新，请刷新后继续')
      const now = this.now()
      const wasNew = !previous || previous.schedule.reps === 0
      if (wasNew) {
        const alreadyToday = await client.query(`SELECT id FROM reviews WHERE user_id=$1 AND card_id=$2 AND was_new=true
          AND (reviewed_at AT TIME ZONE $3)::date=($4::timestamptz AT TIME ZONE $3)::date LIMIT 1`, [userId, input.cardId, settings.timezone, now])
        if (!alreadyToday.rowCount && await this.newToday(client, userId, settings.timezone) >= settings.daily_new_limit) throw new HttpError(409, '今日新卡目标已完成，可继续复习到期卡片')
      } else if (new Date(previous.schedule.due).getTime() > now.getTime()) {
        throw new HttpError(409, '这张卡片尚未到复习时间，可使用自由练习')
      }
      const schedule = scheduleReview(previous?.schedule, input.rating, now.toISOString())
      const version = input.expectedVersion + 1
      await client.query(`INSERT INTO card_progress(user_id,card_id,schedule,version) VALUES($1,$2,$3,$4)
        ON CONFLICT(user_id,card_id) DO UPDATE SET schedule=EXCLUDED.schedule,version=EXCLUDED.version`, [userId, input.cardId, JSON.stringify(schedule), version])
      const event: Review = { id: randomUUID(), cardId: input.cardId, rating: input.rating, reviewedAt: now.toISOString(), due: schedule.due }
      await client.query(`INSERT INTO reviews(id,user_id,card_id,request_id,rating,expected_version,reviewed_at,due,was_new,algorithm,before_schedule,after_schedule,result_version)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [event.id, userId, input.cardId, input.requestId, input.rating, input.expectedVersion, now, schedule.due, wasNew, ALGORITHM, previous ? JSON.stringify(previous.schedule) : null, JSON.stringify(schedule), version])
      return { progress: { cardId: input.cardId, version, schedule }, review: event }
    })
  }
  async saveNote(userId: string, input: {cardId: string; text: string; expectedVersion: number}): Promise<StudyNote> {
    this.card(input.cardId)
    return transaction(this.db, async client => {
      await this.lock(client, userId)
      const found = await client.query('SELECT version FROM study_notes WHERE user_id=$1 AND card_id=$2', [userId, input.cardId])
      if ((found.rows[0]?.version || 0) !== input.expectedVersion) throw new HttpError(409, '笔记已在其他设备更新，请保留当前文字并刷新核对')
      const note = { cardId: input.cardId, text: input.text, version: input.expectedVersion + 1, updatedAt: this.now().toISOString() }
      await client.query(`INSERT INTO study_notes(user_id,card_id,text,version,updated_at) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(user_id,card_id) DO UPDATE SET text=EXCLUDED.text,version=EXCLUDED.version,updated_at=EXCLUDED.updated_at`, [userId, note.cardId, note.text, note.version, note.updatedAt])
      return note
    })
  }
  async reset(userId: string, categoryId: string) {
    const ids = [...this.cards.values()].filter(c => c.categoryId === categoryId).map(c => c.id)
    if (!ids.length) throw new HttpError(400, '请选择有效分类')
    await transaction(this.db, async client => {
      await this.lock(client, userId)
      // Keep rows and advance their versions: stale devices cannot replay pre-reset updates.
      const fresh: ScheduleState = { due: this.now().toISOString(), stability: 0, difficulty: 0, elapsed_days: 0, scheduled_days: 0, reps: 0, lapses: 0, state: 0, learning_steps: 0 }
      await client.query('UPDATE card_progress SET schedule=$3,version=version+1 WHERE user_id=$1 AND card_id=ANY($2::text[])', [userId, ids, JSON.stringify(fresh)])
    })
  }
  async settings(userId: string, input: {dailyNewLimit: number; timezone: string}) {
    try { new Intl.DateTimeFormat('en', { timeZone: input.timezone }).format() } catch { throw new HttpError(400, '时区无效') }
    await this.db.query('UPDATE users SET daily_new_limit=$2,timezone=$3 WHERE id=$1', [userId, input.dailyNewLimit, input.timezone])
    return input
  }
}
