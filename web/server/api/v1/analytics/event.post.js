import { useDb } from '../../../db/index.js'
import { pageViews } from '../../../db/schema.js'
import { generateId } from '../../../utils/id.js'

const ALLOWED_EVENTS = new Set(['page_view', 'download_click'])
const EXCLUDED_PREFIXES = ['/admin', '/login', '/signup', '/account', '/verify-email', '/reset-password', '/d/', '/api/']

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body || !body.eventType || !ALLOWED_EVENTS.has(body.eventType)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid event type' }
  }

  const path = body.path
  if (typeof path !== 'string' || !path.startsWith('/') || path.length > 500) {
    setResponseStatus(event, 400)
    return { error: 'Invalid path' }
  }

  // Reject non-public paths
  if (EXCLUDED_PREFIXES.some(p => path === p || path.startsWith(p + '/') || path.startsWith(p))) {
    return { ok: true } // Silent drop — don't leak which paths exist
  }

  // Strip referrer to domain only (server-side)
  let referrerDomain = null
  if (body.referrer && typeof body.referrer === 'string') {
    try {
      const url = new URL(body.referrer)
      referrerDomain = url.hostname
    } catch {
      // Ignore malformed referrer
    }
  }

  // Cap duration to 0-3600
  let duration = null
  if (typeof body.durationSeconds === 'number' && isFinite(body.durationSeconds)) {
    duration = Math.max(0, Math.min(3600, Math.round(body.durationSeconds)))
  }

  // Event meta (e.g. platform for download clicks)
  let eventMeta = null
  if (body.eventMeta && typeof body.eventMeta === 'object') {
    eventMeta = JSON.stringify(body.eventMeta)
  }

  const db = useDb()
  db.insert(pageViews).values({
    id: generateId(),
    path,
    referrerDomain,
    durationSeconds: duration,
    eventType: body.eventType,
    eventMeta,
  }).run()

  return { ok: true }
})
