mod config;
mod session;
mod agent;

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
async fn send_message(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    let config = config::load_config(&app);
    let state_clone = state.pending_confirmation.clone();
    
    tokio::spawn(async move {
        agent::run_agent_loop(app, session_id, config, state_clone).await;
    });
    
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            pending_confirmation: Arc::new(Mutex::new(None)),
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
            respond_to_tool,
            get_workspace_tree,
            read_file_raw,
            write_file_raw
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
