import { Pool, type PoolClient } from 'pg'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

let pool: Pool | undefined
export function getPool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured')
  return pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 8000 })
}
export async function transaction<T>(db: Pool, run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const result = await run(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { client.release() }
}
export async function migrate(db: Pool) {
  await transaction(db, async client => {
    await client.query('SELECT pg_advisory_xact_lock(5873401)')
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY)')
    const applied = await client.query('SELECT version FROM schema_migrations')
    const versions = new Set(applied.rows.map(row => row.version))
    const directory = resolve('server/migrations')
    for (const file of readdirSync(directory).filter(name => /^\d{3}-.+\.sql$/.test(name)).sort()) {
      const version = Number(file.slice(0, 3))
      if (versions.has(version)) continue
      await client.query(readFileSync(join(directory, file), 'utf8'))
      await client.query('INSERT INTO schema_migrations(version) VALUES($1) ON CONFLICT DO NOTHING', [version])
    }
  })
}
