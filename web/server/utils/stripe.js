import Stripe from 'stripe'

let _stripe = null

export function getStripe() {
  if (!_stripe) {
    const config = useRuntimeConfig()
    if (!config.stripeSecretKey) throw new Error('STRIPE_SECRET_KEY not configured')
    _stripe = new Stripe(config.stripeSecretKey)
  }
  return _stripe
}
