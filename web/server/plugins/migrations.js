import { existsSync } from 'fs'
import { mkdirSync } from 'fs'
import { dirname } from 'path'
import { useDb } from '../db/index.js'

export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()

  // Ensure data directory exists
  mkdirSync(dirname(config.databasePath), { recursive: true })

  const db = useDb()

  // If migrations folder exists, use drizzle migrator
  const migrationsDir = './server/db/migrations'
  if (existsSync(migrationsDir)) {
    import('drizzle-orm/better-sqlite3/migrator').then(({ migrate }) => {
      migrate(db, { migrationsFolder: migrationsDir })
      console.log('[db] Migrations applied successfully')
    })
    return
  }

  // Otherwise create tables directly from schema
  console.log('[db] Creating tables from schema...')
  const sqlite = db.$client
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password_hash TEXT,
      plan TEXT NOT NULL DEFAULT 'free',
      credits INTEGER NOT NULL DEFAULT 500,
      email_verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS verification_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL,
      type TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS api_calls (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      provider TEXT NOT NULL,
      model TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      credits_used INTEGER,
      duration_ms INTEGER,
      status TEXT NOT NULL DEFAULT 'success',
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS contact_submissions (
      id TEXT PRIMARY KEY,
      institution TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      team_size TEXT,
      needs TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS telemetry_events (
      id TEXT PRIMARY KEY,
      device_id TEXT,
      event_type TEXT NOT NULL,
      event_data TEXT,
      app_version TEXT,
      platform TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
  console.log('[db] Tables created successfully')

  // Additive migrations (idempotent — SQLite throws if column already exists)
  const alterStatements = [
    `ALTER TABLE users ADD COLUMN last_active_at TEXT`,
    `ALTER TABLE users ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE contact_submissions ADD COLUMN dismissed INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN stripe_customer_id TEXT`,
    `ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT`,
    `ALTER TABLE users ADD COLUMN auto_recharge_enabled INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN auto_recharge_threshold INTEGER NOT NULL DEFAULT 100`,
    `ALTER TABLE users ADD COLUMN auto_recharge_credits INTEGER NOT NULL DEFAULT 500`,
    `ALTER TABLE users ADD COLUMN auto_recharge_price_cents INTEGER NOT NULL DEFAULT 500`,
    `ALTER TABLE users ADD COLUMN cancel_at TEXT`,
  ]
  for (const stmt of alterStatements) {
    try { sqlite.exec(stmt) } catch {}
  }

  // Refresh tokens table (idempotent)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL,
      family_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      device_label TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
  `)

  // Processed webhooks table for idempotency (idempotent)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS processed_webhooks (
      event_id TEXT PRIMARY KEY,
      processed_at TEXT NOT NULL
    );
  `)

  // Reviews table (peer review pipeline)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'processing',
      email TEXT,
      filename TEXT,
      html TEXT,
      markdown TEXT,
      report TEXT,
      comments_json TEXT,
      anchored_html TEXT,
      domain_hint TEXT,
      tech_notes TEXT,
      cost_cents INTEGER,
      input_tokens INTEGER,
      output_tokens INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      expires_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_reviews_slug ON reviews(slug);
  `)

  // Deck shares + views (pitch deck tracking)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS deck_shares (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      deck_name TEXT NOT NULL,
      recipient TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      cleared_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_deck_shares_slug ON deck_shares(slug);

    CREATE TABLE IF NOT EXISTS deck_views (
      id TEXT PRIMARY KEY,
      share_id TEXT NOT NULL REFERENCES deck_shares(id),
      session_id TEXT NOT NULL,
      slide_times TEXT,
      current_slide INTEGER DEFAULT 1,
      user_agent TEXT,
      ip_address TEXT,
      referrer TEXT,
      last_ping_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_deck_views_share ON deck_views(share_id);
    CREATE INDEX IF NOT EXISTS idx_deck_views_session ON deck_views(session_id);
  `)

  // Page views (anonymous website analytics)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS page_views (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      referrer_domain TEXT,
      duration_seconds INTEGER,
      event_type TEXT NOT NULL DEFAULT 'page_view',
      event_meta TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at);
    CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(path);
    CREATE INDEX IF NOT EXISTS idx_page_views_event_type ON page_views(event_type);
  `)

  // Seed existing deck shares (idempotent)
  const seedShares = [
    ['seed_fe6kc', 'fe6kc-ch160-yw8c', 'deck-antler', 'faerber',       '2026-02-16T10:17:44.567Z'],
    ['seed_zck4h', 'zck4h-rbl0a-rv0a', 'deck-antler', 'tu-dresden',    '2026-02-16T09:49:53.262Z'],
    ['seed_qmzwn', 'qmzwn-0jmun-gd1x', 'deck-antler', 'hdm-generator', '2026-02-12T09:26:14.060Z'],
    ['seed_g941q', 'g941q-bsdva-raxh', 'deck-antler', 'cherry',        '2026-02-09T06:50:55.915Z'],
    ['seed_bou4y', 'bou4y-zg4j7-0pan', 'deck-antler', 'bgv',           '2026-01-23T14:01:06.447Z'],
    ['seed_z4jnw', 'z4jnw-g52xp-ncdg', 'deck-antler', 'nrwbank',       '2026-01-19T17:23:54.597Z'],
    ['seed_etuzl', 'etuzl-7bz3v-vy85', 'deck-antler', 'test',          '2026-01-08T15:24:29.875Z'],
  ]
  const insertShare = sqlite.prepare(`
    INSERT OR IGNORE INTO deck_shares (id, slug, deck_name, recipient, is_active, created_at)
    VALUES (?, ?, ?, ?, 1, ?)
  `)
  for (const row of seedShares) {
    insertShare.run(...row)
  }
})
