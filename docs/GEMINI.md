# GEMINI.md — Architectural Blueprint & Guidelines for 0xAgent

This document serves as the authoritative architectural blueprint and operating guide for AI coding assistants working on the **0xAgent** codebase.

> **Full documentation:** See `docs/architecture.md` and `docs/api/README.md` for detailed architecture and API reference.

---

## 1. Technology Stack & Overview

- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS 4 + Lucide Icons.
- **Backend**: Node.js (TypeScript via `tsx` watch mode) + Express + WebSockets (`ws`).
- **Ports**: Backend API `3001`, Vite UI `5173`, Local LLM `11434`.
- **Data Persistence**: `~/.0xagent/` directory:
  - `config.json`: App and local server configuration.
  - `prompts/`: System prompt files (`default.md`, `coding_agent.md`, etc.).
  - `data/sessions/`: Chat history session JSON files.
  - `memory.json`: Long-term agent facts and preferences.
  - `skills/`: Extensible agent skill instruction markdown files.
  - `llama/`: Installed versions of `llama.cpp` binaries (`llama-server.exe` / `llama.exe`).
  - `models/`: Downloaded `.gguf` model files.

---

## 2. Project Structure (Key Files)

```
server/
  index.ts       — Main server: ALL API routes, WebSocket, llama.cpp child process manager
  agent.ts       — Agent loop: LLM call → parse tool calls → execute → repeat
  config.ts      — Config & prompt file I/O
  session.ts     — Chat session CRUD
  tools.ts       — Tool implementations (read/write/patch/grep/exec/shell)
  memory.ts      — Persistent agent memory
  skills.ts      — Skill files management
  hardware.ts    — GPU auto-detection (Win32_VideoController)
  ggufParser.ts  — GGUF binary header parser

src/
  App.tsx                — Root app: routing, session management, WS listeners
  types.ts               — Shared TypeScript interfaces (AppConfig, LocalServerConfig, etc.)
  services/api.ts        — REST + WebSocket client wrappers
  components/
    ChatArea.tsx          — Chat messages, input, voice input, 1-click launch banner
    ToolCard.tsx          — Tool call approval/rejection UI card
    settings/
      SettingsPage.tsx    — Settings orchestrator (tabs, debounced auto-save)
      LocalServerTab.tsx  — llama.cpp server config + GitHub installer UI
```

---

## 3. Backend API Routes Quick Reference

### Config & Settings
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/config` | Load full app config |
| POST | `/api/config` | Save full app config |

### Chat Sessions
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sessions` | List all sessions |
| GET | `/api/sessions/:id` | Load session by ID |
| POST | `/api/sessions` | Create new session `{ title }` |
| POST | `/api/sessions/:id/save` | Save session |
| DELETE | `/api/sessions/:id` | Delete session |

### Agent Execution
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/send-message` | Trigger agent loop `{ sessionId }` |
| POST | `/api/cancel-agent` | Cancel agent `{ sessionId }` |
| POST | `/api/respond-to-tool` | Approve/reject tool `{ sessionId, toolCallId, approve }` |

### System Prompts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/prompts` | List prompt files |
| GET | `/api/prompts/:filename` | Read prompt content |
| POST | `/api/prompts/:filename` | Write prompt `{ content }` |
| DELETE | `/api/prompts/:filename` | Delete prompt |
| POST | `/api/prompts-select` | Set active prompt `{ filename }` |

### Memory & Skills
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/memories` | List memories (`?query=...`) |
| POST | `/api/memories` | Add/update `{ key, value, category }` |
| DELETE | `/api/memories/:id` | Delete memory |
| GET | `/api/skills` | List skills |
| GET | `/api/skills/:name` | Read skill |
| POST | `/api/skills/:name` | Write skill |
| DELETE | `/api/skills/:name` | Delete skill |

### Workspace & Files
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/select-workspace` | Native folder picker |
| POST | `/api/select-file` | Native file picker `{ filter }` |
| GET | `/api/workspace-tree` | File tree (`?workspaceDir=...`) |
| GET | `/api/read-file-raw` | Read file (`?path=...`) |
| POST | `/api/write-file-raw` | Write file `{ path, content }` |

### Local LLM Server (llama.cpp)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/start-local-server` | Spawn llama-server process |
| POST | `/api/stop-local-server` | Kill llama-server process |
| GET | `/api/server-health` | Health check (`?host=...&port=...`) |
| GET | `/api/server-slots` | Live slot metrics |

### GGUF Model & llama.cpp Management
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/llama-releases` | GitHub releases (15-min cache) |
| GET | `/api/installed-llama-versions` | Locally installed versions |
| POST | `/api/install-llama-version` | Download/install version |
| POST | `/api/select-installed-llama` | Switch active version |
| GET | `/api/gguf-models` | Recommended model catalog |
| POST | `/api/download-model` | Download GGUF model |
| POST | `/api/parse-gguf` | Parse GGUF metadata |
| GET | `/api/scan-models-dir` | Scan directory for models |

### Other
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/detect-hardware` | GPU auto-detection |
| POST | `/api/transcribe-audio` | Groq Whisper STT |
| GET | `/api/get-local-ips` | LAN IP addresses |

---

## 4. WebSocket Events

Connection: `ws://localhost:3001/ws`. Messages: `{ event, payload }`.

| Event | Payload | Description |
|-------|---------|-------------|
| `agent-status-changed` | `"idle" \| "thinking" \| "waiting_approval" \| "executing_tool"` | Agent state |
| `agent-message-start` | `{ sessionId, messageId }` | New assistant message |
| `agent-token-stream` | `{ sessionId, messageId, token, fullContent }` | Streaming LLM tokens |
| `agent-tools-updated` | `{ sessionId, messageId, tools[] }` | Tool calls parsed |
| `agent-tool-status-changed` | `{ sessionId, toolCallId, status, output? }` | Tool status |
| `agent-error` | `string \| { sessionId, message }` | Error / status notification |
| `llama-server-log` | `string` | Live llama-server stdout/stderr |

---

## 5. Process Lifetime & Launcher Supervisor

1. **`start.bat` & PowerShell Launcher (`scripts/start.ps1`)**:
   - `start.bat` delegates execution to `scripts/start.ps1` with UTF-8 encoding (`chcp 65001`).
   - `scripts/cleanup.ps1`: Clears any processes bound to ports **3001** (Backend API) and **5173** (Vite UI), as well as any background instances of `llama-server.exe`, `llama.exe`, or orphaned `node.exe` processes running 0xAgent.
   - **Log Retention & Archive Cycle**: Session output is captured into `logs/0xAgent_YYYY-MM-DD_HH-MM-SS.log`. If raw log count reaches 10, older logs are compressed into `.zip` archives inside `logs/archive/`.
   - **Process Trap**: `finally` block in `start.ps1` and Node process signal handlers (`SIGINT`, `SIGTERM`, `exit`, `uncaughtException`) ensure zero orphaned processes remain when exiting.
   - **Manual Cleanup**: `npm run stop` executes `scripts/cleanup.ps1`.

---

## 6. Local LLM Engine (`llama.cpp`) Management

- Local GGUF models are executed via `llama.cpp` binaries spawned directly by the Node backend (`server/index.ts`).
- **Endpoint `/api/start-local-server`**:
  - Spawns `llama-server.exe` with configured parameters (`-m`, `-c`, `-ngl`, `-t`, `-b`, `-ub`, `--temp`, `--min-p`, `--repeat-penalty`, `-fa`, `--no-mmap`, `--mlock`, `--embedding`, `--cont-batching`).
  - Auto-detects installed binaries in `~/.0xagent/llama/` and GGUF models in `~/.0xagent/models/` if parameters are omitted.
  - Calls `killProcessOnPort(port)` before spawn to handle orphaned processes from tsx restarts.
  - Streams stdout/stderr real-time logs over WebSocket (`llama-server-log` event).
- **Endpoint `/api/stop-local-server`**:
  - Terminates the active `llama-server.exe` process tree using `taskkill /F /T /PID` on Windows.

---

## 7. Configuration & State Persistence Rules (CRITICAL)

- **Auto-save Mechanism**: `SettingsPage.tsx` uses a 600ms debounced `useEffect` to automatically save changes to `/api/config`.
- **CRITICAL RULE**: When adding or updating configuration fields in `SettingsPage.tsx` or `AppConfig` (`src/types.ts`), you **MUST** ensure that `useEffect` on `config` load restores **ALL** fields from `config.local_server` into state.
  - *Failure to restore a state property when loading `config` causes the debounced auto-save to overwrite `config.json` with initial default values on startup!*

---

## 8. UI Features & Error Handling Architecture

1. **Interactive Warning Banner & 1-Click Launch (`src/components/ChatArea.tsx`)**:
   - Polls `/api/server-health` every 3000ms.
   - Renders a prominent warning banner above the chat input box in both empty hero view (`!hasMessages`) and chat history view (`hasMessages`) when the local server is offline:
     `⚠️ Локальный LLM Сервер не запущен на порту 11434!` Button: `🚀 Запустить LLM Сервер в 1-клик`.
   - Clicking the button starts the server via `/api/start-local-server`, polls `/health` readiness, and automatically sends any typed user prompt once ready.

2. **System Error Persisting & Instant Dialogue Rendering**:
   - On LLM failure or network disconnect, `server/agent.ts` and `server/index.ts` push the error message directly into `session.messages`, update `session.updated_at`, save to disk (`saveSession`), and broadcast `agent-error`.
   - `App.tsx` catches `agent-error` WebSocket events and instantly reloads/renders the session so errors appear immediately inside the chat dialogue without delay.

---

## 9. Agent Tool System & Unified TOOLS.md Architecture

The agent uses XML-tagged tool calls parsed from LLM responses in `agent.ts`.
Tools configuration is decoupled from Personas and managed globally in `server/toolsConfig.ts`.

- **Persistence**: `~/.0xagent/tools_config.json` (toggles) & `~/.0xagent/TOOLS.md` (unified global system prompt snippet loaded in `agent.ts`).
- **UI Management**: Configurable via the **Инструменты (TOOLS.md)** tab under Settings -> Personas. Each tool can be toggled on/off to optimize context length.
- **Endpoints**:
  - `GET /api/tools`: Get active tools list, toggle states, and `TOOLS.md` content.
  - `POST /api/tools/toggles`: Update tool enabled/disabled states and regenerate `TOOLS.md`.
  - `POST /api/tools/md`: Save custom `TOOLS.md` content directly.

| Tool | Category | Requires Approval | Description |
|------| font-mono |:-:|---|
| `read_file` | Files | No | Read file contents |
| `write_file` | Files | **Yes** | Write/create file |
| `patch_file` | Files | **Yes** | Surgical search/replace patch |
| `create_directory` | Files | No | Recursive directory creation |
| `get_file_info` | Files | No | File/folder metadata inspection |
| `list_dir` | Files | No | List directory contents |
| `grep_search` | Files | No | Regex search across files |
| `execute_command` | Terminal | **Yes** | Execute PowerShell command |
| `remember_fact` | Memory | No | Store persistent memory |
| `recall_memories` | Memory | No | Query stored memories |
| `list_skills` | Skills | No | List available skills |
| `execute_skill` | Skills | No | Execute a skill instruction |
| `search_sessions` | Sessions | No | Search chat history |
| `run_scratch_script` | Terminal | **Yes** | Run temporary script |
| `ask_user` | Interactive | N/A | Ask user for clarification |
| `spawn_subagent` | Agents | No | Spawn a sub-agent |

---

## 10. Verification Checklist for Developers / AI Models

When making changes to 0xAgent:
1. Run `npx tsc --noEmit` to verify type safety across frontend and backend.
2. Run `npm run build` to verify Vite production build.
3. Test process cleanup using `powershell -ExecutionPolicy Bypass -File ./scripts/cleanup.ps1`.

