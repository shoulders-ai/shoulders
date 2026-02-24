export default defineEventHandler((event) => {
  const user = event.context.user
  if (!user) {
    setResponseStatus(event, 401)
    return { error: 'Authentication required' }
  }

  return {
    user: { email: user.email },
    plan: user.plan,
    credits: user.credits,
    emailVerified: !!user.emailVerified,
    createdAt: user.createdAt,
    suspended: !!user.suspended,
    stripeCustomerId: user.stripeCustomerId || null,
    hasSubscription: !!user.stripeSubscriptionId,
    cancelAt: user.cancelAt || null,
    autoRecharge: {
      enabled: !!user.autoRechargeEnabled,
      threshold: user.autoRechargeThreshold,
      credits: user.autoRechargeCredits,
      priceCents: user.autoRechargePriceCents,
    },
  }
})
