import { useDb } from '../../db/index.js'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const page = Math.max(1, parseInt(query.page) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 50))
  const provider = query.provider || ''
  const status = query.status || ''
  const userId = query.userId || ''
  const from = query.from || ''
  const to = query.to || ''
  const offset = (page - 1) * limit

  const db = useDb()
  const sqlite = db.$client

  const conditions = []
  const params = []

  if (provider) {
    conditions.push('c.provider = ?')
    params.push(provider)
  }
  if (status) {
    conditions.push('c.status = ?')
    params.push(status)
  }
  if (userId) {
    conditions.push('c.user_id = ?')
    params.push(userId)
  }
  if (from) {
    conditions.push('c.created_at >= ?')
    params.push(from)
  }
  if (to) {
    conditions.push('c.created_at <= ?')
    params.push(to + 'T23:59:59.999Z')
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const countRow = sqlite.prepare(`SELECT count(*) as total FROM api_calls c ${whereClause}`).get(...params)

  // Aggregate status counts for the current filter
  const statusCounts = sqlite.prepare(`
    SELECT
      count(*) as total,
      sum(case when c.status = 'success' then 1 else 0 end) as success,
      sum(case when c.status = 'error' then 1 else 0 end) as errors,
      sum(c.input_tokens) as total_input,
      sum(c.output_tokens) as total_output,
      sum(c.credits_used) as total_credits,
      avg(case when c.status = 'success' then c.duration_ms end) as avg_duration
    FROM api_calls c ${whereClause}
  `).get(...params)

  const rows = sqlite.prepare(`
    SELECT
      c.id, c.user_id, c.provider, c.model,
      c.input_tokens, c.output_tokens, c.credits_used,
      c.duration_ms, c.status, c.error_message, c.created_at,
      u.email as user_email
    FROM api_calls c
    LEFT JOIN users u ON u.id = c.user_id
    ${whereClause}
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset)

  return {
    calls: rows,
    pagination: {
      page,
      limit,
      total: countRow.total,
      pages: Math.ceil(countRow.total / limit),
    },
    stats: {
      success: statusCounts.success || 0,
      errors: statusCounts.errors || 0,
      errorRate: statusCounts.total > 0 ? ((statusCounts.errors || 0) / statusCounts.total * 100).toFixed(1) : '0.0',
      totalInput: statusCounts.total_input || 0,
      totalOutput: statusCounts.total_output || 0,
      totalCredits: statusCounts.total_credits || 0,
      avgDuration: statusCounts.avg_duration ? Math.round(statusCounts.avg_duration) : null,
    },
  }
})
