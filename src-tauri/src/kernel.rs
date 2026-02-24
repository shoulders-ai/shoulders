use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::Emitter;
use zeromq::Socket;

/// Cross-platform home directory.
fn get_home_dir() -> String {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_default()
}

// ====== State ======

pub struct KernelInstance {
    pub _spec_name: String,
    pub process: Option<std::process::Child>,
    pub connection_file: PathBuf,
    pub cancel_tx: tokio::sync::watch::Sender<bool>,
}

pub struct KernelState {
    pub kernels: Mutex<HashMap<String, KernelInstance>>,
}

impl Default for KernelState {
    fn default() -> Self {
        Self {
            kernels: Mutex::new(HashMap::new()),
        }
    }
}

// ====== Data types ======

#[derive(Serialize, Clone)]
pub struct KernelSpec {
    pub name: String,
    pub display_name: String,
    pub language: String,
    pub path: String,
}

#[derive(Deserialize)]
struct KernelSpecJson {
    display_name: Option<String>,
    language: Option<String>,
    argv: Option<Vec<String>>,
}

#[derive(Deserialize, Serialize, Clone)]
struct ConnectionInfo {
    ip: String,
    transport: String,
    shell_port: u16,
    iopub_port: u16,
    stdin_port: u16,
    control_port: u16,
    hb_port: u16,
    key: String,
    signature_scheme: String,
}

// ====== Jupyter message protocol (simplified) ======

#[derive(Serialize, Clone)]
struct JupyterHeader {
    msg_id: String,
    session: String,
    username: String,
    date: String,
    msg_type: String,
    version: String,
}

impl JupyterHeader {
    fn new(msg_type: &str, session: &str) -> Self {
        Self {
            msg_id: uuid::Uuid::new_v4().to_string(),
            session: session.to_string(),
            username: "shoulders".to_string(),
            date: chrono::Utc::now().to_rfc3339(),
            msg_type: msg_type.to_string(),
            version: "5.3".to_string(),
        }
    }
}

fn create_message(
    msg_type: &str,
    session: &str,
    content: serde_json::Value,
    key: &str,
) -> Vec<Vec<u8>> {
    let header = JupyterHeader::new(msg_type, session);
    let header_bytes = serde_json::to_vec(&header).unwrap();
    let parent_bytes = b"{}".to_vec();
    let metadata_bytes = b"{}".to_vec();
    let content_bytes = serde_json::to_vec(&content).unwrap();

    // HMAC signature
    let signature = if key.is_empty() {
        String::new()
    } else {
        use hmac::{Hmac, Mac};
        use sha2::Sha256;
        type HmacSha256 = Hmac<Sha256>;
        let mut mac = HmacSha256::new_from_slice(key.as_bytes()).unwrap();
        mac.update(&header_bytes);
        mac.update(&parent_bytes);
        mac.update(&metadata_bytes);
        mac.update(&content_bytes);
        hex::encode(mac.finalize().into_bytes())
    };

    vec![
        b"<IDS|MSG>".to_vec(),
        signature.into_bytes(),
        header_bytes,
        parent_bytes,
        metadata_bytes,
        content_bytes,
    ]
}

fn parse_message(frames: &[Vec<u8>]) -> Option<(serde_json::Value, serde_json::Value, String)> {
    // Find delimiter
    let delim_pos = frames.iter().position(|f| f == b"<IDS|MSG>")?;
    // After delimiter: signature, header, parent, metadata, content
    if frames.len() < delim_pos + 6 {
        return None;
    }
    let header: serde_json::Value = serde_json::from_slice(&frames[delim_pos + 2]).ok()?;
    let parent: serde_json::Value = serde_json::from_slice(&frames[delim_pos + 3]).ok()?;
    let content: serde_json::Value = serde_json::from_slice(&frames[delim_pos + 5]).ok()?;
    let msg_type = header.get("msg_type")?.as_str()?.to_string();
    Some((content, parent, msg_type))
}

// ====== Commands ======

#[tauri::command]
pub fn kernel_discover() -> Result<Vec<KernelSpec>, String> {
    let mut specs = Vec::new();

    // Primary: use `jupyter kernelspec list --json` — most reliable, uses Jupyter's
    // own discovery which handles all data paths including user-local Python installs
    if let Ok(output) = std::process::Command::new("jupyter")
        .args(["kernelspec", "list", "--json"])
        .output()
    {
        if output.status.success() {
            let json_str = String::from_utf8_lossy(&output.stdout);
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&json_str) {
                if let Some(kernelspecs) = json.get("kernelspecs").and_then(|v| v.as_object()) {
                    for (name, info) in kernelspecs {
                        let resource_dir = info.get("resource_dir")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        let spec = info.get("spec");
                        let display_name = spec
                            .and_then(|s| s.get("display_name"))
                            .and_then(|v| v.as_str())
                            .unwrap_or(name)
                            .to_string();
                        let language = spec
                            .and_then(|s| s.get("language"))
                            .and_then(|v| v.as_str())
                            .unwrap_or(name)
                            .to_string();

                        specs.push(KernelSpec {
                            name: name.clone(),
                            display_name,
                            language,
                            path: resource_dir,
                        });
                    }
                }
            }
        }
    }

    // Fallback: scan standard directories if jupyter command wasn't available
    if specs.is_empty() {
        let home = get_home_dir();
        #[allow(unused_mut)]
        let mut search_paths = vec![
            format!("{}/Library/Jupyter/kernels", home),
            format!("{}/Library/Python/3.9/share/jupyter/kernels", home),
            format!("{}/Library/Python/3.10/share/jupyter/kernels", home),
            format!("{}/Library/Python/3.11/share/jupyter/kernels", home),
            format!("{}/Library/Python/3.12/share/jupyter/kernels", home),
            format!("{}/Library/Python/3.13/share/jupyter/kernels", home),
            format!("{}/.local/share/jupyter/kernels", home),
            "/usr/local/share/jupyter/kernels".to_string(),
            "/usr/share/jupyter/kernels".to_string(),
            format!("{}/miniconda3/share/jupyter/kernels", home),
            format!("{}/anaconda3/share/jupyter/kernels", home),
            format!("{}/miniforge3/share/jupyter/kernels", home),
        ];

        #[cfg(target_os = "windows")]
        {
            if let Ok(appdata) = std::env::var("APPDATA") {
                search_paths.push(format!("{}\\jupyter\\kernels", appdata));
            }
            if let Ok(pd) = std::env::var("ProgramData") {
                search_paths.push(format!("{}\\jupyter\\kernels", pd));
            }
        }

        for search_path in &search_paths {
            let path = Path::new(search_path);
            if !path.is_dir() {
                continue;
            }
            if let Ok(entries) = std::fs::read_dir(path) {
                for entry in entries.flatten() {
                    if let Some(spec) = read_kernelspec(&entry.path()) {
                        if !specs.iter().any(|s| s.name == spec.name) {
                            specs.push(spec);
                        }
                    }
                }
            }
        }
    }

    Ok(specs)
}

fn read_kernelspec(dir: &Path) -> Option<KernelSpec> {
    let kernel_json = dir.join("kernel.json");
    let content = std::fs::read_to_string(&kernel_json).ok()?;
    let spec: KernelSpecJson = serde_json::from_str(&content).ok()?;
    let name = dir.file_name()?.to_str()?.to_string();

    Some(KernelSpec {
        display_name: spec.display_name.unwrap_or_else(|| name.clone()),
        language: spec.language.unwrap_or_else(|| name.clone()),
        path: dir.to_str()?.to_string(),
        name,
    })
}

/// Check if a Python binary has ipykernel installed.
fn has_ipykernel(python: &str) -> bool {
    std::process::Command::new(python)
        .args(["-m", "ipykernel_launcher", "--version"])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Find a Python interpreter that has ipykernel installed.
/// Probes in priority order: bare command, pyenv, conda, homebrew, system, user-local.
fn find_python_with_ipykernel(bare_cmd: &str) -> Result<String, String> {
    let home = get_home_dir();

    // 1. Bare command as-is (from kernel.json) — already on PATH
    if has_ipykernel(bare_cmd) {
        return Ok(bare_cmd.to_string());
    }
    eprintln!("[kernel] Bare '{}' lacks ipykernel, probing alternatives...", bare_cmd);

    let mut candidates: Vec<String> = Vec::new();

    // 2. pyenv shims
    let pyenv_root = std::env::var("PYENV_ROOT")
        .unwrap_or_else(|_| format!("{}/.pyenv", home));
    candidates.push(format!("{}/shims/python3", pyenv_root));
    candidates.push(format!("{}/shims/python", pyenv_root));

    // 3. conda / miniconda / miniforge / mambaforge
    if let Ok(prefix) = std::env::var("CONDA_PREFIX") {
        candidates.push(format!("{}/bin/python3", prefix));
        candidates.push(format!("{}/bin/python", prefix));
    }
    for dir in &["miniconda3", "miniforge3", "mambaforge", "anaconda3"] {
        candidates.push(format!("{}/{}/bin/python3", home, dir));
    }

    // 4. Homebrew (macOS)
    candidates.push("/opt/homebrew/bin/python3".to_string());
    candidates.push("/usr/local/bin/python3".to_string());

    // 5. macOS per-version (~/Library/Python and /Library/Frameworks)
    for minor in (9..=15).rev() {
        candidates.push(format!(
            "{}/Library/Python/3.{}/bin/python3",
            home, minor
        ));
        candidates.push(format!(
            "/Library/Frameworks/Python.framework/Versions/3.{}/bin/python3",
            minor
        ));
    }

    // 6. System Python
    candidates.push("/usr/bin/python3".to_string());
    candidates.push("/usr/bin/python".to_string());

    // 7. Linux per-version
    for minor in (8..=14).rev() {
        candidates.push(format!("/usr/bin/python3.{}", minor));
    }

    // 8. User-local (Unix)
    candidates.push(format!("{}/.local/bin/python3", home));

    // 9. Windows-specific paths
    #[cfg(target_os = "windows")]
    {
        candidates.push("py".to_string());
        candidates.push("py -3".to_string());
        for minor in (8..=14).rev() {
            candidates.push(format!("{}\\AppData\\Local\\Programs\\Python\\Python3{}\\python.exe", home, minor));
            candidates.push(format!("C:\\Python3{}\\python.exe", minor));
        }
        for dir in &["miniconda3", "miniforge3", "Anaconda3"] {
            candidates.push(format!("{}\\{}\\python.exe", home, dir));
        }
        candidates.push(format!("{}\\scoop\\apps\\python\\current\\python.exe", home));
    }

    // Probe each candidate: exists check first (cheap), then ipykernel check
    for candidate in &candidates {
        let path = Path::new(candidate);
        if !path.exists() {
            continue;
        }
        if has_ipykernel(candidate) {
            return Ok(candidate.clone());
        }
    }

    Err(
        "Could not find a Python interpreter with ipykernel installed.\n\
         Install it with: pip3 install ipykernel\n\
         Then restart or click Re-check in the notebook toolbar."
            .to_string(),
    )
}

/// Get the Jupyter runtime directory (cross-platform).
fn jupyter_runtime_dir() -> PathBuf {
    let home = get_home_dir();

    // Windows
    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            return PathBuf::from(format!("{}\\jupyter\\runtime", appdata));
        }
        return PathBuf::from(format!("{}\\AppData\\Roaming\\jupyter\\runtime", home));
    }

    // Linux: prefer XDG_RUNTIME_DIR/jupyter
    #[cfg(target_os = "linux")]
    {
        if let Ok(xdg) = std::env::var("XDG_RUNTIME_DIR") {
            return PathBuf::from(format!("{}/jupyter", xdg));
        }
        return PathBuf::from(format!("{}/.local/share/jupyter/runtime", home));
    }

    // macOS (and fallback)
    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
    {
        PathBuf::from(format!("{}/Library/Jupyter/runtime", home))
    }
}

fn find_free_port() -> u16 {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    listener.local_addr().unwrap().port()
}

#[tauri::command]
pub async fn kernel_launch(
    app: tauri::AppHandle,
    state: tauri::State<'_, KernelState>,
    spec_name: String,
    spec_path: String,
) -> Result<String, String> {
    // Read kernel.json to get argv
    let kernel_json_path = format!("{}/kernel.json", spec_path);
    let kernel_json_content = std::fs::read_to_string(&kernel_json_path)
        .map_err(|e| format!("Failed to read kernel.json: {}", e))?;
    let spec: KernelSpecJson = serde_json::from_str(&kernel_json_content)
        .map_err(|e| format!("Failed to parse kernel.json: {}", e))?;

    let mut argv = spec.argv.ok_or("kernel.json missing 'argv'")?;

    // Resolve bare python/python3 to the correct interpreter with ipykernel.
    // kernel.json often uses bare "python" or "python3" which may resolve to a
    // different Python than the one that installed ipykernel (e.g. Homebrew vs system).
    if !argv.is_empty() {
        let cmd = &argv[0];
        let is_bare_python = cmd == "python" || cmd == "python3"
            || cmd.starts_with("python3.");
        if is_bare_python {
            match find_python_with_ipykernel(cmd) {
                Ok(resolved) => {
                    if resolved != *cmd {
                        eprintln!("[kernel] Resolved '{}' → '{}' (has ipykernel)", cmd, resolved);
                    }
                    argv[0] = resolved;
                }
                Err(msg) => {
                    return Err(msg);
                }
            }
        }
    }

    // Generate connection file
    let kernel_id = uuid::Uuid::new_v4().to_string();
    let connection_info = ConnectionInfo {
        ip: "127.0.0.1".to_string(),
        transport: "tcp".to_string(),
        shell_port: find_free_port(),
        iopub_port: find_free_port(),
        stdin_port: find_free_port(),
        control_port: find_free_port(),
        hb_port: find_free_port(),
        key: uuid::Uuid::new_v4().to_string().replace("-", ""),
        signature_scheme: "hmac-sha256".to_string(),
    };

    let runtime_dir = jupyter_runtime_dir();
    std::fs::create_dir_all(&runtime_dir).ok();
    let conn_file_path = runtime_dir.join(format!("kernel-{}.json", kernel_id));
    let conn_json = serde_json::to_string_pretty(&connection_info)
        .map_err(|e| format!("Failed to serialize connection info: {}", e))?;
    std::fs::write(&conn_file_path, &conn_json)
        .map_err(|e| format!("Failed to write connection file: {}", e))?;

    // Substitute {connection_file} in argv
    let conn_file_str = conn_file_path.to_str().unwrap().to_string();
    let actual_argv: Vec<String> = argv
        .iter()
        .map(|a| a.replace("{connection_file}", &conn_file_str))
        .collect();

    // Spawn kernel process
    eprintln!("[kernel] Launching: {:?}", actual_argv);
    eprintln!("[kernel] Connection file: {}", conn_file_str);
    let child = std::process::Command::new(&actual_argv[0])
        .args(&actual_argv[1..])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn kernel: {}", e))?;

    let (cancel_tx, cancel_rx) = tokio::sync::watch::channel(false);

    {
        let mut kernels = state.kernels.lock().unwrap();
        kernels.insert(
            kernel_id.clone(),
            KernelInstance {
                _spec_name: spec_name.clone(),
                process: Some(child),
                connection_file: conn_file_path.clone(),
                cancel_tx,
            },
        );
    }

    // Wait a moment for kernel to start, then verify it's alive
    tokio::time::sleep(tokio::time::Duration::from_millis(1500)).await;
    {
        let mut kernels = state.kernels.lock().unwrap();
        if let Some(instance) = kernels.get_mut(&kernel_id) {
            if let Some(ref mut child) = instance.process {
                match child.try_wait() {
                    Ok(Some(status)) => {
                        eprintln!("[kernel] Process exited early with status: {}", status);
                        let mut stderr_text = String::new();
                        if let Some(mut stderr) = child.stderr.take() {
                            use std::io::Read;
                            let _ = stderr.read_to_string(&mut stderr_text);
                            if !stderr_text.is_empty() {
                                eprintln!("[kernel] stderr: {}", &stderr_text[..stderr_text.len().min(2000)]);
                            }
                        }
                        // Parse stderr for actionable hints
                        let hint = if stderr_text.contains("No module named") {
                            "\nHint: A required Python module is missing. Try: pip3 install ipykernel"
                        } else if stderr_text.contains("Permission denied") {
                            "\nHint: Permission denied. Check file permissions or try running with appropriate access."
                        } else if stderr_text.contains("SyntaxError") {
                            "\nHint: Python version mismatch. The kernel may need a different Python version."
                        } else {
                            ""
                        };
                        return Err(format!(
                            "Kernel process exited with status: {}.{}{}",
                            status,
                            if stderr_text.is_empty() { String::new() } else { format!("\n{}", &stderr_text[..stderr_text.len().min(500)]) },
                            hint,
                        ));
                    }
                    Ok(None) => eprintln!("[kernel] Process alive (pid={})", child.id()),
                    Err(e) => eprintln!("[kernel] Could not check process: {}", e),
                }
            }
        }
    }

    // Start IOPub listener in background
    let kid = kernel_id.clone();
    let conn = connection_info.clone();
    let app_clone = app.clone();
    tokio::spawn(async move {
        iopub_listener(app_clone, kid, conn, cancel_rx).await;
    });

    Ok(kernel_id)
}

async fn iopub_listener(
    app: tauri::AppHandle,
    kernel_id: String,
    conn: ConnectionInfo,
    mut cancel_rx: tokio::sync::watch::Receiver<bool>,
) {
    let addr = format!("{}://{}:{}", conn.transport, conn.ip, conn.iopub_port);
    eprintln!("[kernel] IOPub connecting to {}", addr);

    // Use zeromq crate for pure-Rust ZeroMQ
    let mut socket: zeromq::SubSocket = zeromq::SubSocket::new();
    if let Err(e) = socket.connect(&addr).await {
        eprintln!("[kernel] Failed to connect IOPub: {}", e);
        return;
    }
    if let Err(e) = socket.subscribe("").await {
        eprintln!("[kernel] Failed to subscribe: {}", e);
        return;
    }
    eprintln!("[kernel] IOPub listener started for {}", kernel_id);

    loop {
        tokio::select! {
            _ = cancel_rx.changed() => {
                if *cancel_rx.borrow() {
                    break;
                }
            }
            msg = zeromq::SocketRecv::recv(&mut socket) => {
                match msg {
                    Ok(zmq_msg) => {
                        let frames: Vec<Vec<u8>> = zmq_msg.into_vec()
                            .iter()
                            .map(|f| f.to_vec())
                            .collect();
                        eprintln!("[kernel] IOPub received {} frames", frames.len());
                        if let Some((content, parent, msg_type)) = parse_message(&frames) {
                            eprintln!("[kernel] IOPub msg_type={}, parent_msg_id={}", msg_type, parent.get("msg_id").and_then(|v| v.as_str()).unwrap_or("none"));
                            let parent_msg_id = parent
                                .get("msg_id")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();

                            match msg_type.as_str() {
                                "stream" => {
                                    let event_name = format!("kernel-output-{}-{}", kernel_id, parent_msg_id);
                                    let _ = app.emit(&event_name, serde_json::json!({
                                        "output_type": "stream",
                                        "name": content.get("name").and_then(|v| v.as_str()).unwrap_or("stdout"),
                                        "text": content.get("text").and_then(|v| v.as_str()).unwrap_or(""),
                                    }));
                                }
                                "display_data" | "execute_result" => {
                                    let event_name = format!("kernel-output-{}-{}", kernel_id, parent_msg_id);
                                    let _ = app.emit(&event_name, serde_json::json!({
                                        "output_type": msg_type,
                                        "data": content.get("data"),
                                        "metadata": content.get("metadata"),
                                        "execution_count": content.get("execution_count"),
                                    }));
                                }
                                "error" => {
                                    let event_name = format!("kernel-output-{}-{}", kernel_id, parent_msg_id);
                                    let _ = app.emit(&event_name, serde_json::json!({
                                        "output_type": "error",
                                        "ename": content.get("ename"),
                                        "evalue": content.get("evalue"),
                                        "traceback": content.get("traceback"),
                                    }));
                                }
                                "status" => {
                                    let status = content.get("execution_state")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("unknown");
                                    let event_name = format!("kernel-status-{}", kernel_id);
                                    let _ = app.emit(&event_name, serde_json::json!({
                                        "status": status,
                                    }));

                                    // Emit done event when kernel goes idle after execution
                                    if status == "idle" && !parent_msg_id.is_empty() {
                                        let done_event = format!("kernel-done-{}-{}", kernel_id, parent_msg_id);
                                        let _ = app.emit(&done_event, serde_json::json!({
                                            "success": true,
                                        }));
                                    }
                                }
                                _ => {}
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("IOPub recv error: {}", e);
                        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                    }
                }
            }
        }
    }
}

#[tauri::command]
pub async fn kernel_execute(
    _app: tauri::AppHandle,
    state: tauri::State<'_, KernelState>,
    kernel_id: String,
    code: String,
) -> Result<String, String> {
    eprintln!("[kernel] kernel_execute called for kernel_id={}, code_len={}", kernel_id, code.len());
    let (conn_info, key) = {
        let kernels = state.kernels.lock().unwrap();
        let instance = kernels.get(&kernel_id).ok_or("Kernel not found")?;
        let conn_json = std::fs::read_to_string(&instance.connection_file)
            .map_err(|e| format!("Failed to read connection file: {}", e))?;
        let info: ConnectionInfo = serde_json::from_str(&conn_json)
            .map_err(|e| format!("Failed to parse connection file: {}", e))?;
        let key = info.key.clone();
        (info, key)
    };

    let addr = format!(
        "{}://{}:{}",
        conn_info.transport, conn_info.ip, conn_info.shell_port
    );

    let session_id = uuid::Uuid::new_v4().to_string();
    let content = serde_json::json!({
        "code": code,
        "silent": false,
        "store_history": true,
        "user_expressions": {},
        "allow_stdin": false,
        "stop_on_error": true,
    });

    let msg = create_message("execute_request", &session_id, content, &key);
    let msg_id = {
        let header: serde_json::Value = serde_json::from_slice(&msg[2]).unwrap();
        header.get("msg_id").unwrap().as_str().unwrap().to_string()
    };
    let msg_id_ret = msg_id.clone();

    // Send via DEALER socket
    let mut socket: zeromq::DealerSocket = zeromq::DealerSocket::new();
    eprintln!("[kernel] Connecting DEALER to {}", addr);
    socket.connect(&addr).await.map_err(|e| format!("Failed to connect shell: {}", e))?;

    // Small delay to let ZMQ async handshake complete before sending
    tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
    eprintln!("[kernel] Sending execute_request msg_id={}", msg_id_ret);

    let zmq_msg = zeromq::ZmqMessage::try_from(
        msg.into_iter()
            .map(|f| bytes::Bytes::from(f))
            .collect::<Vec<_>>(),
    )
    .map_err(|e| format!("Failed to create ZMQ message: {}", e))?;

    zeromq::SocketSend::send(&mut socket, zmq_msg)
        .await
        .map_err(|e| format!("Failed to send execute request: {}", e))?;

    // Keep socket alive in a background task — if dropped immediately,
    // the message may not have been flushed to the wire yet.
    // Wait for the shell execute_reply, then drop.
    tokio::spawn(async move {
        match tokio::time::timeout(
            tokio::time::Duration::from_secs(300),
            zeromq::SocketRecv::recv(&mut socket),
        )
        .await
        {
            Ok(Ok(_reply)) => { /* execute_reply received, socket can drop */ }
            Ok(Err(e)) => eprintln!("Shell reply error for {}: {}", msg_id, e),
            Err(_) => eprintln!("Shell reply timeout for {}", msg_id),
        }
    });

    Ok(msg_id_ret)
}

#[tauri::command]
pub async fn kernel_interrupt(
    state: tauri::State<'_, KernelState>,
    kernel_id: String,
) -> Result<(), String> {
    let kernels = state.kernels.lock().unwrap();
    let instance = kernels.get(&kernel_id).ok_or("Kernel not found")?;

    // Interrupt the kernel process
    if let Some(ref child) = instance.process {
        let pid = child.id();
        #[cfg(unix)]
        unsafe {
            libc::kill(pid as i32, libc::SIGINT);
        }
        #[cfg(windows)]
        {
            let _ = std::process::Command::new("taskkill")
                .args(["/PID", &pid.to_string()])
                .output();
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn kernel_shutdown(
    state: tauri::State<'_, KernelState>,
    kernel_id: String,
) -> Result<(), String> {
    let mut kernels = state.kernels.lock().unwrap();
    if let Some(mut instance) = kernels.remove(&kernel_id) {
        // Signal cancel to IOPub listener
        let _ = instance.cancel_tx.send(true);

        // Kill process
        if let Some(ref mut child) = instance.process {
            let _ = child.kill();
            let _ = child.wait();
        }

        // Clean up connection file
        let _ = std::fs::remove_file(&instance.connection_file);
    }

    Ok(())
}

#[tauri::command]
pub async fn kernel_complete(
    state: tauri::State<'_, KernelState>,
    kernel_id: String,
    code: String,
    cursor_pos: usize,
) -> Result<String, String> {
    let (conn_info, key) = {
        let kernels = state.kernels.lock().unwrap();
        let instance = kernels.get(&kernel_id).ok_or("Kernel not found")?;
        let conn_json = std::fs::read_to_string(&instance.connection_file)
            .map_err(|e| format!("Failed to read connection file: {}", e))?;
        let info: ConnectionInfo = serde_json::from_str(&conn_json)
            .map_err(|e| format!("Failed to parse connection file: {}", e))?;
        let key = info.key.clone();
        (info, key)
    };

    let addr = format!(
        "{}://{}:{}",
        conn_info.transport, conn_info.ip, conn_info.shell_port
    );

    let session_id = uuid::Uuid::new_v4().to_string();
    let content = serde_json::json!({
        "code": code,
        "cursor_pos": cursor_pos,
    });

    let msg = create_message("complete_request", &session_id, content, &key);
    let _msg_id = {
        let header: serde_json::Value = serde_json::from_slice(&msg[2]).unwrap();
        header.get("msg_id").unwrap().as_str().unwrap().to_string()
    };

    let mut socket: zeromq::DealerSocket = zeromq::DealerSocket::new();
    socket.connect(&addr).await.map_err(|e| format!("Failed to connect shell: {}", e))?;

    let zmq_msg = zeromq::ZmqMessage::try_from(
        msg.into_iter()
            .map(|f| bytes::Bytes::from(f))
            .collect::<Vec<_>>(),
    )
    .map_err(|e| format!("Failed to create ZMQ message: {}", e))?;

    zeromq::SocketSend::send(&mut socket, zmq_msg)
        .await
        .map_err(|e| format!("Failed to send complete request: {}", e))?;

    // Wait for reply
    let reply = zeromq::SocketRecv::recv(&mut socket)
        .await
        .map_err(|e| format!("Failed to receive reply: {}", e))?;

    let frames: Vec<Vec<u8>> = reply.into_vec().iter().map(|f| f.to_vec()).collect();
    if let Some((content, _, _)) = parse_message(&frames) {
        Ok(serde_json::to_string(&content).unwrap_or_default())
    } else {
        Err("Failed to parse completion reply".into())
    }
}
