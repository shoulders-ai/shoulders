const windows = new Map()

const LIMITS = {
  auth: { max: 30, windowMs: 60_000 },
  adminLogin: { max: 5, windowMs: 60_000 },
  proxy: { max: 120, windowMs: 60_000 },
  desktopPoll: { max: 60, windowMs: 60_000 },
  telemetry: { max: 30, windowMs: 60_000 },
  review: { max: 5, windowMs: 3600_000 },
  analytics: { max: 30, windowMs: 60_000 },
}

function getKey(event, type) {
  if (type === 'proxy' && event.context.user) {
    return `proxy:${event.context.user.id}`
  }
  const forwarded = getHeader(event, 'x-forwarded-for')
  const ip = forwarded?.split(',').pop()?.trim() || '127.0.0.1'
  return `${type}:${ip}`
}

function checkLimit(key, limit) {
  const now = Date.now()
  let entry = windows.get(key)

  if (!entry || now - entry.start > limit.windowMs) {
    entry = { start: now, count: 0 }
    windows.set(key, entry)
  }

  entry.count++
  return entry.count <= limit.max
}

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of windows) {
    if (now - entry.start > 120_000) windows.delete(key)
  }
}, 300_000)

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname

  let type = null
  if (path === '/api/v1/auth/desktop-poll') type = 'desktopPoll'
  else if (path === '/api/admin/login') type = 'adminLogin'
  else if (path.startsWith('/api/v1/auth/')) type = 'auth'
  else if (path.startsWith('/api/v1/proxy')) type = 'proxy'
  else if (path.startsWith('/api/v1/telemetry')) type = 'telemetry'
  else if (path.startsWith('/api/v1/analytics')) type = 'analytics'
  else if (path === '/api/review/upload') type = 'review'

  if (!type) return

  const key = getKey(event, type)
  if (!checkLimit(key, LIMITS[type])) {
    setResponseStatus(event, 429)
    return { error: 'Too many requests. Please try again later.' }
  }
})
