# GEMINI.md — Architectural Blueprint & Guidelines for 0xAgent

This document serves as the authoritative architectural blueprint and operating guide for AI coding assistants working on the **0xAgent** codebase.

> **Full documentation:** See `docs/architecture.md` and `docs/api/README.md` for detailed architecture and API reference.

---

## 1. Technology Stack & Overview

- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS 4 + Monaco Code Editor + Lucide Icons.
- **Backend**: Node.js (TypeScript via `tsx` watch mode) + Express + WebSockets (`ws`).
- **CLI & Supervisor**: `bin/0xagent.js` CLI Hub + Native C# Windows Tray Launcher (`0xAgent.exe`, ~15 KB, ~8 MB RAM).
- **Ports**: Backend API `3001`, Vite UI `5173`, Local LLM `11434`.
- **Data Persistence**: `~/.0xagent/` directory:
  - `config.json`: App and local server configuration.
  - `bin/`: CLI executables (`0xagent.cmd`, `0xagent.ps1`, `0xagent`).
  - `app/`: Codebase root (when installed via 1-click script).
  - `personas/`: Persona profiles (`SOUL.md`, `USER.md`, `TOOLS.md`).
  - `data/sessions/`: Chat history session JSON files.
  - `workspaces/`: Sandboxed autonomous agent workspaces.
  - `spill/`: Disk logs for spilled tool outputs (>24 KB).
  - `llama/`: Installed versions of `llama.cpp` binaries (`llama-server.exe` / `llama.exe`).
  - `models/`: Downloaded `.gguf` model files.

---

## 2. Project Structure (Key Files)

```
0xAgent/
├── bin/
│   └── 0xagent.js        — Universal CLI hub (start, config, update, status, purge-vram, stop)
├── install.ps1           — 1-Click interactive Windows installer
├── install.sh            — 1-Click interactive Unix/macOS installer
├── launcher/
│   └── TrayLauncher.cs   — Ultra-lightweight native C# tray supervisor (<15 KB)
├── server/
│   ├── index.ts          — Express API (:3001), WebSocket (/ws), process supervisor
│   ├── agent.ts          — Primary LLM streaming loop & orchestrator
│   ├── agent/            — Compactor, loop breaker, spiller, code sandbox, permission guard
│   ├── tools.ts          — Sandboxed workspace file, patch, terminal & search tools
│   ├── config.ts         — Configuration persistence (~/.0xagent/config.json)
│   ├── session.ts        — Session manager, dialogue history, forking
│   ├── hardware.ts       — GPU/VRAM auto-detection (Win32_VideoController)
│   ├── fffService.ts     — Native Rust Fast File Finder (@ff-labs/fff-node)
│   └── searxngService.ts — Privacy web search aggregator
├── src/
│   ├── App.tsx           — Root component, routing, split-screen layout, WS subscriptions
│   ├── types.ts          — Single Source of Truth TypeScript interfaces
│   ├── i18n/             — Bilingual dictionaries (en.ts, ru.ts)
│   └── components/       — Chat, Editor, Settings, HUDs, and popovers
├── tests/                — Comprehensive node:test suites (90+ automated tests)
```

---

## 3. Core Architectural Invariants & Rules

1. **Single Source of Types (`src/types.ts`)**: Never duplicate interfaces. Both frontend and backend import from `src/types.ts`.
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
9. **Zero-Emoji UI Policy**: No unicode emojis in HUDs, toasts, cards, or telemetry. Use Material Design 3 icons (`MaterialIcon`) or monospaced ASCII indicators (`[OK]`, `[ERR]`, `[>]`, `::`).
10. **Dual Documentation Synchronization**: When updating `README.md`, always synchronously update `README.ru.md` to keep documentation in complete parity.
11. **Tool Expansion Protocol**: Adding or changing a tool requires updates in:
    - Tool logic in `server/tools/` or `server/tools.ts`
    - Dispatcher in `server/agent/toolDispatcher.ts` and parser in `server/agent/toolParser.ts`
    - Type definitions in `src/types.ts`
    - System prompt instructions in `server/agent/promptBuilder.ts`
    - Unit tests in `tests/`
12. **Mandatory Automated Test Pass**: Before concluding any task or committing changes, run `npm test`. All 90+ tests must pass with 0 failures.

---

## 4. Development & Operational Commands

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
