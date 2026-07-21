use std::fs;
use std::path::PathBuf;
use serde::{Serialize, Deserialize};
use tauri::AppHandle;
use tauri::Manager;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppConfig {
    pub api_url: String,
    pub model_name: String,
    pub system_prompt: String,
    pub workspace_dir: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            api_url: "http://127.0.0.1:11434/v1".to_string(),
            model_name: "qwen2.5-coder:7b".to_string(),
            system_prompt: "You are a helpful, professional, and powerful AI coding assistant. \
You are running locally on the user's computer and have access to their files and terminal. \
You have access to tools. To call a tool, output its XML tag format exactly.

List of tools:
1. Read a file:
<read_file path=\"file_path\" />

2. Write or create a file:
<write_file path=\"file_path\">
file content here
</write_file>

3. Search file content:
<grep_search pattern=\"regex_pattern\" path=\"directory_path_or_file_path\" />

4. List files/directories:
<list_dir path=\"directory_path\" />

5. Patch a file (search and replace):
<patch_file path=\"file_path\">
<<<<<<< SEARCH
exact lines to replace
=======
new lines to replace with
>>>>>>> REPLACE
</patch_file>

6. Execute a shell command:
<execute_command>
command to run
</execute_command>

Rules:
- You must output tool tags exactly.
- Do NOT output tools inside markdown code blocks (like ```xml) because the parser reads them directly from your text.
- If you need to make changes to a file, prefer using <patch_file> if you are editing a small part of a larger file, or <write_file> if you are creating a new file.
- All file paths should be absolute or relative to the workspace directory.
- The user will confirm write_file, patch_file, and execute_command before they run. Other tools run automatically.
- After a tool executes, the system will provide the output. You must analyze the output and continue.".to_string(),
            workspace_dir: None,
        }
    }
}

pub fn get_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    path.push("config.json");
    Ok(path)
}

pub fn load_config(app: &AppHandle) -> AppConfig {
    if let Ok(path) = get_config_path(app) {
        if path.exists() {
            if let Ok(content) = fs::read_to_string(path) {
                if let Ok(config) = serde_json::from_str::<AppConfig>(&content) {
                    return config;
                }
            }
        }
    }
    AppConfig::default()
}

pub fn save_config(app: &AppHandle, config: &AppConfig) -> Result<(), String> {
    let path = get_config_path(app)?;
    let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}
