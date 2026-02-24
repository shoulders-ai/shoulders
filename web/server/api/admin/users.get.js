import { useDb } from '../../db/index.js'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const page = Math.max(1, parseInt(query.page) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 50))
  const search = query.search?.trim() || ''
  const plan = query.plan || ''
  const sort = ['created', 'active', 'credits'].includes(query.sort) ? query.sort : 'created'
  const dir = query.dir === 'asc' ? 'ASC' : 'DESC'
  const offset = (page - 1) * limit

  const db = useDb()
  const sqlite = db.$client

  const conditions = []
  const params = []

  if (search) {
    conditions.push(`u.email LIKE ?`)
    params.push(`%${search}%`)
  }
  if (plan) {
    conditions.push(`u.plan = ?`)
    params.push(plan)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const orderMap = {
    created: `u.created_at ${dir}`,
    active: dir === 'ASC'
      ? `CASE WHEN u.last_active_at IS NULL THEN 1 ELSE 0 END, u.last_active_at ASC`
      : `CASE WHEN u.last_active_at IS NULL THEN 1 ELSE 0 END, u.last_active_at DESC`,
    credits: `u.credits ${dir}`,
  }
  const orderBy = orderMap[sort]

  const countRow = sqlite.prepare(`SELECT count(*) as total FROM users u ${whereClause}`).get(...params)

  const rows = sqlite.prepare(`
    SELECT
      u.id, u.email, u.plan, u.credits, u.email_verified,
      u.last_active_at, u.suspended,
      u.created_at, u.updated_at,
      (SELECT count(*) FROM api_calls WHERE user_id = u.id) as total_calls,
      (SELECT coalesce(sum(credits_used), 0) FROM api_calls WHERE user_id = u.id) as total_credits_used
    FROM users u
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset)

  return {
    users: rows,
    pagination: {
      page,
      limit,
      total: countRow.total,
      pages: Math.ceil(countRow.total / limit),
    },
  }
})
