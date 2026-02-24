import { useDb } from '../../db/index.js'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const db = useDb()
  const sqlite = db.$client

  // Date range defaults to last 30 days
  const now = new Date()
  const defaultFrom = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const defaultTo = now.toISOString().slice(0, 10)
  const from = query.from || defaultFrom
  const to = query.to || defaultTo
  const fromISO = `${from}T00:00:00.000Z`
  const toISO = `${to}T23:59:59.999Z`

  // Summary stats
  const totalViews = sqlite.prepare(
    `SELECT count(*) as count FROM page_views WHERE event_type = 'page_view' AND created_at >= ? AND created_at <= ?`
  ).get(fromISO, toISO)

  const totalDownloads = sqlite.prepare(
    `SELECT count(*) as count FROM page_views WHERE event_type = 'download_click' AND created_at >= ? AND created_at <= ?`
  ).get(fromISO, toISO)

  const avgDuration = sqlite.prepare(
    `SELECT coalesce(avg(duration_seconds), 0) as avg FROM page_views WHERE event_type = 'page_view' AND duration_seconds IS NOT NULL AND created_at >= ? AND created_at <= ?`
  ).get(fromISO, toISO)

  const uniquePaths = sqlite.prepare(
    `SELECT count(DISTINCT path) as count FROM page_views WHERE event_type = 'page_view' AND created_at >= ? AND created_at <= ?`
  ).get(fromISO, toISO)

  // Top pages (top 20 by view count)
  const topPages = sqlite.prepare(`
    SELECT path, count(*) as views, coalesce(avg(duration_seconds), 0) as avg_duration
    FROM page_views
    WHERE event_type = 'page_view' AND created_at >= ? AND created_at <= ?
    GROUP BY path
    ORDER BY views DESC
    LIMIT 20
  `).all(fromISO, toISO)

  // Daily views
  const dailyViews = sqlite.prepare(`
    SELECT date(created_at) as date, count(*) as views
    FROM page_views
    WHERE event_type = 'page_view' AND created_at >= ? AND created_at <= ?
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all(fromISO, toISO)

  // Download clicks by platform
  const downloads = sqlite.prepare(`
    SELECT json_extract(event_meta, '$.platform') as platform, count(*) as count
    FROM page_views
    WHERE event_type = 'download_click' AND created_at >= ? AND created_at <= ?
    GROUP BY platform
    ORDER BY count DESC
  `).all(fromISO, toISO)

  // Top referrers
  const topReferrers = sqlite.prepare(`
    SELECT referrer_domain, count(*) as count
    FROM page_views
    WHERE referrer_domain IS NOT NULL AND created_at >= ? AND created_at <= ?
    GROUP BY referrer_domain
    ORDER BY count DESC
    LIMIT 10
  `).all(fromISO, toISO)

  return {
    summary: {
      totalViews: totalViews.count,
      totalDownloads: totalDownloads.count,
      avgDuration: Math.round(avgDuration.avg),
      uniquePaths: uniquePaths.count,
    },
    topPages,
    dailyViews,
    downloads,
    topReferrers,
  }
})
