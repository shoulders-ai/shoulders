use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde_json;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use tauri::Emitter;

pub struct PtySession {
    writer: Box<dyn Write + Send>,
    master: Box<dyn portable_pty::MasterPty + Send>,
}

pub struct PtyState {
    sessions: Mutex<HashMap<u32, PtySession>>,
    next_id: Mutex<u32>,
}

impl Default for PtyState {
    fn default() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            next_id: Mutex::new(1),
        }
    }
}

#[tauri::command]
pub async fn pty_spawn(
    app: tauri::AppHandle,
    state: tauri::State<'_, PtyState>,
    cmd: String,
    args: Vec<String>,
    cwd: String,
    cols: u16,
    rows: u16,
) -> Result<u32, String> {
    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let mut cmd_builder = CommandBuilder::new(&cmd);
    for arg in &args {
        cmd_builder.arg(arg);
    }
    cmd_builder.cwd(&cwd);

    // Set environment variables
    cmd_builder.env("TERM", "xterm-256color");
    // Shorter prompt (Unix shells only)
    #[cfg(unix)]
    {
        cmd_builder.env("PROMPT", "%1~ %# ");
        cmd_builder.env("PS1", "\\W \\$ ");
    }

    let _child = pair.slave.spawn_command(cmd_builder).map_err(|e| e.to_string())?;

    // Drop the slave - we only need the master
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    let mut id_lock = state.next_id.lock().unwrap();
    let id = *id_lock;
    *id_lock += 1;
    drop(id_lock);

    // Store session
    {
        let mut sessions = state.sessions.lock().unwrap();
        sessions.insert(
            id,
            PtySession {
                writer,
                master: pair.master,
            },
        );
    }

    // Spawn reader thread
    let event_name = format!("pty-output-{}", id);
    let app_clone = app.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_clone.emit(&event_name, serde_json::json!({ "data": data }));
                }
                Err(_) => break,
            }
        }
        // PTY closed - notify frontend
        let _ = app_clone.emit(
            &format!("pty-exit-{}", id),
            serde_json::json!({ "id": id }),
        );
    });

    Ok(id)
}

#[tauri::command]
pub async fn pty_write(
    state: tauri::State<'_, PtyState>,
    id: u32,
    data: String,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.get_mut(&id) {
        session
            .writer
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
        session.writer.flush().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("PTY session not found".to_string())
    }
}

#[tauri::command]
pub async fn pty_resize(
    state: tauri::State<'_, PtyState>,
    id: u32,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.get(&id) {
        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("PTY session not found".to_string())
    }
}

#[tauri::command]
pub async fn pty_kill(state: tauri::State<'_, PtyState>, id: u32) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    sessions.remove(&id);
    Ok(())
}
