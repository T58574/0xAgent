# 0xAgent — Autonomous AI Developer & Web-IDE Platform

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19.1-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7.0-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![llama.cpp](https://img.shields.io/badge/llama.cpp-Inference_Engine-FFA500?style=flat-square)](https://github.com/ggerganov/llama.cpp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

**A high-performance, privacy-first autonomous AI coding agent and Web-IDE designed for local model inference (`llama.cpp`, Gemma 4, Qwen) and hybrid cloud LLM workflows.**

[Key Features](#-key-features) • [DeepSeek Harness Innovations](#-deepseek-harness-innovations) • [Architecture](#-architecture) • [Tech Stack](#-tech-stack) • [Quick Start](#-quick-start) • [Project Structure](#-project-structure) • [Configuration](#-configuration) • [Security](#-security--opsec)

</div>

---

## 📖 Overview

**0xAgent** is an open-source, full-stack autonomous AI developer platform that bridges the gap between lightweight local LLMs and professional IDE environments. Built on **React 19**, **Express**, and **llama.cpp**, it delivers end-to-end autonomous agent loops with strict workspace sandboxing, sub-millisecond file indexing, multi-chunk fuzzy code patching, live terminal command execution, and long-term memory recall.

Whether executing quantized 31B+ models locally on consumer GPUs with quantized KV caches or connecting to ultra-fast cloud APIs (Gemini 3.6 Flash, Flash Lite), 0xAgent provides a fluid, responsive glassmorphic interface engineered for maximum developer productivity.

---

## ✨ Key Features

- **Dual Local & Cloud Inference Engine**
  - Native process management for `llama-server.exe` with automatic GPU layer offloading, Flash Attention (`-fa on`), quantized KV cache (`-ctk q8_0 -ctv q8_0`), and automatic VRAM freeing when switching to cloud models.
  - Seamless hybrid fallback support for Google AI Studio (Gemini 3.6 Flash, Gemma 4 31B, Flash Lite) and Groq.
- **Autonomous Step-by-Step Agent Loop**
  - Self-correcting diagnostics, planning mode, real-time reasoning (`<think>`) parsing, and autonomous multi-turn tool execution.
  - Zero-lag streaming token render engine with a 50ms RAF throttler handling 100+ tokens/second without DOM stutter.
- **Dynamic Plan Progress HUD (`todo_write`)**
  - Real-time step-by-step checklist progress bar integrated into the chat interface for full execution visibility.
- **Loop Breaker & Output Spiller**
  - Canonical JSON argument sorting and loop breaking (escalating from warning to forced halt on repeat tool loops).
  - Automated output spilling to disk (`~/.0xagent/spill/*.log`) for results exceeding 24 KB.
- **Auto-Workspaces & Standalone Chats**
  - Create standalone chats instantly with auto-generated isolated workspace sandboxes (`~/.0xagent/workspaces/<slug>`).
- **Native Voice Assistant & Zero-Token Voice Macros**
  - Background offline Vosk RU wake-word spotting ("Джарвис") with Groq Whisper transcription and zero-token Windows OS voice macros.
- **Precision File & Tooling Dispatcher**
  - **Fuzzy Multi-Chunk Patching (`patch_file`)**: Whitespace-tolerant search/replace block patcher designed for complex refactoring without file truncation.
  - **Sub-3ms Fast File Finder (FFF)**: Native Rust-accelerated file search (`@ff-labs/fff-node`) with recursive fallback.
  - **Live Terminal Supervisor (`execute_command`)**: Real-time PowerShell execution with interactive process handling and automated timeout protection.
  - **Zero-Token-Cost Web Search**: Integrated local SearXNG / DuckDuckGo search and structured Markdown web scraping.
- **Native Zero-Overhead Tray Launcher**
  - Ultra-lightweight Windows tray controller (`0xAgent.exe`, ~15 KB, ~8 MB RAM) compiled with native C# `csc.exe` — eliminating heavy Electron/WebView2 runtime overhead to conserve VRAM for local models.

---

## 🔬 DeepSeek Harness Innovations

0xAgent incorporates 6 core architectural subsystems adapted from the open-source **DeepSeek Harness** (`@deepseek-ai/deepseek-harness`):

1. **Interactive Decision Cards (`<ask_user_question>`)**
   - Enables the agent to pause execution and present interactive single/multi-select option cards or plan review modals (`InteractiveQuestionCard.tsx`), resuming upon user input.
2. **Code Mode Sandbox (`<code_run>`)**
   - Sandboxed JavaScript execution directly inside Node.js `node:vm` with async host `tools.*` bindings (read, write, patch, fff, web, exec) in 1 turn without token bloat.
3. **4-Level Permission Matrix (`permissionGuard.ts`)**
   - Security presets (`readonly`, `workspace-write`, `prompt`, `unrestricted`) with path traversal guards and real-time UI switching in the command bar.
4. **Event-Sourced Session Forking (`sessionEvents.ts`)**
   - Instant dialogue branching from any message checkpoint (`POST /api/sessions/:id/fork`) with isolated message lineage.
5. **Continuable Subagent Orchestrator (`subagentOrchestrator.ts`)**
   - Stateful background subagents with live messaging (`send_subagent_message`), interrupts (`interrupt_subagent`), and status polling.
6. **4-Tier Context Compaction Pipeline (`compactionPipeline.ts`)**
   - Coordinated context management combining Zero-Token Tool Pruning (Tier 1), CoT Thought Stripping (Tier 2), Bounded Windowing (Tier 3), and Milestone LLM Summarization (Tier 4) at 75% context threshold.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      0xAgent Web Frontend                        │
│    (React 19 + TypeScript + Vite + Tailwind CSS + WebSocket)     │
└─────────────────────────────────┬────────────────────────────────┘
                                  │ HTTP REST & WebSocket (ws://)
┌─────────────────────────────────▼────────────────────────────────┐
│                     0xAgent Backend Engine                       │
│    (Express + Tool Dispatcher + Context Compactor + Auth Guard)  │
└───────────────┬─────────────────┬────────────────┬───────────────┘
                │                 │                │
┌───────────────▼────────┐ ┌──────▼────────┐ ┌─────▼───────────────┐
│ Local llama.cpp Server │ │ Cloud LLM API │ │ SearXNG Search Engine│
│ (GGUF / GPU Offload)   │ │ (Gemini/Groq) │ │ (Privacy Search API) │
└────────────────────────┘ └───────────────┘ └─────────────────────┘
```

---

## 🛠 Tech Stack

| Domain | Technology | Description |
|---|---|---|
| **Frontend UI** | React 19, TypeScript, Vite 7 | Modern reactive component architecture and high-speed HMR |
| **Styling** | Tailwind CSS 4, Glassmorphism | Custom design tokens, dark glass aesthetic, Material Design 3 |
| **Backend API** | Node.js, Express, WebSocket (`ws`) | Async non-blocking Event Loop and live duplex token streaming |
| **Local Inference** | llama.cpp, GGUF Binaries | High-performance C++ LLM inference engine with GPU acceleration |
| **File Indexing** | `@ff-labs/fff-node` | Native Rust FFF engine for instantaneous project-wide file search |
| **Web Search** | SearXNG / DuckDuckGo | Zero-token-cost privacy-respecting search aggregator |
| **Launcher** | C# (.NET Framework / `csc.exe`) | Native Windows System Tray process manager |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: `v18.0.0` or newer
- **Operating System**: Windows 10/11 (PowerShell 5.1+ or PowerShell 7)
- **Git**: Installed and configured

### 1. Clone the Repository
```bash
git clone https://github.com/T58574/0xAgent.git
cd 0xAgent
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to create your local `.env` configuration:
```bash
cp .env.example .env
```
*(Optional)* Add your **Google AI Studio API key** inside `.env` to enable hybrid cloud models:
```ini
GEMINI_API_KEY=your_actual_api_key_here
```

### 4. Run the Development Server
```bash
npm run dev
```
- **Web UI:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:3001](http://localhost:3001)

### 5. Run Test Suite
```bash
npm test
```

### 6. (Optional) Compile the Native Windows Tray Launcher
```bash
npm run build:launcher
```
This compiles `launcher/TrayLauncher.cs` into `0xAgent.exe` using Windows native `csc.exe`.

---

## 📁 Project Structure

```
0xAgent/
├── .github/                 # GitHub workflows and issue templates
├── docs/                    # Architecture blueprints and API reference
├── launcher/                # Native Windows Tray Launcher
│   └── TrayLauncher.cs      # Ultra-lightweight C# tray host (<15 KB)
├── scripts/                 # Automation & helper scripts
│   ├── build-launcher.ps1   # C# compiler pipeline via csc.exe
│   ├── cleanup.ps1          # Process and port cleanup utility
│   ├── security_audit.cjs   # Automated OPSEC & credential scanner
│   └── start.ps1            # Master PowerShell orchestrator
├── searxng/                 # SearXNG local search configuration
├── server/                  # Node.js / Express Backend
│   ├── agent/               # Autonomous agent logic & pipeline
│   │   ├── agentState.ts    # Agent status & execution cycle
│   │   ├── codeRuntime.ts   # Sandboxed Code Mode VM execution
│   │   ├── compactionPipeline.ts # 4-Tier context compactor
│   │   ├── contextManager.ts# Context window & token management
│   │   ├── loopBreaker.ts   # Repeat tool loop breaker
│   │   ├── outputSpiller.ts # Disk spill for giant outputs (>24 KB)
│   │   ├── permissionGuard.ts # 4-level security presets
│   │   ├── promptBuilder.ts # Dynamic system prompt generation
│   │   ├── sessionEvents.ts # Event sourcing & session forking
│   │   ├── subagentOrchestrator.ts # Continuable subagent protocol
│   │   ├── toolDispatcher.ts# Tool execution coordinator
│   │   ├── toolParser.ts    # Resilient XML/JSON tool call parser
│   │   ├── toolResultPruner.ts # Zero-token tool output pruner
│   │   └── userQuestionService.ts # Interactive question resolver
│   ├── routes/              # Modular Express API endpoints
│   ├── agent.ts             # Primary LLM streaming loop
│   ├── config.ts            # Configuration persistence (~/.0xagent)
│   ├── hardware.ts          # GPU & VRAM autodetection (WMI/Win32)
│   ├── searxngService.ts    # Privacy web search with fallback
│   ├── session.ts           # Chat session manager & persistence
│   └── tools.ts             # Workspace sandboxed tool implementations
├── src/                     # React 19 Frontend Application
│   ├── components/          # UI Components (Chat, Editor, Settings, HUD)
│   │   ├── chat/            # ReasoningViewer, CommandBar, Scrubber, Questions, PlanProgressStrip
│   │   ├── settings/        # Model picker, llama installer, Themes, Personas
│   │   └── common/          # Zero-XSS Tokenizer, Material Icons, Canvas
│   ├── hooks/               # Custom React hooks (Model Manager, etc.)
│   ├── services/            # REST API client & WebSocket service
│   ├── types.ts             # Single Source of Truth TypeScript types
│   ├── App.tsx              # Main application root
│   └── index.css            # Custom glassmorphic styles and themes
├── tests/                   # Comprehensive automated test suites (node:test)
│   ├── deepseekInnovations.test.ts # DeepSeek innovations test suite
│   ├── deepseekHarnessAdaptations.test.ts # Pruner, loop breaker, spiller tests
│   ├── jarvisCompanion.test.ts # Companion, voice, macro tests
│   └── workspacePersona.test.ts # Workspaces, sandboxes, personas tests
├── .env.example             # Template for environment configuration
├── package.json             # NPM package manifest & scripts
├── tsconfig.json            # TypeScript configuration
└── vite.config.ts           # Vite bundler configuration
```

---

## ⚙️ Configuration

All user preferences, installed models, custom personas, and long-term memory are stored in your user profile under `~/.0xagent/`:

| Path | Purpose |
|---|---|
| `~/.0xagent/config.json` | Core app settings, API URLs, model parameters, permission preset |
| `~/.0xagent/models/` | Downloaded local `.gguf` model files |
| `~/.0xagent/llama/` | Local `llama-server.exe` executable binaries |
| `~/.0xagent/personas/` | System personas (`SOUL.md`, `USER.md`, `TOOLS.md`) |
| `~/.0xagent/sessions/` | Persisted chat histories and execution checkpoints |
| `~/.0xagent/workspaces/` | Auto-generated ephemeral workspace sandboxes |
| `~/.0xagent/spill/` | Spilled tool execution log files (>24 KB) |

---

## 🛡️ Security & OPSEC

- **Permission Matrix**: 4 security presets (`readonly`, `workspace-write`, `prompt`, `unrestricted`) enforce fine-grained control over file mutations and shell execution.
- **Zero Path Traversal**: All file read, write, and patch operations enforce strict canonical root resolution within the chosen workspace directory.
- **System Command Guard**: Commands containing destructive patterns (`system32`, disk wipe, root deletion) are automatically rejected.
- **Zero XSS Code Highlighting**: Code blocks are rendered through a custom lexical tokenizer producing sanitized React elements without `dangerouslySetInnerHTML`.
- **Automated Security Scanner**: Run `npm run audit:security` anytime to verify that no credentials or private paths exist in the workspace.

---

## 📜 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
