import { getStripe } from '../../../utils/stripe.js'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    setResponseStatus(event, 401)
    return { error: 'Authentication required' }
  }

  if (!user.stripeCustomerId) {
    setResponseStatus(event, 400)
    return { error: 'No billing account' }
  }

  const stripe = getStripe()
  const config = useRuntimeConfig()

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${config.baseUrl}/account`,
  })

  return { url: session.url }
})
