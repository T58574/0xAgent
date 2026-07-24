# GEMINI.md — Architectural Blueprint & Guidelines for 0xAgent

This document serves as the authoritative architectural blueprint and operating guide for AI coding assistants working on the **0xAgent** codebase.

---

## 1. Technology Stack & Overview

- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS 4 + Lucide Icons.
- **Backend**: Node.js (TypeScript via `tsx` watch mode) + Express + WebSockets (`ws`).
- **Data Persistence**: `~/.0xagent/` directory:
  - `config.json`: App and local server configuration.
  - `prompts/`: System prompt files (`default.md`, `coding_agent.md`, etc.).
  - `data/sessions/`: Chat history session JSON files.
  - `memory.json`: Long-term agent facts and preferences.
  - `skills/`: Extensible agent skill instruction markdown files.
  - `llama/`: Installed versions of `llama.cpp` binaries (`llama-server.exe` / `llama.exe`).
  - `models/`: Downloaded `.gguf` model files.

---

## 2. Process Lifetime & Launcher Supervisor

1. **`start.bat` & PowerShell Launcher (`scripts/start.ps1`)**:
   - `start.bat` delegates execution to `scripts/start.ps1` with UTF-8 encoding (`chcp 65001`).
   - `scripts/cleanup.ps1`: Clears any processes bound to ports **3001** (Backend API) and **5173** (Vite UI), as well as any background instances of `llama-server.exe`, `llama.exe`, or orphaned `node.exe` processes running 0xAgent.
   - **Log Retention & Archive Cycle**: Session output is captured into `logs/0xAgent_YYYY-MM-DD_HH-MM-SS.log`. If raw log count reaches 10, older logs are compressed into `.zip` archives inside `logs/archive/`.
   - **Process Trap**: `finally` block in `start.ps1` and Node process signal handlers (`SIGINT`, `SIGTERM`, `exit`, `uncaughtException`) ensure zero orphaned processes remain when exiting.
   - **Manual Cleanup**: `npm run stop` executes `scripts/cleanup.ps1`.

---

## 3. Local LLM Engine (`llama.cpp`) Management

- Local GGUF models are executed via `llama.cpp` binaries spawned directly by the Node backend (`server/index.ts`).
- **Endpoint `/api/start-local-server`**:
  - Spawns `llama-server.exe` with configured parameters (`-m`, `-c`, `-ngl`, `-t`, `-b`, `-ub`, `--temp`, `--min-p`, `--repeat-penalty`, `-fa`, `--no-mmap`, `--mlock`, `--embedding`, `--cont-batching`).
  - Auto-detects installed binaries in `~/.0xagent/llama/` and GGUF models in `~/.0xagent/models/` if parameters are omitted.
  - Streams stdout/stderr real-time logs over WebSocket (`llama-server-log` event).
- **Endpoint `/api/stop-local-server`**:
  - Terminates the active `llama-server.exe` process tree using `taskkill /F /T /PID` on Windows.

---

## 4. Configuration & State Persistence Rules (CRITICAL)

- **Auto-save Mechanism**: `SettingsPage.tsx` uses a 600ms debounced `useEffect` to automatically save changes to `/api/config`.
- **CRITICAL RULE**: When adding or updating configuration fields in `SettingsPage.tsx` or `AppConfig` (`src/types.ts`), you **MUST** ensure that `useEffect` on `config` load restores **ALL** fields from `config.local_server` into state.
  - *Failure to restore a state property when loading `config` causes the debounced auto-save to overwrite `config.json` with initial default values on startup!*

---

## 5. UI Features & Error Handling Architecture

1. **Interactive Warning Banner & 1-Click Launch (`src/components/ChatArea.tsx`)**:
   - Polls `/api/server-health` every 3000ms.
   - Renders a prominent warning banner above the chat input box in both empty hero view (`!hasMessages`) and chat history view (`hasMessages`) when the local server is offline:
     `⚠️ Локальный LLM Сервер не запущен на порту 11434!` Button: `🚀 Запустить LLM Сервер в 1-клик`.
   - Clicking the button starts the server via `/api/start-local-server`, polls `/health` readiness, and automatically sends any typed user prompt once ready.

2. **System Error Persisting & Instant Dialogue Rendering**:
   - On LLM failure or network disconnect, `server/agent.ts` and `server/index.ts` push the error message directly into `session.messages`, update `session.updated_at`, save to disk (`saveSession`), and broadcast `agent-error`.
   - `App.tsx` catches `agent-error` WebSocket events and instantly reloads/renders the session so errors appear immediately inside the chat dialogue without delay.

---

## 6. Verification Checklist for Developers / AI Models

When making changes to 0xAgent:
1. Run `npx tsc --noEmit` to verify type safety across frontend and backend.
2. Run `npm run build` to verify Vite production build.
3. Test process cleanup using `powershell -ExecutionPolicy Bypass -File ./scripts/cleanup.ps1`.
