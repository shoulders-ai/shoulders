# Usage Tracking & Cost Display

Tracks token usage and estimated cost for every AI API call across all features. Data is stored in a global SQLite database, surfaced in the footer and a Settings tab with month navigation and trend visualization.

For the reusable SQLite infrastructure pattern, see [sqlite-infrastructure.md](sqlite-infrastructure.md).

## Relevant Files

| File | Role |
|---|---|
| **Rust Backend** | |
| `src-tauri/src/usage_db.rs` | SQLite DB management: schema, record, query, trend, settings |
| `src-tauri/src/lib.rs` | Registers `UsageDbState` + 5 Tauri commands |
| `src-tauri/Cargo.toml` | `rusqlite` (bundled) + `dirs` dependencies |
| **Frontend Store** | |
| `src/stores/usage.js` | Pinia store: record, query, month navigation, trend, settings, session totals |
| `src/services/tokenUsage.js` | Pricing tables, normalization, cost calculation, `addUsage()` |
| **Call Sites** | |
| `src/stores/chat.js` | Records after each streaming response (tool_use + done paths) |
| `src/stores/tasks.js` | Full usage accumulation pipeline, mirrors chat.js |
| `src/editor/ghostSuggestion.js` | Records after each ghost suggestion API call |
| `src/editor/docxGhost.js` | Records after each DOCX ghost suggestion API call |
| `src/services/refAi.js` | Records after each reference parsing/extraction call |
| `src/services/docxProvider.js` | Records for both non-streaming and streaming DOCX AI calls |
| **UI** | |
| `src/components/layout/Footer.vue` | Toggleable monthly cost display (click opens Settings) |
| `src/components/settings/SettingsUsage.vue` | Usage tab: trend, month nav, breakdowns, budget, Shoulders link |
| `src/components/settings/Settings.vue` | Accepts `initialSection` prop for deep-linking |

## Architecture

```
  Call Sites                   Frontend Store              Rust / SQLite
  ──────────                   ──────────────              ─────────────
  chat.js        ──┐
  tasks.js       ──┤           ┌──────────┐          ┌──────────────────┐
  ghostSuggest.  ──┼──record()─▶ usage.js ├─invoke()─▶ usage_db.rs     │
  docxGhost.js   ──┤           │ (Pinia)  │◀─invoke()─│                 │
  refAi.js       ──┤           └────┬─────┘          │ ~/.shoulders/   │
  docxProvider   ──┘                │                 │   usage.db      │
                              reactive getters        └──────────────────┘
                           ┌────────┴────────┐
                           ▼                 ▼
                      Footer.vue      SettingsUsage.vue
                      (monthly $)     (trend + nav + breakdown)
```

## Database

**Location**: `~/.shoulders/usage.db` — global, cross-workspace. Created on first `record()` call.

**Mode**: WAL (Write-Ahead Logging) + 5s busy timeout for crash safety.

### Schema

```sql
CREATE TABLE usage_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,           -- ISO 8601
  workspace TEXT,                    -- workspace path (for per-project filtering)
  feature TEXT NOT NULL,             -- chat | ghost | tasks | references | docx
  provider TEXT NOT NULL,            -- anthropic | openai | google | shoulders
  model TEXT NOT NULL,               -- full model ID as sent to API
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_read INTEGER DEFAULT 0,
  cache_write INTEGER DEFAULT 0,
  cost REAL DEFAULT 0,               -- estimated USD
  session_id TEXT                    -- chat session or task thread ID
);

CREATE TABLE usage_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

Indexes on `timestamp` (month queries) and `workspace` (project filtering).

### Settings Keys

| Key | Values | Default |
|---|---|---|
| `monthly_limit` | USD amount as string, `"0"` = no limit | `"0"` |
| `show_footer_cost` | `"true"` / `"false"` | `"true"` |
| `show_cost_estimates` | `"true"` / `"false"` — opt-in dollar estimates for direct API key usage | `"false"` |

## Tauri Commands

| Command | Purpose |
|---|---|
| `usage_record` | INSERT a single call record (fire-and-forget) |
| `usage_query_month` | Aggregate for YYYY-MM: total/shoulders/direct cost+calls, input/output tokens, by-feature, by-model |
| `usage_query_monthly_trend` | Last N months: `[{ month, cost, calls, shoulders_cost }]` |
| `usage_set_setting` | Write a key-value pair |
| `usage_get_setting` | Read a setting value |

All commands use a lazy-initialized `Mutex<Option<Connection>>` singleton in Tauri managed state.

### Monthly Trend Query

`usage_query_monthly_trend(count, workspace?)` returns up to `count` months of aggregated data, newest first. Each entry includes total cost, call count, and Shoulders-specific cost (for conditional UI). Uses `GROUP BY substr(timestamp, 1, 7)` for efficient month-level aggregation.

## Pricing

Defined in `src/services/tokenUsage.js`. Per-token USD for 7 models across 3 providers:

| Model | Input | Output | Cache Read | Cache Write |
|---|---|---|---|---|
| claude-opus-4-6 | $5.00/MTok | $25.00/MTok | $0.50/MTok | $6.25/MTok |
| claude-sonnet-4-6 | $3.00/MTok | $15.00/MTok | $0.30/MTok | $3.75/MTok |
| claude-haiku-4-5 | $1.00/MTok | $5.00/MTok | $0.10/MTok | $1.25/MTok |
| gpt-5.2 | $1.75/MTok | $14.00/MTok | $0.175/MTok | — |
| gpt-5-mini | $0.25/MTok | $2.00/MTok | $0.025/MTok | — |
| gpt-5-nano | $0.05/MTok | $0.40/MTok | $0.005/MTok | — |
| gemini-3.1-pro | $2.00/MTok | $12.00/MTok | $0.20/MTok | — |
| gemini-3-flash | $0.50/MTok | $3.00/MTok | $0.05/MTok | — |

Sonnet and Gemini Pro have higher rates for prompts >200K tokens. `resolveModelPriceKey()` strips date suffixes and `-preview` to match pricing keys.

## How Recording Works

### Streaming calls (chat, tasks, docx streaming)

```
API stream begins
  ↓
Each SSE event with usage → normalizeUsage() → mergeUsage(accumulator, partial)
  ↓
Stream ends (message_delta stop or done event)
  ↓
calculateCost(accumulator, modelId)
  ↓
Store on assistantMsg.usage (persisted in session JSON)
  ↓
usageStore.record({ usage, feature, provider, modelId, sessionId })
  ↓
invoke('usage_record', ...) → INSERT into SQLite
  ↓
usageStore.loadMonth() + loadTrend() → refresh reactive getters
```

### Non-streaming calls (ghost, references, docx non-streaming)

```
API call returns response
  ↓
getUsage(provider, rawUsage, modelId)  // normalize + calculate cost
  ↓
usageStore.record({ usage, feature, provider, modelId })
```

### Feature tags

| Feature | Source | Model |
|---|---|---|
| `chat` | Chat sessions | User-selected |
| `tasks` | Task threads | User-selected |
| `ghost` | Ghost suggestions (markdown + DOCX) | claude-haiku-4-5 |
| `references` | Reference parsing, PDF metadata extraction | Cheapest available |
| `docx` | SuperDoc AI actions (non-streaming + streaming) | User-selected |

## Usage Store (`usage.js`)

### State
- `monthData` — cached `usage_query_month` result for selected month
- `selectedMonth` — YYYY-MM string, defaults to current month
- `trendData` — `[{ month, cost, calls, shoulders_cost }]` last 12 months, newest first
- `monthlyLimit` — hard USD limit from settings (0 = no limit). At 100%, all AI features are blocked
- `showInFooter` — footer visibility toggle
- `showCostEstimates` — opt-in: show dollar estimates for direct API key usage (default false)
- `sessionTotals` — `{ [sessionId]: cost }` rebuilt from message `.usage` fields

### Key Getters
- `totalCost` / `formattedTotal` — selected month total
- `shouldersCost` / `directCost` — split by provider=shoulders vs not
- `shouldersCalls` / `directCalls` — call count split
- `totalInputTokens` / `totalOutputTokens` — aggregate token counts
- `isNearBudget` — direct API key cost >= 80% of limit (Shoulders usage excluded)
- `isOverBudget` — direct API key cost >= 100% of limit (Shoulders usage excluded)
- `byFeature` / `byModel` — breakdown arrays from SQL for selected month
- `isCurrentMonth` — whether selected month is the live month
- `allTimeCost` / `allTimeCalls` — sum across all trend data
- `allTimeShouldersCost` — sum of Shoulders-provider costs (for conditional UI)
- `selectedMonthLabel` — formatted month name (e.g., "February 2026")
- `monthCount` — number of months with data

### Actions
- `record()` — INSERT + refresh month data (only if current month) + refresh trend + check budget thresholds
- `checkBudgetThresholds()` — fires toast at 80% (warning) and 100% (error) via `showOnce` with `Infinity` cooldown (once per app session, resets on restart)
- `loadMonth()` — query for `selectedMonth`
- `loadTrend()` — query last 12 months
- `navigateMonth(delta)` — move selected month forward/backward (clamped to current)
- `goToCurrentMonth()` — reset to live month
- `goToMonth(ym)` — jump to specific YYYY-MM (used by trend bar clicks)

### Lifecycle
- `workspace.openWorkspace()` → `usageStore.loadSettings()` + `loadMonth()` + `loadTrend()`
- Each `record()` call → non-blocking refresh
- `chat.loadSessions()` → `rebuildSessionTotals(sessions)` from persisted message `.usage` fields

## UI

### Footer

See [billing.md](billing.md) for full display rules. Key points:
- Follows the **selected model's billing route** via `getBillingRoute(workspace.selectedModelId, workspace)`
- Shoulders route: `$X.XX Credits remaining` → click opens Settings → Account
- Direct route: `~$X.XX this month` → click opens Settings → Models
- Flips reactively when the user switches models in the chat picker
- Hidden when `showInFooter` is false or route has nothing to display

### Settings Layout (billing-related)

**Models tab** (`SettingsModels.vue`):
- API key fields + save
- API Key Usage: calls + tokens summary cards, by-model table, cost estimates toggle
- Monthly Budget: soft limit + progress bar

**Account tab** (`SettingsAccount.vue`):
- Balance, plan, actions (existing)
- Shoulders monthly stats: `$X.XX spent · N calls this month`, all-time total

**Usage tab** (`SettingsUsage.vue`) — cross-cutting historical view:
- Trend chart (stacked bars: Shoulders vs API keys)
- Month navigation
- By-feature table with Shoulders/API Keys split columns
- Show billing in footer toggle

## Per-Message Usage Persistence

Chat and task messages include a `usage` field in their serialization:

```json
{
  "id": "msg-abc123",
  "role": "assistant",
  "content": "...",
  "usage": {
    "input_cache_miss": 1200,
    "input_cache_hit": 0,
    "input_cache_write": 0,
    "input_total": 1200,
    "output": 350,
    "thinking": 0,
    "total": 1550,
    "cost": 0.007050
  }
}
```

This enables `rebuildSessionTotals()` to reconstruct per-session costs from reopened sessions without querying the DB.

## Design Decisions

- **SQLite, not JSON** — per-call INSERT, no read-modify-write, no corruption from interrupted writes, SQL aggregation for any breakdown dimension
- **Global DB at `~/.shoulders/`** — cross-workspace, survives workspace deletion
- **Per-call rows** — no maintained counters, no stale aggregates, new breakdowns without migration
- **Hard budget, easy escape** — at 80% a warning toast fires; at 100% all AI features are blocked (chat shows error message, ghost silently disabled, send button disabled with "Budget reached" label). Budget only caps *direct API key spending* — Shoulders usage has its own server-side balance and is excluded from budget calculations. Toasts fire once per app session (not repeatedly). Users can change or remove the limit at any time in Settings — never locked out, but must make a conscious decision to keep spending. If a stale budget exists but the user has no API keys, it is auto-cleared on `loadSettings()` and the budget section is shown with a "Remove" button as a fallback. Budget gates use dynamic `await import('../stores/usage')` at each call site (same lazy pattern as existing usage recording)
- **No per-message cost in UI** — costs live in footer + Settings only. Clean, not anxiety-inducing
- **Fire-and-forget recording** — `record()` errors are caught and warned, never interrupt the user's workflow
- **Month navigation, not date ranges** — proportionate for a personal app. Monthly granularity covers 95% of "how much am I spending?" questions without the complexity of arbitrary date pickers
- **Trend strip, not charts** — pure CSS bars, no chart library. Clickable for navigation. Shows 12 months of history at a glance
- **Shoulders link conditional** — only shown when user has Shoulders auth or historical Shoulders costs. Opens system browser via shell `open` command
