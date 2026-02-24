import { useDb } from '../../db/index.js'

export default defineEventHandler(() => {
  const db = useDb()
  const sqlite = db.$client

  const sharesRows = sqlite.prepare(`
    SELECT id, slug, deck_name, recipient, is_active, cleared_at, created_at
    FROM deck_shares
    ORDER BY created_at DESC
  `).all()

  const shares = sharesRows.map(share => {
    // Fetch views, filtered by cleared_at
    const viewsQuery = share.cleared_at
      ? `SELECT session_id, slide_times, current_slide, user_agent, referrer, created_at
         FROM deck_views WHERE share_id = ? AND created_at > ? ORDER BY created_at DESC`
      : `SELECT session_id, slide_times, current_slide, user_agent, referrer, created_at
         FROM deck_views WHERE share_id = ? ORDER BY created_at DESC`

    const viewParams = share.cleared_at ? [share.id, share.cleared_at] : [share.id]
    const viewRows = sqlite.prepare(viewsQuery).all(...viewParams)

    const views = viewRows.map(v => {
      let slideTimes = {}
      try { slideTimes = JSON.parse(v.slide_times || '{}') } catch {}
      const totalSeconds = Object.values(slideTimes).reduce((sum, t) => sum + t, 0)

      return {
        session_id: v.session_id,
        started_at: v.created_at,
        total_seconds: totalSeconds,
        slide_times: slideTimes,
        user_agent: v.user_agent,
        referrer: v.referrer,
      }
    })

    const sessionCount = views.length
    const totalTimeSeconds = views.reduce((sum, v) => sum + v.total_seconds, 0)

    return {
      id: share.id,
      slug: share.slug,
      deck_name: share.deck_name,
      recipient: share.recipient,
      is_active: share.is_active,
      created_at: share.created_at,
      url: `/d/${share.slug}`,
      session_count: sessionCount,
      total_time_seconds: totalTimeSeconds,
      views,
    }
  })

  return { shares }
})
