import { useDb } from '../../../db/index.js'
import { verificationTokens, users, refreshTokens } from '../../../db/schema.js'
import { hashToken, hashPassword } from '../../../utils/auth.js'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { token, password } = await readBody(event)

  if (!token || !password) {
    setResponseStatus(event, 400)
    return { error: 'Token and new password are required' }
  }

  if (password.length < 8) {
    setResponseStatus(event, 400)
    return { error: 'Password must be at least 8 characters' }
  }

  const db = useDb()
  const tHash = hashToken(token)

  const record = db.select().from(verificationTokens)
    .where(and(
      eq(verificationTokens.tokenHash, tHash),
      eq(verificationTokens.type, 'password_reset'),
      eq(verificationTokens.used, 0),
    ))
    .get()

  if (!record) {
    setResponseStatus(event, 400)
    return { error: 'Invalid or already used reset token' }
  }

  if (new Date(record.expiresAt) < new Date()) {
    setResponseStatus(event, 400)
    return { error: 'Reset token has expired' }
  }

  // Mark token as used
  db.update(verificationTokens).set({ used: 1 }).where(eq(verificationTokens.id, record.id)).run()

  // Update password
  const newHash = await hashPassword(password)
  db.update(users).set({
    passwordHash: newHash,
    updatedAt: new Date().toISOString(),
  }).where(eq(users.id, record.userId)).run()

  // Revoke all refresh tokens — user proved identity via reset token
  db.delete(refreshTokens)
    .where(eq(refreshTokens.userId, record.userId))
    .run()

  return { message: 'Password has been reset successfully' }
})
