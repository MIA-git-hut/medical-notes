import { Pool } from 'pg'
import { PGlite } from '@electric-sql/pglite'
import { randomUUID } from 'node:crypto'

/** CI uses PostgreSQL 16; local tests use the PostgreSQL engine compiled to WASM. */
export async function testDatabase() {
  if (process.env.DATABASE_URL) {
    const schema = 'test_' + randomUUID().replaceAll('-', '')
    const admin = new Pool({ connectionString: process.env.DATABASE_URL })
    await admin.query(`CREATE SCHEMA ${schema}`)
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` })
    return { pool, close: async () => { await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end() } }
  }
  const pg = new PGlite()
  await pg.waitReady
  let tail = Promise.resolve()
  const acquire = async () => {
    const previous = tail
    let release!: () => void
    tail = new Promise<void>(resolve => { release = resolve })
    await previous
    return release
  }
  const query = async (sql: string, parameters?: unknown[]) => {
    if (!parameters && sql.includes(';')) {
      const results = await pg.exec(sql)
      const result = results.at(-1)!
      return { rows: result.rows, rowCount: result.affectedRows || result.rows.length }
    }
    const result = await pg.query(sql, parameters)
    return { rows: result.rows, rowCount: result.affectedRows || result.rows.length }
  }
  const pool = {
    async query(sql: string, parameters?: unknown[]) { const release = await acquire(); try { return await query(sql, parameters) } finally { release() } },
    async connect() { const release = await acquire(); return { query, release } },
  } as unknown as Pool
  return { pool, close: () => pg.close() }
}
