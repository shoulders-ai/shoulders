import { useDb } from '../../db/index.js'
import { generateId } from '../../utils/id.js'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { slug, session_id } = body

  if (!slug || !session_id) {
    throw createError({ statusCode: 400, statusMessage: 'slug and session_id required' })
  }

  const db = useDb()
  const sqlite = db.$client

  const share = sqlite.prepare(`
    SELECT id FROM deck_shares WHERE slug = ? AND is_active = 1
  `).get(slug)

  if (!share) {
    throw createError({ statusCode: 404, statusMessage: 'Share not found' })
  }

  const headers = getHeaders(event)
  const userAgent = headers['user-agent'] || null
  const referrer = headers['referer'] || headers['referrer'] || null
  const forwardedFor = headers['x-forwarded-for']
  const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : null

  const id = generateId()
  const now = new Date().toISOString()

  sqlite.prepare(`
    INSERT INTO deck_views (id, share_id, session_id, slide_times, current_slide, user_agent, ip_address, referrer, created_at)
    VALUES (?, ?, ?, '{}', 1, ?, ?, ?, ?)
  `).run(id, share.id, session_id, userAgent, ipAddress, referrer, now)

  return { success: true, view_id: id }
})
