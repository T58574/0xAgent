# GEMINI.md — 0xAgent Architecture & Developer Guide

## 🚀 Overview
**0xAgent** is a local-first autonomous AI coding agent and Web-IDE platform (React 19 + Node.js/Express + local llama.cpp / hybrid cloud LLMs).

---

## 📁 Key File Map

### Backend Core (`server/`)
- `index.ts` — Express API (`:3001`), WebSocket gateway (`/ws`), and process supervisor for `llama-server.exe`.
- `agent.ts` — Autonomous agent orchestrator (prompt execution loop, streaming, tool dispatching).
- `agent/` — Agent submodules:
  - `llmClient.ts` — Universal LLM client (local llama.cpp & Google AI Studio).
  - `toolDispatcher.ts` / `toolParser.ts` — Tool execution and robust XML/tag parsing (`<toolcall>`, `<tool_call>`).
  - `promptBuilder.ts` — System prompt construction, persona injection, and context assembly.
  - `contextManager.ts` / `compactionPipeline.ts` — 4-tier context compression and token management.
  - `toolResultPruner.ts` — Model-free syntactic trimming of historical tool outputs.
  - `loopBreaker.ts` — Infinite tool loop detection and breaker.
  - `outputSpiller.ts` — Automatic spilling of massive tool outputs (>24 KB) to disk.
  - `codeRuntime.ts` — Sandboxed Node.js VM runtime for `<code_run>` batch operations.
  - `permissionGuard.ts` — Security presets (`readonly`, `workspace-write`, `prompt`, `unrestricted`).
  - `voiceDaemonManager.ts` / `voiceMacroService.ts` — Native voice spotting and zero-token OS macros.
- `tools/` & `tools.ts` — Tool implementations (file system, patches, search, terminal execution).
- `config.ts` — Application settings store (`~/.0xagent/config.json`).
- `session.ts` — Multi-session storage, message history, and branching.
- `hardware.ts` — GPU/VRAM hardware detection (`Win32_VideoController`).
- `ggufParser.ts` — Binary GGUF metadata parser.
- `fffService.ts` — High-speed fuzzy file search (`@ff-labs/fff-node`).
- `searxngService.ts` / `webReaderService.ts` — Privacy-first web search and HTML-to-Markdown reader.
- `ttsService.ts` — Text-to-speech audio synthesis.

### Frontend (`src/`)
- `App.tsx` — Root component, split-screen layout, and WebSocket subscriptions.
- `types.ts` — **Single Source of Truth** for all shared data types across frontend and backend.
- `components/` — UI components:
  - `Navbar.tsx` — Top control bar (server status, model/view selector, telemetry).
  - `Sidebar.tsx` — Session history, active workspaces, and file explorer.
  - `ChatArea.tsx` — Chat stream, tool cards, reasoning viewer (`<think>`), and live plan progress HUD.
  - `CodeEditor.tsx` — Multi-tab Monaco-style code viewer and editor.
  - `chat/` — Chat components (`ReasoningViewer.tsx`, `FloatingCommandBar.tsx`, `PlanProgressStrip.tsx`).
  - `settings/` — Settings tabs (General, LLM Server, Personas, Themes, Security).
  - `common/` — Shared UI elements (`MaterialIcon.tsx`, `AsciiCanvasEngine.tsx`).
- `services/api.ts` & `services/wsService.ts` — REST API and WebSocket communication layers.
- `index.css` — Glassmorphism styles and 4 color themes (`obsidian`, `cyber`, `graphite`, `matrix`).

### Data Directory (`~/.0xagent/`)
- `config.json` — Persistent configuration.
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
9. **Zero-Emoji UI & Design Policy**: No unicode emojis in HUDs, toasts, cards, or telemetry. Use Material Design 3 icons (`MaterialIcon`) or monospaced ASCII indicators (`[OK]`, `[ERR]`, `[>]`, `::`). Popups use persona glassmorphism (`rounded-2xl`, `backdrop-blur-2xl`).
10. **Workspace Isolation**: Never write persona files (`SOUL.md`, `USER.md`) to the user workspace root. Use `<update_user_profile>` and `<update_persona_file>` which target `~/.0xagent/personas/`.
11. **Robust Error Handling**: Wrap user/LLM regex in `try/catch`. Never return fake success responses on caught task/tool errors.
12. **Model & Agent Testing Protocol (0xAgent Bridge)**: Never test models via ad-hoc standalone CLI commands or isolated configs. Always test through the 0xAgent Bridge (`npm run bridge` or `scripts/agent-bridge.ts`), which authenticates against the live 0xAgent backend API (`POST /api/start-local-server`, `GET /api/server-health`, `/v1/chat/completions`) using the active application configuration, tracking real-time t/s, MTP draft acceptance rates, and memory telemetry.

---

## 🛠 Development Commands

```bash
npm run dev              # Run backend (:3001) and Vite frontend (:5173) concurrently
npm run build            # Typecheck (tsc) and build production frontend
npm test                 # Run subsystem and unit tests
npm run bridge           # Run 0xAgent Diagnostic Bridge for backend & MTP model benchmarking
npm run audit:security   # Run OPSEC and security audit script
npm run build:launcher   # Compile native C# Windows tray launcher (0xAgent.exe)
npm run stop             # Clean up hanging processes and ports (scripts/cleanup.ps1)
```
