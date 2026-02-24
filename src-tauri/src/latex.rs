use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use tauri::Emitter;

pub struct LatexState {
    pub enabled: Mutex<bool>,
    pub compiling: Mutex<HashMap<String, bool>>,
}

impl Default for LatexState {
    fn default() -> Self {
        Self {
            enabled: Mutex::new(true),
            compiling: Mutex::new(HashMap::new()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatexError {
    pub line: Option<u32>,
    pub message: String,
    pub severity: String, // "error" or "warning"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompileResult {
    pub success: bool,
    pub pdf_path: Option<String>,
    pub synctex_path: Option<String>,
    pub errors: Vec<LatexError>,
    pub warnings: Vec<LatexError>,
    pub log: String,
    pub duration_ms: u64,
}

fn shoulders_bin_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".shoulders").join("bin"))
}

fn tectonic_binary_name() -> &'static str {
    if cfg!(target_os = "windows") { "tectonic.exe" } else { "tectonic" }
}

fn find_tectonic(_app: &tauri::AppHandle) -> Option<String> {
    // 1. Shoulders-managed install (~/.shoulders/bin/tectonic)
    if let Some(bin_dir) = shoulders_bin_dir() {
        let path = bin_dir.join(tectonic_binary_name());
        if path.exists() {
            return Some(path.to_string_lossy().to_string());
        }
    }

    // 2. Common system install locations
    #[cfg(unix)]
    {
        let candidates = [
            "/opt/homebrew/bin/tectonic",
            "/usr/local/bin/tectonic",
            "/usr/bin/tectonic",
        ];
        for path in &candidates {
            if Path::new(path).exists() {
                return Some(path.to_string());
            }
        }
        if let Ok(home) = std::env::var("HOME") {
            let cargo_path = format!("{home}/.cargo/bin/tectonic");
            if Path::new(&cargo_path).exists() {
                return Some(cargo_path);
            }
        }
    }

    // 3. Shell lookup fallback
    #[cfg(unix)]
    {
        let output = Command::new("/bin/bash")
            .args(&["-lc", "which tectonic"])
            .output()
            .ok()?;
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Some(path);
            }
        }
    }
    #[cfg(windows)]
    {
        let output = Command::new("where")
            .arg("tectonic")
            .output()
            .ok()?;
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout)
                .lines().next()?.trim().to_string();
            if !path.is_empty() {
                return Some(path);
            }
        }
    }

    None
}

fn parse_tectonic_output(output: &str) -> (Vec<LatexError>, Vec<LatexError>) {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    for line in output.lines() {
        let trimmed = line.trim();

        // Tectonic error format: "error: ..." or specific TeX errors
        if trimmed.starts_with("error:") {
            let msg = trimmed.strip_prefix("error:").unwrap_or(trimmed).trim();
            let (line_num, message) = extract_line_number(msg);
            errors.push(LatexError {
                line: line_num,
                message: message.to_string(),
                severity: "error".to_string(),
            });
        } else if trimmed.starts_with("warning:") {
            let msg = trimmed.strip_prefix("warning:").unwrap_or(trimmed).trim();
            let (line_num, message) = extract_line_number(msg);
            warnings.push(LatexError {
                line: line_num,
                message: message.to_string(),
                severity: "warning".to_string(),
            });
        }
        // TeX error format: "! Undefined control sequence." or "! Missing $ inserted."
        else if trimmed.starts_with('!') {
            let msg = trimmed.strip_prefix('!').unwrap_or(trimmed).trim();
            errors.push(LatexError {
                line: None,
                message: msg.to_string(),
                severity: "error".to_string(),
            });
        }
        // Line number format: "l.42 ..."
        else if trimmed.starts_with("l.") {
            if let Some(num_str) = trimmed.strip_prefix("l.") {
                let parts: Vec<&str> = num_str.splitn(2, ' ').collect();
                if let Ok(line_num) = parts[0].parse::<u32>() {
                    // Attach line number to the last error without one
                    if let Some(last) = errors.last_mut() {
                        if last.line.is_none() {
                            last.line = Some(line_num);
                        }
                    }
                }
            }
        }
    }

    (errors, warnings)
}

fn extract_line_number(msg: &str) -> (Option<u32>, &str) {
    // Try to extract "on line 42" or "line 42" patterns
    if let Some(idx) = msg.find("line ") {
        let after = &msg[idx + 5..];
        let num_str: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
        if let Ok(n) = num_str.parse::<u32>() {
            return (Some(n), msg);
        }
    }
    (None, msg)
}

#[tauri::command]
pub async fn compile_latex(
    app: tauri::AppHandle,
    state: tauri::State<'_, LatexState>,
    tex_path: String,
) -> Result<CompileResult, String> {
    // Check if enabled
    {
        let enabled = state.enabled.lock().unwrap();
        if !*enabled {
            return Err("Tectonic is disabled. Enable it in Settings.".to_string());
        }
    }

    // Check if already compiling this file
    {
        let mut compiling = state.compiling.lock().unwrap();
        if *compiling.get(&tex_path).unwrap_or(&false) {
            return Err("Compilation already in progress for this file.".to_string());
        }
        compiling.insert(tex_path.clone(), true);
    }

    let start = std::time::Instant::now();

    let result = (|| -> Result<CompileResult, String> {
        let tectonic_path = find_tectonic(&app)
            .ok_or_else(|| "Tectonic not found. Install it or check Settings.".to_string())?;
        eprintln!("[latex] Using tectonic at: {}", tectonic_path);

        let tex = Path::new(&tex_path);
        let dir = tex.parent().ok_or("Invalid tex path")?;
        eprintln!("[latex] Compiling: {} in dir: {}", tex_path, dir.display());

        let output = Command::new(&tectonic_path)
            .args(&[
                "-X", "compile",
                "--synctex",
                "--keep-logs",
                &tex_path,
            ])
            .current_dir(dir)
            .output()
            .map_err(|e| format!("Failed to run tectonic: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let full_log = format!("{}\n{}", stdout, stderr);
        eprintln!("[latex] exit status: {}", output.status);
        eprintln!("[latex] stdout: {}", stdout);
        eprintln!("[latex] stderr: {}", stderr);

        let (errors, warnings) = parse_tectonic_output(&full_log);

        let stem = tex.file_stem().unwrap_or_default().to_string_lossy();
        let pdf_path = dir.join(format!("{}.pdf", stem));
        let synctex_path = dir.join(format!("{}.synctex.gz", stem));
        eprintln!("[latex] PDF expected at: {} exists: {}", pdf_path.display(), pdf_path.exists());

        let success = output.status.success() && pdf_path.exists();
        let duration_ms = start.elapsed().as_millis() as u64;

        Ok(CompileResult {
            success,
            pdf_path: if pdf_path.exists() {
                Some(pdf_path.to_string_lossy().to_string())
            } else {
                None
            },
            synctex_path: if synctex_path.exists() {
                Some(synctex_path.to_string_lossy().to_string())
            } else {
                None
            },
            errors,
            warnings,
            log: full_log,
            duration_ms,
        })
    })();

    // Clear compiling flag
    {
        let mut compiling = state.compiling.lock().unwrap();
        compiling.remove(&tex_path);
    }

    result
}

#[tauri::command]
pub async fn set_tectonic_enabled(
    state: tauri::State<'_, LatexState>,
    enabled: bool,
) -> Result<(), String> {
    let mut flag = state.enabled.lock().unwrap();
    *flag = enabled;
    Ok(())
}

#[tauri::command]
pub async fn is_tectonic_enabled(
    state: tauri::State<'_, LatexState>,
) -> Result<bool, String> {
    let flag = state.enabled.lock().unwrap();
    Ok(*flag)
}

#[derive(Debug, Clone, Serialize)]
pub struct TectonicStatus {
    pub installed: bool,
    pub path: Option<String>,
}

#[tauri::command]
pub async fn check_tectonic(
    app: tauri::AppHandle,
) -> Result<TectonicStatus, String> {
    match find_tectonic(&app) {
        Some(path) => Ok(TectonicStatus { installed: true, path: Some(path) }),
        None => Ok(TectonicStatus { installed: false, path: None }),
    }
}

const TECTONIC_VERSION: &str = "0.15.0";

fn tectonic_download_url() -> Result<(String, bool), String> {
    let base = format!(
        "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40{}/tectonic-{}",
        TECTONIC_VERSION, TECTONIC_VERSION
    );

    let arch = if cfg!(target_arch = "aarch64") { "aarch64" }
               else if cfg!(target_arch = "x86_64") { "x86_64" }
               else { return Err("Unsupported architecture".to_string()) };

    if cfg!(target_os = "macos") {
        Ok((format!("{}-{}-apple-darwin.tar.gz", base, arch), false))
    } else if cfg!(target_os = "linux") {
        // Use musl build for static linking (no glibc dependency)
        Ok((format!("{}-{}-unknown-linux-musl.tar.gz", base, arch), false))
    } else if cfg!(target_os = "windows") {
        Ok((format!("{}-{}-pc-windows-msvc.zip", base, arch), true))
    } else {
        Err("Unsupported platform".to_string())
    }
}

#[tauri::command]
pub async fn download_tectonic(
    app: tauri::AppHandle,
) -> Result<String, String> {
    let bin_dir = shoulders_bin_dir()
        .ok_or_else(|| "Cannot determine home directory".to_string())?;
    std::fs::create_dir_all(&bin_dir)
        .map_err(|e| format!("Cannot create directory: {}", e))?;

    let (url, is_zip) = tectonic_download_url()?;
    eprintln!("[tectonic] Downloading from: {}", url);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let response = client
        .get(&url)
        .header("User-Agent", "Shoulders/1.0")
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed with HTTP {}", response.status()));
    }

    let total_bytes = response.content_length().unwrap_or(0);
    let total_mb = total_bytes as f64 / 1_048_576.0;

    // Stream download to temp file
    let archive_ext = if is_zip { "zip" } else { "tar.gz" };
    let archive_path = bin_dir.join(format!("tectonic-download.{}", archive_ext));
    let mut file = std::fs::File::create(&archive_path)
        .map_err(|e| format!("Cannot create temp file: {}", e))?;

    let mut downloaded: u64 = 0;
    let mut last_pct: u32 = 0;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("Write error: {}", e))?;
        downloaded += chunk.len() as u64;

        let pct = if total_bytes > 0 {
            ((downloaded as f64 / total_bytes as f64) * 100.0) as u32
        } else {
            0
        };

        // Emit progress every 1%
        if pct != last_pct {
            last_pct = pct;
            let _ = app.emit(
                "tectonic-download-progress",
                serde_json::json!({
                    "percent": pct,
                    "downloaded_mb": format!("{:.1}", downloaded as f64 / 1_048_576.0),
                    "total_mb": format!("{:.1}", total_mb),
                }),
            );
        }
    }

    drop(file);
    eprintln!("[tectonic] Download complete: {} bytes", downloaded);

    // Extract binary
    let binary_name = tectonic_binary_name();
    let dest_path = bin_dir.join(binary_name);

    if is_zip {
        // Windows: use PowerShell to extract
        #[cfg(windows)]
        {
            let status = Command::new("powershell")
                .args(&[
                    "-NoProfile", "-Command",
                    &format!(
                        "Expand-Archive -Path '{}' -DestinationPath '{}' -Force",
                        archive_path.display(),
                        bin_dir.display(),
                    ),
                ])
                .status()
                .map_err(|e| format!("Extract failed: {}", e))?;
            if !status.success() {
                return Err("Failed to extract zip archive".to_string());
            }
        }
        #[cfg(not(windows))]
        {
            return Err("Zip extraction not supported on this platform".to_string());
        }
    } else {
        // Unix: use tar to extract
        let status = Command::new("tar")
            .args(&["xzf", &archive_path.to_string_lossy(), "-C", &bin_dir.to_string_lossy()])
            .status()
            .map_err(|e| format!("Extract failed: {}", e))?;
        if !status.success() {
            return Err("Failed to extract tar.gz archive".to_string());
        }
    }

    // Clean up archive
    let _ = std::fs::remove_file(&archive_path);

    // Verify binary exists
    if !dest_path.exists() {
        return Err(format!("Binary not found after extraction at {}", dest_path.display()));
    }

    // Set executable permission on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&dest_path, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| format!("Failed to set permissions: {}", e))?;
    }

    let result = dest_path.to_string_lossy().to_string();
    eprintln!("[tectonic] Installed to: {}", result);

    // Emit 100% done
    let _ = app.emit(
        "tectonic-download-progress",
        serde_json::json!({ "percent": 100, "downloaded_mb": format!("{:.1}", total_mb), "total_mb": format!("{:.1}", total_mb) }),
    );

    Ok(result)
}

#[tauri::command]
pub async fn synctex_forward(
    synctex_path: String,
    tex_path: String,
    line: u32,
) -> Result<serde_json::Value, String> {
    let synctex = Path::new(&synctex_path);
    if !synctex.exists() {
        return Err("SyncTeX file not found. Recompile with SyncTeX enabled.".to_string());
    }

    let data = parse_synctex_gz(&synctex_path)?;
    forward_sync(&data, &tex_path, line)
}

#[tauri::command]
pub async fn synctex_backward(
    synctex_path: String,
    page: u32,
    x: f64,
    y: f64,
) -> Result<serde_json::Value, String> {
    let synctex = Path::new(&synctex_path);
    if !synctex.exists() {
        return Err("SyncTeX file not found. Recompile with SyncTeX enabled.".to_string());
    }

    let data = parse_synctex_gz(&synctex_path)?;
    backward_sync(&data, page, x, y)
}

// --- SyncTeX parser ---

#[derive(Debug)]
#[allow(dead_code)]
struct SyncNode {
    file: String,
    line: u32,
    page: u32,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

fn parse_synctex_gz(path: &str) -> Result<Vec<SyncNode>, String> {
    use std::io::Read;

    let file = std::fs::File::open(path).map_err(|e| format!("Cannot open synctex: {}", e))?;
    let mut decoder = flate2::read::GzDecoder::new(file);
    let mut content = String::new();
    decoder
        .read_to_string(&mut content)
        .map_err(|e| format!("Cannot decompress synctex: {}", e))?;

    let mut nodes = Vec::new();
    let mut inputs: HashMap<u32, String> = HashMap::new();
    let mut current_page: u32 = 0;

    for line in content.lines() {
        if line.starts_with("Input:") {
            // Input:1:/path/to/file.tex
            let rest = &line[6..];
            if let Some(colon) = rest.find(':') {
                if let Ok(id) = rest[..colon].parse::<u32>() {
                    inputs.insert(id, rest[colon + 1..].to_string());
                }
            }
        } else if line.starts_with('{') {
            // {page_num
            if let Ok(p) = line[1..].trim().parse::<u32>() {
                current_page = p;
            }
        } else if line.starts_with('h') || line.starts_with('v') || line.starts_with('x') {
            // h/v/x records: type input_id:line:col:x:y:W:H:D
            let parts: Vec<&str> = line[1..].split(':').collect();
            if parts.len() >= 7 {
                let input_id = parts[0].parse::<u32>().unwrap_or(0);
                let ln = parts[1].parse::<u32>().unwrap_or(0);
                let x = parts[3].parse::<f64>().unwrap_or(0.0);
                let y = parts[4].parse::<f64>().unwrap_or(0.0);
                let w = parts[5].parse::<f64>().unwrap_or(0.0);
                let h = parts[6].parse::<f64>().unwrap_or(0.0);

                if let Some(file) = inputs.get(&input_id) {
                    nodes.push(SyncNode {
                        file: file.clone(),
                        line: ln,
                        page: current_page,
                        x,
                        y,
                        width: w,
                        height: h,
                    });
                }
            }
        }
    }

    Ok(nodes)
}

fn forward_sync(
    nodes: &[SyncNode],
    tex_path: &str,
    line: u32,
) -> Result<serde_json::Value, String> {
    // Find the node closest to the given line in the given file
    let tex_canonical = std::fs::canonicalize(tex_path)
        .unwrap_or_else(|_| Path::new(tex_path).to_path_buf());

    let mut best: Option<&SyncNode> = None;
    let mut best_dist: u32 = u32::MAX;

    for node in nodes {
        let node_path = std::fs::canonicalize(&node.file)
            .unwrap_or_else(|_| Path::new(&node.file).to_path_buf());

        if node_path == tex_canonical {
            let dist = if node.line >= line {
                node.line - line
            } else {
                line - node.line
            };
            if dist < best_dist {
                best_dist = dist;
                best = Some(node);
            }
        }
    }

    match best {
        Some(node) => Ok(serde_json::json!({
            "page": node.page,
            "x": node.x,
            "y": node.y,
        })),
        None => Err("No SyncTeX match found for this line.".to_string()),
    }
}

fn backward_sync(
    nodes: &[SyncNode],
    page: u32,
    x: f64,
    y: f64,
) -> Result<serde_json::Value, String> {
    // Find the node on the given page closest to (x, y)
    let mut best: Option<&SyncNode> = None;
    let mut best_dist: f64 = f64::MAX;

    for node in nodes {
        if node.page == page {
            let dx = node.x - x;
            let dy = node.y - y;
            let dist = (dx * dx + dy * dy).sqrt();
            if dist < best_dist {
                best_dist = dist;
                best = Some(node);
            }
        }
    }

    match best {
        Some(node) => Ok(serde_json::json!({
            "file": node.file,
            "line": node.line,
        })),
        None => Err("No SyncTeX match found at this position.".to_string()),
    }
}
