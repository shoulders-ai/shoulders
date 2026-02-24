import { useDb } from '../../../db/index.js'
import { users, refreshTokens } from '../../../db/schema.js'
import { verifyPassword, hashPassword } from '../../../utils/auth.js'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    setResponseStatus(event, 401)
    return { error: 'Authentication required' }
  }

  const { currentPassword, newPassword } = await readBody(event)

  if (!currentPassword || !newPassword) {
    setResponseStatus(event, 400)
    return { error: 'Current and new password are required' }
  }

  if (newPassword.length < 8) {
    setResponseStatus(event, 400)
    return { error: 'New password must be at least 8 characters' }
  }

  const valid = await verifyPassword(user.passwordHash, currentPassword)
  if (!valid) {
    setResponseStatus(event, 403)
    return { error: 'Current password is incorrect' }
  }

  const newHash = await hashPassword(newPassword)
  const db = useDb()

  db.update(users)
    .set({ passwordHash: newHash, updatedAt: new Date().toISOString() })
    .where(eq(users.id, user.id))
    .run()

  // Revoke all refresh tokens for this user (forces re-login on all devices)
  db.update(refreshTokens)
    .set({ revoked: 1 })
    .where(eq(refreshTokens.userId, user.id))
    .run()

  return { success: true }
})
