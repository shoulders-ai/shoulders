import { useDb } from '../../../db/index.js'
import { refreshTokens, users } from '../../../db/schema.js'
import { createAccessToken, hashToken } from '../../../utils/auth.js'
import { generateId } from '../../../utils/id.js'
import { eq, and } from 'drizzle-orm'
import { randomBytes } from 'crypto'

export default defineEventHandler(async (event) => {
  const { refreshToken } = await readBody(event)

  if (!refreshToken) {
    setResponseStatus(event, 400)
    return { error: 'Refresh token is required' }
  }

  const db = useDb()
  const tokenHash = hashToken(refreshToken)

  // Atomic revocation: UPDATE ... WHERE revoked = 0 ensures only one concurrent
  // request can succeed. If changes === 0, the token was already revoked. (SEC-015)
  const result = db.update(refreshTokens)
    .set({ revoked: 1 })
    .where(and(eq(refreshTokens.tokenHash, tokenHash), eq(refreshTokens.revoked, 0)))
    .run()

  if (result.changes === 0) {
    // Token was not found as active — check if it exists but is revoked (theft detection)
    const revoked = db.select().from(refreshTokens)
      .where(and(eq(refreshTokens.tokenHash, tokenHash), eq(refreshTokens.revoked, 1)))
      .get()

    if (revoked) {
      // Family compromised — revoke ALL tokens in this family
      db.update(refreshTokens)
        .set({ revoked: 1 })
        .where(eq(refreshTokens.familyId, revoked.familyId))
        .run()

      setResponseStatus(event, 401)
      return { error: 'Session invalidated for security. Please log in again.' }
    }

    setResponseStatus(event, 401)
    return { error: 'Invalid refresh token' }
  }

  // Token was successfully revoked — now read its data for rotation
  const stored = db.select().from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .get()

  // Check expiry
  if (new Date(stored.expiresAt) < new Date()) {
    setResponseStatus(event, 401)
    return { error: 'Session expired. Please log in again.' }
  }

  // Look up user
  const user = db.select().from(users).where(eq(users.id, stored.userId)).get()
  if (!user) {
    setResponseStatus(event, 401)
    return { error: 'User not found' }
  }

  if (user.suspended) {
    setResponseStatus(event, 403)
    return { error: 'Account suspended' }
  }

  // Issue new refresh token in the same family
  const raw = randomBytes(32).toString('base64url')
  const newTokenHash = hashToken(raw)
  const refreshExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  const now = new Date().toISOString()

  db.insert(refreshTokens).values({
    id: generateId(),
    userId: user.id,
    tokenHash: newTokenHash,
    familyId: stored.familyId,
    expiresAt: refreshExpiresAt.toISOString(),
    deviceLabel: stored.deviceLabel,
    createdAt: now,
  }).run()

  // Issue new access token
  const { token, expiresAt } = await createAccessToken(user.id)

  return {
    token,
    expiresAt,
    refreshToken: raw,
    refreshExpiresAt: refreshExpiresAt.toISOString(),
    user: { email: user.email },
    plan: user.plan,
    credits: user.credits,
    cancelAt: user.cancelAt || null,
  }
})
