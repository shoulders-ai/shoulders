import { jwtVerify } from 'jose'

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/admin/') || path === '/api/admin/login') return

  const method = getMethod(event)
  const config = useRuntimeConfig()

  // Check admin session cookie
  const cookie = getCookie(event, 'admin_session')
  if (!cookie) {
    setResponseStatus(event, 401)
    return { error: 'Admin authentication required' }
  }

  try {
    const secret = new TextEncoder().encode(config.jwtSecret)
    const { payload } = await jwtVerify(cookie, secret)
    if (!payload.admin) throw new Error('Not admin')
    event.context.admin = true
  } catch {
    setResponseStatus(event, 401)
    return { error: 'Invalid admin session' }
  }

  // CSRF protection for state-changing requests (cookie auth is vulnerable to cross-origin forms)
  if (method !== 'GET' && method !== 'HEAD') {
    const origin = getHeader(event, 'origin')
    const host = getHeader(event, 'host')
    if (origin && !origin.endsWith(`://${host}`)) {
      setResponseStatus(event, 403)
      return { error: 'CSRF check failed: origin mismatch' }
    }
  }
})
