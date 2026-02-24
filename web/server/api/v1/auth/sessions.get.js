import { useDb } from '../../../db/index.js'
import { refreshTokens } from '../../../db/schema.js'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler((event) => {
  const user = event.context.user
  if (!user) {
    setResponseStatus(event, 401)
    return { error: 'Authentication required' }
  }

  const db = useDb()
  const tokens = db.select({
    id: refreshTokens.id,
    deviceLabel: refreshTokens.deviceLabel,
    createdAt: refreshTokens.createdAt,
    expiresAt: refreshTokens.expiresAt,
    familyId: refreshTokens.familyId,
  }).from(refreshTokens)
    .where(and(
      eq(refreshTokens.userId, user.id),
      eq(refreshTokens.revoked, 0),
    ))
    .all()

  // Filter out expired tokens
  const now = new Date()
  const active = tokens
    .filter(t => new Date(t.expiresAt) > now)
    .map(t => ({
      id: t.id,
      deviceLabel: t.deviceLabel || 'Unknown device',
      createdAt: t.createdAt,
    }))

  return { sessions: active }
})
