# GEMINI.md — 0xAgent Architecture & Developer Guide

## 🚀 Overview
**0xAgent** is a local-first autonomous AI conversational agent, companion & Web-IDE platform (React 19 + Node.js/Express + SQLite WAL + local llama.cpp / hybrid cloud LLMs).

---

## 📁 Key File Map

### Core CLI & Installers
- `bin/0xagent.js` — Universal CLI Hub (`0xagent start`, `config`, `update`, `status`, `purge-vram`, `stop`).
- `install.ps1` — 1-Click interactive Windows installer with dependency checks, C# tray build, and PATH binding.
- `install.sh` — 1-Click interactive Unix/macOS installer and CLI linker.
- `launcher/TrayLauncher.cs` — Native C# Windows System Tray supervisor (~15 KB, ~8 MB RAM).

### Backend Core (`server/`)
- `index.ts` — Express API (`:3001`), WebSocket gateway (`/ws`), and process supervisor for `llama-server.exe`.
- `agent.ts` — Autonomous agent orchestrator (prompt execution loop, streaming, tool dispatching).
- `agent/` — Agent submodules:
  - `memoryWorker.ts` — Asynchronous debounced background memory ingestion worker.
  - `llmClient.ts` — Universal LLM client (local llama.cpp & Google AI Studio Gemini).
  - `toolDispatcher.ts` / `toolParser.ts` — Tool execution and robust XML/tag parsing (`<toolcall>`, `<tool_call>`).
  - `promptBuilder.ts` — Dynamic system prompt construction, persona injection, and context assembly.
  - `contextManager.ts` / `compactionPipeline.ts` — 4-tier context compression and token management.
  - `toolResultPruner.ts` — Model-free syntactic trimming of historical tool outputs.
  - `loopBreaker.ts` — Infinite tool loop & cyclic oscillation breaker.
  - `outputSpiller.ts` — Automatic spilling of massive tool outputs (>24 KB) to disk.
  - `codeRuntime.ts` — Sandboxed Node.js VM runtime for `<code_run>` batch operations.
  - `permissionGuard.ts` — Security presets (`prompt` - Partial Automation, `unrestricted` - Full Automation).
  - `voiceDaemonManager.ts` / `voiceMacroService.ts` — Native voice spotting and zero-token OS macros.
- `memory.ts` — Memory Engine v1.0 (CRUD, Write Policy, deterministic router, token budget allocator).
- `memoryDb.ts` — Native `node:sqlite` connection manager, WAL mode, tables and FTS5 triggers.
- `jarvisSupervisor.ts` / `proactiveCompanion.ts` — Voice companion orchestrator, sparks engine, and activity watcher.
- `voice_daemon.py` — Native Python onnx speech recognizer daemon (sherpa-onnx / Moonshine).
- `tools/` & `tools.ts` — Tool implementations (file system, patches, search, terminal execution).
- `config.ts` — Application settings store (`~/.0xagent/config.json`).
- `session.ts` — Multi-session storage, message history, and branching.
- `hardware.ts` — GPU/VRAM hardware detection (`Win32_VideoController`).
- `ggufParser.ts` — Binary GGUF metadata parser.
- `fffService.ts` — High-speed fuzzy file search (`@ff-labs/fff-node`).
- `searxngService.ts` / `webReaderService.ts` — Privacy-first web search and HTML-to-Markdown reader.
- `ttsService.ts` — Text-to-speech audio synthesis.

### Module Veronica Subsystem (`server/veronica/`)
- `telegram/` — Telegram bot gateway (`bot.ts`), multi-turn session orchestrator (`veronicaOrchestrator.ts`), and HTML card builder (`messageBuilder.ts`).
- `core/` — Task registry (`taskRegistry.ts`), project discovery (`projectDiscovery.ts`), project passport documentation manager (`projectDocManager.ts`), 4-phase structured task prompt builder (`taskPromptBuilder.ts`), context engine (`contextEngine.ts`), operational journal (`operationalJournal.ts`), and project mutex lock manager (`projectLockManager.ts`).
- `cli/` — CLI handler (`cliHandler.ts`) and safe git executor (`gitExecutor.ts`).
- `adapters/` — Antigravity Headless CLI adapter (`antigravityAdapter.ts`), safe CLI path resolution (`getSafeCliPath`), and model/effort parameter validator (`resolveAntigravityModelAndEffort`).
- `db/` — SQLite WAL connection (`veronicaDb.ts`), schema migrations (`migrations.ts`), and single-writer queue (`writeQueue.ts`).
- `watchdog/` — Task recovery watchdog (`recoveryService.ts`) and process supervisor.

### Frontend (`src/`)
- `App.tsx` — Root component, split-screen layout, and WebSocket subscriptions.
- `types.ts` — **Single Source of Truth** for all shared data types across frontend and backend.
- `components/` — UI components:
  - `ui/` — **Atomic Design System** (`Button.tsx`, `Input.tsx`, `Select.tsx`, `Toggle.tsx`, `Badge.tsx`, `Card.tsx`, `Modal.tsx`, `index.ts`).
  - `Navbar.tsx` — Top control bar (server status, model/view selector, telemetry).
  - `Sidebar.tsx` — Session history, active workspaces, and file explorer.
  - `ChatArea.tsx` — Chat stream, tool cards, reasoning viewer (`<think>`), and live plan progress HUD.
  - `CodeEditor.tsx` — Multi-tab Monaco-style code viewer and editor.
  - `chat/` — Chat components (`ReasoningViewer.tsx`, `FloatingCommandBar.tsx`, `PlanProgressStrip.tsx`, `VeronicaActionStrip.tsx`).
  - `veronica/` — Veronica Web-IDE integration (`VeronicaTaskModal.tsx`, `VeronicaPage.tsx`).
  - `settings/` — Settings tabs (General, LLM Server, Personas, Themes, Security, Customizations).
  - `settings/personas/` — Modular persona & memory subcomponents (`MemoryManagerSection.tsx`, `PersonaEditorSection.tsx`, `TokenTelemetrySection.tsx`).
  - `settings/common/` — Settings molecules (`SettingsHeader.tsx`, `SettingsSection.tsx`, `SettingToggleCard.tsx`, `SettingItemRow.tsx`, `SettingStatCard.tsx`).
  - `KnowledgeVault/` — Knowledge base manager, RAG retrieval index, and vector embeddings viewer.
  - `JarvisSanctuary.tsx` / `JarvisWidget.tsx` — Voice companion floating HUD, audio visualizer, and active sparks.
  - `MemorySkillsModal.tsx` — Long-term memory viewer and AGY skill inspector.
  - `AnalyticsPage.tsx` — Token analytics, telemetry benchmarks, and model performance metrics.
  - `common/` — Shared UI elements (`MaterialIcon.tsx`, `AsciiCanvasEngine.tsx`).
- `i18n/` — Bilingual translation dictionaries (`en.ts`, `ru.ts`).
- `services/api.ts` & `services/wsService.ts` — REST API and WebSocket communication layers.
- `index.css` — Glassmorphism styles and 2 clean brutal themes (`graphite`, `light`).

### Data Directory (`~/.0xagent/`)
- `memory.db` — SQLite canonical database (WAL mode: canonical memories, episodes, relationships, audit log, FTS5).
- `veronica/` — Veronica SQLite audit journal (`veronica.db`), backups & task history.
- `config.json` — Persistent configuration.
- `bin/` — Global CLI executables (`0xagent.cmd`, `0xagent.ps1`, `0xagent`).
- `app/` — Codebase installation directory.
- `data/sessions/` — Chat sessions in JSON.
- `personas/` — Persona profiles (`SOUL.md`, `USER.md`, `TOOLS.md`).
- `workspaces/` — Auto-generated sandbox directories for isolated tasks.
- `spill/` — Truncated large output logs.
- `llama/` & `models/` — Local llama.cpp binaries and GGUF model files.

---

## 🛡 Architectural Rules & Invariants

1. **Single Source of Types**: `src/types.ts` is the single source of truth for all types. Both frontend and backend import from here.
2. **Safe Code Rendering (Zero XSS)**: Never use `dangerouslySetInnerHTML`. Code and markdown are tokenized safely via React elements.
3. **Patching Standard (`patch_file`)**: Always use `patch_file` with `SEARCH`/`REPLACE` blocks for existing files (>50 lines). `write_file` is reserved for new or small files only.
4. **Fast File & Web Search**: Use `fffService` for workspace file discovery (<3 ms) and `searxngService`/`webReaderService` for web research without token bloat.
5. **Strict Async I/O**: Synchronous blocking calls (`fs.readFileSync`, `execSync`) are prohibited on request/event paths. Use `fs.promises` and async child processes.
6. **Zero-Falsy Serialization**: Never check boolean/numeric configuration via `if (prop)`. Explicitly validate `if (val !== undefined && val !== null)` so `0` and `false` are not overwritten with defaults.
7. **Local LLM Defaults**: When spawning `llama-server.exe`, explicitly supply `-fa on`, `-np 1` (single slot), rounded integer `--top-k`, and quantized KV cache (`-ctk q8_0 -ctv q8_0`) for large models. Stop the local server automatically when switching to cloud models to free VRAM.
8. **Token & Context Protection**:
   - Model-free tool output pruning (`toolResultPruner.ts`) trims old tool outputs in context.
   - Loop breaker (`loopBreaker.ts`) halts repetitive tool calls (warning at 3, halt at 5).
   - Massive command outputs (>24 KB) spill to `~/.0xagent/spill/*.log` with truncated context references.
   - Memory Engine v1.0 enforces dynamic token budgeting (0..400 tokens) with 0 memories for casual dialogue.
9. **Atomic UI & Zero-Slop Design Policy**:
   - Strictly prohibit writing ad-hoc raw HTML controls (`<button>`, `<input>`, `<select>`, `<textarea>`, raw `<dialog>`) styled with haphazard utility classes (`bg-white/10`, custom borders). Always import and compose from `src/components/ui/` (`Button`, `Input`, `Select`, `Toggle`, `Badge`, `Card`, `Modal`).
   - **Canonical Settings Layout & Sub-Navigation Standard**:
     - Settings tabs must strictly follow `PersonasTab.tsx` and `src/components/settings/common/` as the canonical standard.
     - Top level: `SettingsHeader` (`title`, `subtitle`, `icon`, `actionSlot`).
     - Multi-domain tabs (e.g. Memory & Personas, Tools) must use **Segmented Sub-Navigation Pills** (`px-4 py-2 rounded-xl text-xs font-semibold`, icon + label + counter badge) to isolate views and prevent infinite vertical scroll fatigue (Miller's Law / cognitive load).
     - Entity/editor pairs must use a responsive **Master-Detail Layout** (`grid grid-cols-1 md:grid-cols-12 gap-6`, `md:col-span-5` / `md:col-span-7`) with explicit active card styling (`border-[var(--theme-accent)] bg-[var(--theme-card-bg)] ring-1 ring-[var(--theme-accent)]/30`).
     - Large settings views must be decomposed into modular components in `src/components/settings/<domain>/` (max ~200 lines per file).
   - No blinding white buttons in dark mode; use `Button` variants (`primary`, `secondary`, `ghost`, `danger`, `accent`).
   - Zero unicode emojis in HUDs, toasts, cards, or telemetry. Use Material Design 3 icons (`MaterialIcon`) or monospaced ASCII indicators (`[OK]`, `[ERR]`, `[>]`, `::`). Popups use persona glassmorphism (`rounded-2xl`, `backdrop-blur-2xl`).
10. **Dual Documentation Synchronization**: When updating `README.md`, always synchronously update `README.ru.md` to keep all user-facing documentation in complete parity.
11. **Tool Expansion Protocol**: Adding or changing a tool requires updates in:
    - Tool logic in `server/tools/` or `server/tools.ts`
    - Dispatcher in `server/agent/toolDispatcher.ts` and parser in `server/agent/toolParser.ts`
    - Type definitions in `src/types.ts`
    - System prompt instructions in `server/agent/promptBuilder.ts`
    - Corresponding unit test in `tests/`
12. **Mandatory Automated Test Pass**: Before concluding any task or committing changes, run `npm test`. All 190+ tests must pass with 0 failures.
13. **I18n Strict Parity**: When adding or modifying UI labels, placeholders, or settings keys, always synchronously update BOTH `src/i18n/translations/en.ts` AND `src/i18n/translations/ru.ts`. Never hardcode raw untranslated text strings directly into JSX templates.
14. **Safe Process Spawning & Model Effort Resolution**:
    - Never execute CLI processes with `{ shell: true }` when passing arguments (eliminates `DEP0190`). Always resolve full paths via `getSafeCliPath` and spawn with `{ shell: false }`.
    - Always pass Antigravity models through `resolveAntigravityModelAndEffort`. Claude and GPT-OSS models must never receive `--effort` flags, while Gemini models default to `low` with optional `medium` and `high` levels.

---

## 🛠 Development & Operational Commands

```bash
npm run dev              # Run backend (:3001) and Vite frontend (:5173) concurrently
node bin/0xagent.js      # CLI Hub: start, config, update, status, purge-vram, stop
npm run build            # Typecheck (tsc) and build production frontend
npm test                 # Run subsystem and unit tests (all suites)
npm run bridge           # Run 0xAgent Diagnostic Bridge for backend & MTP model benchmarking
npm run audit:security   # Run OPSEC and security audit script
npm run build:launcher   # Compile native C# Windows tray launcher (0xAgent.exe)
npm run stop             # Clean up hanging processes and ports (scripts/cleanup.ps1)
```
