import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique(),
  passwordHash: text('password_hash'),
  plan: text('plan').notNull().default('free'),
  credits: integer('credits').notNull().default(500),
  emailVerified: integer('email_verified').notNull().default(0),
  lastActiveAt: text('last_active_at'),
  suspended: integer('suspended').notNull().default(0),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  cancelAt: text('cancel_at'),
  autoRechargeEnabled: integer('auto_recharge_enabled').notNull().default(0),
  autoRechargeThreshold: integer('auto_recharge_threshold').notNull().default(100),
  autoRechargeCredits: integer('auto_recharge_credits').notNull().default(500),
  autoRechargePriceCents: integer('auto_recharge_price_cents').notNull().default(500),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const authTokens = sqliteTable('auth_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  tokenHash: text('token_hash').notNull(),
  expiresAt: text('expires_at').notNull(),
  revoked: integer('revoked').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const verificationTokens = sqliteTable('verification_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  tokenHash: text('token_hash').notNull(),
  type: text('type').notNull(), // 'email_verify' or 'password_reset'
  expiresAt: text('expires_at').notNull(),
  used: integer('used').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const refreshTokens = sqliteTable('refresh_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  tokenHash: text('token_hash').notNull(),
  familyId: text('family_id').notNull(),
  expiresAt: text('expires_at').notNull(),
  revoked: integer('revoked').notNull().default(0),
  deviceLabel: text('device_label'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const apiCalls = sqliteTable('api_calls', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  provider: text('provider').notNull(),
  model: text('model'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  creditsUsed: integer('credits_used'),
  durationMs: integer('duration_ms'),
  status: text('status').notNull().default('success'),
  errorMessage: text('error_message'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const contactSubmissions = sqliteTable('contact_submissions', {
  id: text('id').primaryKey(),
  institution: text('institution').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  teamSize: text('team_size'),
  needs: text('needs'),
  dismissed: integer('dismissed').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const telemetryEvents = sqliteTable('telemetry_events', {
  id: text('id').primaryKey(),
  deviceId: text('device_id'),
  eventType: text('event_type').notNull(),
  eventData: text('event_data'),
  appVersion: text('app_version'),
  platform: text('platform'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const processedWebhooks = sqliteTable('processed_webhooks', {
  eventId: text('event_id').primaryKey(),
  processedAt: text('processed_at').notNull(),
})

export const reviews = sqliteTable('reviews', {
  id: text('id').primaryKey(),
  slug: text('slug').unique().notNull(),
  status: text('status').notNull().default('processing'),
  email: text('email'),
  filename: text('filename'),
  html: text('html'),
  markdown: text('markdown'),
  report: text('report'),
  commentsJson: text('comments_json'),
  anchoredHtml: text('anchored_html'),
  domainHint: text('domain_hint'),
  techNotes: text('tech_notes'),
  costCents: integer('cost_cents'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  completedAt: text('completed_at'),
  expiresAt: text('expires_at'),
})

export const deckShares = sqliteTable('deck_shares', {
  id: text('id').primaryKey(),
  slug: text('slug').unique().notNull(),
  deckName: text('deck_name').notNull(),
  recipient: text('recipient').notNull(),
  isActive: integer('is_active').notNull().default(1),
  clearedAt: text('cleared_at'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const deckViews = sqliteTable('deck_views', {
  id: text('id').primaryKey(),
  shareId: text('share_id').notNull().references(() => deckShares.id),
  sessionId: text('session_id').notNull(),
  slideTimes: text('slide_times'),
  currentSlide: integer('current_slide').default(1),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  referrer: text('referrer'),
  lastPingAt: text('last_ping_at'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const pageViews = sqliteTable('page_views', {
  id: text('id').primaryKey(),
  path: text('path').notNull(),
  referrerDomain: text('referrer_domain'),
  durationSeconds: integer('duration_seconds'),
  eventType: text('event_type').notNull().default('page_view'),
  eventMeta: text('event_meta'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})
