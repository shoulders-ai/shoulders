const REQUIRED_SECRETS = ['jwtSecret', 'adminKey', 'stripeWebhookSecret']

const DEFAULTS = {
  jwtSecret: 'dev-secret-change-me',
  adminKey: '',
  stripeWebhookSecret: '',
}

export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  const isProd = process.env.NODE_ENV === 'production'

  const missing = REQUIRED_SECRETS.filter((key) => {
    const value = config[key]
    return !value || value === DEFAULTS[key]
  })

  if (missing.length === 0) return

  const envNames = missing.map((k) => {
    // Convert camelCase config key to SCREAMING_SNAKE_CASE env var name
    return k.replace(/([A-Z])/g, '_$1').toUpperCase()
  })

  const message = `Missing required environment variables: ${envNames.join(', ')}`

  if (isProd) {
    throw new Error(message)
  }

  console.warn(`[validateEnv] WARNING: ${message}`)
})
