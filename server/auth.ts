import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import type { Request, Response } from 'express'
import type { Pool } from 'pg'
import { transaction } from './db'
import { HttpError } from './errors'
import type { User } from '../shared/study'
import type { VerifiedIdentity } from '../shared/auth'

export interface AuthConfig { origin: string; clientId: string; clientSecret: string; secure: boolean }
export type Identity = VerifiedIdentity
export interface IdentityProvider { authorize(state: string, verifier: string): string; exchange(code: string, verifier: string): Promise<Identity> }
export const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export const randomToken = () => randomBytes(32).toString('base64url')
export function equal(a: unknown, b: unknown): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || !a) return false
  const first = Buffer.from(a), second = Buffer.from(b)
  return first.length === second.length && timingSafeEqual(first, second)
}
export function cookie(req: Request, name: string): string {
  const part = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(name + '='))
  return part ? part.slice(name.length + 1) : ''
}
export function sessionCookie(res: Response, token: string, secure: boolean) {
  res.cookie('study_session', token, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 30 * 86400000 })
}
export async function createSession(db: Pool, identity: Identity) {
  return transaction(db, async client => {
    // Serialize account creation by provider identity, including concurrent first sign-ins.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [identity.providerId + ':' + identity.subject])
    let found = await client.query('SELECT user_id FROM identities WHERE provider=$1 AND provider_id=$2', [identity.providerId, identity.subject])
    const userId = found.rows[0]?.user_id || randomUUID()
    const login = identity.displayName || identity.subject
    const avatarUrl = identity.avatarUrl || ''
    if (!found.rowCount) {
      await client.query('INSERT INTO users(id,login,avatar_url) VALUES($1,$2,$3)', [userId, login, avatarUrl])
      await client.query('INSERT INTO identities(provider,provider_id,user_id) VALUES($1,$2,$3)', [identity.providerId, identity.subject, userId])
    } else await client.query('UPDATE users SET login=$2,avatar_url=$3 WHERE id=$1', [userId, login, avatarUrl])
    const token = randomToken(), csrfToken = randomToken()
    await client.query('INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,$3,$4)', [hash(token), userId, csrfToken, new Date(Date.now() + 30 * 86400000)])
    await client.query('INSERT INTO login_events(id,user_id,provider) VALUES($1,$2,$3)', [randomUUID(), userId, identity.providerId])
    return { token, csrfToken, user: { id: userId, login, avatarUrl } as User }
  })
}
export async function readSession(db: Pool, req: Request): Promise<{user: User; csrfToken: string} | null> {
  const token = cookie(req, 'study_session')
  if (!token || token.length > 100) return null
  const result = await db.query('SELECT u.id,u.login,u.avatar_url,s.csrf_token FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>$2', [hash(token), new Date()])
  const row = result.rows[0]
  return row ? { user: { id: row.id, login: row.login, avatarUrl: row.avatar_url }, csrfToken: row.csrf_token } : null
}
export function githubProvider(config: AuthConfig): IdentityProvider {
  const callback = config.origin + '/api/auth/github/callback'
  return {
    authorize(state, verifier) {
      const url = new URL('https://github.com/login/oauth/authorize')
      url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: callback, state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' }).toString()
      return url.toString()
    },
    async exchange(code, verifier) {
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, code, redirect_uri: callback, code_verifier: verifier }), signal: AbortSignal.timeout(10000),
      })
      const token = await response.json() as { access_token?: string }
      if (!response.ok || !token.access_token) throw new HttpError(502, 'GitHub 授权失败，请重试')
      const userResponse = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'medical-notes' }, signal: AbortSignal.timeout(10000) })
      const user = await userResponse.json() as { id?: number; login?: string; avatar_url?: string }
      if (!userResponse.ok || !Number.isSafeInteger(user.id) || !user.login) throw new HttpError(502, '无法读取 GitHub 身份')
      // OAuth token is not persisted: this application never reads or writes repositories.
      return { providerId: 'github', subject: String(user.id), displayName: user.login, avatarUrl: user.avatar_url || '' }
    },
  }
}
