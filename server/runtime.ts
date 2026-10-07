import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createApp } from './app'
import { getPool } from './db'
import type { StudyCard } from '../shared/study'

export function runtimeApp() {
  const origin = process.env.APP_ORIGIN || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173')
  const url = new URL(origin)
  if (url.origin !== origin || (process.env.VERCEL && url.protocol !== 'https:')) throw new Error('APP_ORIGIN must be an exact origin; HTTPS is required on Vercel')
  const cards = JSON.parse(readFileSync(resolve('docs/public/study-cards.json'), 'utf8')) as StudyCard[]
  return createApp({
    cards,
    db: process.env.DATABASE_URL ? getPool() : undefined,
    adminGithubIds: (process.env.ADMIN_GITHUB_IDS || '').split(',').map(id => id.trim()).filter(id => /^\d+$/.test(id)),
    config: { origin, clientId: process.env.GITHUB_CLIENT_ID || '', clientSecret: process.env.GITHUB_CLIENT_SECRET || '', secure: url.protocol === 'https:' },
  })
}
