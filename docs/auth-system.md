# Auth System

Desktop + web authentication for Shoulders. Refresh token rotation with theft detection, desktop login via browser, OS keychain storage.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Access Token (JWT)              Refresh Token (opaque) │
│  HS256, 15-min expiry            90-day expiry          │
│  Stateless — no DB lookup        Stored hashed in DB    │
│  Sent as Bearer header           Sent in POST body only │
│  Used for all API requests       Used only at /refresh  │
└─────────────────────────────────────────────────────────┘
```

**Why two tokens?** The access token is fast (no DB read on every request). The refresh token is secure (rotation + theft detection). When an admin deprovisions a user, access expires within 15 minutes without any revocation mechanism.

### Rotation & Theft Detection

Every refresh token belongs to a `familyId` chain (all tokens issued from the same login session). When a refresh token is used:

1. Old token is revoked (`revoked = 1`)
2. New token is created with the **same** `familyId`
3. Both new access + refresh tokens are returned

If a **revoked** token is reused (stolen token replay), the server revokes the entire family — all sessions from that login are invalidated.

## Server Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/auth/login` | No | Email + password → access + refresh tokens |
| POST | `/auth/refresh` | Refresh token in body | Rotate refresh, issue new access token |
| POST | `/auth/logout` | Refresh token in body | Revoke entire token family |
| GET | `/auth/status` | Bearer | Current user info (email, plan, credits) |
| GET | `/auth/sessions` | Bearer | List active refresh token sessions |
| DELETE | `/auth/sessions/:id` | Bearer | Revoke a specific session |
| POST | `/auth/desktop-code` | Bearer | Store tokens for desktop polling (2-min TTL) |
| POST | `/auth/desktop-poll` | No | Desktop polls for tokens by state |
| POST | `/auth/exchange` | No | Exchange one-time deep link code for tokens |

### Key Files

| File | Purpose |
|------|---------|
| `web/server/utils/auth.js` | `createAccessToken`, `createRefreshToken`, `rotateRefreshToken`, `verifyToken`, `hashToken` |
| `web/server/middleware/01.auth.js` | JWT verification, user lookup (1 DB read), `PROTECTED_PREFIXES` list |
| `web/server/api/v1/auth/refresh.post.js` | Rotation + theft detection |
| `web/server/api/v1/auth/desktop-code.post.js` | Stores tokens in `verification_tokens` for desktop polling |
| `web/server/api/v1/auth/desktop-poll.post.js` | Desktop polls by hashed state key |
| `web/server/api/v1/auth/exchange.post.js` | Deep link code → tokens (production path) |
| `web/server/plugins/cleanup.js` | Purges expired/revoked tokens every 24h |
| `web/composables/useAuth.js` | Web client: `authedFetch()`, auto-refresh, session management |
| `src/services/shouldersAuth.js` | Desktop client: keychain storage, polling, deep link handler |

## Desktop Login Flow

### Smart Mode Detection

`loginViaBrowser()` auto-detects whether to show signup or signin:

| `~/.shoulders/account.json` exists? | Opens as |
|--------------------------------------|----------|
| No (first-time user) | signup |
| Yes (has logged in before) | signin |

The marker file is written after every successful login with `{ email }`. It survives app reinstalls, logouts, and workspace changes since it lives in the global config dir. Both forms have toggle links so the user can switch with one click.

Callers can override with `loginViaBrowser({ mode: 'signin' })` or `{ mode: 'signup' }`.

### Two Racing Paths

Two parallel paths race — whichever completes first wins:

#### Path 1: Polling (always works, used in dev)

```
Desktop                    Browser                    Server
  │                          │                          │
  ├─ generate random state   │                          │
  ├─ open browser ───────────►                          │
  │    ?state=xxx&mode=yyy   │                          │
  │                          ├─ user logs in ──────────►│
  │                          │                          ├─ createAccessToken()
  │                          │                          ├─ createRefreshToken()
  │                          │                  ◄───────┤  store in verification_tokens
  │                          │◄─ { ok: true } ─────────┤  keyed by hash(state)
  │                          ├─ show "Authenticated"    │
  │                          │                          │
  ├─ POST /desktop-poll ────────────────────────────────►
  │    { state: xxx }        │                          ├─ lookup by hash(state)
  │◄─ { token, refresh... } ────────────────────────────┤  mark used
  ├─ store in OS keychain    │                          │
  ├─ done                    │                          │
```

#### Path 2: Deep Link (production, requires installed app bundle)

```
Desktop                    Browser                    Server
  │                          │                          │
  │                          ├─ user logs in ──────────►│
  │                          │                          ├─ generate one-time code
  │                          │◄─ redirect to ──────────┤
  │                          │   shoulders://auth/      │
  │                          │   callback?code=xxx      │
  │◄─ deep link received ───┤                          │
  ├─ POST /exchange ─────────────────────────────────────►
  │    { code: xxx }         │                          ├─ lookup code, verify
  │◄─ { token, refresh... } ────────────────────────────┤  issue tokens
  ├─ store in OS keychain    │                          │
```

**Why two paths?** Deep links (`shoulders://`) only work when the app is installed as a proper macOS/Windows bundle. During development (`npx tauri dev`), the URL scheme isn't registered, so polling is the fallback. Both paths run simultaneously; a 5-minute timeout rejects if neither completes.

## Token Storage (Desktop)

### OS Keychain via `keyring` crate

Tokens are stored in the OS-native credential store:
- **macOS**: Keychain (via Security framework)
- **Windows**: Credential Manager
- **Linux**: Secret Service (GNOME Keyring / KWallet)

Rust commands in `lib.rs`:
- `keychain_get(key)` → returns stored string or empty
- `keychain_set(key, value)` → stores string
- `keychain_delete(key)` → removes entry

Service name: `com.shoulders.editor`, key: `auth-data`.

If keychain fails (e.g. no keyring daemon on minimal Linux), falls back to `localStorage`.

### Why not Stronghold?

`tauri-plugin-stronghold` was the original choice (Tauri's built-in encrypted vault). **It takes ~50 seconds to load** due to its internal key derivation, making every auth operation painfully slow. The `keyring` crate uses OS-native APIs and is instant.

## Production Checklist

### Before First Deploy

- [ ] **`JWT_SECRET` env var**: Set a strong random secret on the production server (`openssl rand -hex 32`). Used by `jose` for HS256 signing/verification. If not set, the server generates a random one on startup (tokens won't survive restarts).

- [ ] **Deep link URL scheme**: Verify `shoulders://` is registered in the production app bundle. On macOS, the Tauri build automatically adds it to `Info.plist` from `tauri.conf.json`. Test by running `open shoulders://test` in Terminal after installing the built `.dmg`.

- [ ] **`BASE_ORIGIN` in `shouldersAuth.js`**: Currently switches between `localhost:3000` (dev) and `shoulde.rs` (prod) via `import.meta.env.DEV`. Verify the production URL is correct.

- [ ] **HTTPS**: All auth endpoints must be HTTPS in production. The Caddy reverse proxy handles TLS termination.

- [ ] **Desktop-poll TTL**: The `desktop-code.post.js` endpoint sets a 2-minute expiry on the verification token. If users are slow to authenticate, increase this (but keep it short for security).

### Ongoing

- [ ] **Token cleanup**: `plugins/cleanup.js` runs on server start + every 24h. Deletes expired refresh tokens and old revoked ones (30+ days). Verify this is running in production logs.

- [ ] **Monitor `/refresh` 401s**: A spike in 401s on the refresh endpoint may indicate token theft attempts (family revocation).

### Future: Organisations

The refresh token design supports org-scoped session management:
- Add optional `orgId` column to `refresh_tokens`
- Org admin can revoke all sessions for their org
- SSO login creates user + org membership in one transaction
- See org schema design in `docs/web-backend.md`

## Debugging

### Common Issues

**Desktop stuck on "Waiting for browser..."**
- Check browser dev tools: did `desktop-code.post.js` return `{ ok: true }`?
- Check Tauri dev tools console for poll errors
- Verify `proxy_api_call` wraps args in `{ request: { ... } }` (not flat)
- Verify the Nuxt dev server is running on port 3000

**Slow auth operations**
- If using Stronghold: replace with `keyring` crate (see commit history)
- If keychain fails silently: check localStorage fallback is working

**Token refresh loops**
- Check server time sync (JWT expiry comparison)
- Check `refreshExpiresAt` is being returned from `/refresh` endpoint
- A revoked family returns 401 with "Session invalidated" — user must re-login

### `proxy_api_call` Gotcha

The Rust command signature is `fn proxy_api_call(request: ApiProxyRequest)`. Tauri v2 deserializes invoke arguments by parameter name. The JS call **must** wrap arguments:

```js
// CORRECT
invoke('proxy_api_call', { request: { url, method, headers, body } })

// WRONG — silently fails (deserialization error caught as invoke rejection)
invoke('proxy_api_call', { url, method, headers, body })
```

This applies to all Tauri commands with struct parameters.

### Shoulders Proxy URL in Dev Mode

Any code that calls the Shoulders proxy must use `localhost:3000` in dev, `shoulde.rs` in prod:

```js
const PROXY_URL = `${import.meta.env.DEV ? 'http://localhost:3000' : 'https://shoulde.rs'}/api/v1/proxy`
```

Files that need this: `chatProvider.js`, `refAi.js`, `ai.js`. If you add a new AI call path, use the central proxy URL.

### Don't Leak Provider URLs Through resolveModel

When `resolveModel()` falls back to the Shoulders proxy, it must NOT pass the original provider's `providerConfig` (which contains e.g. `https://api.anthropic.com/v1/messages`). Pass `providerConfig: {}` so `formatShoulders` uses its own proxy URL instead of the upstream provider URL.

### Multiple AI Call Paths (Technical Debt)

There are currently 4 independent code paths for calling AI models (`ai.js`, `chatProvider.js`, `refAi.js`, `docxProvider.js`). Each handles URL routing, auth headers, and Shoulders proxy logic independently. This caused cascading bugs during the auth rollout — fixing one file didn't fix the others. A future refactor should consolidate into a single `apiClient.js`.
