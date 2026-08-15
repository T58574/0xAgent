# ⚡ 0xAgent — Autonomous AI Developer & Web-IDE Platform

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19.1-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7.0-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![llama.cpp](https://img.shields.io/badge/llama.cpp-Inference_Engine-FFA500?style=flat-square)](https://github.com/ggerganov/llama.cpp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

**A high-performance, privacy-first autonomous AI coding agent and Web-IDE designed for local model inference (`llama.cpp`, Gemma 4, Qwen) and hybrid cloud LLM workflows.**

[Key Features](#-key-features) • [Architecture](#-architecture) • [Tech Stack](#-tech-stack) • [Quick Start](#-quick-start) • [Project Structure](#-project-structure) • [Configuration](#-configuration) • [Security](#-security--opsec)

</div>

---

<img width="1625" height="1049" alt="image" src="https://github.com/user-attachments/assets/ee144717-f865-470e-aa65-5b7b4b20c4cd" />


## 📖 Overview

**0xAgent** is an open-source, full-stack autonomous AI developer platform that bridges the gap between lightweight local LLMs and professional IDE environments. Built on **React 19**, **Express**, and **llama.cpp**, it delivers end-to-end autonomous agent loops with strict workspace sandboxing, sub-millisecond file indexing, multi-chunk fuzzy code patching, live terminal command execution, and long-term memory recall.

Whether executing quantized 31B+ models locally on consumer GPUs with quantized KV caches or connecting to ultra-fast cloud APIs (Gemini 3.6 Flash, Flash Lite), 0xAgent provides a fluid, responsive glassmorphic interface engineered for maximum developer productivity.

---

## ✨ Key Features

- 🧠 **Dual Local & Cloud Inference Engine**
  - Native process management for `llama-server.exe` with automatic GPU layer offloading, Flash Attention (`-fa on`), quantized KV cache (`-ctk q8_0 -ctv q8_0`), and automatic VRAM freeing when switching to cloud models.
  - Seamless hybrid fallback support for Google AI Studio (Gemini 3.6 Flash, Gemma 4 31B, Flash Lite) and Groq.
- ⚡ **Autonomous Step-by-Step Agent Loop**
  - Self-correcting diagnostics, planning mode, real-time reasoning (`<think>`) parsing, and autonomous multi-turn tool execution.
  - Zero-lag streaming token render engine with a 50ms RAF throttler handling 100+ tokens/second without DOM stutter.
- 🛠️ **Precision File & Tooling Dispatcher**
  - **Fuzzy Multi-Chunk Patching (`patch_file`)**: Robust whitespace-tolerant search/replace block patcher designed for complex refactoring without file truncation.
  - **Sub-3ms Fast File Finder (FFF)**: Native Rust-accelerated file search (`@ff-labs/fff-node`) with recursive fallback.
  - **Live Terminal Supervisor (`execute_command`)**: Real-time PowerShell execution with interactive process handling and automated timeout protection.
  - **Zero-Token-Cost Web Search**: Integrated local SearXNG / DuckDuckGo search and structured Markdown web scraping.
- 🎨 **Modern Glassmorphic Web-IDE Interface**
  - 4 tailored visual themes (`obsidian`, `cyber`, `graphite`, `matrix`).
  - Zero-XSS safe code tokenizer with line-level diffing and multi-tab workspace editor.
  - Real-time telemetry overlays, interactive timeline scrubber, and floating command launcher.
- 🚀 **Native Zero-Overhead Tray Launcher**
  - Ultra-lightweight Windows tray controller (`0xAgent.exe`, ~15 KB, ~8 MB RAM) compiled with native C# `csc.exe` — eliminating heavy Electron/WebView2 runtime overhead to conserve VRAM for local models.
- 🛡️ **Strict Sandboxing & OPSEC Security**
  - Path traversal protection isolating all disk operations to the selected workspace directory.
  - Blacklist guard blocking destructive operating system commands.
  - Optional session token and master password authentication.

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
│    (Express + Tool Dispatcher + Context Manager + Auth Guard)    │
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
| **Styling** | Tailwind CSS 4, Glassmorphism | Custom design tokens, dark glass aesthetic, and CSS variables |
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

### 5. (Optional) Compile the Native Windows Tray Launcher
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
│   ├── api/                 # Detailed REST & WebSocket endpoint specifications
│   └── architecture.md      # Deep-dive architectural documentation
├── launcher/                # Native Windows Tray Launcher
│   └── TrayLauncher.cs      # Ultra-lightweight C# tray host (<15 KB)
├── scripts/                 # Automation & helper scripts
│   ├── build-launcher.ps1   # C# compiler pipeline via csc.exe
│   ├── cleanup.ps1          # Process and port cleanup utility
│   ├── security_audit.cjs   # Automated OPSEC & credential scanner
│   └── start.ps1            # Master PowerShell orchestrator
├── searxng/                 # SearXNG local search configuration
│   └── settings.yml         # Privacy search engine settings
├── server/                  # Node.js / Express Backend
│   ├── agent/               # Autonomous agent logic & pipeline
│   │   ├── agentState.ts    # Agent status & execution cycle
│   │   ├── contextManager.ts# Context window & token management
│   │   ├── promptBuilder.ts # Dynamic system prompt generation
│   │   ├── toolDispatcher.ts# Tool execution coordinator
│   │   └── toolParser.ts    # Resilient XML/JSON tool call parser
│   ├── routes/              # Modular Express API endpoints
│   ├── agent.ts             # Primary LLM streaming loop
│   ├── config.ts            # Configuration persistence (~/.0xagent)
│   ├── hardware.ts          # GPU & VRAM autodetection (WMI/Win32)
│   ├── searxngService.ts    # Privacy web search with fallback
│   ├── session.ts           # Chat session manager & persistence
│   └── tools.ts             # Workspace sandboxed tool implementations
├── src/                     # React 19 Frontend Application
│   ├── components/          # UI Components (Chat, Editor, Settings, HUD)
│   │   ├── chat/            # ReasoningViewer, CommandBar, Scrubber
│   │   ├── settings/        # Model picker, llama installer, Themes
│   │   └── common/          # Zero-XSS Tokenizer, Material Icons, Canvas
│   ├── hooks/               # Custom React hooks (Model Manager, etc.)
│   ├── services/            # REST API client & WebSocket service
│   ├── types.ts             # Single Source of Truth TypeScript types
│   ├── App.tsx              # Main application root
│   └── index.css            # Custom glassmorphic styles and themes
├── .env.example             # Template for environment configuration
├── .gitignore               # Strict production ignore rules
├── package.json             # NPM package manifest & scripts
├── tsconfig.json            # TypeScript configuration
└── vite.config.ts           # Vite bundler configuration
```

---

## ⚙️ Configuration

All user preferences, installed models, custom personas, and long-term memory are stored in your user profile under `~/.0xagent/`:

| Path | Purpose |
|---|---|
| `~/.0xagent/config.json` | Core app settings, API URLs, model parameters |
| `~/.0xagent/models/` | Downloaded local `.gguf` model files |
| `~/.0xagent/llama/` | Local `llama-server.exe` executable binaries |
| `~/.0xagent/personas/` | System personas (`SOUL.md`, `USER.md`, `TOOLS.md`) |
| `~/.0xagent/sessions/` | Persisted chat histories and execution checkpoints |

---

## 🛡️ Security & OPSEC

- **Zero Path Traversal**: All file read, write, and patch operations enforce strict canonical root resolution within the chosen workspace directory.
- **System Command Guard**: Commands containing destructive patterns (`system32`, disk wipe, root deletion) are automatically rejected.
- **Zero XSS Code Highlighting**: Code blocks are rendered through a custom lexical tokenizer producing sanitized React elements without `dangerouslySetInnerHTML`.
- **Automated Security Scanner**: Run `npm run audit:security` anytime to verify that no credentials or private paths exist in the workspace.

---

## 📜 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
