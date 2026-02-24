import { useDb } from '../../../db/index.js'
import { refreshTokens } from '../../../db/schema.js'
import { hashToken } from '../../../utils/auth.js'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { refreshToken } = await readBody(event)

  if (!refreshToken) {
    return { ok: true } // Nothing to revoke
  }

  const db = useDb()
  const tokenHash = hashToken(refreshToken)

  // Find the token to get its familyId
  const stored = db.select().from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .get()

  if (stored) {
    // Revoke the entire family
    db.update(refreshTokens)
      .set({ revoked: 1 })
      .where(eq(refreshTokens.familyId, stored.familyId))
      .run()
  }

  return { ok: true }
})
