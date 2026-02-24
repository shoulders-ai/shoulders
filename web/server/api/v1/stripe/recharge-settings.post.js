import { eq } from 'drizzle-orm'
import { useDb } from '../../../db/index.js'
import { users } from '../../../db/schema.js'

// Fixed tiers: priceCents → credits. Users cannot set credits independently.
const TIERS = { 500: 500, 1000: 1000, 2000: 2000 }

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    setResponseStatus(event, 401)
    return { error: 'Authentication required' }
  }

  const body = await readBody(event)
  const priceCents = body.priceCents

  if (!TIERS[priceCents]) {
    setResponseStatus(event, 400)
    return { error: `Invalid priceCents. Allowed values: ${Object.keys(TIERS).join(', ')}` }
  }

  const enabled = body.enabled ? 1 : 0
  const threshold = Math.max(0, Math.min(100, parseInt(body.threshold) || 10))
  const credits = TIERS[priceCents]

  const db = useDb()
  db.update(users).set({
    autoRechargeEnabled: enabled,
    autoRechargeThreshold: threshold,
    autoRechargeCredits: credits,
    autoRechargePriceCents: priceCents,
    updatedAt: new Date().toISOString(),
  }).where(eq(users.id, user.id)).run()

  return {
    enabled: !!enabled,
    threshold,
    credits,
    priceCents,
  }
})
