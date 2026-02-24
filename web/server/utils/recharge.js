import { eq, sql } from 'drizzle-orm'
import { useDb } from '../db/index.js'
import { users } from '../db/schema.js'
import { getStripe } from './stripe.js'

/**
 * Trigger an auto-recharge for a user with a saved payment method.
 * Creates an off-session PaymentIntent and adds credits on success.
 */
export async function triggerRecharge(user) {
  const stripe = getStripe()

  if (!user.stripeCustomerId) {
    return { success: false, error: 'No Stripe customer' }
  }

  const methods = await stripe.paymentMethods.list({
    customer: user.stripeCustomerId,
    type: 'card',
  })

  if (!methods.data.length) {
    return { success: false, error: 'No payment method on file' }
  }

  try {
    await stripe.paymentIntents.create({
      amount: user.autoRechargePriceCents,
      currency: 'usd',
      customer: user.stripeCustomerId,
      payment_method: methods.data[0].id,
      off_session: true,
      confirm: true,
      metadata: { userId: user.id, type: 'auto_recharge' },
    })

    const db = useDb()
    db.update(users)
      .set({ credits: sql`credits + ${user.autoRechargeCredits}`, updatedAt: new Date().toISOString() })
      .where(eq(users.id, user.id))
      .run()

    return { success: true }
  } catch (err) {
    console.error('[recharge] Failed:', err.message)
    return { success: false, error: err.message }
  }
}
