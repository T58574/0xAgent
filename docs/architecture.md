# 0xAgent Architecture Overview

> **Version:** 0.1.0  
> **Platform:** Windows (primary), macOS (partial)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    start.bat (Entry Point)               │
│                        ↓                                 │
│              scripts/start.ps1 (Supervisor)              │
│         ┌──────────────────────────────┐                 │
│         │  Log Rotation & Archiving    │                 │
│         │  Port/Process Cleanup        │                 │
│         │  Exit Trap (finally block)   │                 │
│         └──────────────────────────────┘                 │
│                        ↓                                 │
│    ┌───────────────────┴────────────────────┐            │
│    │                                        │            │
│    ▼                                        ▼            │
│ [SERVER] tsx watch server/index.ts    [CLIENT] vite      │
│   Port 3001 (API + WebSocket)           Port 5173 (UI)  │
│    │                                        │            │
│    ├─ Express REST API                      ├─ React 19  │
│    ├─ WebSocket Server (ws)                 ├─ TailwindCSS│
│    ├─ Agent Loop (agent.ts)                 ├─ Lucide Icons│
│    ├─ llama.cpp Child Process Manager       └─ TypeScript │
│    └─ GGUF Parser / Hardware Detector                    │
└─────────────────────────────────────────────────────────┘
                        ↕
              ┌─────────────────────┐
              │  ~/.0xagent/        │
              │  ├─ config.json     │
              │  ├─ memory.json     │
              │  ├─ prompts/        │
              │  ├─ skills/         │
              │  ├─ data/sessions/  │
              │  ├─ llama/          │
              │  └─ models/         │
              └─────────────────────┘
```

---

## Project File Structure

```
0xAgent/
├── start.bat                    # Entry point — invokes scripts/start.ps1
├── package.json                 # npm scripts: dev, build, stop
├── tsconfig.json                # TypeScript config (frontend + backend)
├── vite.config.ts               # Vite dev server + proxy config
├── GEMINI.md                    # AI model architectural blueprint
│
├── scripts/
│   ├── start.ps1                # Supervisor: cleanup → log rotation → concurrently
│   └── cleanup.ps1              # Kill stale processes on ports 3001/5173/llama
│
├── server/                      # Backend (Node.js + Express + TypeScript)
│   ├── index.ts                 # Main server: all API routes, WebSocket, llama manager
│   ├── agent.ts                 # Agent loop: LLM ↔ tool execution cycle
│   ├── config.ts                # Config & prompt file I/O (~/.0xagent/)
│   ├── session.ts               # Chat session CRUD (~/.0xagent/data/sessions/)
│   ├── tools.ts                 # Tool implementations (read/write/patch/grep/exec)
│   ├── memory.ts                # Persistent agent memory (~/.0xagent/memory.json)
│   ├── skills.ts                # Extensible skill files (~/.0xagent/skills/)
│   ├── hardware.ts              # GPU auto-detection (Win32_VideoController / wmic)
│   └── ggufParser.ts            # GGUF binary header parser for model metadata
│
├── src/                         # Frontend (React 19 + TypeScript)
│   ├── main.tsx                 # React entry point
│   ├── App.tsx                  # Root app: routing, session management, WS listeners
│   ├── types.ts                 # Shared TypeScript interfaces
│   ├── index.css                # TailwindCSS 4 + custom design tokens
│   │
│   ├── services/
│   │   └── api.ts               # REST + WebSocket client wrappers
│   │
│   ├── components/
│   │   ├── ChatArea.tsx          # Chat messages, input, voice, 1-click launch banner
│   │   ├── Header.tsx            # Top navigation bar
│   │   ├── BottomPanel.tsx       # Bottom toolbar panel
│   │   ├── WorkspaceTree.tsx     # File tree sidebar
│   │   ├── CodeEditor.tsx        # Inline code viewer/editor
│   │   ├── FileViewer.tsx        # Raw file content viewer
│   │   ├── ToolCard.tsx          # Tool call approval/rejection UI
│   │   ├── MemorySkillsModal.tsx # Memory & Skills management modal
│   │   ├── ModelPickerModal.tsx  # GGUF model scanner/picker modal
│   │   │
│   │   └── settings/
│   │       ├── SettingsPage.tsx   # Settings orchestrator (tabs, auto-save)
│   │       ├── GeneralTab.tsx     # General settings (API URL, model, tokens)
│   │       ├── LocalServerTab.tsx # llama.cpp server config + installer UI
│   │       ├── PromptsTab.tsx     # System prompts editor
│   │       ├── ColorsTab.tsx      # Custom theme color picker
│   │       └── ThemesTab.tsx      # Preset theme selector
│   │
│   └── utils/
│       └── helpers.ts            # Utility functions
│
├── logs/                        # Runtime logs (auto-rotated)
│   └── archive/                 # Compressed old logs (.zip)
│
└── models/                      # Local GGUF model files (gitignored)
```

---

## Data Storage (`~/.0xagent/`)

| Path | Format | Purpose |
|---|---|---|
| `config.json` | JSON | All app settings: API URL, model name, theme, local_server params |
| `memory.json` | JSON | Agent long-term facts and user preferences |
| `prompts/` | `.md` files | System prompt templates (default.md, coding_agent.md, etc.) |
| `skills/` | `.md` files | Extensible agent skill instruction files |
| `data/sessions/` | JSON files | Chat history sessions (one file per session) |
| `llama/` | Directories | Installed llama.cpp versions (e.g. `llama/b10099/`) |
| `models/` | `.gguf` files | Downloaded GGUF model files |

---

## Agent Tool System

The agent uses XML-tagged tool calls parsed from LLM responses. Tools available:

| Tool | XML Format | Description |
|---|---|---|
| `read_file` | `<read_file path="..." />` | Read file contents |
| `write_file` | `<write_file path="...">content</write_file>` | Write file (create/overwrite) |
| `patch_file` | `<patch_file path="...">SEARCH/REPLACE</patch_file>` | Surgical file patching |
| `list_dir` | `<list_dir path="..." />` | List directory contents |
| `grep_search` | `<grep_search pattern="..." path="..." />` | Regex search in files |
| `execute_command` | `<execute_command>cmd</execute_command>` | Execute PowerShell command |
| `remember_fact` | `<remember_fact key="..." value="..." />` | Store persistent memory |
| `recall_memories` | `<recall_memories query="..." />` | Query stored memories |
| `list_skills` | `<list_skills />` | List available skills |
| `execute_skill` | `<execute_skill name="..." />` | Execute a skill |
| `search_sessions` | `<search_sessions query="..." />` | Search chat history |
| `run_scratch_script` | `<run_scratch_script language="...">code</run_scratch_script>` | Run temporary script |
| `ask_user` | `<ask_user question="..." />` | Ask user clarification |
| `spawn_subagent` | `<spawn_subagent role="..." goal="..." />` | Spawn a sub-agent |

### Tool Confirmation Flow

Destructive tools (`write_file`, `patch_file`, `execute_command`) require user approval:

1. Agent parses tool calls from LLM response
2. Backend broadcasts `agent-tools-updated` with status `"pending"`
3. Frontend renders `ToolCard` with Approve/Reject buttons
4. User clicks → `POST /api/respond-to-tool` → agent continues or skips

---

## Process Management

### Startup Flow (`start.bat` → `scripts/start.ps1`)

1. Set UTF-8 encoding (`chcp 65001`)
2. Run `scripts/cleanup.ps1` — kill stale processes on ports 3001, 5173, and any llama-server/llama.exe
3. Archive logs if count > 10 → compress to `logs/archive/`
4. Launch `npm run dev` (concurrently: tsx + vite)
5. Capture output to `logs/0xAgent_YYYY-MM-DD_HH-MM-SS.log`
6. On exit: `finally` block runs cleanup again

### Exit Handlers (Node.js — `server/index.ts`)

Signals `SIGINT`, `SIGTERM`, `exit`, `uncaughtException` all call `cleanupOnExit()` which kills the active llama-server child process via `taskkill /F /T /PID`.

### Orphan Process Protection

When `tsx` restarts the Node server (file change), the module-level `activeLlamaProcess` reference is lost. The function `killProcessOnPort(port)` uses `netstat` + `taskkill` to find and kill any process holding the target port before spawning a new llama-server.

---

## Configuration Auto-Save Mechanism

**CRITICAL for developers:**

`SettingsPage.tsx` uses a 600ms debounced `useEffect` to auto-save all settings to `POST /api/config`. When the config loads, `useEffect` restores all `config.local_server` fields into React state.

⚠️ **If you add a new field to `LocalServerConfig` in `types.ts`, you MUST also:**
1. Add a `useState` hook in `SettingsPage.tsx`
2. Restore its value from `config.local_server` in the `useEffect` on config load
3. Include it in the debounced save payload

**Failure to do this causes the debounced auto-save to overwrite `config.json` with default values, destroying user settings.**
