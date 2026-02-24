# Web Backend (`web/`)

Nuxt 4 app serving the Shoulders API: user auth, AI proxy with credit tracking, telemetry, admin dashboard, and peer review tool. SQLite + Drizzle ORM. Deployed as a Node server behind Caddy on `shoulde.rs`.

> **Peer Review** — Free promotional tool at `/review`. Full documentation: [`peer-review.md`](peer-review.md).

---

## Overview

- Auth routes: `web/server/api/v1/auth/` — signup, login, refresh, status, verify, forgot, reset, change-password
- AI proxy: `web/server/api/v1/proxy.post.js` — streaming + non-streaming, credit tracking
- Provider translation: `web/server/utils/providerProxy.js` — Anthropic↔OpenAI↔Google
- Auth middleware: `web/server/middleware/01.auth.js` — JWT verification (protects: proxy, status, refresh, change-password)
- Admin routes: `web/server/api/admin/` — login, logout, stats, users (CRUD), calls, contacts, credits
- Admin middleware: `web/server/middleware/02.admin.js` — cookie verification
- Database: `web/server/db/schema.js` (6 tables), `web/server/db/index.js` (singleton)
- Email: `web/server/utils/email.js` — Resend verification + password reset (no-op without RESEND_API_KEY)
- Enterprise form: `web/server/api/v1/contact.post.js` — stores in DB + emails notification
- Client-side auth: `web/composables/useAuth.js` — localStorage-backed state
- Tauri app auth: `src/services/shouldersAuth.js` (keychain, polling, deep link), `apiClient.js` (Shoulders proxy fallback)
- Auth docs: [auth-system.md](auth-system.md) — token architecture, desktop login flow, production checklist
- Telemetry client: `src/services/telemetry.js` — opt-in, batched events
- Deploy: `web/deploy/` — systemd, Caddyfile, backup script
- CI: `.github/workflows/deploy-web.yml`


---

## Architecture

```
Client (Tauri app)
  │
  ├── Auth calls ──────────► /api/v1/auth/*     (signup, login, refresh, status, verify, forgot, reset)
  ├── AI proxy (streaming) ► /api/v1/proxy      (translates Anthropic↔OpenAI↔Google)
  └── Telemetry ───────────► /api/v1/telemetry/events

Admin browser
  └── /admin/* pages ──────► /api/admin/*        (login, stats, users, calls)
```

All client→server calls from the Tauri app go through Rust's `proxy_api_call` (reqwest) to avoid CORS. The proxy route is the only one that touches external APIs.

---

## File Structure

```
web/
├── app/
│   ├── app.vue                          # Root: <NuxtPage />
│   └── pages/
│       ├── index.vue                    # Landing page (download link)
│       ├── privacy.vue                  # Privacy policy (placeholder)
│       ├── terms.vue                    # Terms of service (placeholder)
│       ├── reset-password.vue           # Password reset form (?token=)
│       └── admin/
│           ├── login.vue                # Admin key entry
│           ├── index.vue                # Dashboard (stats, DAU/WAU/MAU, contact management)
│           ├── users.vue                # User CRUD (create, edit, suspend, delete, password reset)
│           └── calls.vue                # API call log (provider, status, userId, date range)
├── server/
│   ├── db/
│   │   ├── schema.js                    # Drizzle schema: 5 tables
│   │   └── index.js                     # DB singleton (better-sqlite3, WAL mode)
│   ├── plugins/
│   │   └── migrations.js               # Auto-create tables on startup
│   ├── middleware/
│   │   ├── rateLimit.js                 # In-memory rate limiting
│   │   ├── 01.auth.js                   # JWT verification, suspended check, last_active_at tracking
│   │   └── 02.admin.js                  # Admin cookie verification
│   ├── utils/
│   │   ├── id.js                        # generateId() — 16-char hex
│   │   ├── auth.js                      # JWT (jose) + argon2 password hashing
│   │   ├── credits.js                   # Token→credit calc + atomic deduction
│   │   ├── email.js                     # Resend: verification + password reset emails
│   │   ├── providerProxy.js             # Anthropic↔OpenAI↔Google request/response translation
│   │   ├── ai.js                        # AI provider abstraction: callAnthropic (tool loop), callGemini
│   │   ├── pricing.js                   # Per-model token pricing + cost calculation (cents)
│   │   ├── docx.js                      # DOCX → HTML (mammoth) + markdown (turndown) + images
│   │   ├── anchorComments.js            # Peer review: inject <mark> tags at text_snippet positions
│   │   ├── reviewEmail.js               # Peer review: "review ready"/"failed" notification email (Resend)
│   │   └── reviewToTypst.js             # Peer review: review data → Typst markup for PDF export
│   ├── services/review/
│   │   ├── pipeline.js                  # 5-stage review orchestrator (extract → gate → review → report → anchor)
│   │   ├── gatekeeper.js               # Gemini Flash Lite: classify if document is reviewable research
│   │   ├── guidanceLoader.js           # Tool factory: loads markdown guidance chapters for reviewer agents
│   │   ├── validateAnchors.js          # Validates text_snippet quotes exist verbatim in source
│   │   ├── agents/technicalReviewer.js  # Statistics + methods reviewer (Claude Sonnet, tool loop)
│   │   ├── agents/editorialReviewer.js  # Argumentation + structure reviewer (Claude Sonnet, tool loop)
│   │   ├── agents/reportWriter.js       # Synthesises comments into structured summary
│   │   └── guidance/                    # Markdown reference chapters (statistics, reporting-standards, general)
│   └── api/
│       ├── health.get.js                # DB check → { status, timestamp }
│       ├── releases.get.js              # GitHub releases (cached 10min)
│       ├── admin/
│       │   ├── login.post.js            # ADMIN_KEY → signed cookie (24h)
│       │   ├── logout.post.js           # Clear admin cookie
│       │   ├── stats.get.js             # Dashboard stats (users, calls, credits, DAU/WAU/MAU, contacts)
│       │   ├── users.get.js             # Paginated users (search, sort, plan filter)
│       │   ├── users.post.js            # Create user (email, password, plan, credits)
│       │   ├── users.patch.js           # Edit user (plan, credits, verified, suspended, password)
│       │   ├── users.delete.js          # Delete user + cascade (tokens, calls)
│       │   ├── calls.get.js             # Paginated API calls (provider, status, userId, date range)
│       │   ├── contacts.get.js          # Paginated contacts (dismissed filter, sort)
│       │   ├── contacts.patch.js        # Toggle contact dismissed status
│       │   └── credits.post.js          # Add/remove credits for a user
│       └── v1/
│           ├── proxy.post.js            # Core AI proxy (streaming + non-streaming)
│           ├── search.post.js          # Exa web search proxy (search + contents)
│           ├── telemetry/
│           │   └── events.post.js       # Batch event ingestion (max 100)
│           └── auth/
│               ├── signup.post.js       # Email + password → 50 credits
│               ├── login.post.js        # Email + password → JWT
│               ├── refresh.post.js      # Rotate JWT (revokes old)
│               ├── status.get.js        # Current user profile + credits
│               ├── verify.get.js        # Email verification (?token=) → redirect
│               ├── forgot.post.js       # Send password reset email
│               └── reset.post.js        # Token + new password
├── deploy/
│   ├── shoulders-web.service            # Systemd unit
│   ├── Caddyfile                        # Reverse proxy config
│   └── backup.sh                        # Daily SQLite backup (30-day retention)
├── nuxt.config.js
├── drizzle.config.js
├── package.json
├── .env.example
└── .gitignore
```

---

## Database Schema

6 tables in SQLite (WAL mode, foreign keys on):

### `users`
| Column | Type | Notes |
|---|---|---|
| id | text PK | 16-char hex |
| email | text unique | |
| password_hash | text | argon2 |
| plan | text | `free` (default), `pro`, `enterprise` |
| credits | integer | 50 default |
| email_verified | integer | 0 or 1 |
| last_active_at | text | ISO 8601, nullable. Updated by auth middleware (5-min debounce) |
| suspended | integer | 0 or 1. Blocks login + API access without deleting account |
| created_at | text | ISO 8601 |
| updated_at | text | ISO 8601 |

### `auth_tokens` (legacy — draining)
| Column | Type | Notes |
|---|---|---|
| id | text PK | |
| user_id | text FK → users | |
| token_hash | text | SHA-256 of JWT |
| expires_at | text | 7 days from creation |
| revoked | integer | 0 or 1 |

No longer written to. Existing tokens expire naturally. Cleanup plugin purges expired rows.

### `refresh_tokens`
| Column | Type | Notes |
|---|---|---|
| id | text PK | |
| user_id | text FK → users | |
| token_hash | text | SHA-256 of opaque refresh token |
| family_id | text | Rotation family (all tokens from same login share this) |
| expires_at | text | 90 days from creation |
| revoked | integer | 0 or 1 |
| device_label | text | e.g. "Chrome on macOS", "Shoulders Desktop" |
| created_at | text | ISO 8601 |

Indexes: `token_hash`, `family_id`, `user_id`.

**Rotation theft detection**: if a revoked token is reused, all tokens in the same `family_id` are revoked (family compromised).

### `verification_tokens`
| Column | Type | Notes |
|---|---|---|
| id | text PK | |
| user_id | text FK → users | |
| token_hash | text | SHA-256 of raw token |
| type | text | `email_verify`, `password_reset`, or `desktop_auth` |
| expires_at | text | 24h for verify, 1h for reset |
| used | integer | 0 or 1 |

### `api_calls`
| Column | Type | Notes |
|---|---|---|
| id | text PK | |
| user_id | text FK → users | |
| provider | text | anthropic, openai, google |
| model | text | |
| input_tokens | integer | |
| output_tokens | integer | |
| credits_used | integer | ceil((in+out)/1000) |
| duration_ms | integer | |
| status | text | `success` or `error` |
| error_message | text | nullable |

### `contact_submissions`
| Column | Type | Notes |
|---|---|---|
| id | text PK | |
| institution | text | Organisation name |
| name | text | Contact person |
| email | text | Contact email |
| team_size | text | nullable |
| needs | text | nullable, free-text |
| dismissed | integer | 0 or 1. Admin marks enquiries as handled |

### `telemetry_events`
| Column | Type | Notes |
|---|---|---|
| id | text PK | |
| device_id | text | Random UUID, no user link |
| event_type | text | e.g. `app_open`, `chat_send` |
| event_data | text | JSON string |
| app_version | text | |
| platform | text | macos, windows, linux |

---

## API Endpoints

### Auth (`/api/v1/auth/`)

Responses include `{ token, expiresAt, refreshToken, refreshExpiresAt, user: { email }, plan, credits }` on success, `{ error: "message" }` on failure.

**Token model**: Short-lived access JWT (15 min, stateless) + long-lived refresh token (90 days, opaque, rotated on use, stored hashed in DB). Access token verified by signature only (no DB read). Refresh token rotation provides theft detection via `familyId` chains.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/signup` | No | Create account (email + password, min 8 chars). 50 credits. Sends verification email. |
| POST | `/login` | No | Authenticate. Returns access + refresh tokens. |
| POST | `/refresh` | Refresh token in body | Rotates refresh token, issues new access token. Detects theft via family chain. |
| POST | `/logout` | Refresh token in body | Revokes entire refresh token family. |
| GET | `/status` | Bearer | Returns `{ user, plan, credits }` (no token). |
| GET | `/sessions` | Bearer | List active refresh token sessions (device, date). |
| DELETE | `/sessions/:id` | Bearer | Revoke a specific session's token family. |
| POST | `/desktop-code` | Bearer | Generate one-time code for desktop deep link auth (60s TTL). |
| POST | `/exchange` | No | Exchange desktop auth code for access + refresh tokens. |
| GET | `/verify?token=` | No | Email verification. Redirects to `/login?verified=true`. |
| POST | `/forgot` | No | Send password reset email. Always returns success (no enumeration). |
| POST | `/reset` | No | `{ token, password }` → resets password. |
| POST | `/change-password` | Bearer | `{ currentPassword, newPassword }` → update password. |

### Proxy (`/api/v1/proxy`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/proxy` | Bearer | Forward AI request to upstream provider. |

**Request**: Always Anthropic Messages API format. Headers:
- `Authorization: Bearer <jwt>`
- `X-Shoulders-Provider: anthropic|openai|google` (default: anthropic)

**Streaming** (`body.stream === true`): Returns `text/event-stream`. Translates upstream SSE to Anthropic SSE format. Credits deducted after stream ends.

**Non-streaming** (`body.stream === false`): Returns Anthropic Messages JSON format. Credits deducted immediately.

**Credit cost**: `ceil((input_tokens + output_tokens) / 1000)`

**Status codes**: 401 (no auth), 402 (no credits), 502 (upstream error)

### Exa Search Proxy (`/api/v1/search`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/search` | Bearer | Forward search/contents request to Exa API. |

**Request**: `Authorization: Bearer <jwt>`. Body: `{ action: "search"|"contents", ...exaParams }`. The `action` field is stripped; remaining body forwarded to `https://api.exa.ai/{action}` with server-side `EXA_API_KEY`.

**Credit cost**: 1 cent per call (flat).

**Response**: Exa JSON response + `_shoulders: { credits, cost_cents }` trailer.

**Status codes**: 400 (invalid action), 401 (no auth), 402 (no credits), 502 (Exa error or not configured)

### Contact (`/api/v1/contact`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/contact` | No | Enterprise enquiry. Stores in DB + emails `contact@shoulde.rs` (if Resend configured). |

### Telemetry (`/api/v1/telemetry/`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/events` | No | `{ events: [...] }` — max 100 per batch. |

### Admin (`/api/admin/`)

Protected by `ADMIN_KEY` env var. Login sets httpOnly cookie (JWT, 24h).

| Method | Path | Description |
|---|---|---|
| POST | `/login` | `{ key }` → set admin cookie |
| POST | `/logout` | Clear admin cookie |
| GET | `/stats` | Users, API calls, credits, DAU/WAU/MAU, contacts (undismissed count), plan/provider breakdowns |
| GET | `/users` | Paginated. Query: `?page=&limit=&search=&plan=free|pro|enterprise&sort=created|active|credits&dir=asc|desc` |
| POST | `/users` | `{ email, password, plan?, credits? }` → create user (pre-verified) |
| PATCH | `/users` | `{ userId, plan?, credits?, emailVerified?, suspended?, password? }` → partial update |
| DELETE | `/users` | `{ userId }` → cascade delete (tokens, calls, user) |
| GET | `/calls` | Paginated. Query: `?page=&limit=&provider=&status=&userId=&from=&to=` |
| GET | `/contacts` | Paginated. Query: `?page=&limit=&dismissed=0|1&sort=asc|desc` |
| PATCH | `/contacts` | `{ id, dismissed }` → toggle dismissed status |
| POST | `/credits` | `{ userId, amount }` → add/remove credits for a user |

### Peer Review (`/api/review/`)

No authentication required. Full documentation: [`peer-review.md`](peer-review.md).

| Method | Path | Description |
|---|---|---|
| POST | `/upload` | Upload .docx + email → create review record, start background pipeline. Returns `{ slug }` |
| GET | `/[slug]` | Full review data (status, anchoredHtml, report, comments, domainHint, filename, expiresAt) |
| GET | `/[slug]/status` | Lightweight status check (for 5s polling during processing) |
| DELETE | `/[slug]` | Delete review and all associated data |
| GET | `/[slug]/pdf` | Generate PDF via Typst → returns binary blob with Content-Disposition attachment |

### Other

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | `{ status: 'ok', timestamp }` or 503 |
| GET | `/api/releases` | Latest GitHub release (cached 10min). `{ version, assets: [{ name, url, size }] }` |

---

## Provider Proxy System

The proxy (`providerProxy.js`) translates between Anthropic Messages API and upstream providers. The client always sends/receives Anthropic format.

```
Client → Anthropic format → [proxy] → translateRequest() → Provider format → Upstream API
Client ← Anthropic format ← [proxy] ← translateResponse/translateStreamChunk() ← Provider format
```

**Key functions:**
- `translateRequest(body, provider)` — Anthropic body → OpenAI/Google body. Mirrors logic from client's `chatProvider.js`.
- `translateResponse(provider, json)` — Non-streaming response → Anthropic format.
- `translateStreamChunk(provider, sseData)` — Single SSE event → array of Anthropic SSE events (multiple events can result from one upstream chunk, e.g. Google text + finishReason).
- `extractUsage(provider, data)` — Pull input/output token counts from response.
- `getProviderUrl(provider, model, streaming)` — Upstream API URL.
- `getProviderHeaders(provider, apiKey)` — Provider-specific auth headers.
- `appendGoogleKey(url, apiKey)` — Google uses API key in URL query param.

For Anthropic upstream: pass-through (no translation needed).

---

## Authentication Flow

### Token Architecture
- **Access token**: HS256 JWT, 15-minute expiry, stateless (no DB lookup on validation)
- **Refresh token**: Opaque random string (32 bytes, base64url), 90-day expiry, stored as SHA-256 hash in `refresh_tokens` table
- **Rotation**: Each refresh returns a new refresh token in the same `familyId`. Reuse of a revoked token revokes the entire family (theft detection)
- **Cleanup**: Server plugin purges expired + old revoked tokens every 24 hours

### Website
1. **Signup** → creates user → sends verification email → redirects to `/verify-email`.
2. **Email link** → `verify.get.js` sets `email_verified=1` → redirects to `/login?verified=true`.
3. **Login** → returns access JWT (15 min) + refresh token (90 days) → `useAuth()` stores both in localStorage → redirects to `/account`.
4. **Auto-refresh** → `authedFetch()` checks access token expiry before each request. If expired, calls `/refresh` with refresh token → gets new pair. On 401 response, retries once after refresh.
5. **Account page** → shows active sessions (device label + date), user can revoke individual sessions.
6. **Sign out** → POST `/logout` with refresh token (server-side revocation) → `clearAuth()`.

### Tauri App (Desktop Auth)
1. **Onboard** → opens `shoulde.rs/auth/desktop-onboard?state=<random>` in system browser. Signup-first page (free account + $5 credits); returning users toggle to sign in.
2. **Browser** → user signs up (6-digit email verification) or logs in → server stores tokens in DB keyed by `state`.
3. **Desktop** → polls `POST /desktop-poll { state }` every 2s via `proxy_api_call` → picks up tokens when ready.
4. **Deep link (prod)** → alternative path: browser redirects to `shoulders://auth/callback?code=xxx` → app exchanges code via `/exchange`. Races with polling; whichever finishes first wins.
5. **Storage** → OS keychain via `keyring` crate (macOS Keychain / Windows Credential Manager / Linux Secret Service), localStorage fallback.
6. **Auto-refresh on startup** → `initAuth()` loads from keychain, refreshes if access token expired.
7. **Logout** → POST `/logout` → clears keychain.
8. **Fallback chain** (in `chatModels.js`): direct API key → Shoulders proxy → no access.

---

## Email Verification

Requires `RESEND_API_KEY` env var. Without it, emails are silently skipped (signup still works, just no verification).

1. Signup → fire-and-forget `sendVerificationEmail()` → frontend redirects to `/verify-email`.
2. Email contains link: `{BASE_URL}/api/v1/auth/verify?token=xxx`.
3. Click → marks `email_verified = 1`, redirects to `/login?verified=true`.
4. Login page shows "Email verified" success banner.
5. Token expires after 24 hours, single-use.

Password reset: same pattern, 1-hour expiry, redirects to `/reset-password?token=xxx` page.

---

## Rate Limiting

In-memory Map, cleaned every 5 minutes.

| Scope | Key | Limit |
|---|---|---|
| Auth endpoints (`/api/v1/auth/*`) | IP address | 30/min |
| Proxy (`/api/v1/proxy`) | User ID | 120/min |

Returns 429 with `{ error: "Too many requests..." }`.

---

## Admin Dashboard

No user roles — single `ADMIN_KEY` env var (64-char random string).

**Flow**: Navigate to `/admin/login` → enter key → POST `/api/admin/login` → server validates against env var → sets httpOnly JWT cookie (24h) → redirects to `/admin`.

**Pages**:
- **Dashboard**: stat cards (users, calls, credits, enquiries), DAU/WAU/MAU row, plan/provider breakdowns, recent signups, contact enquiries (dismiss/restore, click-to-expand, "show dismissed" toggle)
- **Users**: full CRUD — create (modal), edit (plan, credits, verified, password reset), suspend/unsuspend, delete (cascade). Sortable columns (Joined, Last Active, Credits), plan filter, search. Calls count links to filtered calls page.
- **API Calls**: provider/status filters + userId filter (pre-populated from users page link) + date range (from/to)

**Active user tracking**: auth middleware updates `last_active_at` on every authenticated request (5-min debounce). DAU/WAU/MAU computed from `COUNT(DISTINCT user_id)` on `api_calls`.

**Suspension**: `users.suspended` flag checked in auth middleware (403 for API) and login endpoint. Admin can toggle per-user without deleting the account.

---

## Client Integration

Key files in the Tauri app that reference the web backend:

| File | What | URL |
|---|---|---|
| `src/services/shouldersAuth.js` | Auth (deep link login, keychain storage, refresh, logout) | `https://shoulde.rs/api/v1/auth` |
| `src/services/apiClient.js` | Unified API routing + auth + non-streaming transport (`SHOULDERS_PROXY_URL`) | `https://shoulde.rs/api/v1/proxy` |
| `src/services/chatProvider.js` | Streaming format conversion (used by chat/tasks for streaming via proxy) | (URL resolved by apiClient) |

**Model fallback** (`apiClient.js:resolveApiAccess()`): If user has direct API key → use provider directly. If user has Shoulders auth → auto-refresh expired JWT via `workspace.ensureFreshToken()` → route through proxy with `provider: 'shoulders'`. Otherwise → no access.

**Token auto-refresh**: `resolveApiAccess()` is async — before returning a Shoulders access object, it calls `workspace.ensureFreshToken()` which checks JWT expiry (15 min) and refreshes via `shouldersAuth.refreshTokens()` if needed. This prevents 401s during long sessions.

**Telemetry** (`src/services/telemetry.js`): Opt-in, batched events, 60s flush. Not yet wired into the app — needs Settings toggle and event calls at key points.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes | HS256 signing key. `openssl rand -hex 32` |
| `ADMIN_KEY` | Yes | Admin dashboard access. `openssl rand -hex 32` |
| `DATABASE_PATH` | No | Default: `./data/shoulders.db` |
| `ANTHROPIC_API_KEY` | For proxy | Server-side Anthropic key |
| `OPENAI_API_KEY` | For proxy | Server-side OpenAI key |
| `GOOGLE_API_KEY` | For proxy | Server-side Google key |
| `RESEND_API_KEY` | For email | Resend transactional email |
| `BASE_URL` | For email links | Default: `http://localhost:3000` |
| `GITHUB_REPO` | For releases | Default: `user/shoulders` |

**Dev**: Set raw env vars (`JWT_SECRET=xxx bun run dev`).
**Production build**: Use `NUXT_` prefix at runtime (`NUXT_JWT_SECRET=xxx node .output/server/index.mjs`), or set them at build time so they're baked in.

---

## Commands

```bash
cd web
bun run dev          # Start dev server (port 3000)
bun run build        # Production build → .output/
bun run preview      # Preview production build
bun run db:generate  # Generate drizzle migrations from schema
bun run db:migrate   # Run drizzle migrations
```

---

## Deployment

1. VPS with Node.js 20+, Caddy, SQLite3
2. Clone repo, `cd web && bun install && bun run build`
3. Copy `.env.example` → `.env`, fill in secrets
4. `sudo cp deploy/shoulders-web.service /etc/systemd/system/`
5. `sudo systemctl enable --now shoulders-web`
6. `sudo cp deploy/Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy`
7. Cron: `0 3 * * * /opt/shoulders-web/web/deploy/backup.sh`

GitHub Actions (`deploy-web.yml`) auto-deploys on push to `main` (paths: `web/**`).

---

## Future: Organisation Support (Design Notes)

The refresh token architecture is designed to support organisations without breaking changes. Below is the planned schema — **not yet implemented**.

### `organizations`
| Column | Type | Notes |
|---|---|---|
| id | text PK | |
| name | text | Display name |
| slug | text unique | URL-friendly identifier |
| plan | text | `free`, `pro`, `enterprise` |
| credits | integer | Org-level credit pool |
| sso_provider | text | nullable — `saml`, `oidc`, etc. |
| sso_config | text | nullable — JSON config blob |
| created_at | text | ISO 8601 |
| updated_at | text | ISO 8601 |

### `org_memberships`
| Column | Type | Notes |
|---|---|---|
| id | text PK | |
| user_id | text FK → users | |
| org_id | text FK → organizations | |
| role | text | `owner`, `admin`, `member` |
| invited_by | text FK → users | nullable |
| created_at | text | ISO 8601 |

### Integration Points

- **Credit routing**: When user belongs to an org, proxy checks `org.credits` instead of `user.credits`.
- **Refresh tokens**: Add optional `org_id` column for org-scoped session management. Org admin can revoke all sessions for a member.
- **SSO login**: Creates user + membership in one transaction. SSO-provisioned users may not have a password.
- **Deprovisioning**: Org admin removes membership → server revokes all refresh tokens for that user+org pair. 15-min access token TTL means access is cut within 15 minutes.
- **Org admin dashboard**: Separate from site admin. Scoped to their org's members, credit usage, and session management.
