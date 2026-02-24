import { useDb } from '../../db/index.js'
import { users, authTokens, verificationTokens, apiCalls } from '../../db/schema.js'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { userId } = await readBody(event)

  if (!userId) {
    setResponseStatus(event, 400)
    return { error: 'userId is required' }
  }

  const db = useDb()
  const user = db.select().from(users).where(eq(users.id, userId)).get()
  if (!user) {
    setResponseStatus(event, 404)
    return { error: 'User not found' }
  }

  // Delete in FK order within a transaction
  const sqlite = db.$client
  sqlite.transaction(() => {
    sqlite.prepare('DELETE FROM auth_tokens WHERE user_id = ?').run(userId)
    sqlite.prepare('DELETE FROM verification_tokens WHERE user_id = ?').run(userId)
    sqlite.prepare('DELETE FROM api_calls WHERE user_id = ?').run(userId)
    sqlite.prepare('DELETE FROM users WHERE id = ?').run(userId)
  })()

  return { deleted: userId }
})
