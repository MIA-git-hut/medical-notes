// Test-only entrypoint. Production runtime never imports this file or provides a mock-login flag.
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createApp } from '../server/app'
import { migrate } from '../server/db'
import { testDatabase } from './database'
import express from 'express'
import { resolve } from 'node:path'
async function main() {
  if (process.env.NODE_ENV !== 'test') throw new Error('Test server requires NODE_ENV=test')
  const db = await testDatabase()
  await migrate(db.pool)
  const origin = 'http://localhost:4175'
  const app = createApp({ db: db.pool, cards: JSON.parse(readFileSync('docs/public/study-cards.json', 'utf8')), config: { origin, clientId: 'test', clientSecret: 'test', secure: false }, provider: {
    authorize: state => origin + '/api/auth/github/callback?' + new URLSearchParams({ state, code: 'test' }),
    exchange: async () => ({ providerId: 'github', subject: randomUUID(), displayName: '学习测试用户', avatarUrl: '' }),
  } })
  app.use(express.static(resolve('docs/.vitepress/dist'), { extensions: ['html'] }))
  const server = app.listen(4175, 'localhost', () => console.log('E2E site and API ready'))
  const shutdown = () => server.close(() => { db.close().finally(() => process.exit(0)) })
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}
main().catch(error => { console.error(error); process.exit(1) })
