import { useDb } from '../db/index.js'

function runCleanup() {
  try {
    const db = useDb()
    const sqlite = db.$client
    const now = new Date().toISOString()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // Clean expired refresh tokens
    sqlite.exec(`DELETE FROM refresh_tokens WHERE expires_at < '${now}'`)
    // Clean old revoked refresh tokens
    sqlite.exec(`DELETE FROM refresh_tokens WHERE revoked = 1 AND created_at < '${thirtyDaysAgo}'`)
    // Drain old auth_tokens table
    sqlite.exec(`DELETE FROM auth_tokens WHERE expires_at < '${now}'`)

    // Redact expired reviews (keep email + metadata for outreach)
    sqlite.exec(`UPDATE reviews SET status = 'expired', html = NULL, markdown = NULL, anchored_html = NULL, report = NULL, comments_json = NULL, tech_notes = NULL WHERE status NOT IN ('expired', 'deleted') AND expires_at IS NOT NULL AND expires_at < '${now}'`)

    // Purge page_views older than 180 days
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
    sqlite.exec(`DELETE FROM page_views WHERE created_at < '${sixMonthsAgo}'`)

    console.log('[cleanup] Expired tokens, reviews, and old page views cleaned')
  } catch (e) {
    console.error('[cleanup] Error:', e.message)
  }
}

export default defineNitroPlugin(() => {
  // Run on startup (delayed to let DB init finish)
  setTimeout(runCleanup, 5000)

  // Run every 24 hours
  setInterval(runCleanup, 24 * 60 * 60 * 1000)
})
