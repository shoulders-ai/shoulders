# SQLite Infrastructure

Reusable pattern for persistent structured data in the Rust backend. Currently used by the usage tracking system; any future system needing durable cross-workspace or per-workspace storage (search index, analytics, bookmarks, settings) should follow this pattern.

## Relevant Files

| File | Role |
|---|---|
| `src-tauri/src/usage_db.rs` | Reference implementation — schema, record, query, settings |
| `src-tauri/src/lib.rs` | `.manage()` registration + `generate_handler![]` |
| `src-tauri/Cargo.toml` | `rusqlite` (bundled) + `dirs` dependencies |

## Dependencies

```toml
# src-tauri/Cargo.toml
rusqlite = { version = "0.32", features = ["bundled"] }  # statically links SQLite — no system dependency
dirs = "5"                                                 # cross-platform home directory resolution
```

The `bundled` feature compiles SQLite from source into the binary (~1.5 MB increase). This avoids requiring users to have SQLite installed and guarantees version consistency.

## Pattern: Lazy-Init Singleton

Every SQLite-backed module follows the same three-part pattern:

### 1. Managed State Struct

```rust
use rusqlite::Connection;
use std::sync::Mutex;

pub struct MyDbState {
    pub conn: Mutex<Option<Connection>>,
}

impl Default for MyDbState {
    fn default() -> Self {
        Self { conn: Mutex::new(None) }
    }
}
```

The `Option` allows lazy initialization — the DB isn't opened until the first command needs it.

### 2. Lazy Initializer

```rust
fn ensure_connection(state: &MyDbState) -> Result<(), String> {
    let mut guard = state.conn.lock().map_err(|e| e.to_string())?;
    if guard.is_some() { return Ok(()); }

    let path = get_db_path()?;  // see "DB Location" below
    let conn = Connection::open(&path)
        .map_err(|e| format!("Failed to open DB: {}", e))?;

    // Always set these pragmas
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;")
        .map_err(|e| format!("Failed to set pragmas: {}", e))?;

    // Create schema (idempotent)
    conn.execute_batch("CREATE TABLE IF NOT EXISTS ...")
        .map_err(|e| format!("Failed to create schema: {}", e))?;

    *guard = Some(conn);
    Ok(())
}
```

**WAL mode** (Write-Ahead Logging) allows concurrent reads during writes and survives crashes without corruption. **Busy timeout** (5 seconds) prevents "database is locked" errors when rapid sequential writes overlap.

### 3. Tauri Commands

```rust
#[tauri::command]
pub fn my_command(
    state: tauri::State<'_, MyDbState>,
    // ... parameters
) -> Result<SomeReturnType, String> {
    ensure_connection(&state)?;
    let guard = state.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("DB not initialized")?;

    // Use conn to execute queries
    Ok(result)
}
```

### Registration in `lib.rs`

```rust
.manage(my_module::MyDbState::default())
.invoke_handler(tauri::generate_handler![
    my_module::my_command,
    // ...
])
```

## DB Location Conventions

| Scope | Path | Use Case |
|---|---|---|
| **Global** | `~/.shoulders/<name>.db` | Cross-workspace data (usage tracking, user preferences) |
| **Per-workspace** | `<workspace>/.shoulders/<name>.db` | Project-specific data (search index, local bookmarks) |

Global DBs use `dirs::home_dir()` to resolve `~`. Per-workspace DBs use the workspace path from the frontend.

```rust
fn get_db_path() -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let dir = home.join(".shoulders");
    if !dir.exists() {
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create dir: {}", e))?;
    }
    Ok(dir.join("my_data.db").to_string_lossy().to_string())
}
```

## Schema Conventions

- **`CREATE TABLE IF NOT EXISTS`** — idempotent, runs on every connection open. No migration system yet.
- **`CREATE INDEX IF NOT EXISTS`** — add indexes for any column used in `WHERE` or `GROUP BY`.
- **ISO 8601 timestamps** (`TEXT`) — enables `LIKE 'YYYY-MM%'` prefix matching for month queries and natural sort order.
- **Settings table** — generic key-value `(key TEXT PRIMARY KEY, value TEXT)` for module configuration. Use `INSERT OR REPLACE` for upserts.

## Frontend Pattern

Thin Pinia store wrapping `invoke()` calls. Key conventions:

- **Fire-and-forget recording**: `record()` calls catch and warn on errors, never throw. Recording failures must not interrupt the user's workflow.
- **Non-blocking refresh**: After writing, call the read action (e.g., `loadMonth()`) without awaiting — the UI will reactively update when the data arrives.
- **Dynamic imports**: Use `await import('./workspace')` inside actions to avoid circular dependencies between stores.

```js
// src/stores/myStore.js
import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'

export const useMyStore = defineStore('myStore', {
  state: () => ({ data: null }),
  actions: {
    async record(payload) {
      try { await invoke('my_record', payload) }
      catch (e) { console.warn('[myStore] record failed:', e) }
      this.load()  // non-blocking refresh
    },
    async load() {
      try { this.data = await invoke('my_query', { /* params */ }) }
      catch (e) { console.warn('[myStore] load failed:', e) }
    },
  },
})
```

## Querying Tips

### Parameterized queries with optional filters

When a parameter is optional (e.g., workspace filtering), build two SQL variants rather than using dynamic `WHERE` clauses:

```rust
let sql = if workspace.is_some() {
    "SELECT ... FROM t WHERE timestamp LIKE ?1 AND workspace = ?2"
} else {
    "SELECT ... FROM t WHERE timestamp LIKE ?1"
};
```

Use `stmt.query(params![...])` with manual row iteration (not `query_map()`) to avoid Rust closure type mismatches between branches.

### Aggregation

SQLite is fast at aggregate queries over millions of rows. Prefer `SUM()`, `COUNT()`, `GROUP BY` in SQL over fetching raw rows and aggregating in Rust/JS.

## Current Implementations

| Module | DB Path | Tables | Commands |
|---|---|---|---|
| Usage tracking | `~/.shoulders/usage.db` | `usage_calls`, `usage_settings` | `usage_record`, `usage_query_month`, `usage_query_monthly_trend`, `usage_get_setting`, `usage_set_setting` |

See [usage-system.md](usage-system.md) for full schema and API documentation.
