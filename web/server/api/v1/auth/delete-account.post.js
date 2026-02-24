import { useDb } from '../../../db/index.js'
import { users } from '../../../db/schema.js'
import { eq } from 'drizzle-orm'
import { getStripe } from '../../../utils/stripe.js'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    setResponseStatus(event, 401)
    return { error: 'Authentication required' }
  }

  const { confirmation } = await readBody(event)
  if (confirmation !== 'DELETE') {
    setResponseStatus(event, 400)
    return { error: 'Type DELETE to confirm account deletion' }
  }

  // Cancel active Stripe subscription before deleting
  if (user.stripeSubscriptionId) {
    try {
      const stripe = getStripe()
      await stripe.subscriptions.cancel(user.stripeSubscriptionId)
      console.log(`[account] Cancelled subscription ${user.stripeSubscriptionId} for user ${user.id}`)
    } catch (err) {
      console.error(`[account] Failed to cancel subscription for user ${user.id}:`, err.message)
      setResponseStatus(event, 500)
      return { error: 'Failed to cancel your subscription. Please cancel it from Manage billing first, then try again.' }
    }
  }

  const db = useDb()
  const sqlite = db.$client

  sqlite.transaction(() => {
    sqlite.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(user.id)
    sqlite.prepare('DELETE FROM auth_tokens WHERE user_id = ?').run(user.id)
    sqlite.prepare('DELETE FROM verification_tokens WHERE user_id = ?').run(user.id)
    sqlite.prepare('DELETE FROM api_calls WHERE user_id = ?').run(user.id)
    sqlite.prepare('DELETE FROM users WHERE id = ?').run(user.id)
  })()

  return { deleted: true }
})
