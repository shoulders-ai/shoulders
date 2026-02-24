import { eq, sql } from 'drizzle-orm'
import { useDb } from '../../../db/index.js'
import { users, processedWebhooks } from '../../../db/schema.js'
import { getStripe } from '../../../utils/stripe.js'

export default defineEventHandler(async (event) => {
  const stripe = getStripe()
  const config = useRuntimeConfig()

  const rawBody = await readRawBody(event)
  const sig = getHeader(event, 'stripe-signature')

  let stripeEvent
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, config.stripeWebhookSecret)
  } catch (err) {
    console.error('[stripe] Webhook signature verification failed:', err.message)
    setResponseStatus(event, 400)
    return { error: 'Invalid signature' }
  }

  const db = useDb()

  // Idempotency check for credit-granting events — prevent double grants on webhook retries
  const CREDIT_EVENTS = ['checkout.session.completed', 'invoice.paid']
  if (CREDIT_EVENTS.includes(stripeEvent.type)) {
    const existing = db.select().from(processedWebhooks).where(eq(processedWebhooks.eventId, stripeEvent.id)).get()
    if (existing) {
      console.log(`[stripe] Duplicate webhook ${stripeEvent.id} (${stripeEvent.type}), skipping`)
      return { received: true, duplicate: true }
    }
    // Record event BEFORE processing to prevent race conditions
    db.insert(processedWebhooks).values({
      eventId: stripeEvent.id,
      processedAt: new Date().toISOString(),
    }).run()
  }

  switch (stripeEvent.type) {
    case 'checkout.session.completed': {
      const session = stripeEvent.data.object
      const userId = session.metadata?.userId
      if (!userId) break

      if (session.mode === 'subscription') {
        // Subscription checkout completed
        db.update(users).set({
          plan: 'pro',
          stripeSubscriptionId: session.subscription,
          credits: sql`credits + 1000`,
          updatedAt: new Date().toISOString(),
        }).where(eq(users.id, userId)).run()
        console.log(`[stripe] User ${userId} subscribed, +$10.00`)
      } else if (session.metadata?.type === 'credit_pack') {
        // One-time credit pack purchase
        const credits = parseInt(session.metadata.credits) || 0
        if (credits > 0) {
          db.update(users).set({
            credits: sql`credits + ${credits}`,
            updatedAt: new Date().toISOString(),
          }).where(eq(users.id, userId)).run()
          console.log(`[stripe] User ${userId} bought ${credits} credits`)
        }
      }
      break
    }

    case 'invoice.paid': {
      const invoice = stripeEvent.data.object
      const subscriptionId = invoice.subscription
      if (!subscriptionId) break

      // Skip the first invoice — credits already granted by checkout.session.completed
      const billingReason = invoice.billing_reason
      if (billingReason === 'subscription_create') break

      // Monthly renewal — add $10.00 (1000 cents)
      const user = db.select().from(users).where(eq(users.stripeSubscriptionId, subscriptionId)).get()
      if (user) {
        db.update(users).set({
          credits: sql`credits + 1000`,
          updatedAt: new Date().toISOString(),
        }).where(eq(users.id, user.id)).run()
        console.log(`[stripe] Renewal for user ${user.id}, +$10.00`)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = stripeEvent.data.object
      const user = db.select().from(users).where(eq(users.stripeSubscriptionId, subscription.id)).get()
      if (user) {
        db.update(users).set({
          plan: 'free',
          stripeSubscriptionId: null,
          cancelAt: null,
          updatedAt: new Date().toISOString(),
        }).where(eq(users.id, user.id)).run()
        console.log(`[stripe] User ${user.id} subscription cancelled`)
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscription = stripeEvent.data.object
      console.log(`[stripe] subscription.updated: id=${subscription.id} cancel_at_period_end=${subscription.cancel_at_period_end} cancel_at=${subscription.cancel_at} status=${subscription.status}`)

      const user = db.select().from(users).where(eq(users.stripeSubscriptionId, subscription.id)).get()
      if (!user) {
        console.warn(`[stripe] subscription.updated: no user found for subscription ${subscription.id}`)
        break
      }
      console.log(`[stripe] subscription.updated: matched user ${user.id}, current cancelAt=${user.cancelAt}`)

      if (subscription.cancel_at) {
        // User cancelled — record when the subscription will end
        // Stripe uses cancel_at (specific timestamp) or cancel_at_period_end — both set cancel_at
        const cancelAt = new Date(subscription.cancel_at * 1000).toISOString()
        db.update(users).set({ cancelAt, updatedAt: new Date().toISOString() }).where(eq(users.id, user.id)).run()
        console.log(`[stripe] User ${user.id} subscription cancelling at ${cancelAt}`)
      } else if (!subscription.cancel_at && user.cancelAt) {
        // User reactivated — cancel_at cleared
        db.update(users).set({ cancelAt: null, updatedAt: new Date().toISOString() }).where(eq(users.id, user.id)).run()
        console.log(`[stripe] User ${user.id} subscription reactivated`)
      } else {
        console.log(`[stripe] subscription.updated: no cancel state change for user ${user.id}`)
      }

      if (subscription.status === 'past_due') {
        console.warn(`[stripe] User ${user.id} subscription past_due`)
      }
      break
    }
  }

  return { received: true }
})
