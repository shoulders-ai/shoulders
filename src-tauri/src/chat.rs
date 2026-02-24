use crate::fs_commands::validate_url_host;
use futures_util::StreamExt;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::Emitter;

pub struct ChatSession {
    pub cancel_tx: tokio::sync::watch::Sender<bool>,
}

pub struct ChatState {
    pub sessions: Mutex<HashMap<String, ChatSession>>,
}

impl Default for ChatState {
    fn default() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

#[derive(Deserialize)]
pub struct ChatRequest {
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: String,
}

#[tauri::command]
pub async fn chat_stream(
    app: tauri::AppHandle,
    state: tauri::State<'_, ChatState>,
    session_id: String,
    request: ChatRequest,
) -> Result<(), String> {
    validate_url_host(&request.url)?;

    let (cancel_tx, mut cancel_rx) = tokio::sync::watch::channel(false);

    // Store session
    {
        let mut sessions = state.sessions.lock().unwrap();
        sessions.insert(session_id.clone(), ChatSession { cancel_tx });
    }

    let chunk_event = format!("chat-chunk-{}", session_id);
    let done_event = format!("chat-done-{}", session_id);
    let error_event = format!("chat-error-{}", session_id);

    let app_clone = app.clone();
    let sid = session_id.clone();

    tokio::spawn(async move {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(300))
            .build();

        let client = match client {
            Ok(c) => c,
            Err(e) => {
                let _ = app_clone.emit(
                    &error_event,
                    serde_json::json!({ "error": e.to_string() }),
                );
                return;
            }
        };

        let mut req = client.post(&request.url);
        for (key, value) in &request.headers {
            req = req.header(key.as_str(), value.as_str());
        }
        req = req.body(request.body);

        let response = match req.send().await {
            Ok(r) => r,
            Err(e) => {
                let _ = app_clone.emit(
                    &error_event,
                    serde_json::json!({ "error": e.to_string() }),
                );
                return;
            }
        };

        let status = response.status().as_u16();
        if status < 200 || status >= 300 {
            let body = response.text().await.unwrap_or_default();
            let _ = app_clone.emit(
                &error_event,
                serde_json::json!({ "error": format!("API error {}: {}", status, body) }),
            );
            return;
        }

        let mut stream = response.bytes_stream();
        let mut aborted = false;

        loop {
            tokio::select! {
                chunk = stream.next() => {
                    match chunk {
                        Some(Ok(bytes)) => {
                            let data = String::from_utf8_lossy(&bytes).to_string();
                            let _ = app_clone.emit(
                                &chunk_event,
                                serde_json::json!({ "data": data }),
                            );
                        }
                        Some(Err(e)) => {
                            let _ = app_clone.emit(
                                &error_event,
                                serde_json::json!({ "error": e.to_string() }),
                            );
                            return;
                        }
                        None => break, // Stream finished
                    }
                }
                _ = cancel_rx.changed() => {
                    if *cancel_rx.borrow() {
                        aborted = true;
                        break;
                    }
                }
            }
        }

        let _ = app_clone.emit(
            &done_event,
            serde_json::json!({ "session_id": sid, "aborted": aborted }),
        );
    });

    Ok(())
}

#[tauri::command]
pub async fn chat_abort(state: tauri::State<'_, ChatState>, session_id: String) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.get(&session_id) {
        let _ = session.cancel_tx.send(true);
    }
    Ok(())
}

#[tauri::command]
pub async fn chat_cleanup(state: tauri::State<'_, ChatState>, session_id: String) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    sessions.remove(&session_id);
    Ok(())
}
