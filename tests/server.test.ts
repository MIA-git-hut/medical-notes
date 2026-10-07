import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { testDatabase } from './database'
import { migrate } from '../server/db'
import { createApp } from '../server/app'
import { createSession } from '../server/auth'
import { StudyService } from '../server/study-service'
import type { StudyCard } from '../shared/study'

const cards: StudyCard[] = ['a', 'b', 'c'].map((id, i) => ({ id, contentId: 'source', categoryId: i < 2 ? 'one' : 'two', category: i < 2 ? '一' : '二', question: '问题', answer: '答案', sourceUrl: 'https://example.com/source', sourceTitle: '测试来源', noteUrl: '/测试', status: 'reviewed' }))

test('API: identity isolation, CSRF, review idempotency, conflicts and scoped reset', async () => {
  const db = await testDatabase()
  try {
    await migrate(db.pool)
    await migrate(db.pool) // migrations must be repeatable
    const a = await createSession(db.pool, { providerId: 'github', subject: '1', displayName: 'a', avatarUrl: '' })
    const b = await createSession(db.pool, { providerId: 'github', subject: '2', displayName: 'b', avatarUrl: '' })
    let time = new Date('2026-10-07T05:00:00.000Z')
    const app = createApp({ db: db.pool, cards, now: () => time, adminGithubIds: ['1'], config: { origin: 'http://localhost:5173', clientId: 'test', clientSecret: 'test', secure: false } })
    const asA = (method: 'post' | 'put' | 'patch', path: string, body: object) => request(app)[method](path).set('Cookie', `study_session=${a.token}`).set('Origin', 'http://localhost:5173').set('X-CSRF-Token', a.csrfToken).send(body)
    await request(app).get('/api/study').expect(401)
    await request(app).get('/api/admin/stats').expect(401)
    await request(app).get('/api/admin/users').set('Cookie', `study_session=${b.token}`).expect(403)
    await request(app).get('/api/admin/stats').set('Cookie', `study_session=${b.token}`).set('X-Admin', 'true').expect(403)
    const admin = await request(app).get('/api/admin/stats').set('Cookie', `study_session=${a.token}`).expect(200)
    assert.equal(admin.body.totalUsers, 2)
    assert.equal(admin.body.totalSignIns, 2)
    const users = await request(app).get('/api/admin/users').set('Cookie', `study_session=${a.token}`).expect(200)
    assert.equal(users.body.users.length, 2)
    assert.deepEqual(Object.keys(users.body.users[0]).sort(), ['createdAt', 'id', 'lastLoginAt', 'login', 'signIns'])
    assert.equal(users.headers['cache-control'], 'no-store')
    assert.ok(!JSON.stringify(admin.body).includes(a.token))
    const providers = await request(app).get('/api/auth/providers').expect(200)
    assert.equal(providers.body.providers[0].id, 'github')
    assert.equal(providers.body.providers.length, 1)
    await request(app).get('/api/auth/wechat/start').expect(404)
    const recovery = await request(app).get('/api/auth/github/recovery').expect(200)
    assert.equal(recovery.body.url, 'https://github.com/password_reset')
    await request(app).post('/api/study/reset').set('Cookie', `study_session=${a.token}`).send({ categoryId: 'one' }).expect(403)
    await request(app).post('/api/study/reset').set('Cookie', `study_session=${a.token}`).set('Origin', 'https://attacker.example').set('X-CSRF-Token', a.csrfToken).send({ categoryId: 'one' }).expect(403)
    const input = { cardId: 'a', rating: 3, expectedVersion: 0, requestId: randomUUID() }
    const response = await asA('post', '/api/study/reviews', input).expect(200)
    assert.equal(response.body.progress.version, 1)
    const replay = await asA('post', '/api/study/reviews', input).expect(200)
    assert.equal(replay.body.review.id, response.body.review.id)
    await asA('post', '/api/study/reviews', { ...input, rating: 1 }).expect(409)
    await asA('post', '/api/study/reviews', { ...input, requestId: randomUUID() }).expect(409)
    await asA('post', '/api/study/reviews', { ...input, expectedVersion: 1, requestId: randomUUID() }).expect(409) // not due
    await asA('post', '/api/study/reviews', { ...input, userId: b.user.id }).expect(400)
    await asA('post', '/api/study/reviews', { ...input, cardId: 'unknown', requestId: randomUUID() }).expect(400)
    await asA('put', '/api/study/notes', { cardId: 'a', text: '<script>private text</script>', expectedVersion: 0 }).expect(200)
    await asA('put', '/api/study/notes', { cardId: 'a', text: 'overwrite', expectedVersion: 0 }).expect(409)
    const other = await request(app).get('/api/study').set('Cookie', `study_session=${b.token}`).expect(200)
    assert.deepEqual(other.body.progress, []); assert.deepEqual(other.body.notes, []); assert.deepEqual(other.body.reviews, [])
    await asA('post', '/api/study/reviews', { ...input, cardId: 'c', requestId: randomUUID() }).expect(200)
    await asA('post', '/api/study/reset', { categoryId: 'one' }).expect(200)
    const snapshot = (await request(app).get('/api/study').set('Cookie', `study_session=${a.token}`).expect(200)).body
    assert.equal(snapshot.progress.find((p: any) => p.cardId === 'a').schedule.reps, 0)
    assert.equal(snapshot.progress.find((p: any) => p.cardId === 'a').version, 2)
    assert.equal(snapshot.progress.find((p: any) => p.cardId === 'c').schedule.reps, 1)
    assert.equal(snapshot.notes.length, 1); assert.equal(snapshot.reviews.length, 2)
    await asA('post', '/api/study/reviews', { ...input, expectedVersion: 1, requestId: randomUUID() }).expect(409)
    await asA('patch', '/api/study/settings', { dailyNewLimit: 0, timezone: 'Asia/Shanghai' }).expect(200)
    await asA('post', '/api/study/reviews', { ...input, cardId: 'b', requestId: randomUUID() }).expect(409)
    await asA('patch', '/api/study/settings', { dailyNewLimit: 10, timezone: 'not/a-zone' }).expect(400)
    time = new Date('2026-10-08T05:00:00Z')
    await asA('post', '/api/study/reviews', { ...input, cardId: 'c', expectedVersion: 1, requestId: randomUUID() }).expect(200) // due reviews still allowed with zero new limit
    await asA('post', '/api/auth/logout', {}).expect(200)
    await request(app).get('/api/study').set('Cookie', `study_session=${a.token}`).expect(401)
  } finally { await db.close() }
})

test('GitHub OAuth callback requires browser-bound single-use state and rotates session', async () => {
  const db = await testDatabase()
  try {
    await migrate(db.pool)
    let calls = 0
    const app = createApp({ db: db.pool, cards, config: { origin: 'http://localhost:5173', clientId: 'test', clientSecret: 'test', secure: false }, provider: {
      authorize: (state, verifier) => `https://github.com/login/oauth/authorize?state=${state}&challenge=${verifier.length}`,
      exchange: async () => { calls++; return { providerId: 'github', subject: '42', displayName: 'tester', avatarUrl: '' } },
    } })
    const start = await request(app).get('/api/auth/github').expect(302)
    const state = new URL(start.headers.location).searchParams.get('state')!
    const cookies = start.headers['set-cookie'] as unknown as string[]
    const stateCookie = cookies[0].split(';')[0]
    await request(app).get(`/api/auth/github/callback?state=${state}&code=code`).expect(400)
    const success = await request(app).get(`/api/auth/github/callback?state=${state}&code=code`).set('Cookie', stateCookie).expect(302)
    assert.equal(calls, 1)
    assert.match(String(success.headers['set-cookie']), /study_session=/)
    await request(app).get(`/api/auth/github/callback?state=${state}&code=code`).set('Cookie', stateCookie).expect(400)
    assert.equal(calls, 1)
  } finally { await db.close() }
})

test('concurrent submissions serialize: one review wins, the other conflicts', async () => {
  const db = await testDatabase()
  try {
    await migrate(db.pool)
    const user = await createSession(db.pool, { providerId: 'github', subject: 'concurrent', displayName: 'concurrent', avatarUrl: '' })
    const study = new StudyService(db.pool, cards)
    const outcomes = await Promise.allSettled([1, 2].map(() => study.review(user.user.id, { cardId: 'a', rating: 3, expectedVersion: 0, requestId: randomUUID() })))
    assert.equal(outcomes.filter(o => o.status === 'fulfilled').length, 1)
    assert.equal((await study.snapshot(user.user.id)).reviews.length, 1)
  } finally { await db.close() }
})

test('returning identities retain their account; matching display names do not grant admin access', async () => {
  const db = await testDatabase()
  try {
    await migrate(db.pool)
    const first = await createSession(db.pool, { providerId: 'github', subject: '100', displayName: 'owner' })
    const study = new StudyService(db.pool, cards)
    await study.saveNote(first.user.id, { cardId: 'a', text: 'persistent private note', expectedVersion: 0 })
    const returning = await createSession(db.pool, { providerId: 'github', subject: '100', displayName: 'renamed-owner' })
    const impersonator = await createSession(db.pool, { providerId: 'github', subject: '200', displayName: 'renamed-owner' })
    assert.equal(returning.user.id, first.user.id)
    assert.notEqual(impersonator.user.id, first.user.id)
    assert.equal((await study.snapshot(returning.user.id)).notes[0].text, 'persistent private note')
    const app = createApp({ db: db.pool, cards, adminGithubIds: ['100'], config: { origin: 'http://localhost:5173', clientId: 'test', clientSecret: 'test', secure: false } })
    await request(app).get('/api/admin/stats').set('Cookie', `study_session=${impersonator.token}`).expect(403)
    const stats = await request(app).get('/api/admin/stats').set('Cookie', `study_session=${returning.token}`).expect(200)
    assert.equal(stats.body.totalUsers, 2)
    assert.equal(stats.body.totalSignIns, 3)
    assert.equal(stats.body.activeUsers7d, 2)
  } finally { await db.close() }
})
