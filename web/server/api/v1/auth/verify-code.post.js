import { useDb } from '../../../db/index.js'
import { verificationTokens, users } from '../../../db/schema.js'
import { hashToken, createAccessToken, createRefreshToken, parseDeviceLabel } from '../../../utils/auth.js'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { email, code } = await readBody(event)

  if (!email || !code) {
    setResponseStatus(event, 400)
    return { error: 'Email and code are required' }
  }

  const emailLower = email.toLowerCase().trim()
  const db = useDb()

  const user = db.select().from(users).where(eq(users.email, emailLower)).get()
  if (!user) {
    setResponseStatus(event, 400)
    return { error: 'Invalid code' }
  }

  const codeHash = hashToken(code.trim())
  const record = db.select().from(verificationTokens)
    .where(and(
      eq(verificationTokens.userId, user.id),
      eq(verificationTokens.tokenHash, codeHash),
      eq(verificationTokens.type, 'email_verify'),
      eq(verificationTokens.used, 0),
    ))
    .get()

  if (!record) {
    setResponseStatus(event, 400)
    return { error: 'Invalid code' }
  }

  if (new Date(record.expiresAt) < new Date()) {
    setResponseStatus(event, 400)
    return { error: 'Code expired. Please sign up again.' }
  }

  // Mark token as used
  db.update(verificationTokens).set({ used: 1 }).where(eq(verificationTokens.id, record.id)).run()

  // Mark email as verified
  const now = new Date().toISOString()
  db.update(users).set({
    emailVerified: 1,
    updatedAt: now,
  }).where(eq(users.id, user.id)).run()

  // Issue both tokens
  const deviceLabel = parseDeviceLabel(getHeader(event, 'user-agent'))
  const { token, expiresAt } = await createAccessToken(user.id)
  const { refreshToken, refreshExpiresAt } = await createRefreshToken(user.id, deviceLabel)

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
