import { useDb } from '../../db/index.js'
import { users, apiCalls, contactSubmissions } from '../../db/schema.js'
import { sql, gte } from 'drizzle-orm'

// Helper: daily counts for a table/condition over the last N days, zero-filled
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

export default defineEventHandler(() => {
  const db = useDb()
  const sqlite = db.$client
  const now = new Date()
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString()
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString()
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

  // === KPI totals ===
  const totalUsers = db.select({ count: sql`count(*)` }).from(users).get()
  const totalCredits = db.select({ sum: sql`coalesce(sum(credits_used), 0)` }).from(apiCalls).get()
  const totalCalls = db.select({ count: sql`count(*)` }).from(apiCalls).get()
  const callsToday = db.select({ count: sql`count(*)` }).from(apiCalls).where(gte(apiCalls.createdAt, dayAgo)).get()

  // Active users
  const dau = sqlite.prepare('SELECT COUNT(DISTINCT user_id) as count FROM api_calls WHERE created_at >= ?').get(dayAgo)
  const wau = sqlite.prepare('SELECT COUNT(DISTINCT user_id) as count FROM api_calls WHERE created_at >= ?').get(weekAgo)
  const mau = sqlite.prepare('SELECT COUNT(DISTINCT user_id) as count FROM api_calls WHERE created_at >= ?').get(monthAgo)

  // Landing page views total
  const landingTotal = sqlite.prepare("SELECT count(*) as count FROM page_views WHERE event_type = 'page_view' AND path = '/'").get()

  // === Week-over-week deltas ===
  const signupsThisWeek = sqlite.prepare('SELECT count(*) as count FROM users WHERE created_at >= ?').get(weekAgo)
  const signupsLastWeek = sqlite.prepare('SELECT count(*) as count FROM users WHERE created_at >= ? AND created_at < ?').get(twoWeeksAgo, weekAgo)

  const revenueThisWeek = sqlite.prepare('SELECT coalesce(sum(credits_used), 0) as sum FROM api_calls WHERE created_at >= ?').get(weekAgo)
  const revenueLastWeek = sqlite.prepare('SELECT coalesce(sum(credits_used), 0) as sum FROM api_calls WHERE created_at >= ? AND created_at < ?').get(twoWeeksAgo, weekAgo)

  const dauThisWeek = sqlite.prepare('SELECT COUNT(DISTINCT user_id) as count FROM api_calls WHERE created_at >= ?').get(weekAgo)
  const dauLastWeek = sqlite.prepare('SELECT COUNT(DISTINCT user_id) as count FROM api_calls WHERE created_at >= ? AND created_at < ?').get(twoWeeksAgo, weekAgo)

  const landingThisWeek = sqlite.prepare("SELECT count(*) as count FROM page_views WHERE event_type = 'page_view' AND path = '/' AND created_at >= ?").get(weekAgo)
  const landingLastWeek = sqlite.prepare("SELECT count(*) as count FROM page_views WHERE event_type = 'page_view' AND path = '/' AND created_at >= ? AND created_at < ?").get(twoWeeksAgo, weekAgo)

  // === 14-day trends (for sparklines + chart) ===
  const trends = {
    signups: dailyCounts(sqlite,
      'SELECT date(created_at) as date, count(*) as count FROM users WHERE created_at >= ? GROUP BY date(created_at)',
      [twoWeeksAgo], 14),
    apiCalls: dailyCounts(sqlite,
      'SELECT date(created_at) as date, count(*) as count FROM api_calls WHERE created_at >= ? GROUP BY date(created_at)',
      [twoWeeksAgo], 14),
    pageViews: dailyCounts(sqlite,
      "SELECT date(created_at) as date, count(*) as count FROM page_views WHERE event_type = 'page_view' AND path = '/' AND created_at >= ? GROUP BY date(created_at)",
      [twoWeeksAgo], 14),
    reviews: dailyCounts(sqlite,
      'SELECT date(created_at) as date, count(*) as count FROM reviews WHERE created_at >= ? GROUP BY date(created_at)',
      [twoWeeksAgo], 14),
    downloads: dailyCounts(sqlite,
      "SELECT date(created_at) as date, count(*) as count FROM page_views WHERE event_type = 'download_click' AND created_at >= ? GROUP BY date(created_at)",
      [twoWeeksAgo], 14),
    deckViews: dailyCounts(sqlite,
      'SELECT date(created_at) as date, count(*) as count FROM deck_views WHERE created_at >= ? GROUP BY date(created_at)',
      [twoWeeksAgo], 14),
  }

  // === 30-day funnel ===
  const funnel = {
    landing: sqlite.prepare("SELECT count(*) as count FROM page_views WHERE event_type = 'page_view' AND path = '/' AND created_at >= ?").get(monthAgo).count,
    downloadPage: sqlite.prepare("SELECT count(*) as count FROM page_views WHERE event_type = 'page_view' AND path = '/download' AND created_at >= ?").get(monthAgo).count,
    downloadClick: sqlite.prepare("SELECT count(*) as count FROM page_views WHERE event_type = 'download_click' AND created_at >= ?").get(monthAgo).count,
    signups: sqlite.prepare('SELECT count(*) as count FROM users WHERE created_at >= ?').get(monthAgo).count,
  }

  // === Reviews ===
  const reviewTotal = sqlite.prepare('SELECT count(*) as count FROM reviews').get()
  const reviewComplete = sqlite.prepare("SELECT count(*) as count FROM reviews WHERE status = 'complete'").get()
  const reviewFailed = sqlite.prepare("SELECT count(*) as count FROM reviews WHERE status = 'failed'").get()
  const reviewProcessing = sqlite.prepare("SELECT count(*) as count FROM reviews WHERE status = 'processing'").get()
  const reviewCost = sqlite.prepare('SELECT coalesce(sum(cost_cents), 0) as total FROM reviews').get()

  // === Decks ===
  const deckViewCount = sqlite.prepare('SELECT count(*) as count FROM deck_views').get()
  const deckViewsThisWeek = sqlite.prepare('SELECT count(*) as count FROM deck_views WHERE created_at >= ?').get(weekAgo)

  // === API errors (for attention section) ===
  const errorsToday = sqlite.prepare("SELECT count(*) as count FROM api_calls WHERE status = 'error' AND created_at >= ?").get(dayAgo)

  // === Download clicks breakdown ===
  const downloadsByPlatform = sqlite.prepare(`
    SELECT json_extract(event_meta, '$.platform') as platform, count(*) as count
    FROM page_views WHERE event_type = 'download_click'
    GROUP BY platform ORDER BY count DESC
  `).all()

  // === Contacts ===
  const undismissedCount = sqlite.prepare('SELECT count(*) as count FROM contact_submissions WHERE dismissed = 0').get()

  return {
    users: { total: totalUsers.count },
    credits: { total: totalCredits.sum },
    activeUsers: { dau: dau.count, wau: wau.count, mau: mau.count },
    apiCalls: { total: totalCalls.count, today: callsToday.count, errorsToday: errorsToday.count },
    landingViews: { total: landingTotal.count },

    deltas: {
      signups: { thisWeek: signupsThisWeek.count, lastWeek: signupsLastWeek.count },
      revenue: { thisWeek: revenueThisWeek.sum, lastWeek: revenueLastWeek.sum },
      activeUsers: { thisWeek: dauThisWeek.count, lastWeek: dauLastWeek.count },
      pageViews: { thisWeek: landingThisWeek.count, lastWeek: landingLastWeek.count },
    },

    trends,
    funnel,

    reviews: {
      total: reviewTotal.count,
      complete: reviewComplete.count,
      failed: reviewFailed.count,
      processing: reviewProcessing.count,
      totalCostCents: reviewCost.total,
    },
    decks: {
      totalViews: deckViewCount.count,
      viewsThisWeek: deckViewsThisWeek.count,
    },
    downloads: { byPlatform: downloadsByPlatform },
    contact: {
      undismissed: undismissedCount.count,
    },
  }
})
