# 0xAgent: Local AI Agent Developer Workspace

This file is a guide for future AI agents working on this codebase. It documents the architecture, data flow, tool execution loops, and development guidelines for the **0xAgent** desktop application.

---

## 📌 Project Overview
**0xAgent** is a fast, visually rich, and secure local developer agent desktop application.
* **Backend**: Tauri v2 + Rust (handles safety, file I/O, process execution, and the main agent loop).
* **Frontend**: React + Vite + TypeScript + Tailwind CSS v4 (handles chat log presentation, state sync, and interactive tool confirmations).
* **Model Server**: Connects to any local OpenAI-compatible endpoint (e.g. `llama.cpp` or `Ollama`) listening by default on `http://127.0.0.1:11434/v1`.

---

## 📂 Codebase Architecture

```
0xAgent/
├── src-tauri/               # Rust Backend (Tauri v2)
│   ├── src/
│   │   ├── main.rs          # Process Entrypoint
│   │   ├── lib.rs           # Tauri Command definitions, AppState & init
│   │   ├── config.rs        # App settings (API URL, model parameters)
│   │   ├── session.rs       # Chat history JSON storage & load functions
│   │   └── agent.rs         # Agent Completion Loop, XML Parser, Tool Executors
│   └── Cargo.toml           # Backend dependencies (tokio, reqwest, rfd, uuid)
├── src/                     # React Frontend (TypeScript)
│   ├── components/
│   │   ├── Sidebar.tsx      # Sidebar settings & session switcher
│   │   ├── ChatArea.tsx     # Message logs and text input form
│   │   ├── MessageBubble.tsx# Format chat bubble (User/Agent) and strips XML tags
│   │   └── ToolCard.tsx     # Widget displaying parameters, output, and Approve/Reject
│   ├── utils/
│   │   └── helpers.ts       # Text cleaning and uuid helpers
│   ├── App.tsx              # Root component: sets up Tauri IPC & State Orchestrator
│   ├── index.css            # Tailwind CSS v4 entrypoint
│   ├── types.ts             # TS types (AppConfig, ChatSession, ToolCallInfo)
│   └── main.tsx             # React entrypoint
└── vite.config.ts           # Vite build config
```

---

## 🤖 The Agent Loop & Tool Flow

The logic of the agent resides entirely on the Rust backend (`agent.rs`). When the user sends a message:
1. The frontend invokes `send_message(session_id)`.
2. The Rust backend spawns a background `tokio::spawn` task executing `run_agent_loop(...)`.
3. **LLM Connection**: The backend queries the LLM completions endpoint with `stream: true`.
4. **SSE Token Streaming**: Tokens are streamed in real-time. The backend emits `agent-message-start` and `agent-token-stream` events to the frontend.
5. **Tool Parsing**: Once the model finishes its output, the backend parses the text using Regex looking for structured XML tags:
   - `<read_file path="..." />`
   - `<write_file path="...">contents</write_file>`
   - `<patch_file path="...">search-and-replace-blocks</patch_file>`
   - `<list_dir path="..." />`
   - `<grep_search pattern="..." path="..." />`
   - `<execute_command>command</execute_command>`
6. **Tool Execution & Confirmations**:
   - **Auto-Approved**: Read-only tools (`read_file`, `list_dir`, `grep_search`) execute immediately.
   - **Interactive Confirmation**: Write-based/shell execution tools (`write_file`, `patch_file`, `execute_command`) pause the loop. The backend sets Tauri State `pending_confirmation` and emits `agent-status-changed` with `"waiting_approval"`.
   - The frontend renders an interactive widget on the tool card with **Approve** and **Reject** buttons.
   - Clicking a button invokes the `respond_to_tool` Tauri command which sends a boolean to the backend oneshot channel.
   - The backend resumes, runs the command if approved (in Windows PowerShell for shell commands), logs the output, and appends the result to the history as a `tool` role message.
7. **Re-Completion**: The loop restarts, feeding the tool execution log back into the LLM context until the LLM stops returning tool tags.

---

## 🛠️ IPC Communication (Tauri Events & Commands)

### Tauri Commands (Invoked from React)
* `get_config() -> Result<AppConfig, String>`
* `save_config(config: AppConfig) -> Result<(), String>`
* `list_sessions() -> Result<Vec<ChatSession>, String>`
* `load_session(id: String) -> Result<ChatSession, String>`
* `save_session(session: ChatSession) -> Result<(), String>`
* `create_session(title: String) -> Result<ChatSession, String>`
* `delete_session(id: String) -> Result<(), String>`
* `select_workspace() -> Result<Option<String>, String>` (opens native RFD picker)
* `send_message(session_id: String) -> Result<(), String>` (starts async agent task)
* `respond_to_tool(session_id: String, tool_call_id: String, approve: bool) -> Result<(), String>`

### Tauri Events (Emitted from Rust to React)
* `"agent-message-start"`: payload `{ id: string, role: string }`
* `"agent-token-stream"`: payload `{ message_id: string, token: string }`
* `"agent-status-changed"`: payload `"idle" | "thinking" | "waiting_approval" | "executing_tool"`
* `"agent-tools-updated"`: payload `{ message_id: string, tools: ToolCallInfo[] }`
* `"agent-tool-status-changed"`: payload `{ message_id: string, tool_id: string, status: string, output?: string }`
* `"agent-error"`: payload `string` (errors thrown to toast system)

---

## ⚙️ Development & Build Guidelines

### ⚡ Windows Loopback Configuration (Crucial)
To prevent Tauri from hanging while waiting for the Vite dev server to respond:
* Vite's server host is hardcoded to `"127.0.0.1"` in `vite.config.ts`.
* Tauri's devUrl is bound to `http://127.0.0.1:1420` in `tauri.conf.json`.
* **Never** change these to `localhost` to avoid Windows IPv6 `::1` loopback resolution bugs.

### 📦 Production Compilation
To compile the standalone Windows executable:
1. Close any running instances of the app (Windows locks files during execution).
2. Run:
   ```bash
   npm run tauri build
   ```
3. Locate outputs:
   - Standalone exe: `src-tauri/target/release/tauri-app.exe`
   - Setup installer: `src-tauri/target/release/bundle/nsis/0xAgent_0.1.0_x64-setup.exe`

### ⚠️ Compiler Access Violations (Low-Memory/CI environments)
If `cargo build --release` crashes with `STATUS_ACCESS_VIOLATION` (0xc0000005) due to parallel thread limits, restrict compilation threads:
```powershell
$env:CARGO_BUILD_JOBS=1
npm run tauri build
```

---

## 💡 Notes for Code Maintenance
1. **Modularity**: Keep the React directory modular. Do **not** pack layout code back into `App.tsx`.
2. **XML Tag Stripping**: The UI filters out raw XML tags from text bubbles using the `cleanContent` helper. If an assistant message contains only tool execution blocks, no text bubble is rendered to prevent empty circular boxes from clogging the UI.
3. **SSE Line Buffering**: In `agent.rs`, parsing SSE lines is line-by-line using `\n` search. If modifying this, ensure double newlines in SSE payloads are gracefully skipped.
