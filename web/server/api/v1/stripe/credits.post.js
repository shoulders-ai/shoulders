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

  if (user.plan !== 'pro') {
    setResponseStatus(event, 403)
    return { error: 'Active subscription required to purchase credits.' }
  }

  const body = await readBody(event)
  const cents = parseInt(body.amount)
  if (!cents || cents < 100 || cents > 10000) {
    setResponseStatus(event, 400)
    return { error: 'Amount must be between $1 and $100' }
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

  const dollarLabel = '$' + (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: `${dollarLabel} balance top-up` },
        unit_amount: cents,
      },
      quantity: 1,
    }],
    success_url: `${config.baseUrl}/account?credits=added`,
    cancel_url: `${config.baseUrl}/account`,
    metadata: { userId: user.id, credits: String(cents), type: 'credit_pack' },
  })

  return { url: session.url }
})
