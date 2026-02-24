import { useDb } from '../../../../db/index.js'
import { refreshTokens } from '../../../../db/schema.js'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler((event) => {
  const user = event.context.user
  if (!user) {
    setResponseStatus(event, 401)
    return { error: 'Authentication required' }
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    setResponseStatus(event, 400)
    return { error: 'Session ID is required' }
  }

  const db = useDb()

  // Find the token — must belong to this user
  const token = db.select().from(refreshTokens)
    .where(and(eq(refreshTokens.id, id), eq(refreshTokens.userId, user.id)))
    .get()

  if (!token) {
    setResponseStatus(event, 404)
    return { error: 'Session not found' }
  }

  // Revoke the entire family
  db.update(refreshTokens)
    .set({ revoked: 1 })
    .where(eq(refreshTokens.familyId, token.familyId))
    .run()

  return { ok: true }
})
