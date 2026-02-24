import { useDb } from '../../db/index.js'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const page = Math.max(1, parseInt(query.page) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 50))
  const dismissed = query.dismissed === '1' ? 1 : query.dismissed === '0' ? 0 : null
  const sort = query.sort === 'asc' ? 'ASC' : 'DESC'
  const offset = (page - 1) * limit

  const db = useDb()
  const sqlite = db.$client

  const conditions = []
  const params = []

  if (dismissed !== null) {
    conditions.push('dismissed = ?')
    params.push(dismissed)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const countRow = sqlite.prepare(`SELECT count(*) as total FROM contact_submissions ${whereClause}`).get(...params)

  const rows = sqlite.prepare(`
    SELECT id, institution, name, email, team_size, needs, dismissed, created_at
    FROM contact_submissions
    ${whereClause}
    ORDER BY created_at ${sort}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset)

  return {
    contacts: rows,
    pagination: {
      page,
      limit,
      total: countRow.total,
      pages: Math.ceil(countRow.total / limit),
    },
  }
})
