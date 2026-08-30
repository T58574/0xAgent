# 0xAgent System Architecture

> **Version:** 0.1.0  
> **Platform:** Windows (PowerShell / Native Tray), macOS/Linux (CLI)  
> **Core Stack:** Node.js (TypeScript) + Express (`:3001`) + React 19 + TailwindCSS 4 + SQLite WAL (`node:sqlite`) + local `llama.cpp` / Hybrid Cloud

---

## 1. High-Level Topology

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 0xAgent Architecture                                   │
├────────────────────────────────────────┬───────────────────────────────────────────────┤
│           Frontend Layer (UI)          │             Backend Subsystems                │
│ ┌────────────────────────────────────┐ │ ┌───────────────────────────────────────────┐ │
│ │ React 19 + TypeScript + Vite       │ │ │ Express REST API (:3001) & WS (/ws)       │ │
│ │ ├─ ChatArea (Timeline & Reasoning) │ │ │ ├─ Agent Orchestrator (agent.ts)          │ │
│ │ ├─ Monaco Code Editor              │ │ │ ├─ Memory Engine v1.0 (SQLite WAL + FTS5) │ │
│ │ ├─ Jarvis Sanctuary Visualizer     │ │ │ ├─ Jarvis Supervisor (Sparks & Voice)     │ │
│ │ ├─ Knowledge Vault (RAG)           │ │ │ ├─ FastMTP Speculative Decoding Manager   │ │
│ │ ├─ Settings Tabs (LLM, Personas)   │ │ │ ├─ Sandboxed Tool Dispatcher & Spiller    │ │
│ │ └─ Memory & Skills Modal           │ │ │ └─ llama.cpp Child Process Supervisor     │ │
│ └────────────────────────────────────┘ │ └───────────────────────────────────────────┘ │
└────────────────────────────────────────┴───────────────────────────────────────────────┘
                                         ↕
                    ┌──────────────────────────────────────────┐
                    │       Data Storage (~/.0xagent/)         │
                    │ ├─ memory.db (SQLite Canonical Store)    │
                    │ ├─ config.json (Global Configuration)    │
                    │ ├─ data/sessions/ (Chat Session Logs)    │
                    │ ├─ knowledge_base/ (RAG Vault & Index)   │
                    │ ├─ personas/ (SOUL, USER, TOOLS profiles)│
                    │ ├─ workspaces/ (Sandboxed agent folders) │
                    │ ├─ spill/ (Truncated tool outputs >24KB) │
                    │ ├─ llama/ (Installed llama.cpp binaries) │
                    │ └─ models/ (Local GGUF models)           │
                    └──────────────────────────────────────────┘
```

---

## 2. Core Backend Subsystems

### A. Agent Execution Loop (`server/agent.ts`)
1. **Dynamic Prompt Assembly (`promptBuilder.ts`)**: Injects persona identity (`SOUL.md`), user profile & active memories from `memory.ts`, tool schemas, and workspace rules.
2. **Context Compaction Pipeline (`compactionPipeline.ts`)**: 4-tier compaction that strips historical `<think>` reasoning traces from past assistant turns to preserve the KV cache.
3. **Speculative / Streaming Response (`llmClient.ts`)**: Streams tokens from local `llama-server.exe` or cloud API (Gemini).
4. **Tool Parsing & Dispatch (`toolParser.ts` / `toolDispatcher.ts`)**: Parses XML tags (`<read_file>`, `<patch_file>`, `<execute_command>`, `<save_knowledge>`) with fallback regex for unclosed tags.
5. **Loop Breaker (`loopBreaker.ts`)**: Halts repetitive tool loops (warning at 3 oscillations, halt at 5).
6. **Output Spiller (`outputSpiller.ts`)**: Automatically writes massive tool outputs (>24 KB) to `~/.0xagent/spill/*.log` and provides a short summary reference.

### B. Memory Engine v1.0 (`server/memory.ts` & `server/memoryDb.ts`)
- **Native SQLite WAL**: Stored in `~/.0xagent/memory.db`.
- **Write Policy & Candidate Review**: Distinguishes between explicit user commands (confidence 1.0, immediate save) and inferred facts (confidence gating, candidate status, or ignore).
- **Deterministic Router**: Emits 0 memories for casual chat; ranks relevant facts and FTS5 episodes within a dynamic token budget (0..400 tokens).
- **Background Worker (`memoryWorker.ts`)**: Asynchronously ingests conversational facts on 20s debounce without delaying the main LLM response.

### C. Jarvis Companion & Voice System (`server/jarvisSupervisor.ts`)
- **Proactive Sparks Engine (`proactiveCompanion.ts`)**: Emits proactive suggestions and actions based on user activity and system events.
- **Voice Intercom Daemon (`voiceDaemonManager.ts` / `voice_daemon.py`)**: Local Python speech recognition (sherpa-onnx / Moonshine / Whisper).
- **TTS Audio Engine (`ttsService.ts`)**: Synthesizes and caches voice responses.

### D. Speculative Decoding & FastMTP (`server/routes/llama/`)
- Supports loading draft models alongside primary 9B/27B models for accelerated speculative token generation in llama.cpp.

---

## 3. Directory Layout

```text
0xAgent/
├── bin/
│   └── 0xagent.js               — Universal CLI Hub (start, status, config, stop)
├── docs/                        — Complete Documentation (architecture, memory, api, guides)
├── launcher/
│   └── TrayLauncher.cs          — Native C# Windows System Tray supervisor (<15 KB)
├── server/
│   ├── index.ts                 — Express server, WebSocket gateway, process supervisor
│   ├── agent.ts                 — Autonomous agent execution loop
│   ├── agent/                   — Prompt builder, memory worker, compactor, loop breaker
│   ├── memory.ts                — Memory Engine API, Write Policy, Deterministic Router
│   ├── memoryDb.ts              — Native node:sqlite database manager & FTS5 triggers
│   ├── personas.ts              — Persona manager (SOUL, USER, TOOLS profiles)
│   ├── knowledgeBase.ts         — Knowledge Vault manager and manifest index
│   ├── hardware.ts              — GPU & VRAM hardware detection (Win32_VideoController)
│   ├── fffService.ts            — High-speed fuzzy file finder (@ff-labs/fff-node)
│   ├── searxngService.ts        — Privacy-first web search aggregator
│   └── tools.ts                 — Sandboxed file system & terminal tools
├── src/                         — React 19 Frontend (Atomic Design System)
│   ├── App.tsx                  — Root component & split-screen orchestrator
│   ├── types.ts                 — Single Source of Truth TypeScript interfaces
│   ├── components/ui/           — Atomic Design System (Button, Input, Select, Card, Modal)
│   ├── components/chat/         — Chat timeline, reasoning HUD, floating command bar
│   ├── components/settings/     — Tabbed configuration views
│   └── i18n/                    — Bilingual translation dictionaries (en.ts, ru.ts)
└── tests/                       — Automated test suites (100+ tests)
```

---

## 4. Key Architectural Invariants

1. **Single Source of Types**: `src/types.ts` is the single source of truth for all types across backend and frontend.
2. **Zero-Slop UI & Atomic Design**: Never write ad-hoc raw HTML controls. Always compose from `src/components/ui/` (`Button`, `Input`, `Select`, `Card`, `Modal`).
3. **Safe Code Rendering**: Zero `dangerouslySetInnerHTML`. Code and markdown are tokenized safely via React elements.
4. **Patching Standard**: Use `patch_file` with compact `SEARCH`/`REPLACE` blocks for modifying existing files.
5. **Strict Async I/O**: Synchronous blocking calls (`fs.readFileSync`, `execSync`) are prohibited on request and event paths.
