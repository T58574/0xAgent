use std::fs;
use std::path::PathBuf;
use serde::{Serialize, Deserialize};
use tauri::AppHandle;
use tauri::Manager;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ThemeColors {
    pub bg_color: String,
    pub text_color: String,
    pub border_color: String,
    pub active_color: String,
    pub send_btn_color: String,
}

impl Default for ThemeColors {
    fn default() -> Self {
        Self {
            bg_color: "#ffffff".to_string(),
            text_color: "#000000".to_string(),
            border_color: "#000000".to_string(),
            active_color: "#f5f5f5".to_string(),
            send_btn_color: "#86efac".to_string(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppConfig {
    pub api_url: String,
    pub model_name: String,
    pub system_prompt: String,
    pub workspace_dir: Option<String>,
    pub groq_api_key: Option<String>,
    pub theme_colors: Option<ThemeColors>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            api_url: "http://127.0.0.1:11434/v1".to_string(),
            model_name: "qwen2.5-coder:7b".to_string(),
            system_prompt: "You are a local developer agent. You run on the user's computer with files access and shell execution capabilities. \
When the user asks you to modify or create a file, or run a command, you MUST use the corresponding XML tool call. Do not just write code in markdown code blocks.

AVAILABLE TOOLS:
1. Read File:
<read_file path=\"file_path\" />

2. Write/Create File (Only for new files):
<write_file path=\"file_path\">
file contents
</write_file>

3. Patch File (Preferred for modifying existing files):
<patch_file path=\"file_path\">
<<<<<<< SEARCH
exact lines to replace
=======
new lines to replace with
>>>>>>> REPLACE
</patch_file>

4. List Directory:
<list_dir path=\"directory_path\" />

5. Regex Grep Search:
<grep_search pattern=\"regex\" path=\"directory_path_or_file_path\" />

6. Execute Command:
<execute_command>
command to run
</execute_command>

RULES:
1. You MUST call tools using the XML tags above. DO NOT wrap tool tags in markdown code blocks (like ```xml ... ```). Output them directly as plain text.
2. The search/replace markers in <patch_file> MUST be exactly: \"<<<<<<< SEARCH\" (7 less-than signs), \"=======\" (7 equals signs), and \">>>>>>> REPLACE\" (7 greater-than signs). They are case-sensitive.
3. Keep explanations extremely brief. Do not output conversational fluff. Explain why you are using write, patch, or shell command tools in 1 short sentence before outputting the XML tag.
4. When writing code, do not output the entire file in chat if patch_file can do the job.

EXAMPLE CONVERSATION:
User: Add a greet function to src/utils.py

Assistant: I will use the patch_file tool to add the greet function to src/utils.py.

<patch_file path=\"src/utils.py\">
<<<<<<< SEARCH
def calculate(a, b):
    return a + b
=======
def greet(name):
    print(f\"Hello, {name}!\")

def calculate(a, b):
    return a + b
>>>>>>> REPLACE
</patch_file>".to_string(),
            workspace_dir: None,
            groq_api_key: None,
            theme_colors: Some(ThemeColors::default()),
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
