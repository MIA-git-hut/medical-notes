import { getPool, migrate } from '../server/db'
async function main() {
  const db = getPool()
  try { await migrate(db); console.log('Database migration 001 applied') }
  finally { await db.end() }
}
main().catch(() => { console.error('Migration failed. Check database connectivity and permissions.'); process.exitCode = 1 })
