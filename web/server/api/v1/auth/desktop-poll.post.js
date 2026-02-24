import { useDb } from '../../../db/index.js'
import { verificationTokens, users } from '../../../db/schema.js'
import { hashToken, createAccessToken, createRefreshToken } from '../../../utils/auth.js'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { state } = await readBody(event)

  if (!state) {
    setResponseStatus(event, 400)
    return { error: 'State is required' }
  }

  const stateKey = 'desktop_session:' + hashToken(state)
  const db = useDb()

  const record = db.select().from(verificationTokens)
    .where(and(
      eq(verificationTokens.type, stateKey),
      eq(verificationTokens.used, 0),
    ))
    .get()

  if (!record) {
    return { pending: true }
  }

  // Check expiry
  if (new Date(record.expiresAt) < new Date()) {
    db.update(verificationTokens).set({ used: 1 }).where(eq(verificationTokens.id, record.id)).run()
    setResponseStatus(event, 410)
    return { error: 'Session expired. Please try again.' }
  }

  // Mark as used (one-time)
  db.update(verificationTokens).set({ used: 1 }).where(eq(verificationTokens.id, record.id)).run()

  // tokenHash stores userId — generate fresh tokens on demand (SEC-013)
  const userId = record.tokenHash
  const user = db.select().from(users).where(eq(users.id, userId)).get()

  if (!user) {
    setResponseStatus(event, 401)
    return { error: 'User not found' }
  }

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
