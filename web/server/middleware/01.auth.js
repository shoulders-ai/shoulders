import { verifyToken } from '../utils/auth.js'
import { useDb } from '../db/index.js'
import { users } from '../db/schema.js'
import { eq } from 'drizzle-orm'

const PROTECTED_PREFIXES = [
  '/api/v1/proxy',
  '/api/v1/search',
  '/api/v1/auth/status',
  '/api/v1/auth/change-password',
  '/api/v1/auth/usage',
  '/api/v1/auth/delete-account',
  '/api/v1/auth/sessions',
  '/api/v1/auth/desktop-code',
  '/api/v1/stripe/checkout',
  '/api/v1/stripe/portal',
  '/api/v1/stripe/credits',
  '/api/v1/stripe/recharge-settings',
]

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  const isProtected = PROTECTED_PREFIXES.some(p => path.startsWith(p))
  if (!isProtected) return

  const authHeader = getHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    setResponseStatus(event, 401)
    return { error: 'Authentication required' }
  }

  const token = authHeader.slice(7)
  const payload = await verifyToken(token)
  if (!payload) {
    setResponseStatus(event, 401)
    return { error: 'Invalid or expired token' }
  }

  // Look up user (1 DB read — no token revocation check, 15-min TTL is the security boundary)
  const db = useDb()
  const user = db.select().from(users).where(eq(users.id, payload.userId)).get()
  if (!user) {
    setResponseStatus(event, 401)
    return { error: 'User not found' }
  }

  if (user.suspended) {
    setResponseStatus(event, 403)
    return { error: 'Account suspended' }
  }

  // Debounced last_active_at update (only write if >5 min old)
  const now = new Date()
  const lastActive = user.lastActiveAt ? new Date(user.lastActiveAt) : null
  if (!lastActive || (now - lastActive) > 5 * 60 * 1000) {
    db.update(users).set({ lastActiveAt: now.toISOString() }).where(eq(users.id, user.id)).run()
  }

  event.context.user = user
})
