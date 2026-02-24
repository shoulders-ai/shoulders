use base64::{Engine, engine::general_purpose::STANDARD};
use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::process::Command;
use std::sync::Mutex;
use tauri::Emitter;

pub const ALLOWED_HOSTS: &[&str] = &[
    "api.anthropic.com",
    "api.openai.com",
    "generativelanguage.googleapis.com",
    "shoulde.rs",
    "api.github.com",
    "api.crossref.org",
    "api.exa.ai",
    "api.openalex.org",
];

pub fn validate_url_host(raw_url: &str) -> Result<(), String> {
    let parsed = url::Url::parse(raw_url)
        .map_err(|e| format!("Invalid URL: {}", e))?;
    let host = parsed.host_str()
        .ok_or_else(|| "URL has no host".to_string())?;

    // Allow localhost / 127.0.0.1 in debug builds only
    #[cfg(debug_assertions)]
    {
        if host == "localhost" || host == "127.0.0.1" {
            return Ok(());
        }
    }

    if ALLOWED_HOSTS.contains(&host) {
        Ok(())
    } else {
        Err(format!("URL host not in allowlist: {}", host))
    }
}

#[derive(Serialize, Clone)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileEntry>>,
}

pub struct WatcherState {
    pub watcher: Mutex<Option<RecommendedWatcher>>,
}

impl Default for WatcherState {
    fn default() -> Self {
        Self {
            watcher: Mutex::new(None),
        }
    }
}

fn build_file_tree(dir: &Path) -> Result<Vec<FileEntry>, String> {
    let mut entries = Vec::new();
    let read_dir = fs::read_dir(dir).map_err(|e| e.to_string())?;

    for entry in read_dir {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden directories, node_modules, target, .DS_Store
        if name.starts_with('.') && path.is_dir() {
            continue;
        }
        if name == "node_modules" || name == "target" || name == ".DS_Store" {
            continue;
        }

        let is_dir = path.is_dir();
        let children = if is_dir {
            Some(build_file_tree(&path)?)
        } else {
            None
        };

        entries.push(FileEntry {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir,
            children,
        });
    }

    // Sort: directories first, then alphabetical
    entries.sort_by(|a, b| {
        if a.is_dir == b.is_dir {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        } else if a.is_dir {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    Ok(entries)
}

#[tauri::command]
pub async fn read_dir_recursive(path: String) -> Result<Vec<FileEntry>, String> {
    build_file_tree(Path::new(&path))
}

#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn read_file_base64(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    Ok(STANDARD.encode(&bytes))
}

#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, &content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn write_file_base64(path: String, data: String) -> Result<(), String> {
    let bytes = STANDARD.decode(&data).map_err(|e| format!("Base64 decode error: {}", e))?;
    fs::write(&path, &bytes).map_err(|e| format!("Write error: {}", e))
}

#[tauri::command]
pub async fn create_file(path: String, content: String) -> Result<(), String> {
    if Path::new(&path).exists() {
        return Err("File already exists".to_string());
    }
    fs::write(&path, &content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_dir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rename_path(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_path(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.is_dir() {
        fs::remove_dir_all(p).map_err(|e| e.to_string())
    } else {
        fs::remove_file(p).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn copy_file(src: String, dest: String) -> Result<(), String> {
    fs::copy(&src, &dest).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn copy_dir(src: String, dest: String) -> Result<(), String> {
    let src = Path::new(&src);
    let dest = Path::new(&dest);
    copy_dir_recursive(src, dest).map_err(|e| e.to_string())
}

fn copy_dir_recursive(src: &Path, dest: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dest)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dest_path = dest.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dest_path)?;
        } else {
            fs::copy(&src_path, &dest_path)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn is_directory(path: String) -> Result<bool, String> {
    Ok(Path::new(&path).is_dir())
}

#[tauri::command]
pub async fn path_exists(path: String) -> Result<bool, String> {
    Ok(Path::new(&path).exists())
}

#[tauri::command]
pub async fn watch_directory(
    app: tauri::AppHandle,
    state: tauri::State<'_, WatcherState>,
    path: String,
) -> Result<(), String> {
    let app_clone = app.clone();

    let mut watcher = RecommendedWatcher::new(
        move |res: Result<Event, notify::Error>| {
            match res {
                Ok(event) => {
                    let paths: Vec<String> = event
                        .paths
                        .iter()
                        .map(|p| p.to_string_lossy().to_string())
                        .collect();
                    let _ = app_clone.emit(
                        "fs-change",
                        serde_json::json!({
                            "kind": format!("{:?}", event.kind),
                            "paths": paths,
                        }),
                    );
                }
                Err(e) => eprintln!("[fs-watch] error: {:?}", e),
            }
        },
        Config::default(),
    )
    .map_err(|e| e.to_string())?;

    watcher
        .watch(Path::new(&path), RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    *state.watcher.lock().unwrap() = Some(watcher);
    Ok(())
}

#[tauri::command]
pub async fn unwatch_directory(state: tauri::State<'_, WatcherState>) -> Result<(), String> {
    *state.watcher.lock().unwrap() = None;
    Ok(())
}

#[derive(Deserialize)]
pub struct ApiProxyRequest {
    pub url: String,
    pub method: String,
    pub headers: HashMap<String, String>,
    pub body: String,
}

#[tauri::command]
pub async fn proxy_api_call(request: ApiProxyRequest) -> Result<String, String> {
    validate_url_host(&request.url)?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let mut req = match request.method.as_str() {
        "POST" => client.post(&request.url),
        "GET" => client.get(&request.url),
        "PUT" => client.put(&request.url),
        _ => return Err(format!("Unsupported method: {}", request.method)),
    };

    for (key, value) in &request.headers {
        req = req.header(key.as_str(), value.as_str());
    }

    if !request.body.is_empty() {
        req = req.body(request.body);
    }

    let response = req.send().await.map_err(|e| e.to_string())?;
    let status = response.status().as_u16();
    let body = response.text().await.map_err(|e| e.to_string())?;

    if status >= 200 && status < 300 {
        Ok(body)
    } else {
        Err(format!("API error {}: {}", status, body))
    }
}

#[derive(Serialize, Clone)]
pub struct SearchResult {
    pub path: String,
    pub name: String,
    pub line: usize,
    pub text: String,
}

#[tauri::command]
pub async fn search_file_contents(dir: String, query: String, max_results: usize) -> Result<Vec<SearchResult>, String> {
    let query_lower = query.to_lowercase();
    let mut results = Vec::new();
    search_dir_contents(Path::new(&dir), &query_lower, &mut results, max_results)?;
    Ok(results)
}

#[tauri::command]
pub async fn run_shell_command(cwd: String, command: String) -> Result<String, String> {
    #[cfg(unix)]
    let output = Command::new("bash")
        .args(&["-c", &command])
        .current_dir(&cwd)
        .output()
        .map_err(|e| e.to_string())?;

    #[cfg(windows)]
    let output = Command::new("cmd")
        .args(&["/C", &command])
        .current_dir(&cwd)
        .output()
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    let mut result = stdout;
    if !stderr.is_empty() {
        result.push_str("\n--- stderr ---\n");
        result.push_str(&stderr);
    }

    // Truncate at 100KB
    if result.len() > 100_000 {
        result.truncate(100_000);
        result.push_str("\n... [truncated at 100KB]");
    }

    Ok(result)
}

fn search_dir_contents(dir: &Path, query: &str, results: &mut Vec<SearchResult>, max_results: usize) -> Result<(), String> {
    if results.len() >= max_results {
        return Ok(());
    }

    let read_dir = match fs::read_dir(dir) {
        Ok(d) => d,
        Err(_) => return Ok(()),
    };

    for entry in read_dir {
        if results.len() >= max_results {
            break;
        }
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden dirs, node_modules, target
        if name.starts_with('.') && path.is_dir() {
            continue;
        }
        if name == "node_modules" || name == "target" {
            continue;
        }

        if path.is_dir() {
            search_dir_contents(&path, query, results, max_results)?;
        } else if is_searchable_text(&name) {
            if let Ok(content) = fs::read_to_string(&path) {
                for (i, line) in content.lines().enumerate() {
                    if line.to_lowercase().contains(query) {
                        results.push(SearchResult {
                            path: path.to_string_lossy().to_string(),
                            name: name.clone(),
                            line: i + 1,
                            text: line.trim().to_string(),
                        });
                        if results.len() >= max_results {
                            break;
                        }
                    }
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn fetch_url_content(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&url)
        .header("User-Agent", "Shoulders/1.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = response.status().as_u16();
    if status < 200 || status >= 300 {
        return Err(format!("HTTP error {}", status));
    }

    let html = response.text().await.map_err(|e| e.to_string())?;
    let text = strip_html(&html);

    // Truncate at 50KB
    if text.len() > 50_000 {
        let mut t = text;
        t.truncate(50_000);
        t.push_str("\n... [truncated at 50KB]");
        Ok(t)
    } else {
        Ok(text)
    }
}

fn strip_html(html: &str) -> String {
    use regex_lite::Regex;

    // Remove <script> and <style> blocks
    let re_script = Regex::new(r"(?is)<script[\s>].*?</script>").unwrap();
    let text = re_script.replace_all(html, "");
    let re_style = Regex::new(r"(?is)<style[\s>].*?</style>").unwrap();
    let text = re_style.replace_all(&text, "");
    let re_nav = Regex::new(r"(?is)<(nav|header|footer)[\s>].*?</\1>").unwrap();
    let text = re_nav.replace_all(&text, "");

    // Strip all remaining HTML tags
    let re_tags = Regex::new(r"<[^>]+>").unwrap();
    let text = re_tags.replace_all(&text, "");

    // Decode common HTML entities
    let text = text
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&nbsp;", " ");

    // Collapse whitespace: multiple newlines → double newline, multiple spaces → single
    let re_newlines = Regex::new(r"\n{3,}").unwrap();
    let text = re_newlines.replace_all(&text, "\n\n");
    let re_spaces = Regex::new(r"[ \t]{2,}").unwrap();
    let text = re_spaces.replace_all(&text, " ");

    text.trim().to_string()
}

#[tauri::command]
pub async fn get_global_config_dir() -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let dir = home.join(".shoulders");
    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(dir.to_string_lossy().to_string())
}

fn is_searchable_text(name: &str) -> bool {
    let name_lower = name.to_lowercase();
    let extensions = [
        ".md", ".txt", ".js", ".ts", ".jsx", ".tsx", ".py", ".r", ".rs",
        ".json", ".yaml", ".yml", ".toml", ".html", ".css", ".tex", ".bib",
        ".sh", ".sql", ".rmd", ".xml", ".vue", ".svelte", ".go", ".java",
        ".c", ".cpp", ".h", ".hpp", ".rb", ".php", ".swift", ".kt",
        ".lua", ".zig", ".env", ".csv", ".tsv", ".ini", ".cfg", ".conf",
    ];
    extensions.iter().any(|ext| name_lower.ends_with(ext))
}
