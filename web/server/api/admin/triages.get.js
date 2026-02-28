import { useDb } from '../../db/index.js'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const page = Math.max(1, parseInt(query.page) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 50))
  const status = query.status || ''
  const offset = (page - 1) * limit

  const db = useDb()
  const sqlite = db.$client

  const conditions = []
  const params = []

  if (status) {
    conditions.push('status = ?')
    params.push(status)
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const countRow = sqlite.prepare(`SELECT count(*) as total FROM triages ${whereClause}`).get(...params)

  const statsRow = sqlite.prepare(`
    SELECT
      count(*) as total,
      sum(case when status = 'complete' then 1 else 0 end) as complete,
      sum(case when status = 'failed' then 1 else 0 end) as failed,
      sum(case when status = 'processing' then 1 else 0 end) as processing,
      coalesce(sum(cost_cents), 0) as total_cost,
      avg(case when status = 'complete' then cost_cents end) as avg_cost,
      avg(case when completed_at is not null then
        (julianday(completed_at) - julianday(created_at)) * 86400000
      end) as avg_duration_ms
    FROM triages ${whereClause}
  `).get(...params)

  const rows = sqlite.prepare(`
    SELECT
      id, slug, status, current_step, filename,
      tech_notes, cost_cents, input_tokens, output_tokens,
      created_at, completed_at
    FROM triages
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset)

  const triages = rows.map(r => {
    let durationMs = null
    if (r.completed_at && r.created_at) {
      durationMs = new Date(r.completed_at) - new Date(r.created_at)
    }

    let techNotes = {}
    try { techNotes = r.tech_notes ? JSON.parse(r.tech_notes) : {} } catch {}

    return {
      id: r.id,
      slug: r.slug,
      status: r.status,
      currentStep: r.current_step,
      filename: r.filename,
      costCents: r.cost_cents || 0,
      inputTokens: r.input_tokens || 0,
      outputTokens: r.output_tokens || 0,
      durationMs,
      failReason: techNotes.stages?.fatal || null,
      createdAt: r.created_at,
      completedAt: r.completed_at,
    }
  })

  return {
    triages,
    pagination: {
      page,
      limit,
      total: countRow.total,
      pages: Math.ceil(countRow.total / limit),
    },
    stats: {
      total: statsRow.total || 0,
      complete: statsRow.complete || 0,
      failed: statsRow.failed || 0,
      processing: statsRow.processing || 0,
      totalCostCents: statsRow.total_cost || 0,
      avgCostCents: statsRow.avg_cost ? Math.round(statsRow.avg_cost) : 0,
      avgDurationMs: statsRow.avg_duration_ms ? Math.round(statsRow.avg_duration_ms) : null,
    },
  }
})
