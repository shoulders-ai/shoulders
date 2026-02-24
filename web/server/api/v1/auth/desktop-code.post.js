import { useDb } from '../../../db/index.js'
import { verificationTokens } from '../../../db/schema.js'
import { generateId } from '../../../utils/id.js'
import { hashToken } from '../../../utils/auth.js'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    setResponseStatus(event, 401)
    return { error: 'Authentication required' }
  }

  const body = await readBody(event).catch(() => ({}))
  const state = body?.state

  if (!state) {
    setResponseStatus(event, 400)
    return { error: 'State parameter is required' }
  }

  // Store only userId — tokens are generated on-demand when the desktop app polls.
  // This avoids storing live credentials in the DB (SEC-013).
  const stateKey = 'desktop_session:' + hashToken(state)
  useDb().insert(verificationTokens).values({
    id: generateId(),
    userId: user.id,
    tokenHash: user.id,
    type: stateKey,
    expiresAt: new Date(Date.now() + 120_000).toISOString(), // 2 minutes
  }).run()

  return { ok: true }
})
