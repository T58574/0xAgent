use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;
use serde::{Serialize, Deserialize};
use serde_json::json;
use regex::Regex;
use tokio::sync::oneshot;
use tauri::{AppHandle, Emitter};
use futures_util::StreamExt;
use chrono::Utc;

use crate::config::AppConfig;
use crate::session::{ChatMessage, ToolCallInfo, save_session};


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedToolCall {
    pub id: String,
    pub name: String,
    pub arguments: serde_json::Value,
    pub raw_content: String,
}

// Global state to manage pending tool confirmations
pub struct PendingConfirmation {
    pub session_id: String,
    pub tool_call_id: String,
    pub tx: oneshot::Sender<bool>,
}

// Parses tools from text using regex
pub fn parse_tool_calls(text: &str) -> Vec<ParsedToolCall> {
    let mut tool_calls = Vec::new();

    // 1. Read File: <read_file path="path" />
    let re_read = Regex::new(r#"(?s)<read_file\s+path=["']([^"']+)["']\s*/?>"#).unwrap();
    for cap in re_read.captures_iter(text) {
        let path = cap.get(1).unwrap().as_str().to_string();
        let raw = cap.get(0).unwrap().as_str().to_string();
        let id = format!("read_{}", &uuid::Uuid::new_v4().to_string()[..8]);
        tool_calls.push(ParsedToolCall {
            id,
            name: "read_file".to_string(),
            arguments: json!({ "path": path }),
            raw_content: raw,
        });
    }

    // 2. Write File: <write_file path="path">content</write_file>
    let re_write = Regex::new(r#"(?s)<write_file\s+path=["']([^"']+)["']\s*>(.*?)</write_file>"#).unwrap();
    for cap in re_write.captures_iter(text) {
        let path = cap.get(1).unwrap().as_str().to_string();
        let content = cap.get(2).unwrap().as_str().to_string();
        let raw = cap.get(0).unwrap().as_str().to_string();
        let id = format!("write_{}", &uuid::Uuid::new_v4().to_string()[..8]);
        tool_calls.push(ParsedToolCall {
            id,
            name: "write_file".to_string(),
            arguments: json!({ "path": path, "content": content }),
            raw_content: raw,
        });
    }

    // 3. Patch File: <patch_file path="path">content</patch_file>
    let re_patch = Regex::new(r#"(?s)<patch_file\s+path=["']([^"']+)["']\s*>(.*?)</patch_file>"#).unwrap();
    for cap in re_patch.captures_iter(text) {
        let path = cap.get(1).unwrap().as_str().to_string();
        let content = cap.get(2).unwrap().as_str().to_string();
        let raw = cap.get(0).unwrap().as_str().to_string();
        let id = format!("patch_{}", &uuid::Uuid::new_v4().to_string()[..8]);
        tool_calls.push(ParsedToolCall {
            id,
            name: "patch_file".to_string(),
            arguments: json!({ "path": path, "content": content }),
            raw_content: raw,
        });
    }

    // 4. List Dir: <list_dir path="path" />
    let re_list = Regex::new(r#"(?s)<list_dir\s+path=["']([^"']+)["']\s*/?>"#).unwrap();
    for cap in re_list.captures_iter(text) {
        let path = cap.get(1).unwrap().as_str().to_string();
        let raw = cap.get(0).unwrap().as_str().to_string();
        let id = format!("list_{}", &uuid::Uuid::new_v4().to_string()[..8]);
        tool_calls.push(ParsedToolCall {
            id,
            name: "list_dir".to_string(),
            arguments: json!({ "path": path }),
            raw_content: raw,
        });
    }

    // 5. Grep Search: <grep_search pattern="pattern" path="path" />
    let re_grep1 = Regex::new(r#"(?s)<grep_search\s+pattern=["']([^"']+)["']\s+path=["']([^"']+)["']\s*/?>"#).unwrap();
    let re_grep2 = Regex::new(r#"(?s)<grep_search\s+path=["']([^"']+)["']\s+pattern=["']([^"']+)["']\s*/?>"#).unwrap();
    
    for cap in re_grep1.captures_iter(text) {
        let pattern = cap.get(1).unwrap().as_str().to_string();
        let path = cap.get(2).unwrap().as_str().to_string();
        let raw = cap.get(0).unwrap().as_str().to_string();
        let id = format!("grep_{}", &uuid::Uuid::new_v4().to_string()[..8]);
        tool_calls.push(ParsedToolCall {
            id,
            name: "grep_search".to_string(),
            arguments: json!({ "pattern": pattern, "path": path }),
            raw_content: raw,
        });
    }
    for cap in re_grep2.captures_iter(text) {
        let raw = cap.get(0).unwrap().as_str().to_string();
        if !tool_calls.iter().any(|tc| tc.raw_content == raw) {
            let path = cap.get(1).unwrap().as_str().to_string();
            let pattern = cap.get(2).unwrap().as_str().to_string();
            let id = format!("grep_{}", &uuid::Uuid::new_v4().to_string()[..8]);
            tool_calls.push(ParsedToolCall {
                id,
                name: "grep_search".to_string(),
                arguments: json!({ "pattern": pattern, "path": path }),
                raw_content: raw,
            });
        }
    }

    // 6. Execute Command: <execute_command>command</execute_command>
    let re_exec = Regex::new(r#"(?s)<execute_command\s*>(.*?)</execute_command>"#).unwrap();
    for cap in re_exec.captures_iter(text) {
        let command = cap.get(1).unwrap().as_str().trim().to_string();
        let raw = cap.get(0).unwrap().as_str().to_string();
        let id = format!("exec_{}", &uuid::Uuid::new_v4().to_string()[..8]);
        tool_calls.push(ParsedToolCall {
            id,
            name: "execute_command".to_string(),
            arguments: json!({ "command": command }),
            raw_content: raw,
        });
    }

    tool_calls
}

// Tool Execution Helpers
fn resolve_path(workspace: &Option<String>, path_str: &str) -> PathBuf {
    let path = Path::new(path_str);
    if path.is_absolute() {
        path.to_path_buf()
    } else if let Some(ref ws) = workspace {
        Path::new(ws).join(path)
    } else {
        path.to_path_buf()
    }
}

pub fn execute_read_file(workspace: &Option<String>, path_str: &str) -> Result<String, String> {
    let target_path = resolve_path(workspace, path_str);
    if !target_path.exists() {
        return Err(format!("File does not exist: {}", target_path.display()));
    }
    fs::read_to_string(&target_path).map_err(|e| format!("Failed to read file: {}", e))
}

pub fn execute_write_file(workspace: &Option<String>, path_str: &str, content: &str) -> Result<String, String> {
    let target_path = resolve_path(workspace, path_str);
    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {}", e))?;
    }
    fs::write(&target_path, content).map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(format!("Successfully wrote file: {}", target_path.display()))
}

pub fn execute_patch_file(workspace: &Option<String>, path_str: &str, patch_content: &str) -> Result<String, String> {
    let target_path = resolve_path(workspace, path_str);
    if !target_path.exists() {
        return Err(format!("File to patch does not exist: {}", target_path.display()));
    }
    
    let original = fs::read_to_string(&target_path).map_err(|e| format!("Failed to read file: {}", e))?;
    
    // Parse <<<<<<< SEARCH, =======, >>>>>>> REPLACE
    let search_marker = "<<<<<<< SEARCH";
    let divider_marker = "=======";
    let replace_marker = ">>>>>>> REPLACE";
    
    let mut current_content = original.clone();
    
    if !patch_content.contains(search_marker) {
        // Simple replace as a fallback if the markers are not present
        return Err("Patch content does not contain <<<<<<< SEARCH marker".to_string());
    }

    let mut remaining = patch_content;
    let mut applied_count = 0;

    while let Some(start_idx) = remaining.find(search_marker) {
        let after_search = &remaining[start_idx + search_marker.len()..];
        let div_idx = match after_search.find(divider_marker) {
            Some(idx) => idx,
            None => return Err("Missing ======= separator in patch".to_string()),
        };
        let search_block = after_search[..div_idx].trim_matches(|c| c == '\r' || c == '\n');
        
        let after_div = &after_search[div_idx + divider_marker.len()..];
        let end_idx = match after_div.find(replace_marker) {
            Some(idx) => idx,
            None => return Err("Missing >>>>>>> REPLACE marker in patch".to_string()),
        };
        let replace_block = after_div[..end_idx].trim_matches(|c| c == '\r' || c == '\n');
        
        // Clean up formatting
        let search_block_clean = search_block.replace("\r\n", "\n");
        let current_content_clean = current_content.replace("\r\n", "\n");

        if !current_content_clean.contains(&search_block_clean) {
            return Err(format!(
                "Could not find the SEARCH block in file: \n```\n{}\n```",
                search_block
            ));
        }

        let replaced_clean = current_content_clean.replace(&search_block_clean, replace_block);
        current_content = replaced_clean; // Carry forward normalized newlines is fine
        
        remaining = &after_div[end_idx + replace_marker.len()..];
        applied_count += 1;
    }

    fs::write(&target_path, &current_content).map_err(|e| format!("Failed to write patched file: {}", e))?;
    Ok(format!("Successfully applied {} patch block(s) to {}", applied_count, target_path.display()))
}

pub fn execute_list_dir(workspace: &Option<String>, path_str: &str) -> Result<String, String> {
    let target_path = resolve_path(workspace, path_str);
    if !target_path.exists() {
        return Err(format!("Directory does not exist: {}", target_path.display()));
    }
    if !target_path.is_dir() {
        return Err(format!("Path is not a directory: {}", target_path.display()));
    }
    
    let entries = fs::read_dir(&target_path).map_err(|e| format!("Failed to read directory: {}", e))?;
    let mut list = Vec::new();
    
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        let file_type = entry.file_type().map(|ft| if ft.is_dir() { "Dir" } else { "File" }).unwrap_or("Unknown");
        list.push(format!("- [{}] {}", file_type, name));
    }
    
    Ok(list.join("\n"))
}

pub fn execute_grep_search(workspace: &Option<String>, pattern_str: &str, path_str: &str) -> Result<String, String> {
    let target_path = resolve_path(workspace, path_str);
    if !target_path.exists() {
        return Err(format!("Search path does not exist: {}", target_path.display()));
    }
    
    let re = Regex::new(pattern_str).map_err(|e| format!("Invalid regex pattern: {}", e))?;
    let mut results = Vec::new();
    
    fn walk_dir(dir: &Path, re: &Regex, results: &mut Vec<String>, depth: usize) {
        if depth > 8 { return; }
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let name = path.file_name().unwrap_or_default().to_string_lossy();
                
                // Ignore standard directories
                if path.is_dir() {
                    if name == ".git" || name == "node_modules" || name == "target" || name == "dist" || name == "build" {
                        continue;
                    }
                    walk_dir(&path, re, results, depth + 1);
                } else if path.is_file() {
                    // Quick check if file is likely binary
                    if let Ok(content) = fs::read_to_string(&path) {
                        for (i, line) in content.lines().enumerate() {
                            if re.is_match(line) {
                                results.push(format!("{}:{}: {}", path.display(), i + 1, line.trim()));
                                if results.len() > 100 {
                                    return; // cap at 100 results
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    if target_path.is_file() {
        let content = fs::read_to_string(&target_path).map_err(|e| format!("Failed to read file: {}", e))?;
        for (i, line) in content.lines().enumerate() {
            if re.is_match(line) {
                results.push(format!("{}:{}: {}", target_path.display(), i + 1, line.trim()));
            }
        }
    } else {
        walk_dir(&target_path, &re, &mut results, 0);
    }
    
    if results.is_empty() {
        Ok("No matches found.".to_string())
    } else {
        Ok(results.join("\n"))
    }
}

pub fn execute_shell_command(workspace: &Option<String>, command_str: &str) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    let (shell, args) = ("powershell", vec!["-NoProfile", "-Command", command_str]);
    
    #[cfg(not(target_os = "windows"))]
    let (shell, args) = ("sh", vec!["-c", command_str]);
    
    let mut cmd = Command::new(shell);
    cmd.args(&args);
    
    if let Some(ref ws) = workspace {
        cmd.current_dir(ws);
    }
    
    let output = cmd.output().map_err(|e| format!("Failed to run command: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    
    let mut result = String::new();
    if !stdout.is_empty() {
        result.push_str(&stdout);
    }
    if !stderr.is_empty() {
        if !result.is_empty() {
            result.push_str("\n--- STDERR ---\n");
        }
        result.push_str(&stderr);
    }
    
    if result.is_empty() {
        Ok("Command executed successfully with no output.".to_string())
    } else {
        Ok(result)
    }
}

// Runs the agent completions loop
pub async fn run_agent_loop(
    app: AppHandle,
    session_id: String,
    config: AppConfig,
    state: Arc<tokio::sync::Mutex<Option<PendingConfirmation>>>,
) {
    let mut session = match crate::session::load_session(&app, &session_id) {
        Ok(s) => s,
        Err(e) => {
            let _ = app.emit("agent-error", format!("Failed to load session: {}", e));
            return;
        }
    };

    if let Ok(mut state) = crate::share::get_share_state().lock() {
        state.status = "thinking".to_string();
        state.last_tokens = String::new();
    }

    let _ = app.emit("agent-status-changed", "thinking");

    loop {
        // Prepare request body
        let mut messages = Vec::new();
        messages.push(json!({
            "role": "system",
            "content": config.system_prompt
        }));
        
        for msg in &session.messages {
            // Map "tool" role to "user" role for local LLM compatibility
            let role = if msg.role == "tool" { "user" } else { &msg.role };
            messages.push(json!({
                "role": role,
                "content": msg.content
            }));
        }

        let request_body = json!({
            "model": config.model_name,
            "messages": messages,
            "stream": true,
            "temperature": 0.2
        });

        let client = reqwest::Client::new();
        let api_endpoint = format!("{}/chat/completions", config.api_url.trim_end_matches('/'));
        
        let response = match client.post(&api_endpoint)
            .json(&request_body)
            .send()
            .await {
                Ok(res) => res,
                Err(e) => {
                    let _ = app.emit("agent-error", format!("Failed to connect to LLM server: {}", e));
                    let _ = app.emit("agent-status-changed", "idle");
                    return;
                }
            };

        if !response.status().is_success() {
            let status = response.status();
            let body_text = response.text().await.unwrap_or_default();
            let _ = app.emit("agent-error", format!("LLM server returned error {}: {}", status, body_text));
            let _ = app.emit("agent-status-changed", "idle");
            return;
        }

        // We will create a new assistant message in the history
        let assistant_message_id = uuid::Uuid::new_v4().to_string();
        let mut assistant_message = ChatMessage {
            id: assistant_message_id.clone(),
            role: "assistant".to_string(),
            content: String::new(),
            timestamp: Utc::now().timestamp_millis(),
            tool_calls: Some(Vec::new()),
        };

        // Notify frontend that we are receiving tokens
        let _ = app.emit("agent-message-start", json!({
            "id": assistant_message_id.clone(),
            "role": "assistant"
        }));

        let mut stream = response.bytes_stream();
        let mut buffer = String::new();

        while let Some(chunk_res) = stream.next().await {
            let chunk = match chunk_res {
                Ok(bytes) => bytes,
                Err(e) => {
                    let _ = app.emit("agent-error", format!("Error reading response stream: {}", e));
                    break;
                }
            };
            
            let chunk_str = String::from_utf8_lossy(&chunk);
            buffer.push_str(&chunk_str);

            // Process lines in SSE stream
            while let Some(line_end_idx) = buffer.find('\n') {
                let line = buffer[..line_end_idx].trim().to_string();
                buffer = buffer[line_end_idx + 1..].to_string();
                
                if line.starts_with("data:") {
                    let data = line["data:".len()..].trim();
                    if data == "[DONE]" {
                        break;
                    }
                    
                    if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(data) {
                        if let Some(choices) = json_val.get("choices") {
                            if let Some(choice) = choices.get(0) {
                                if let Some(delta) = choice.get("delta") {
                                    if let Some(content_val) = delta.get("content") {
                                        if let Some(content_str) = content_val.as_str() {
                                            assistant_message.content.push_str(content_str);
                                            
                                            if let Ok(mut state) = crate::share::get_share_state().lock() {
                                                state.last_tokens.push_str(content_str);
                                            }

                                            // Emit stream to frontend
                                            let _ = app.emit("agent-token-stream", json!({
                                                "message_id": assistant_message_id.clone(),
                                                "token": content_str
                                            }));
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Add the finished assistant message to our session
        session.messages.push(assistant_message.clone());
        session.updated_at = Utc::now().timestamp_millis();
        let _ = save_session(&app, &session);

        // Parse tool calls from the accumulated text
        let parsed_calls = parse_tool_calls(&assistant_message.content);
        if parsed_calls.is_empty() {
            // No tool calls found, the agent has finished its work
            let _ = app.emit("agent-status-changed", "idle");
            break;
        }

        // We have tool calls to process!
        let mut tool_results = Vec::new();
        
        // Update assistant message with tool calls in history
        let mut updated_tool_calls = Vec::new();
        for tc in &parsed_calls {
            updated_tool_calls.push(ToolCallInfo {
                id: tc.id.clone(),
                name: tc.name.clone(),
                arguments: tc.arguments.to_string(),
                status: "pending".to_string(),
                output: None,
            });
        }
        
        // Save to session and notify frontend
        if let Some(last_msg) = session.messages.last_mut() {
            last_msg.tool_calls = Some(updated_tool_calls.clone());
        }
        let _ = save_session(&app, &session);
        let _ = app.emit("agent-tools-updated", json!({
            "message_id": assistant_message_id.clone(),
            "tools": updated_tool_calls
        }));

        let mut has_new_tool_executions = false;

        for tc in parsed_calls {
            let is_interactive = tc.name == "write_file" || tc.name == "patch_file" || tc.name == "execute_command";
            
            let mut approved = true;
            if is_interactive {
                // We need confirmation!
                let (tx, rx) = oneshot::channel();
                {
                    let mut lock = state.lock().await;
                    *lock = Some(PendingConfirmation {
                        session_id: session_id.clone(),
                        tool_call_id: tc.id.clone(),
                        tx,
                    });
                }
                
                // Notify frontend we are waiting for confirmation
                let _ = app.emit("agent-status-changed", "waiting_approval");
                let _ = app.emit("agent-tool-status-changed", json!({
                    "message_id": assistant_message_id.clone(),
                    "tool_id": tc.id.clone(),
                    "status": "pending"
                }));
                
                // Wait for frontend response
                approved = rx.await.unwrap_or(false);
                
                // Clear the state
                {
                    let mut lock = state.lock().await;
                    *lock = None;
                }
            }

            // Update status to running/rejected
            let status = if approved { "running" } else { "rejected" };
            let _ = app.emit("agent-status-changed", if approved { "executing_tool" } else { "thinking" });
            let _ = app.emit("agent-tool-status-changed", json!({
                "message_id": assistant_message_id.clone(),
                "tool_id": tc.id.clone(),
                "status": status
            }));

            let output = if approved {
                // Execute
                let res = match tc.name.as_str() {
                    "read_file" => {
                        let path = tc.arguments.get("path").and_then(|v| v.as_str()).unwrap_or("");
                        execute_read_file(&config.workspace_dir, path)
                    }
                    "write_file" => {
                        let path = tc.arguments.get("path").and_then(|v| v.as_str()).unwrap_or("");
                        let content = tc.arguments.get("content").and_then(|v| v.as_str()).unwrap_or("");
                        execute_write_file(&config.workspace_dir, path, content)
                    }
                    "patch_file" => {
                        let path = tc.arguments.get("path").and_then(|v| v.as_str()).unwrap_or("");
                        let content = tc.arguments.get("content").and_then(|v| v.as_str()).unwrap_or("");
                        execute_patch_file(&config.workspace_dir, path, content)
                    }
                    "list_dir" => {
                        let path = tc.arguments.get("path").and_then(|v| v.as_str()).unwrap_or("");
                        execute_list_dir(&config.workspace_dir, path)
                    }
                    "grep_search" => {
                        let pattern = tc.arguments.get("pattern").and_then(|v| v.as_str()).unwrap_or("");
                        let path = tc.arguments.get("path").and_then(|v| v.as_str()).unwrap_or("");
                        execute_grep_search(&config.workspace_dir, pattern, path)
                    }
                    "execute_command" => {
                        let command = tc.arguments.get("command").and_then(|v| v.as_str()).unwrap_or("");
                        execute_shell_command(&config.workspace_dir, command)
                    }
                    _ => Err(format!("Unknown tool: {}", tc.name)),
                };
                
                match res {
                    Ok(out) => {
                        let _ = app.emit("agent-tool-status-changed", json!({
                            "message_id": assistant_message_id.clone(),
                            "tool_id": tc.id.clone(),
                            "status": "completed",
                            "output": out
                        }));
                        out
                    }
                    Err(err) => {
                        let _ = app.emit("agent-tool-status-changed", json!({
                            "message_id": assistant_message_id.clone(),
                            "tool_id": tc.id.clone(),
                            "status": "error",
                            "output": err
                        }));
                        format!("Error: {}", err)
                    }
                }
            } else {
                "Tool execution rejected by the user.".to_string()
            };

            // Record tool result
            tool_results.push(ChatMessage {
                id: uuid::Uuid::new_v4().to_string(),
                role: "tool".to_string(),
                content: format!("Tool {} [{}] output:\n{}", tc.name, tc.id, output),
                timestamp: Utc::now().timestamp_millis(),
                tool_calls: None,
            });

            // Update session representation
            if let Some(last_msg) = session.messages.last_mut() {
                if let Some(ref mut tools) = last_msg.tool_calls {
                    if let Some(t) = tools.iter_mut().find(|x| x.id == tc.id) {
                        t.status = if approved {
                            if output.starts_with("Error:") { "error".to_string() } else { "completed".to_string() }
                        } else {
                            "rejected".to_string()
                        };
                        t.output = Some(output.clone());
                    }
                }
            }
            
            has_new_tool_executions = true;
        }

        // Save tool outputs to history
        for result_msg in tool_results {
            session.messages.push(result_msg);
        }
        session.updated_at = Utc::now().timestamp_millis();
        let _ = save_session(&app, &session);

        if !has_new_tool_executions {
            if let Ok(mut state) = crate::share::get_share_state().lock() {
                state.status = "idle".to_string();
            }
            let _ = app.emit("agent-status-changed", "idle");
            break;
        }
        
        let _ = app.emit("agent-status-changed", "thinking");
        // Loop runs again and sends updated chat history to LLM
    }
}

