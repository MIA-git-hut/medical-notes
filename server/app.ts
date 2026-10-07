import express, { type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import type { Pool } from 'pg'
import type { StudyCard } from '../shared/study'
import { StudyService } from './study-service'
import { HttpError } from './errors'
import { type AuthConfig, type IdentityProvider, cookie, hash, randomToken, equal, githubProvider, createSession, sessionCookie, readSession } from './auth'
import { providerRegistry, describeProvider, type OAuthRegistration } from './auth-providers'
import { isAdmin, adminStats, adminUsers } from './admin'

interface Options { db?: Pool; config?: AuthConfig; cards: StudyCard[]; provider?: IdentityProvider; providers?: OAuthRegistration[]; adminGithubIds?: string[]; now?: () => Date }
export function createApp({ db, config, cards, provider, providers, adminGithubIds = [], now }: Options) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '24kb' }))
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('X-Content-Type-Options', 'nosniff'); next() })
  const registry = providerRegistry(providers || (config?.clientId && config?.clientSecret ? [{ id: 'github', label: 'GitHub', implementation: provider || githubProvider(config), recoveryUrl: 'https://github.com/password_reset' }] : []))
  const configured = !!(db && config && registry.size)
  const getProvider = (id: string) => {
    if (!configured) throw new HttpError(503, '登录尚未配置，请先使用自由练习')
    const found = registry.get(id)
    if (!found) throw new HttpError(404, '此登录方式尚未启用')
    return found
  }
  const service = db ? new StudyService(db, cards, now) : undefined
  app.get('/api/health', (_req, res) => res.json({ ok: true, configured }))
  app.get('/api/me', async (req, res) => {
    const session = configured ? await readSession(db!, req) : null
    res.json({ user: session?.user || null, csrfToken: session?.csrfToken, configured, isAdmin: session ? await isAdmin(db!, session.user.id, adminGithubIds) : false })
  })
  app.get('/api/auth/providers', (_req, res) => res.json({ providers: configured ? [...registry.values()].map(describeProvider) : [] }))
  app.get('/api/auth/:provider/recovery', (req, res) => {
    const selected = getProvider(req.params.provider as string)
    if (!selected.recoveryUrl) throw new HttpError(409, '此登录方式没有启用账户恢复')
    res.json({ mode: 'external', url: selected.recoveryUrl })
  })
  app.get(['/api/auth/:provider/start', '/api/auth/:provider'], async (req, res) => {
    const selected = getProvider(req.params.provider as string)
    const state = randomToken(), verifier = randomToken()
    await db!.query('DELETE FROM oauth_attempts WHERE expires_at<$1', [new Date()])
    await db!.query('DELETE FROM sessions WHERE expires_at<$1', [new Date()])
    await db!.query('INSERT INTO oauth_attempts(state_hash,provider_id,verifier,expires_at) VALUES($1,$2,$3,$4)', [hash(state), selected.id, verifier, new Date(Date.now() + 600000)])
    res.cookie('study_oauth', state, { httpOnly: true, secure: config!.secure, sameSite: 'lax', path: '/api/auth', maxAge: 600000 })
    res.redirect(selected.implementation.authorize(state, verifier))
  })
  app.get('/api/auth/:provider/callback', async (req, res) => {
    const selected = getProvider(req.params.provider as string)
    const state = req.query.state
    if (!equal(state, cookie(req, 'study_oauth'))) throw new HttpError(400, '授权请求已失效，请重新登录')
    res.clearCookie('study_oauth', { path: '/api/auth', httpOnly: true, secure: config!.secure, sameSite: 'lax' })
    const attempt = await db!.query('DELETE FROM oauth_attempts WHERE state_hash=$1 AND provider_id=$2 AND expires_at>$3 RETURNING verifier', [hash(state as string), selected.id, new Date()])
    if (!attempt.rowCount || typeof req.query.code !== 'string' || req.query.code.length > 300) throw new HttpError(400, '授权已取消或过期，请重新登录')
    const identity = await selected.implementation.exchange(req.query.code, attempt.rows[0].verifier)
    if (identity.providerId !== selected.id) throw new HttpError(502, '身份提供者返回了不一致的身份类型')
    const session = await createSession(db!, identity)
    const oldToken = cookie(req, 'study_session')
    if (oldToken) await db!.query('DELETE FROM sessions WHERE token_hash=$1', [hash(oldToken)])
    sessionCookie(res, session.token, config!.secure)
    res.redirect(config!.origin + '/自测/')
  })
  app.use('/api', async (req, res, next) => {
    if (!configured) throw new HttpError(503, '云端学习尚未配置')
    const session = await readSession(db!, req)
    if (!session) throw new HttpError(401, '请先登录')
    res.locals.userId = session.user.id
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.get('origin') !== config!.origin || !equal(req.get('X-CSRF-Token'), session.csrfToken)) throw new HttpError(403, '请求验证失败，请刷新后重试')
    }
    next()
  })
  app.post('/api/auth/logout', async (req, res) => {
    await db!.query('DELETE FROM sessions WHERE token_hash=$1', [hash(cookie(req, 'study_session'))])
    res.clearCookie('study_session', { path: '/', httpOnly: true, secure: config!.secure, sameSite: 'lax' })
    res.json({ ok: true })
  })
  app.use('/api/admin', async (_req, res, next) => {
    if (!await isAdmin(db!, res.locals.userId, adminGithubIds)) throw new HttpError(403, '仅管理员可访问')
    next()
  })
  app.get('/api/admin/stats', async (_req, res) => res.json(await adminStats(db!)))
  app.get('/api/admin/users', async (req, res) => {
    const page = z.coerce.number().int().min(1).max(100000).parse(req.query.page || 1)
    res.json(await adminUsers(db!, page))
  })
  app.get('/api/study', async (_req, res) => res.json(await service!.snapshot(res.locals.userId)))
  const id = z.string().min(1).max(150)
  const version = z.number().int().nonnegative().max(2147483646)
  app.post('/api/study/reviews', async (req, res) => {
    const input = z.object({ cardId: id, rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]), expectedVersion: version, requestId: z.uuid() }).strict().parse(req.body)
    res.json(await service!.review(res.locals.userId, input))
  })
  app.put('/api/study/notes', async (req, res) => {
    const input = z.object({ cardId: id, text: z.string().max(10000), expectedVersion: version }).strict().parse(req.body)
    res.json(await service!.saveNote(res.locals.userId, input))
  })
  app.post('/api/study/reset', async (req, res) => {
    const input = z.object({ categoryId: id }).strict().parse(req.body)
    await service!.reset(res.locals.userId, input.categoryId)
    res.json({ ok: true })
  })
  app.patch('/api/study/settings', async (req, res) => {
    const input = z.object({ dailyNewLimit: z.number().int().min(0).max(100), timezone: z.string().min(1).max(100) }).strict().parse(req.body)
    res.json(await service!.settings(res.locals.userId, input))
  })
  app.use('/api', (_req, res) => res.status(404).json({ error: '接口不存在' }))
  app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError) { res.status(400).json({ error: '提交的数据格式不正确' }); return }
    const status = error instanceof HttpError ? error.status : error.status === 413 ? 413 : error.type === 'entity.parse.failed' ? 400 : 500
    // Never serialize database errors or OAuth responses; they may contain credentials.
    res.status(status).json({ error: error instanceof HttpError ? error.message : status < 500 ? '请求数据不正确' : '服务暂时不可用，请稍后重试' })
  })
  return app
}
