use rusqlite::{Connection, params};
use std::sync::Mutex;

pub struct UsageDbState {
    pub conn: Mutex<Option<Connection>>,
}

impl Default for UsageDbState {
    fn default() -> Self {
        Self {
            conn: Mutex::new(None),
        }
    }
}

fn get_db_path() -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let shoulders_dir = home.join(".shoulders");
    if !shoulders_dir.exists() {
        std::fs::create_dir_all(&shoulders_dir)
            .map_err(|e| format!("Failed to create ~/.shoulders: {}", e))?;
    }
    Ok(shoulders_dir.join("usage.db").to_string_lossy().to_string())
}

fn ensure_connection(state: &UsageDbState) -> Result<(), String> {
    let mut guard = state.conn.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        return Ok(());
    }

    let path = get_db_path()?;
    let conn = Connection::open(&path).map_err(|e| format!("Failed to open usage DB: {}", e))?;

    // WAL mode + busy timeout
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;")
        .map_err(|e| format!("Failed to set pragmas: {}", e))?;

    // Create schema
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS usage_calls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            workspace TEXT,
            feature TEXT NOT NULL,
            provider TEXT NOT NULL,
            model TEXT NOT NULL,
            input_tokens INTEGER DEFAULT 0,
            output_tokens INTEGER DEFAULT 0,
            cache_read INTEGER DEFAULT 0,
            cache_write INTEGER DEFAULT 0,
            cost REAL DEFAULT 0,
            session_id TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_calls_month ON usage_calls(timestamp);
        CREATE INDEX IF NOT EXISTS idx_calls_workspace ON usage_calls(workspace);
        CREATE TABLE IF NOT EXISTS usage_settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );"
    ).map_err(|e| format!("Failed to create schema: {}", e))?;

    *guard = Some(conn);
    Ok(())
}

#[derive(serde::Serialize)]
pub struct TrendEntry {
    pub month: String,
    pub cost: f64,
    pub calls: i64,
    pub shoulders_cost: f64,
}

#[derive(serde::Serialize)]
pub struct BreakdownEntry {
    pub name: String,
    pub cost: f64,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub calls: i64,
    pub shoulders_cost: f64,
    pub direct_cost: f64,
}

#[derive(serde::Serialize)]
pub struct MonthData {
    pub total_cost: f64,
    pub shoulders_cost: f64,
    pub direct_cost: f64,
    pub calls: i64,
    pub shoulders_calls: i64,
    pub direct_calls: i64,
    pub total_input_tokens: i64,
    pub total_output_tokens: i64,
    pub by_feature: Vec<BreakdownEntry>,
    pub by_model: Vec<BreakdownEntry>,
}

#[tauri::command]
pub fn usage_record(
    state: tauri::State<'_, UsageDbState>,
    workspace: Option<String>,
    feature: String,
    provider: String,
    model: String,
    input_tokens: i64,
    output_tokens: i64,
    cache_read: i64,
    cache_write: i64,
    cost: f64,
    session_id: Option<String>,
) -> Result<(), String> {
    ensure_connection(&state)?;
    let guard = state.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("DB not initialized")?;

    let timestamp = chrono::Local::now().to_rfc3339();

    conn.execute(
        "INSERT INTO usage_calls (timestamp, workspace, feature, provider, model, input_tokens, output_tokens, cache_read, cache_write, cost, session_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![timestamp, workspace, feature, provider, model, input_tokens, output_tokens, cache_read, cache_write, cost, session_id],
    ).map_err(|e| format!("Failed to insert usage record: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn usage_query_month(
    state: tauri::State<'_, UsageDbState>,
    month: String,
    workspace: Option<String>,
) -> Result<MonthData, String> {
    ensure_connection(&state)?;
    let guard = state.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("DB not initialized")?;

    // month is "YYYY-MM"
    let month_prefix = format!("{}%", month);

    // Total with shoulders/direct split
    let totals_sql = "SELECT
        COALESCE(SUM(cost), 0),
        COUNT(*),
        COALESCE(SUM(CASE WHEN provider = 'shoulders' THEN cost ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN provider != 'shoulders' THEN cost ELSE 0 END), 0),
        COUNT(CASE WHEN provider = 'shoulders' THEN 1 END),
        COUNT(CASE WHEN provider != 'shoulders' THEN 1 END),
        COALESCE(SUM(input_tokens), 0),
        COALESCE(SUM(output_tokens), 0)
        FROM usage_calls WHERE timestamp LIKE ?1";

    let (total_cost, calls, shoulders_cost, direct_cost, shoulders_calls, direct_calls, total_input_tokens, total_output_tokens) = if let Some(ref ws) = workspace {
        conn.query_row(
            &format!("{} AND workspace = ?2", totals_sql),
            params![month_prefix, ws],
            |row| Ok((
                row.get::<_, f64>(0)?, row.get::<_, i64>(1)?,
                row.get::<_, f64>(2)?, row.get::<_, f64>(3)?,
                row.get::<_, i64>(4)?, row.get::<_, i64>(5)?,
                row.get::<_, i64>(6)?, row.get::<_, i64>(7)?,
            )),
        )
    } else {
        conn.query_row(
            totals_sql,
            params![month_prefix],
            |row| Ok((
                row.get::<_, f64>(0)?, row.get::<_, i64>(1)?,
                row.get::<_, f64>(2)?, row.get::<_, f64>(3)?,
                row.get::<_, i64>(4)?, row.get::<_, i64>(5)?,
                row.get::<_, i64>(6)?, row.get::<_, i64>(7)?,
            )),
        )
    }.map_err(|e| format!("Query failed: {}", e))?;

    // By feature
    let by_feature = query_breakdown(conn, &month_prefix, workspace.as_deref(), GroupBy::Feature)?;

    // By model
    let by_model = query_breakdown(conn, &month_prefix, workspace.as_deref(), GroupBy::Model)?;

    Ok(MonthData {
        total_cost,
        shoulders_cost,
        direct_cost,
        calls,
        shoulders_calls,
        direct_calls,
        total_input_tokens,
        total_output_tokens,
        by_feature,
        by_model,
    })
}

enum GroupBy {
    Feature,
    Model,
}

impl GroupBy {
    fn column_name(&self) -> &'static str {
        match self {
            GroupBy::Feature => "feature",
            GroupBy::Model => "model",
        }
    }
}

fn query_breakdown(
    conn: &Connection,
    month_prefix: &str,
    workspace: Option<&str>,
    group_col: GroupBy,
) -> Result<Vec<BreakdownEntry>, String> {
    let col = group_col.column_name();
    let sql = if workspace.is_some() {
        format!(
            "SELECT {col}, COALESCE(SUM(cost), 0), COALESCE(SUM(input_tokens), 0), COALESCE(SUM(output_tokens), 0), COUNT(*),
             COALESCE(SUM(CASE WHEN provider = 'shoulders' THEN cost ELSE 0 END), 0),
             COALESCE(SUM(CASE WHEN provider != 'shoulders' THEN cost ELSE 0 END), 0)
             FROM usage_calls WHERE timestamp LIKE ?1 AND workspace = ?2 GROUP BY {col} ORDER BY SUM(cost) DESC",
            col = col
        )
    } else {
        format!(
            "SELECT {col}, COALESCE(SUM(cost), 0), COALESCE(SUM(input_tokens), 0), COALESCE(SUM(output_tokens), 0), COUNT(*),
             COALESCE(SUM(CASE WHEN provider = 'shoulders' THEN cost ELSE 0 END), 0),
             COALESCE(SUM(CASE WHEN provider != 'shoulders' THEN cost ELSE 0 END), 0)
             FROM usage_calls WHERE timestamp LIKE ?1 GROUP BY {col} ORDER BY SUM(cost) DESC",
            col = col
        )
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| format!("Prepare failed: {}", e))?;

    let mut result = Vec::new();

    let mut process_rows = |rows: rusqlite::Rows<'_>| -> Result<(), String> {
        let mut rows = rows;
        while let Some(row) = rows.next().map_err(|e| format!("Row error: {}", e))? {
            result.push(BreakdownEntry {
                name: row.get(0).map_err(|e| format!("Column error: {}", e))?,
                cost: row.get(1).map_err(|e| format!("Column error: {}", e))?,
                input_tokens: row.get(2).map_err(|e| format!("Column error: {}", e))?,
                output_tokens: row.get(3).map_err(|e| format!("Column error: {}", e))?,
                calls: row.get(4).map_err(|e| format!("Column error: {}", e))?,
                shoulders_cost: row.get(5).map_err(|e| format!("Column error: {}", e))?,
                direct_cost: row.get(6).map_err(|e| format!("Column error: {}", e))?,
            });
        }
        Ok(())
    };

    if let Some(ws) = workspace {
        let rows = stmt.query(params![month_prefix, ws]).map_err(|e| format!("Query failed: {}", e))?;
        process_rows(rows)?;
    } else {
        let rows = stmt.query(params![month_prefix]).map_err(|e| format!("Query failed: {}", e))?;
        process_rows(rows)?;
    }

    Ok(result)
}

#[tauri::command]
pub fn usage_query_monthly_trend(
    state: tauri::State<'_, UsageDbState>,
    count: i64,
    workspace: Option<String>,
) -> Result<Vec<TrendEntry>, String> {
    ensure_connection(&state)?;
    let guard = state.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("DB not initialized")?;

    let sql = if workspace.is_some() {
        "SELECT substr(timestamp, 1, 7) as month,
                COALESCE(SUM(cost), 0),
                COUNT(*),
                COALESCE(SUM(CASE WHEN provider = 'shoulders' THEN cost ELSE 0 END), 0)
         FROM usage_calls
         WHERE workspace = ?1
         GROUP BY month ORDER BY month DESC LIMIT ?2"
    } else {
        "SELECT substr(timestamp, 1, 7) as month,
                COALESCE(SUM(cost), 0),
                COUNT(*),
                COALESCE(SUM(CASE WHEN provider = 'shoulders' THEN cost ELSE 0 END), 0)
         FROM usage_calls
         GROUP BY month ORDER BY month DESC LIMIT ?1"
    };

    let mut stmt = conn.prepare(sql).map_err(|e| format!("Prepare failed: {}", e))?;
    let mut result = Vec::new();

    let mut process_rows = |rows: rusqlite::Rows<'_>| -> Result<(), String> {
        let mut rows = rows;
        while let Some(row) = rows.next().map_err(|e| format!("Row error: {}", e))? {
            result.push(TrendEntry {
                month: row.get(0).map_err(|e| format!("Column error: {}", e))?,
                cost: row.get(1).map_err(|e| format!("Column error: {}", e))?,
                calls: row.get(2).map_err(|e| format!("Column error: {}", e))?,
                shoulders_cost: row.get(3).map_err(|e| format!("Column error: {}", e))?,
            });
        }
        Ok(())
    };

    if let Some(ref ws) = workspace {
        let rows = stmt.query(params![ws, count]).map_err(|e| format!("Query failed: {}", e))?;
        process_rows(rows)?;
    } else {
        let rows = stmt.query(params![count]).map_err(|e| format!("Query failed: {}", e))?;
        process_rows(rows)?;
    }

    Ok(result)
}

#[derive(serde::Serialize)]
pub struct DailyEntry {
    pub date: String, // "YYYY-MM-DD"
    pub cost: f64,
    pub calls: i64,
    pub shoulders_cost: f64,
}

#[tauri::command]
pub fn usage_query_daily_trend(
    state: tauri::State<'_, UsageDbState>,
    month: String,
    workspace: Option<String>,
) -> Result<Vec<DailyEntry>, String> {
    ensure_connection(&state)?;
    let guard = state.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("DB not initialized")?;

    let month_prefix = format!("{}%", month);

    let sql = if workspace.is_some() {
        "SELECT substr(timestamp, 1, 10) as day,
                COALESCE(SUM(cost), 0),
                COUNT(*),
                COALESCE(SUM(CASE WHEN provider = 'shoulders' THEN cost ELSE 0 END), 0)
         FROM usage_calls
         WHERE timestamp LIKE ?1 AND workspace = ?2
         GROUP BY day ORDER BY day ASC"
    } else {
        "SELECT substr(timestamp, 1, 10) as day,
                COALESCE(SUM(cost), 0),
                COUNT(*),
                COALESCE(SUM(CASE WHEN provider = 'shoulders' THEN cost ELSE 0 END), 0)
         FROM usage_calls
         WHERE timestamp LIKE ?1
         GROUP BY day ORDER BY day ASC"
    };

    let mut stmt = conn.prepare(sql).map_err(|e| format!("Prepare failed: {}", e))?;
    let mut result = Vec::new();

    let mut process_rows = |rows: rusqlite::Rows<'_>| -> Result<(), String> {
        let mut rows = rows;
        while let Some(row) = rows.next().map_err(|e| format!("Row error: {}", e))? {
            result.push(DailyEntry {
                date: row.get(0).map_err(|e| format!("Column error: {}", e))?,
                cost: row.get(1).map_err(|e| format!("Column error: {}", e))?,
                calls: row.get(2).map_err(|e| format!("Column error: {}", e))?,
                shoulders_cost: row.get(3).map_err(|e| format!("Column error: {}", e))?,
            });
        }
        Ok(())
    };

    if let Some(ref ws) = workspace {
        let rows = stmt.query(params![month_prefix, ws]).map_err(|e| format!("Query failed: {}", e))?;
        process_rows(rows)?;
    } else {
        let rows = stmt.query(params![month_prefix]).map_err(|e| format!("Query failed: {}", e))?;
        process_rows(rows)?;
    }

    Ok(result)
}

#[tauri::command]
pub fn usage_get_setting(
    state: tauri::State<'_, UsageDbState>,
    key: String,
) -> Result<Option<String>, String> {
    ensure_connection(&state)?;
    let guard = state.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("DB not initialized")?;

    let result = conn.query_row(
        "SELECT value FROM usage_settings WHERE key = ?1",
        params![key],
        |row| row.get::<_, String>(0),
    );

    match result {
        Ok(val) => Ok(Some(val)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Failed to get setting: {}", e)),
    }
}

#[tauri::command]
pub fn usage_set_setting(
    state: tauri::State<'_, UsageDbState>,
    key: String,
    value: String,
) -> Result<(), String> {
    ensure_connection(&state)?;
    let guard = state.conn.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("DB not initialized")?;

    conn.execute(
        "INSERT OR REPLACE INTO usage_settings (key, value) VALUES (?1, ?2)",
        params![key, value],
    ).map_err(|e| format!("Failed to set setting: {}", e))?;

    Ok(())
}
