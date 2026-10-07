import type { Pool } from 'pg'

/** Admin membership is configured by immutable GitHub IDs, never display names or client input. */
export async function isAdmin(db: Pool, userId: string, adminGithubIds: string[]): Promise<boolean> {
  if (!adminGithubIds.length) return false
  const result = await db.query("SELECT 1 FROM identities WHERE user_id=$1 AND provider='github' AND provider_id=ANY($2::text[])", [userId, adminGithubIds])
  return !!result.rowCount
}
export async function adminStats(db: Pool) {
  const [users, logins, days] = await Promise.all([
    db.query('SELECT COUNT(*)::int AS total FROM users'),
    db.query(`SELECT COUNT(*)::int AS total,
      COUNT(DISTINCT user_id) FILTER (WHERE logged_in_at >= now() - interval '7 days')::int AS week,
      COUNT(DISTINCT user_id) FILTER (WHERE logged_in_at >= now() - interval '30 days')::int AS month FROM login_events`),
    db.query(`SELECT to_char(logged_in_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date, COUNT(*)::int AS sign_ins, COUNT(DISTINCT user_id)::int AS users
      FROM login_events WHERE logged_in_at >= now() - interval '30 days' GROUP BY 1 ORDER BY 1 DESC`),
  ])
  return { totalUsers: users.rows[0].total, totalSignIns: logins.rows[0].total, activeUsers7d: logins.rows[0].week, activeUsers30d: logins.rows[0].month,
    dailyLogins: days.rows.map(r => ({ date: r.date, signIns: r.sign_ins, users: r.users })) }
}
export async function adminUsers(db: Pool, page: number) {
  const size = 50
  const [count, users] = await Promise.all([
    db.query('SELECT COUNT(*)::int AS total FROM users'),
    db.query(`SELECT u.id,u.login,u.created_at, MAX(l.logged_in_at) AS last_login_at,COUNT(l.id)::int AS sign_ins
      FROM users u LEFT JOIN login_events l ON l.user_id=u.id GROUP BY u.id
      ORDER BY u.created_at DESC,u.id LIMIT $1 OFFSET $2`, [size, (page - 1) * size]),
  ])
  return { page, pageSize: size, total: count.rows[0].total, users: users.rows.map(r => ({ id: r.id, login: r.login,
    createdAt: new Date(r.created_at).toISOString(), lastLoginAt: r.last_login_at ? new Date(r.last_login_at).toISOString() : null, signIns: r.sign_ins })) }
}
