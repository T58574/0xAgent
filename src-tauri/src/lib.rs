mod config;
mod session;
mod agent;
mod share;
mod llama_manager;


use std::sync::Arc;
use tokio::sync::Mutex;
use std::fs;
use std::path::{Path, PathBuf};
use serde::{Serialize, Deserialize};

use crate::config::AppConfig;
use crate::session::ChatSession;
use crate::agent::PendingConfirmation;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileNode>>,
}

pub struct AppState {
    pub pending_confirmation: Arc<Mutex<Option<PendingConfirmation>>>,
    pub cancel_tokens: Arc<tokio::sync::Mutex<std::collections::HashSet<String>>>,
    pub llama_process: Arc<tokio::sync::Mutex<Option<llama_manager::LlamaServerProcess>>>,
}

#[tauri::command]
fn get_config(app: tauri::AppHandle) -> Result<AppConfig, String> {
    Ok(config::load_config(&app))
}

#[tauri::command]
fn save_config(app: tauri::AppHandle, config: AppConfig) -> Result<(), String> {
    config::save_config(&app, &config)
}

#[tauri::command]
fn list_sessions(app: tauri::AppHandle) -> Result<Vec<ChatSession>, String> {
    session::list_sessions(&app)
}

#[tauri::command]
fn load_session(app: tauri::AppHandle, id: String) -> Result<ChatSession, String> {
    session::load_session(&app, &id)
}

#[tauri::command]
fn save_session(app: tauri::AppHandle, session: ChatSession) -> Result<(), String> {
    session::save_session(&app, &session)
}

#[tauri::command]
fn create_session(app: tauri::AppHandle, title: String) -> Result<ChatSession, String> {
    session::create_new_session(&app, &title)
}

#[tauri::command]
fn delete_session(app: tauri::AppHandle, id: String) -> Result<(), String> {
    session::delete_session(&app, &id)
}

#[tauri::command]
fn select_workspace(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let folder = rfd::FileDialog::new()
        .pick_folder();
        
    if let Some(path) = folder {
        let path_str = path.to_string_lossy().to_string();
        let mut cfg = config::load_config(&app);
        cfg.workspace_dir = Some(path_str.clone());
        config::save_config(&app, &cfg)?;
        Ok(Some(path_str))
    } else {
        Ok(None)
    }
}

#[tauri::command]
fn select_model_file() -> Result<Option<String>, String> {
    let file = rfd::FileDialog::new()
        .add_filter("GGUF Model (*.gguf)", &["gguf"])
        .pick_file();
        
    if let Some(path) = file {
        Ok(Some(path.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

#[tauri::command]
fn select_models_dir() -> Result<Option<String>, String> {
    let folder = rfd::FileDialog::new()
        .pick_folder();
        
    if let Some(path) = folder {
        Ok(Some(path.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

#[tauri::command]
async fn send_message(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    let config = config::load_config(&app);
    let state_clone = state.pending_confirmation.clone();
    let cancel_clone = state.cancel_tokens.clone();
    
    // Ensure cancellation is reset for this session
    cancel_clone.lock().await.remove(&session_id);
    
    tokio::spawn(async move {
        agent::run_agent_loop(app, session_id, config, state_clone, cancel_clone).await;
    });
    
    Ok(())
}

#[tauri::command]
async fn cancel_agent(
    state: tauri::State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    state.cancel_tokens.lock().await.insert(session_id.clone());
    
    // Interrupt any pending confirmation
    let mut lock = state.pending_confirmation.lock().await;
    if let Some(pending) = lock.take() {
        if pending.session_id == session_id {
            let _ = pending.tx.send(false);
        } else {
            *lock = Some(pending);
        }
    }
    
    Ok(())
}

#[tauri::command]
async fn respond_to_tool(
    state: tauri::State<'_, AppState>,
    session_id: String,
    tool_call_id: String,
    approve: bool,
) -> Result<(), String> {
    let mut lock = state.pending_confirmation.lock().await;
    if let Some(pending) = lock.take() {
        if pending.session_id == session_id && pending.tool_call_id == tool_call_id {
            let _ = pending.tx.send(approve);
            return Ok(());
        }
        *lock = Some(pending);
    }
    Err("No pending confirmation found matching this tool call.".to_string())
}

#[tauri::command]
fn get_workspace_tree(workspace_dir: Option<String>) -> Result<Vec<FileNode>, String> {
    let ws_path = match workspace_dir {
        Some(ref dir) if !dir.trim().is_empty() => PathBuf::from(dir),
        _ => return Ok(Vec::new()),
    };

    if !ws_path.exists() {
        return Err("Workspace directory does not exist".to_string());
    }

    fn read_dir_recursive(dir: &Path, depth: usize) -> Result<Vec<FileNode>, String> {
        if depth > 4 {
            return Ok(Vec::new());
        }
        let mut nodes = Vec::new();
        let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            
            // Ignore heavy directories and system directories
            if name == ".git" || name == "node_modules" || name == "target" || name == "dist" || name == "build" || name == ".idea" || name == ".vscode" {
                continue;
            }

            let is_dir = path.is_dir();
            let children = if is_dir {
                Some(read_dir_recursive(&path, depth + 1)?)
            } else {
                None
            };

            nodes.push(FileNode {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir,
                children,
            });
        }

        // Sort: directories first, then files alphabetically
        nodes.sort_by(|a, b| {
            if a.is_dir != b.is_dir {
                b.is_dir.cmp(&a.is_dir)
            } else {
                a.name.to_lowercase().cmp(&b.name.to_lowercase())
            }
        });

        Ok(nodes)
    }

    read_dir_recursive(&ws_path, 0)
}

#[tauri::command]
fn read_file_raw(path: String) -> Result<String, String> {
    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }
    fs::read_to_string(file_path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
fn write_file_raw(path: String, content: String) -> Result<(), String> {
    let file_path = Path::new(&path);
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create folders: {}", e))?;
    }
    fs::write(file_path, content).map_err(|e| format!("Failed to save file: {}", e))
}

#[tauri::command]
fn start_share_server(app: tauri::AppHandle, password: Option<String>) -> Result<String, String> {
    share::start_http_server(app, password)
}

#[tauri::command]
fn stop_share_server() -> Result<(), String> {
    share::stop_http_server()
}

#[tauri::command]
fn get_share_status() -> Result<Option<String>, String> {
    let state = share::get_share_state().lock().unwrap();
    Ok(state.server_url.clone())
}

fn decode_base64(s: &str) -> Option<Vec<u8>> {
    let mut table = [0u8; 256];
    for (i, &c) in b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".iter().enumerate() {
        table[c as usize] = i as u8;
    }
    let mut clean = String::new();
    for c in s.chars() {
        if c.is_alphanumeric() || c == '+' || c == '/' || c == '=' {
            clean.push(c);
        }
    }
    let bytes = clean.as_bytes();
    let mut result = Vec::new();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'=' { break; }
        if i + 1 >= bytes.len() { break; }
        
        let mut num = (table[bytes[i] as usize] as u32) << 18;
        let mut count = 2;
        num |= (table[bytes[i+1] as usize] as u32) << 12;
        
        if i + 2 < bytes.len() && bytes[i + 2] != b'=' {
            num |= (table[bytes[i+2] as usize] as u32) << 6;
            count += 1;
        }
        if i + 3 < bytes.len() && bytes[i + 3] != b'=' {
            num |= table[bytes[i+3] as usize] as u32;
            count += 1;
        }
        result.push(((num >> 16) & 0xFF) as u8);
        if count > 2 { result.push(((num >> 8) & 0xFF) as u8); }
        if count > 3 { result.push((num & 0xFF) as u8); }
        i += 4;
    }
    Some(result)
}

#[tauri::command]
async fn transcribe_audio(app: tauri::AppHandle, audio_base64: String) -> Result<String, String> {
    let config = config::load_config(&app);
    let api_key = match config.groq_api_key {
        Some(ref key) if !key.trim().is_empty() => key.trim().to_string(),
        _ => return Err("Groq API key is not configured. Please set it in settings.".to_string()),
    };

    let audio_bytes = decode_base64(&audio_base64)
        .ok_or_else(|| "Failed to decode base64 audio payload".to_string())?;

    let boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
    let mut body = Vec::new();

    // 1. Model
    body.extend_from_slice(format!("--{}\r\n", boundary).as_bytes());
    body.extend_from_slice(b"Content-Disposition: form-data; name=\"model\"\r\n\r\n");
    body.extend_from_slice(b"whisper-large-v3\r\n");

    // 2. File
    body.extend_from_slice(format!("--{}\r\n", boundary).as_bytes());
    body.extend_from_slice(b"Content-Disposition: form-data; name=\"file\"; filename=\"audio.webm\"\r\n");
    body.extend_from_slice(b"Content-Type: audio/webm\r\n\r\n");
    body.extend_from_slice(&audio_bytes);
    body.extend_from_slice(b"\r\n");

    // End
    body.extend_from_slice(format!("--{}--\r\n", boundary).as_bytes());

    let client = reqwest::Client::new();
    let url = "https://api.groq.com/openai/v1/audio/transcriptions";

    let response = client.post(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", format!("multipart/form-data; boundary={}", boundary))
        .body(body)
        .send()
        .await
        .map_err(|e| format!("Network request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_body = response.text().await.unwrap_or_default();
        return Err(format!("Groq API returned error {}: {}", status, error_body));
    }

    let json_res: serde_json::Value = response.json()
        .await
        .map_err(|e| format!("Failed to parse response JSON: {}", e))?;

    let text = json_res.get("text")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Response did not contain text field".to_string())?;

    Ok(text.to_string())
}

#[tauri::command]
async fn download_llama_server(
    app: tauri::AppHandle,
    url: String,
    filename: String,
) -> Result<String, String> {
    llama_manager::download_server_release(app, url, filename).await
}

#[tauri::command]
async fn get_llama_releases() -> Result<Vec<llama_manager::LlamaRelease>, String> {
    llama_manager::get_github_releases().await
}

#[tauri::command]
fn get_system_specs() -> Result<llama_manager::SystemSpecs, String> {
    llama_manager::get_system_specs()
}

#[tauri::command]
fn list_downloaded_models(custom_dir: Option<String>, app: tauri::AppHandle) -> Result<Vec<String>, String> {
    llama_manager::list_downloaded_models(custom_dir, &app)
}

#[tauri::command]
async fn download_gguf_model(
    app: tauri::AppHandle,
    repo: String,
    filename: String,
) -> Result<String, String> {
    llama_manager::download_huggingface_model(app, repo, filename).await
}

#[tauri::command]
async fn start_llama_server(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    config: llama_manager::LlamaServerConfig,
) -> Result<(), String> {
    let mut lock = state.llama_process.lock().await;
    if let Some(mut existing) = lock.take() {
        let _ = existing.child.kill().await;
    }
    let new_process = llama_manager::start_llama_server_process(app, config)?;
    *lock = Some(new_process);
    Ok(())
}

#[tauri::command]
async fn stop_llama_server(
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let mut lock = state.llama_process.lock().await;
    if let Some(mut process) = lock.take() {
        process.child.kill().await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn get_llama_server_status(
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let mut lock = state.llama_process.lock().await;
    if let Some(ref mut process) = *lock {
        match process.child.try_wait() {
            Ok(None) => {
                Ok(serde_json::json!({ "status": "running", "port": process.port }))
            }
            Ok(Some(status)) => {
                *lock = None;
                Ok(serde_json::json!({ "status": "stopped", "code": status.code() }))
            }
            Err(_) => {
                *lock = None;
                Ok(serde_json::json!({ "status": "stopped", "error": "failed to check status" }))
            }
        }
    } else {
        Ok(serde_json::json!({ "status": "stopped" }))
    }
}

#[tauri::command]
fn get_local_paths(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let bin_dir = llama_manager::get_bin_dir(&app)?.to_string_lossy().to_string();
    let models_dir = llama_manager::get_models_dir(&app)?.to_string_lossy().to_string();
    Ok(serde_json::json!({ "bin_dir": bin_dir, "models_dir": models_dir }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            pending_confirmation: Arc::new(Mutex::new(None)),
            cancel_tokens: Arc::new(tokio::sync::Mutex::new(std::collections::HashSet::new())),
            llama_process: Arc::new(tokio::sync::Mutex::new(None)),
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            list_sessions,
            load_session,
            save_session,
            create_session,
            delete_session,
            select_workspace,
            send_message,
            cancel_agent,
            respond_to_tool,
            get_workspace_tree,
            read_file_raw,
            write_file_raw,
            start_share_server,
            stop_share_server,
            get_share_status,
            transcribe_audio,
            download_llama_server,
            download_gguf_model,
            start_llama_server,
            stop_llama_server,
            get_llama_server_status,
            get_local_paths,
            get_llama_releases,
            get_system_specs,
            list_downloaded_models,
            select_model_file,
            select_models_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

}

