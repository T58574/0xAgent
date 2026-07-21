use std::fs;
use std::path::PathBuf;
use serde::{Serialize, Deserialize};
use tauri::AppHandle;
use tauri::Manager;
use chrono::Utc;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ToolCallInfo {
    pub id: String,
    pub name: String,
    pub arguments: String,
    pub status: String, // "pending", "approved", "rejected", "running", "completed", "error"
    pub output: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChatMessage {
    pub id: String,
    pub role: String, // "system", "user", "assistant", "tool"
    pub content: String,
    pub timestamp: i64,
    pub tool_calls: Option<Vec<ToolCallInfo>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChatSession {
    pub id: String,
    pub title: String,
    pub messages: Vec<ChatMessage>,
    pub created_at: i64,
    pub updated_at: i64,
}

pub fn get_sessions_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    path.push("sessions");
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path)
}

pub fn list_sessions(app: &AppHandle) -> Result<Vec<ChatSession>, String> {
    let dir = get_sessions_dir(app)?;
    let mut sessions = Vec::new();
    
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "json") {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(session) = serde_json::from_str::<ChatSession>(&content) {
                        sessions.push(session);
                    }
                }
            }
        }
    }
    
    // Sort by updated_at descending
    sessions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(sessions)
}

pub fn load_session(app: &AppHandle, id: &str) -> Result<ChatSession, String> {
    let mut path = get_sessions_dir(app)?;
    path.push(format!("{}.json", id));
    
    if !path.exists() {
        return Err(format!("Session {} not found", id));
    }
    
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let session = serde_json::from_str::<ChatSession>(&content).map_err(|e| e.to_string())?;
    Ok(session)
}

pub fn save_session(app: &AppHandle, session: &ChatSession) -> Result<(), String> {
    let mut path = get_sessions_dir(app)?;
    path.push(format!("{}.json", session.id));
    
    let content = serde_json::to_string_pretty(session).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn delete_session(app: &AppHandle, id: &str) -> Result<(), String> {
    let mut path = get_sessions_dir(app)?;
    path.push(format!("{}.json", id));
    
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn create_new_session(app: &AppHandle, title: &str) -> Result<ChatSession, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().timestamp_millis();
    let session = ChatSession {
        id: id.clone(),
        title: title.to_string(),
        messages: Vec::new(),
        created_at: now,
        updated_at: now,
    };
    save_session(app, &session)?;
    Ok(session)
}
