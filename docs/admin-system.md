# Admin System

The admin dashboard (`/admin/*`) provides internal monitoring for the Shoulders web backend — users, API calls, peer reviews, deck shares, enterprise enquiries, and page analytics.

---

## Authentication

Single-admin key model. No user accounts for admin access.

1. **Login**: POST `/api/admin/login` with `{ key }` matching `ADMIN_KEY` env var (timing-safe comparison via `crypto.timingSafeEqual`)
2. **Token**: Server issues a 24-hour HS256 JWT stored in an `httpOnly` + `secure` + `sameSite: lax` cookie (`admin_session`)
3. **Middleware** (`server/middleware/02.admin.js`): Verifies the cookie JWT on all `/api/admin/*` routes except `/api/admin/login`. Sets `event.context.admin = true` for downstream handlers
4. **CSRF**: Mutating requests (POST/PUT/DELETE/PATCH) require the `Origin` header to match the `Host` header — rejects cross-origin form submissions with 403
5. **Logout**: POST `/api/admin/logout` deletes the cookie

---

## Pages

| Page | Route | API | Purpose |
|------|-------|-----|---------|
| Login | `/admin/login` | `POST /api/admin/login` | Admin key entry (standalone layout, no admin nav) |
| Dashboard | `/admin` | `GET /api/admin/stats` | KPI strip (users, active users, revenue, landing views) with week-over-week deltas + sparklines, visitor funnel, 14-day activity line chart, compact metric rows, needs-attention alerts |
| Users | `/admin/users` | `GET /api/admin/users`, `POST`, `PATCH`, `DELETE` | CRUD: create, edit (plan/credits/verified/password), suspend, delete. Searchable, sortable, filterable |
| API Calls | `/admin/calls` | `GET /api/admin/calls` | Paginated call log with provider/status/userId/date-range filters. Stats strip (success/error/tokens/cost) |
| Reviews | `/admin/reviews` | `GET /api/admin/reviews` | Peer review pipeline: status filter, stats (total/complete/failed/processing/cost/avg duration), per-review detail |
| Decks | `/admin/decks` | `GET /api/admin/decks`, `POST`, `DELETE /api/admin/decks/[id]` | Pitch deck share management: create, delete, view tracking |
| Contacts | `/admin/contacts` | `GET /api/admin/contacts`, `PATCH` | Enterprise enquiries: paginated table, dismiss/restore, expandable needs detail row |
| Analytics | `/admin/analytics` | `GET /api/admin/analytics` | Page view analytics: daily views chart, top pages, download clicks, referrers. Date range filter |

---

## API Endpoints

All protected by admin middleware (JWT cookie required). Mutating endpoints have CSRF protection.

### Dashboard & Stats

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/stats` | GET | Dashboard data: KPI totals, 14-day trends (signups/apiCalls/pageViews/reviews/downloads/deckViews), week-over-week deltas, 30-day visitor funnel, review/deck/download summaries, contact count |
| `/api/admin/analytics` | GET | Page analytics: `?from=YYYY-MM-DD&to=YYYY-MM-DD`. Returns summary (views/downloads/avg duration), top pages, daily views, download breakdown by platform, top referrers |

### Users

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/users` | GET | Paginated user list. Query: `page`, `limit` (1-100), `search` (email), `plan`, `sort` (created/active/credits), `dir` (asc/desc) |
| `/api/admin/users` | POST | Create user: `{ email, password, plan, credits }`. Pre-verified |
| `/api/admin/users` | PATCH | Edit user: `{ id, plan?, credits?, emailVerified?, suspended?, password? }` |
| `/api/admin/users` | DELETE | Delete user + cascade (tokens, calls): `{ id }` |
| `/api/admin/credits` | POST | Add/remove credits: `{ userId, amount }` |

### API Calls

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/calls` | GET | Paginated call log. Query: `page`, `provider`, `status`, `userId`, `from`, `to`. Returns stats strip + call rows |

### Reviews

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/reviews` | GET | Paginated reviews. Query: `page`, `limit`, `status`. Returns stats + review rows with parsed tech_notes |

### Contacts

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/contacts` | GET | Paginated contact enquiries. Query: `dismissed` filter |
| `/api/admin/contacts` | PATCH | Toggle dismissed: `{ id, dismissed }` |

### Decks

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/decks` | GET | All deck shares with view counts |
| `/api/admin/decks` | POST | Create share: `{ deckName, recipient, slug }` |
| `/api/admin/decks/[id]` | DELETE | Delete share |

---

## Layout & Navigation

**Layout** (`web/layouts/admin.vue`): Sticky top nav with links to all admin pages + logout button. Max-width content area (`max-w-6xl`).

**Nav links**: Dashboard, Users, API Calls, Reviews, Decks, Contacts, Analytics.

**Page pattern**: Each admin page uses `definePageMeta({ layout: 'admin' })`. Data fetching via `$fetch` with error state falling back to re-login link. Tables use consistent styling: `text-xs`, stone color palette, `font-mono` for data values.

---

## Page Analytics

Anonymous page view tracking for the Shoulders website. No cookies, no IP addresses, no user agents, no fingerprinting.

### What's tracked

Each row in `page_views` stores: `path`, `referrer_domain` (domain only), `duration_seconds`, `event_type` (`page_view` or `download_click`), `event_meta` (JSON, e.g. `{ platform: "mac-arm" }`), `created_at`.

### How it works

1. **Client plugin** (`web/plugins/analytics.client.js`): Activates `usePageAnalytics()` composable on every page
2. **SPA navigation**: On route change, sends previous page's duration via `sendBeacon`
3. **Page unload**: `beforeunload` sends current page's duration
4. **Download clicks**: `DownloadButton.vue` and `download.vue` send `download_click` events with platform label
5. **Ingest**: POST `/api/v1/analytics/event` (public, rate-limited to 30/min) — validates path, strips referrer to domain, caps duration to 0-3600s
6. **Admin view**: `/admin/analytics` — date range filter, daily views bar chart, top pages table, download breakdown, referrer list
7. **Cleanup**: `page_views` older than 180 days purged daily by `cleanup.js`

### Privacy

Zero PII stored. No cookies set, no IP addresses logged, no user agents recorded. Each row is just an anonymous event with path + timestamp. Falls outside GDPR scope (Recital 26 — genuinely anonymous data).

---

## Rate Limiting

Admin login has its own rate limit bucket: 5 attempts per minute per IP (`adminLogin` in `rateLimit.js`). Analytics ingest is 30 requests per minute per IP.

---

## File Map

| File | Purpose |
|------|---------|
| `web/layouts/admin.vue` | Admin layout: nav bar + content slot |
| `web/pages/admin/login.vue` | Admin key entry |
| `web/pages/admin/index.vue` | Dashboard: KPI strip, funnel, activity chart, metric rows, attention alerts |
| `web/pages/admin/users.vue` | User CRUD |
| `web/pages/admin/calls.vue` | API call log |
| `web/pages/admin/reviews.vue` | Peer review list |
| `web/pages/admin/decks.vue` | Deck share management |
| `web/pages/admin/contacts.vue` | Enterprise enquiries (paginated, expandable) |
| `web/pages/admin/analytics.vue` | Page analytics dashboard |
| `web/server/middleware/02.admin.js` | Admin JWT cookie verification + CSRF |
| `web/server/api/admin/login.post.js` | Login: key → JWT cookie |
| `web/server/api/admin/logout.post.js` | Logout: delete cookie |
| `web/server/api/admin/stats.get.js` | Dashboard aggregates |
| `web/server/api/admin/analytics.get.js` | Page analytics queries |
| `web/server/api/admin/users.get.js` | Paginated users |
| `web/server/api/admin/users.post.js` | Create user |
| `web/server/api/admin/users.patch.js` | Edit user |
| `web/server/api/admin/users.delete.js` | Delete user |
| `web/server/api/admin/calls.get.js` | Paginated API calls |
| `web/server/api/admin/reviews.get.js` | Paginated reviews |
| `web/server/api/admin/contacts.get.js` | Contact enquiries |
| `web/server/api/admin/contacts.patch.js` | Toggle contact dismissed |
| `web/server/api/admin/credits.post.js` | Add/remove credits |
| `web/server/api/admin/decks.get.js` | Deck shares list |
| `web/server/api/admin/decks.post.js` | Create deck share |
| `web/server/api/admin/decks/[id].delete.js` | Delete deck share |
| `web/server/api/v1/analytics/event.post.js` | Page view ingest (public) |
| `web/composables/usePageAnalytics.js` | Client-side page tracking composable |
| `web/plugins/analytics.client.js` | Nuxt plugin to activate analytics |
| `web/server/plugins/cleanup.js` | Purges page_views older than 180 days |
