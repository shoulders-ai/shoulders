import { eq } from 'drizzle-orm'
import { useDb } from '../../../db/index.js'
import { users } from '../../../db/schema.js'
import { getStripe } from '../../../utils/stripe.js'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    setResponseStatus(event, 401)
    return { error: 'Authentication required' }
  }

  if (user.stripeSubscriptionId) {
    setResponseStatus(event, 400)
    return { error: 'Already subscribed' }
  }

  const stripe = getStripe()
  const config = useRuntimeConfig()
  const db = useDb()

  // Create Stripe customer if needed
  let customerId = user.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } })
    customerId = customer.id
    db.update(users).set({ stripeCustomerId: customerId, updatedAt: new Date().toISOString() }).where(eq(users.id, user.id)).run()
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: config.stripePriceId, quantity: 1 }],
    success_url: `${config.baseUrl}/account?upgraded=true`,
    cancel_url: `${config.baseUrl}/account`,
    metadata: { userId: user.id },
  })

  return { url: session.url }
})
