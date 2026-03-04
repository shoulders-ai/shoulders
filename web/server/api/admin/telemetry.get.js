import { useDb } from '../../db/index.js'

function dailyCounts(sqlite, query, params, days) {
  const rows = sqlite.prepare(query).all(...params)
  const map = Object.fromEntries(rows.map(r => [r.date, r.count]))
  const result = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000)
    const date = d.toISOString().slice(0, 10)
    result.push({ date, count: map[date] || 0 })
  }
  return result
}

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const page = Math.max(1, parseInt(query.page) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 50))
  const eventType = query.eventType || ''
  const platform = query.platform || ''
  const deviceId = query.deviceId || ''
  const from = query.from || ''
  const to = query.to || ''
  const offset = (page - 1) * limit

  const db = useDb()
  const sqlite = db.$client

  const conditions = []
  const params = []

  if (eventType) {
    conditions.push('event_type = ?')
    params.push(eventType)
  }
  if (platform) {
    conditions.push('platform = ?')
    params.push(platform)
  }
  if (deviceId) {
    conditions.push('device_id = ?')
    params.push(deviceId)
  }
  if (from) {
    conditions.push('created_at >= ?')
    params.push(from)
  }
  if (to) {
    conditions.push('created_at <= ?')
    params.push(to + 'T23:59:59.999Z')
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const countRow = sqlite.prepare(`SELECT count(*) as total FROM telemetry_events ${whereClause}`).get(...params)

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const statsRow = sqlite.prepare(`
    SELECT
      count(*) as total,
      COUNT(DISTINCT device_id) as unique_devices,
      sum(case when created_at >= ? then 1 else 0 end) as today
    FROM telemetry_events ${whereClause}
  `).get(dayAgo, ...params)

  const byEvent = sqlite.prepare(`
    SELECT event_type, count(*) as count
    FROM telemetry_events ${whereClause}
    GROUP BY event_type ORDER BY count DESC
  `).all(...params)

  const byPlatform = sqlite.prepare(`
    SELECT platform, count(*) as count
    FROM telemetry_events ${whereClause ? whereClause + ' AND' : 'WHERE'} platform IS NOT NULL
    GROUP BY platform ORDER BY count DESC
  `).all(...params)

  // Daily event counts (last 30 days, scoped to filter)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const dailyEventsQuery = `
    SELECT date(created_at) as date, count(*) as count
    FROM telemetry_events ${whereClause ? whereClause + ' AND' : 'WHERE'} created_at >= ?
    GROUP BY date(created_at)
  `
  const daily = dailyCounts(sqlite, dailyEventsQuery, [...params, thirtyDaysAgo], 30)

  // DAU: unique devices per day (last 30 days, scoped to filter)
  const dauQuery = `
    SELECT date(created_at) as date, COUNT(DISTINCT device_id) as count
    FROM telemetry_events ${whereClause ? whereClause + ' AND' : 'WHERE'} created_at >= ?
    GROUP BY date(created_at)
  `
  const dau = dailyCounts(sqlite, dauQuery, [...params, thirtyDaysAgo], 30)

  // Average session duration: time between first and last event per device per day
  // Only counts days with 2+ events (need at least two timestamps to measure a span)
  const sessionRow = sqlite.prepare(`
    SELECT
      AVG(duration_sec) as avg_sec,
      MAX(duration_sec) as max_sec
    FROM (
      SELECT
        device_id,
        date(created_at) as day,
        (julianday(max(created_at)) - julianday(min(created_at))) * 86400 as duration_sec
      FROM telemetry_events
      ${whereClause ? whereClause + ' AND' : 'WHERE'} created_at >= ?
      GROUP BY device_id, date(created_at)
      HAVING count(*) > 1
    )
  `).get(...params, thirtyDaysAgo)

  const rows = sqlite.prepare(`
    SELECT id, device_id, event_type, event_data, app_version, platform, created_at
    FROM telemetry_events
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset)

  return {
    events: rows,
    pagination: {
      page,
      limit,
      total: countRow.total,
      pages: Math.ceil(countRow.total / limit),
    },
    stats: {
      total: statsRow.total || 0,
      uniqueDevices: statsRow.unique_devices || 0,
      today: statsRow.today || 0,
    },
    byEvent,
    byPlatform,
    dailyCounts: daily,
    dauDaily: dau,
    sessionDuration: {
      avgMinutes: sessionRow.avg_sec ? Math.round(sessionRow.avg_sec / 60) : 0,
      maxMinutes: sessionRow.max_sec ? Math.round(sessionRow.max_sec / 60) : 0,
    },
  }
})
