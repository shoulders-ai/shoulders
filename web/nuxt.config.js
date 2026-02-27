export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  future: { compatibilityVersion: 4 },

  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/sitemap'],

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    jwtSecret: 'dev-secret-change-me',
    adminKey: '',
    databasePath: './data/shoulders.db',
    anthropicApiKey: '',
    openaiApiKey: '',
    googleApiKey: '',
    zApiKey: '',
    resendApiKey: '',
    baseUrl: 'http://localhost:3000',
    githubRepo: 'user/shoulders',
    githubClientId: '',
    githubClientSecret: '',
    exaApiKey: '',
    openalexApiKey: '',
    stripeSecretKey: '',
    stripeWebhookSecret: '',
    stripePriceId: '',
    shouldersSurchargeMultiplier: '',
  },

  nitro: {
    preset: 'node-server',
  },

  devtools: false,

  app: {
    head: {
      title: 'Shoulders',
      htmlAttrs: { lang: 'en' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Writing, references, AI, and tools — together in one focused desktop app for researchers.' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
    },
  },

  routeRules: {
    '/login': { ssr: false },
    '/signup': { ssr: false },
    '/account': { ssr: false },
    '/admin/**': { ssr: false },
    '/d/**': { ssr: false },
  },
  sitemap: {
    exclude: ['/admin/**', '/review/**', '/auth/**', '/d/**', '/verify-email', '/reset-password', '/login', '/signup', '/account', '/subscribe'],
    }, 
})