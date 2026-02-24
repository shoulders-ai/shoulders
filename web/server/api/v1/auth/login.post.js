import { useDb } from '../../../db/index.js'
import { users } from '../../../db/schema.js'
import { verifyPassword, createAccessToken, createRefreshToken, parseDeviceLabel } from '../../../utils/auth.js'
import { eq } from 'drizzle-orm'

// Pre-computed dummy hash so "user not found" takes the same time as "wrong password"
const DUMMY_HASH = '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAw$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

export default defineEventHandler(async (event) => {
  const { email, password } = await readBody(event)

  if (!email || !password) {
    setResponseStatus(event, 400)
    return { error: 'Email and password are required' }
  }

  const emailLower = email.toLowerCase().trim()
  const db = useDb()

  const user = db.select().from(users).where(eq(users.email, emailLower)).get()
  if (!user || !user.passwordHash) {
    // Run argon2 against a dummy hash to prevent timing-based account enumeration
    await verifyPassword(DUMMY_HASH, password).catch(() => {})
    setResponseStatus(event, 401)
    return { error: 'Invalid email or password' }
  }

  const valid = await verifyPassword(user.passwordHash, password)
  if (!valid) {
    setResponseStatus(event, 401)
    return { error: 'Invalid email or password' }
  }

  if (user.suspended) {
    setResponseStatus(event, 403)
    return { error: 'Account suspended' }
  }

  if (!user.emailVerified) {
    setResponseStatus(event, 403)
    return { error: 'Please verify your email before signing in. Check your inbox for the verification link.' }
  }

  const now = new Date().toISOString()
  const deviceLabel = parseDeviceLabel(getHeader(event, 'user-agent'))

  const { token, expiresAt } = await createAccessToken(user.id)
  const { refreshToken, refreshExpiresAt } = await createRefreshToken(user.id, deviceLabel)

  db.update(users).set({ updatedAt: now }).where(eq(users.id, user.id)).run()

  return {
    token,
    expiresAt,
    refreshToken,
    refreshExpiresAt,
    user: { email: user.email },
    plan: user.plan,
    credits: user.credits,
    cancelAt: user.cancelAt || null,
    emailVerified: !!user.emailVerified,
    createdAt: user.createdAt,
    suspended: !!user.suspended,
  }
})
