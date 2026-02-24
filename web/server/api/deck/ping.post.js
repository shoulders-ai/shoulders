import { useDb } from '../../db/index.js'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { session_id, current_slide } = body

  if (!session_id || current_slide === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'session_id and current_slide required' })
  }

  const db = useDb()
  const sqlite = db.$client

  const view = sqlite.prepare(`
    SELECT id, slide_times FROM deck_views WHERE session_id = ?
  `).get(session_id)

  if (!view) {
    throw createError({ statusCode: 404, statusMessage: 'Session not found' })
  }

  let slideTimes = {}
  try { slideTimes = JSON.parse(view.slide_times || '{}') } catch {}

  const slideKey = String(current_slide)
  slideTimes[slideKey] = (slideTimes[slideKey] || 0) + 1

  sqlite.prepare(`
    UPDATE deck_views
    SET slide_times = ?, current_slide = ?, last_ping_at = ?
    WHERE id = ?
  `).run(JSON.stringify(slideTimes), current_slide, new Date().toISOString(), view.id)

  return { success: true }
})
