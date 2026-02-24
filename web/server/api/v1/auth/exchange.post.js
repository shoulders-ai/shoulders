import { useDb } from '../../../db/index.js'
import { verificationTokens, users } from '../../../db/schema.js'
import { hashToken, createAccessToken, createRefreshToken } from '../../../utils/auth.js'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { code } = await readBody(event)

  if (!code) {
    setResponseStatus(event, 400)
    return { error: 'Code is required' }
  }

  const db = useDb()
  const codeHash = hashToken(code)

  // Look up the desktop auth code
  const record = db.select().from(verificationTokens)
    .where(and(
      eq(verificationTokens.tokenHash, codeHash),
      eq(verificationTokens.type, 'desktop_auth'),
      eq(verificationTokens.used, 0),
    ))
    .get()

  if (!record) {
    setResponseStatus(event, 401)
    return { error: 'Invalid or expired code' }
  }

  // Check 60-second expiry
  if (new Date(record.expiresAt) < new Date()) {
    setResponseStatus(event, 401)
    return { error: 'Code expired. Please try again.' }
  }

  // Mark as used
  db.update(verificationTokens).set({ used: 1 }).where(eq(verificationTokens.id, record.id)).run()

  // Look up user
  const user = db.select().from(users).where(eq(users.id, record.userId)).get()
  if (!user) {
    setResponseStatus(event, 401)
    return { error: 'User not found' }
  }

  if (user.suspended) {
    setResponseStatus(event, 403)
    return { error: 'Account suspended' }
  }

  // Issue both tokens
  const { token, expiresAt } = await createAccessToken(user.id)
  const { refreshToken, refreshExpiresAt } = await createRefreshToken(user.id, 'Shoulders Desktop')

  return {
    token,
    expiresAt,
    refreshToken,
    refreshExpiresAt,
    user: { email: user.email },
    plan: user.plan,
    credits: user.credits,
    cancelAt: user.cancelAt || null,
  }
})
