<div align="center">

<img src="0xAgent-icon.jpg" alt="0xAgent Icon" width="120" style="border-radius: 26px; margin-bottom: 12px;" />

# 0xAgent — Autonomous AI Developer & Web-IDE Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19.1-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7.0-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![llama.cpp](https://img.shields.io/badge/llama.cpp-Inference_Engine-FFA500?style=flat-square)](https://github.com/ggerganov/llama.cpp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

**A high-performance, privacy-first autonomous AI coding agent and Web-IDE designed for local model inference (`llama.cpp`, Gemma 4, Qwen, DeepSeek) and hybrid cloud LLM workflows.**

[Key Features](#key-features) • [Autonomous Agent Harness Innovations](#autonomous-agent-harness-innovations) • [Architecture](#architecture) • [Tech Stack](#tech-stack) • [Quick Start](#quick-start) • [Localization](#localization--language-support) • [Native Tray Launcher](#native-windows-tray-launcher) • [Project Structure](#project-structure) • [Configuration](#configuration) • [Security](#security--opsec) • [Commands](#available-scripts) • [License](#license)

</div>

---

<img width="1625" height="1049" alt="0xAgent Web IDE Interface" src="https://github.com/user-attachments/assets/ee144717-f865-470e-aa65-5b7b4b20c4cd" />

---

## Overview

**0xAgent** is an open-source, full-stack autonomous AI developer platform that bridges the gap between local LLM execution and professional web IDE environments. Built on **React 19**, **Node.js/Express**, and **llama.cpp**, it delivers an end-to-end agentic loop with strict workspace sandboxing, sub-millisecond file indexing, multi-chunk fuzzy code patching, live terminal command execution, and persistent memory recall.

Whether executing quantized 31B+ models locally on consumer GPUs with Flash Attention and quantized KV caches, or connecting to high-speed cloud APIs (Google AI Studio Gemini 3.6 / Flash Lite, Groq), 0xAgent provides a responsive glassmorphic interface engineered for maximum developer velocity.

---

## Key Features

- **Dual Local & Cloud Inference Engine**
  - Native process supervisor for `llama-server.exe` with automatic GPU layer offloading (`-ngl`), Flash Attention (`-fa on`), quantized KV cache (`-ctk q8_0 -ctv q8_0`), and automated VRAM reclamation when switching to cloud models.
  - Seamless hybrid fallback support for Google AI Studio (Gemini 3.6 Flash, Flash Lite) and Groq.
- **Autonomous Step-by-Step Agent Loop**
  - Self-correcting diagnostics, planning mode, real-time reasoning (`<think>`) parsing, and autonomous multi-turn tool execution.
  - Zero-lag streaming token render engine with a 50ms RAF throttler handling 100+ tokens/second without DOM stutter.
- **Dynamic Plan Progress HUD (`todo_write`)**
  - Real-time step-by-step checklist progress bar integrated directly into the chat interface for full execution visibility.
- **Loop Breaker & Output Spiller**
  - Canonical JSON argument sorting and loop breaking (escalating from warning to forced halt on repeat tool loops).
  - Automated output spilling to disk (`~/.0xagent/spill/*.log`) for execution results exceeding 24 KB.
- **Auto-Workspaces & Standalone Chats**
  - Create standalone chats instantly with auto-generated isolated workspace sandboxes (`~/.0xagent/workspaces/<slug>`).
- **Native Voice Assistant & Zero-Token Voice Macros**
  - Background offline Vosk RU wake-word spotting ("Джарвис") with Groq Whisper transcription and zero-token Windows OS voice macros.
- **Precision File & Tooling Dispatcher**
  - **Fuzzy Multi-Chunk Patching (`patch_file`)**: Whitespace-tolerant search/replace block patcher designed for complex refactoring without file truncation.
  - **Sub-3ms Fast File Finder (FFF)**: Native Rust-accelerated file search (`@ff-labs/fff-node`) with recursive fallback.
  - **Live Terminal Supervisor (`execute_command`)**: Real-time PowerShell execution with interactive process handling and automated timeout protection.
  - **Zero-Token-Cost Web Search**: Integrated local SearXNG / DuckDuckGo search and structured Markdown web scraping.
- **Multilingual UI (EN / RU)**
  - Native bilingual support for English and Russian with instant 1-click runtime switching.
- **Native Zero-Overhead Tray Launcher**
  - Ultra-lightweight Windows tray controller (`0xAgent.exe`, ~15 KB, ~8 MB RAM) compiled with native C# `csc.exe` — eliminating Electron/WebView2 runtime overhead to preserve VRAM for local inference.

---

## Autonomous Agent Harness Innovations
 
0xAgent incorporates core architectural subsystems engineered for resilient local LLM orchestration and maximum token efficiency:
 
1. **Parallel Read-Only Tool Execution (`agent.ts`)**
   - Independent Read-Only tools (`read_file`, `list_dir`, `grep_search`, `fff_search`, `read_web_page`, `web_search`) execute concurrently via `Promise.all()`, accelerating the exploration phase by 3-5x.
2. **Robust Multi-Chunk Patch Engine (`fileTools.ts`)**
   - Whitespace-tolerant search/replace block patcher with strict line-level validation, multi-strategy indentation alignment, and zero data-loss safeguards.
3. **Interactive Decision Cards (`<ask_user_question>`)**
   - Enables the agent to pause execution and present interactive single/multi-select option cards or plan review modals (`InteractiveQuestionCard.tsx`), resuming upon user input.
4. **Code Mode Sandbox (`<code_run>`)**
   - Sandboxed JavaScript execution directly inside Node.js `node:vm` with async host `tools.*` bindings (read, write, patch, fff, web, exec) in 1 turn without token bloat.
5. **4-Level Permission Matrix (`permissionGuard.ts`)**
   - Granular security presets (`readonly`, `workspace-write`, `prompt`, `unrestricted`) with path traversal guards and real-time UI switching in the command bar.
6. **Event-Sourced Session Forking (`sessionEvents.ts`)**
   - Instant dialogue branching from any message checkpoint (`POST /api/sessions/:id/fork`) with isolated message lineage.
7. **Oscillation & Repeat Loop Breaker (`loopBreaker.ts`)**
   - 8-step rolling history tracking with canonical JSON argument sorting and cyclic oscillation detection (A -> B -> A -> B), escalating from corrective guidance to graceful termination.
8. **4-Tier Context Compaction & Smart Error Retention (`compactionPipeline.ts` & `toolResultPruner.ts`)**
   - Coordinated context management combining Zero-Token Tool Pruning with regex error preservation (Tier 1), CoT Thought Stripping (Tier 2), Bounded Windowing (Tier 3), and Milestone LLM Summarization (Tier 4) at 75% context threshold.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      0xAgent Web Frontend                        │
│    (React 19 + TypeScript + Vite + Tailwind CSS + WebSocket)     │
└─────────────────────────────────┬────────────────────────────────┘
                                  │ HTTPS REST & Duplex WSS (wss://)
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

## Tech Stack

| Domain | Technology | Description |
|---|---|---|
| **Frontend UI** | React 19, TypeScript, Vite 7 | Modern reactive component architecture and high-speed HMR |
| **Styling** | Tailwind CSS 4, Glassmorphism | Custom design tokens, dark glass aesthetic, Material Design 3 |
| **Backend API** | Node.js, Express, WebSocket (`ws`) | Async non-blocking Event Loop and live duplex token streaming |
| **Local Inference** | llama.cpp, GGUF Binaries | High-performance C++ LLM inference engine with GPU acceleration |
| **File Indexing** | `@ff-labs/fff-node` | Native Rust FFF engine for instantaneous project-wide file search |
| **Web Search** | SearXNG / DuckDuckGo | Zero-token-cost privacy-respecting search aggregator |
| **Launcher** | C# (.NET Framework / `csc.exe`) | Native Windows System Tray process manager (~15 KB) |

---

## Quick Start

### Prerequisites

- **Node.js**: `v20.19.0` or newer (LTS recommended)
- **Operating System**: Windows 10/11 (PowerShell 5.1+ or PowerShell 7)
- **Git**: Installed and available in `PATH`

---

### Step 1: Clone & Install Dependencies

```powershell
# Clone the repository
git clone https://github.com/T58574/0xAgent.git
cd 0xAgent

# Install dependencies
npm install
```

---

### Step 2: Running with Free Cloud AI (Google AI Studio)

If you prefer to start immediately without downloading local weights or running a local inference engine:

1. Obtain a free API key from [Google AI Studio](https://aistudio.google.com/).
2. Copy `.env.example` to `.env`:
   ```powershell
   cp .env.example .env
   ```
3. Set your key in `.env`:
   ```ini
   GEMINI_API_KEY=your_google_ai_studio_api_key
   ```
   *(Alternatively, you can input your key directly in the UI under **Settings -> General**).*

---

### Step 3: Running 100% Locally with llama.cpp

0xAgent provides full offline autonomy via `llama.cpp` and GGUF quantization.

#### 3.1 Obtain `llama-server.exe`
- **Option A (Integrated Installer - Recommended)**:
  Open the Web UI, navigate to **Settings -> LLM Server**, select the latest official release from the GitHub dropdown, and click **Install / Download**.
- **Option B (Manual Setup)**:
  Download the latest Windows binary build (`llama-bXXXX-bin-win-cuda-cuXX.X-x64.zip` or `avx2`) from [llama.cpp Releases](https://github.com/ggerganov/llama.cpp/releases), extract `llama-server.exe`, and place it in:
  ```
  C:\Users\<YourUser>\.0xagent\llama\llama-server.exe
  ```

#### 3.2 Obtain GGUF Models
Download GGUF model weights (e.g., Qwen 2.5 Coder, Gemma 4, DeepSeek-Coder, Llama 3.3) from HuggingFace and place them into the models directory:
```
C:\Users\<YourUser>\.0xagent\models\
```
*Example recommended models:*
- `Qwen2.5-Coder-7B-Instruct-Q8_0.gguf` (Fast, lightweight coding)
- `Qwen2.5-Coder-32B-Instruct-Q4_K_M.gguf` (Advanced architecture & refactoring)
- `gemma-2-27b-it-Q4_K_M.gguf` (General reasoning and planning)

#### 3.3 Recommended Performance Settings
For maximum throughput and optimal VRAM utilization, configure the following settings in **Settings -> LLM Server**:

| Parameter | Recommended Value | Rationale |
|---|---|---|
| **GPU Offload Layers (`-ngl`)** | Max / 99 | Offloads all model layers into GPU VRAM for maximum speed |
| **Flash Attention (`-fa`)** | `on` (`true`) | Reduces memory consumption and accelerates long context processing |
| **Quantized KV Cache (`-ctk` / `-ctv`)** | `q8_0` / `q8_0` | Cuts context VRAM usage by up to 50% with near-zero perplexity loss |
| **Parallel Slots (`-np`)** | `1` | Dedicates full GPU compute to a single agent session |
| **Top-K (`--top-k`)** | Integer (e.g. `40`) | Bounded sampling candidate pool |

---

### Step 4: Starting the Application

Launch the development server:
```powershell
npm run dev
```

Once initialized, open your browser:
- **Web UI:** `https://127.0.0.1:5173`
- **Backend Gateway:** `https://127.0.0.1:3001`

*(Note: 0xAgent automatically generates local self-signed SSL certificates for secure HTTPS/WSS communication).*

---

## Localization & Language Support

0xAgent features comprehensive multilingual support out of the box:

- **Supported Languages**:
  - **English (Default)**: Complete interface, system prompts, diagnostic messages, and tool reports.
  - **Russian (Русский)**: Полная локализация интерфейса, параметров настроек, карточек инструментов и голосового ассистента.
- **How to Switch Languages**:
  - **1-Click Navbar**: Click the language switcher badge (`[EN]` / `[RU]`) located in the top navigation bar.
  - **Settings Menu**: Navigate to **Settings -> General -> Interface Language** to toggle between English and Russian.
- **Persistence**: Selected language preference is saved in `~/.0xagent/config.json` and synchronized across browser sessions via local storage.

---

## Native Windows Tray Launcher

For daily developer workflows, 0xAgent includes an ultra-lightweight native Windows system tray host (`0xAgent.exe`):

```powershell
# Compile the native C# launcher using Windows built-in csc.exe
npm run build:launcher
```

### Key Advantages:
- **Zero VRAM/RAM Bloat**: Compiles directly to a ~15 KB native executable requiring only ~8 MB of RAM, leaving all system memory and GPU VRAM free for LLM inference (unlike Electron/WebView2 wrappers).
- **Background Lifecycle Supervisor**: Automatically manages Node.js server and Vite processes, monitoring health and restarting on failure.
- **System Tray Controls**: Quick access to Open Web IDE, View Live Logs, Restart Services, and Graceful Shutdown.
- **Silent Operation**: Runs discreetly in the Windows taskbar notification area.

---

## Project Structure

```
0xAgent/
├── .github/                 # GitHub workflows and issue templates
├── docs/                    # Architecture blueprints and API reference
├── launcher/                # Native Windows Tray Launcher
│   └── TrayLauncher.cs      # Ultra-lightweight C# tray host (<15 KB)
├── scripts/                 # Automation & helper scripts
│   ├── build-launcher.ps1   # C# compiler pipeline via csc.exe
│   ├── cleanup.ps1          # Process and port cleanup utility
│   ├── dev-client.cjs       # Vite client runner with SSL support
│   ├── ensure-ssl.cjs       # Automated self-signed SSL certificate manager
│   ├── security_audit.cjs   # Automated OPSEC & credential scanner
│   └── agent-bridge.ts      # Backend & model benchmark bridge
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
│   ├── i18n/                # Multilingual translations (EN / RU)
│   ├── hooks/               # Custom React hooks (Model Manager, WebSocket, etc.)
│   ├── services/            # REST API client & WebSocket service
│   ├── types.ts             # Single Source of Truth TypeScript types
│   ├── App.tsx              # Main application root
│   └── index.css            # Custom glassmorphic styles and themes
├── tests/                   # Comprehensive automated test suites (node:test)
│   ├── agentHarnessInnovations.test.ts # Agent innovations test suite
│   ├── agentHarnessAdaptations.test.ts # Pruner, loop breaker, spiller tests
│   ├── jarvisCompanion.test.ts # Companion, voice, macro tests
│   └── workspacePersona.test.ts # Workspaces, sandboxes, personas tests
├── .env.example             # Template for environment configuration
├── package.json             # NPM package manifest & scripts
├── tsconfig.json            # TypeScript configuration
└── vite.config.ts           # Vite bundler configuration
```

---

## Configuration

All persistent user configuration, downloaded models, personas, and long-term memory reside in `~/.0xagent/`:

| Path | Purpose |
|---|---|
| `~/.0xagent/config.json` | Core application settings, model parameters, API keys, security preset |
| `~/.0xagent/models/` | Downloaded local GGUF model files |
| `~/.0xagent/llama/` | Local `llama-server.exe` binary releases |
| `~/.0xagent/personas/` | Persona definitions (`SOUL.md`, `USER.md`, `TOOLS.md`) |
| `~/.0xagent/sessions/` | Persisted session dialogue histories and checkpoints |
| `~/.0xagent/workspaces/` | Auto-generated isolated workspace sandboxes |
| `~/.0xagent/spill/` | Spilled large tool execution logs (>24 KB) |

---

## Security & OPSEC

- **4-Level Permission Matrix**: Enforces granular restrictions across `readonly`, `workspace-write`, `prompt`, and `unrestricted` presets.
- **Strict Workspace Sandboxing**: All file read, write, and patch operations enforce canonical path verification to prevent path traversal attacks.
- **Destructive Command Guard**: Dangerous terminal instructions (e.g., system directory mutations, disk formatting) are automatically intercepted and blocked.
- **Zero XSS Rendering**: Code blocks and markdown streams are tokenized safely into React elements without invoking `dangerouslySetInnerHTML`.
- **Automated OPSEC Scanner**: Execute `npm run audit:security` to audit workspace code for leaked secrets or insecure path dependencies.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start backend server and Vite frontend concurrently |
| `npm run build` | Validate TypeScript types and compile production web client |
| `npm test` | Execute unit and subsystem test suites via `node:test` |
| `npm run bridge` | Run 0xAgent Diagnostic Bridge for backend and MTP model benchmarking |
| `npm run build:launcher` | Compile native C# Windows tray manager (`0xAgent.exe`) via `csc.exe` |
| `npm run audit:security` | Run automated OPSEC credential and path vulnerability audit |
| `npm run stop` | Clean up hanging background processes, ports, and subtasks |

---

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
