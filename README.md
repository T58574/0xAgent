<div align="center">

<img src="0xAgent-icon.jpg" alt="0xAgent Icon" width="110" style="border-radius: 24px; margin-bottom: 12px;" />

# 0xAgent — Autonomous AI Developer & Web-IDE Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19.1-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7.0-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![llama.cpp](https://img.shields.io/badge/llama.cpp-Builtin_Supervisor-FFA500?style=flat-square)](https://github.com/ggerganov/llama.cpp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

**Next-generation autonomous AI coding platform and Web-IDE with a built-in local inference engine (`llama.cpp`), full zero-config agent harness pipeline, and hybrid cloud fallback.**

[Quick Start](#-1-click-quick-start) • [CLI & Tray Hub](#-cli-supervisor--tray-hub) • [Features & Harness](#-key-features--agent-harness) • [Architecture](#-architecture) • [Configuration](#-configuration) • [License](#-license)

**[English](README.md)** • **[Русский](README.ru.md)**

</div>

---

<img width="1625" height="1049" alt="0xAgent Web IDE Interface" src="https://github.com/user-attachments/assets/ee144717-f865-470e-aa65-5b7b4b20c4cd" />

---

## ⚡ 1-Click Quick Start

Install and configure 0xAgent in a single command. The installer automatically verifies prerequisites (Node.js LTS, Git), sets up SSL, builds the client, compiles the native Windows tray host, and binds the global `0xagent` CLI.

### Windows (PowerShell)
```powershell
irm https://raw.githubusercontent.com/T58574/0xAgent/main/install.ps1 | iex
```

### Linux / macOS / WSL (Bash)
```bash
curl -fsSL https://raw.githubusercontent.com/T58574/0xAgent/main/install.sh | bash
```

---

## 🎮 Terminal CUI & CLI Agent

0xAgent provides a complete, rich **Terminal CUI (Character User Interface)** and CLI execution runner (similar to Claude Code, Antigravity CLI, Codex CLI, and OpenCode CLI) that can be invoked from **any directory** or automated from scripts:

```bash
# Launch full interactive CUI REPL session in the current directory:
0xagent

# Interactive Settings TUI (toggle Auto-Open Browser, Permissions, Themes, etc.):
0xagent settings

# Interactive Model TUI (with horizontal reasoning effort slider and GGUF scanning):
0xagent model

# Interactive Persona Switcher:
0xagent persona

# One-shot prompt execution directly in your terminal:
0xagent "Analyze this project and suggest architectural improvements"
0xagent -p "Fix type errors in server/agent.ts"

# Quiet output for script automation & piping (e.g. Veron / CI):
0xagent -p "Summarize git diff" --quiet
git diff | 0xagent "Explain these changes"

# Manage local llama-server:
0xagent server status
0xagent server start
0xagent server stop
0xagent server logs
0xagent server purge

# View and update configuration:
0xagent config show
0xagent config set permission_preset unrestricted
0xagent config set auto_open_browser true

# Service supervision:
0xagent start           # Launch background System Tray host (Windows)
0xagent status          # Check backend health & telemetry
0xagent purge-vram      # Force release GPU VRAM
0xagent update          # Pull latest releases & rebuild
0xagent stop            # Terminate all processes
```

### ⌨️ In-CUI Slash Commands & Interactive Modals

When running `0xagent`, type `/` to bring up the command picker or use slash commands directly:

| Slash Command | Description |
|---|---|
| `/settings` | Open interactive 2-column settings table with search filter (`Auto Open Browser`, `Permission Preset`, `Reasoning Effort`, `Theme`, etc.) |
| `/model` | Open model picker with horizontal **Effort Slider** (`low` / `medium` / `high` / `auto`), local GGUF scan, and cloud models |
| `/persona` | Open interactive persona profile selector |
| `/server [action]` | Manage local `llama-server` (`start`, `stop`, `status`, `logs`, `purge`) |
| `/status` | View system hardware, GPU VRAM usage, and active session telemetry |
| `/compact` | Trigger 4-tier context compaction and token pruning on demand |
| `/config [key] [val]` | Inspect or update configuration key inline |
| `/clear`, `/reset` | Clear conversation history and reset context checkpoint |
| `/help` | Display command guide and keybindings |
| `/exit`, `/quit` | Exit the CUI session |

> [!TIP]
> **No Browser Popups on Startup**: By default, `auto_open_browser` is set to `false`. Starting 0xAgent never interrupts your workflow with an unwanted browser tab. You can toggle this anytime in `/settings`, the Web IDE settings, or via `0xagent config set auto_open_browser true`.

---

## 🚀 Key Features & Agent Harness

Unlike conventional wrappers requiring external servers (like Ollama or vLLM), **0xAgent is the first all-in-one platform featuring a native, built-in inference supervisor**, a 24/7 personal assistant module (**Veronica**), and a production-grade autonomous agent harness out of the box with zero complex setup.

### 🤖 Module «Veronica» — Personal AI Assistant & Telegram Supervisor
*See full guide: [docs/veronica.md](docs/veronica.md)*
- **Deterministic SQLite Audit Journal**: All background tasks, heartbeats, git commits, and project states are stored in an isolated `veronica.db` (WAL mode) with an In-Memory Single-Writer FIFO queue.
- **Telegram Bot Gateway (`grammy`)**: Control tasks, query project progress, and receive instant proactive notifications on completion, crashes, or timeouts (`/status`, `/projects`, `/today`, `/yesterday`, `/run`, `/kill`).
- **Unified Web-IDE Action Strip & Task Modal**: Launch background tasks with custom prompts, autonomy levels (L0–L5), and project binding directly from the Web-IDE interface.
- **Token-Dense Context Engine & 4-Phase Prompting**: Generates ultra-compact project summaries (~150-250 tokens) via `0xagent veronica context <project>` and injects project passports into headless tasks.
- **Watchdog & Process Supervisor**: Automatic PID verification, inactivity timeout tracking (300s), Tree-Kill of hanging subprocesses, and crash state self-healing on boot.
- **Single-Agent Project Mutex**: Exclusive project locks preventing race conditions and git corruption.
- **Autonomy Levels (L0–L5)**: Hardware-enforced privilege boundaries restricting automated git commits to L3+.

### 🧠 Dual Inference & Unified Model Selector
- **Unified Multi-Engine Model Selector**: Seamlessly switch between Antigravity Cloud models (Gemini 3.7/3.6/3.1 Pro, Claude Sonnet 4.6 & Opus Thinking, GPT-OSS 120B) and Local GGUF weights with inline reasoning effort toggles (`off`, `low`, `medium`, `high`).
- **24-Hour Persistent Model Caching**: High-performance `localStorage` cache with auto-invalidation and 1-click manual refresh.
- **24/7 Low-Power Laptop Mode**: Run 0xAgent and Veronica on a low-spec laptop 24/7 (~150 MB RAM) while offloading heavy LLM inference to a powerful GPU workstation over LAN (`0xagent node probe`).
- **Native `llama-server` Supervisor**: 1-click binary downloader and automatic GPU layer offloading (`-ngl`), Flash Attention (`-fa on`), quantized KV cache (`-ctk q8_0 -ctv q8_0`), and automated VRAM reclamation.
- **Local GGUF Model Hub**: Direct support for Qwen 2.5 Coder, Gemma 4, DeepSeek, and Llama 3.3.

### 🛠 Complete Zero-Config Agent Harness
- **Concurrent Tool Execution**: Read-only exploration tools (`read_file`, `list_dir`, `grep_search`, `fff_search`, `web_search`) execute in parallel via `Promise.all()`, speeding up repository scans by 3-5x.
- **Whitespace-Tolerant Patching (`patch_file`)**: Robust multi-chunk search/replace block patcher ensuring precise refactoring with zero data loss or file truncations.
- **Sandboxed Code Mode (`<code_run>`)**: In-memory VM runtime enabling the agent to execute complex Node.js automation scripts with async host tool bindings in a single turn.
- **Oscillation & Loop Breaker (`loopBreaker.ts`)**: 8-step rolling history tracking with canonical argument sorting, preventing repetitive tool cycling.
- **4-Tier Context Compaction (`compactionPipeline.ts`)**: Coordinated token optimization featuring zero-token tool pruning with error retention, CoT thought stripping, bounded windowing, and milestone summarization.
- **Output Spiller (`outputSpiller.ts`)**: Automatically offloads massive terminal outputs (>24 KB) to disk (`~/.0xagent/spill/*.log`) to shield the LLM context window.
- **Interactive Question Cards (`<ask_user_question>`)**: Agent can pause mid-flight to ask clarifying multi-choice questions or present interactive plan reviews.
- **Privacy Web Search & Fast File Finder**: Local SearXNG / DuckDuckGo web research with Markdown scrapers and sub-3ms Rust-accelerated file finder (`@ff-labs/fff-node`).

---

## 🏛 Architecture

### System Flow & Component Topology

```mermaid
flowchart TD
    subgraph UI ["Frontend Web IDE (React 19 + TypeScript + Tailwind 4)"]
        Chat["Chat & Reasoning Stream (<think>)"]
        Editor["Monaco Code Editor & Tabs"]
        PlanHUD["Live Plan Progress HUD (todo_write)"]
        CmdBar["Floating Command Bar & Permission Matrix"]
    end

    subgraph Host ["Zero-Overhead Supervisor & Host"]
        Tray["Native C# Tray Launcher (0xAgent.exe)"]
        CLI["Universal CLI Hub (0xagent)"]
    end

    subgraph Core ["0xAgent Backend Engine (Express + WebSocket)"]
        AgentLoop["Agent Orchestrator Loop (agent.ts)"]
        Compactor["4-Tier Context Compactor & Pruner"]
        LoopGuard["Loop Breaker & Output Spiller"]
        Sandbox["Code Mode VM Sandbox (<code_run>)"]
        Dispatcher["Parallel Tool Dispatcher"]
    end

    subgraph Inference ["Dual Inference Engine"]
        LlamaSup["llama-server Supervisor\n(GGUF / Flash-Attn / VRAM Purge)"]
        CloudAPI["Cloud LLM Gateway\n(Gemini 3.6 / Flash Lite / Groq)"]
    end

    subgraph Tooling ["Workspace Tooling & External Services"]
        FilePatcher["Fuzzy Multi-Chunk Patcher"]
        FFF["Rust Fast File Finder (FFF)"]
        Terminal["Live Terminal Supervisor"]
        Search["SearXNG / DuckDuckGo Engine"]
    end

    Tray --> UI
    CLI --> Core
    UI <===>|"HTTPS REST & Duplex WSS"| Core
    Core --> AgentLoop
    AgentLoop --> Compactor
    AgentLoop --> LoopGuard
    AgentLoop --> Sandbox
    AgentLoop --> Dispatcher
    Dispatcher --> FilePatcher
    Dispatcher --> FFF
    Dispatcher --> Terminal
    Dispatcher --> Search
    AgentLoop <===> Inference
    Inference --- LlamaSup
    Inference --- CloudAPI
```

### High-Level Topology Schema

```
┌────────────────────────────────────────────────────────────────────────┐
│                      0xAgent Web IDE Interface                         │
│       (React 19 + Vite 7 + Monaco Editor + Glassmorphism Theme)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS REST & Duplex WSS
┌───────────────────────────────────▼────────────────────────────────────┐
│                    0xAgent Backend Engine & Harness                    │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ Agent Loop • 4-Tier Context Compaction • Loop Breaker • Sandbox │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
└───────────────────┬───────────────┴───────────────┬────────────────────┘
                    │                               │
┌───────────────────▼──────────────┐ ┌──────────────▼────────────────────┐
│  Built-in llama.cpp Supervisor   │ │      Hybrid Cloud Gateway         │
│  (Native GGUF / GPU Offloading)  │ │   (Google AI Studio / Groq API)   │
└──────────────────────────────────┘ └───────────────────────────────────┘
```

---

## 🌐 Localization

0xAgent provides full out-of-the-box bilingual support for **English** and **Russian (Русский)** across the entire interface, tool outputs, settings, and voice telemetry. Toggle instantly via the `[EN]` / `[RU]` badge in the navigation bar or configure via `0xagent config`.

- 📖 Документация на русском языке доступна в [README.ru.md](README.ru.md).

---

## 📁 Configuration

All runtime configurations, model weights, personas, and memory are stored in `~/.0xagent/`:

| Directory / File | Description |
|---|---|
| `~/.0xagent/config.json` | Global settings, API keys, active models, and security permissions |
| `~/.0xagent/veronica/` | Veronica SQLite audit journal (`veronica.db`), backups & task history |
| `~/.0xagent/models/` | Local GGUF model files repository |
| `~/.0xagent/llama/` | Managed `llama-server.exe` binary builds |
| `~/.0xagent/personas/` | System personas & memory (`SOUL.md`, `USER.md`, `TOOLS.md`) |
| `~/.0xagent/sessions/` | Dialogue session history and branching checkpoints |
| `~/.0xagent/workspaces/` | Isolated workspace sandbox directories |
| `~/.0xagent/spill/` | Disk spilled logs for outputs exceeding 24 KB |

---

## 📜 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
