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

## 🎮 CLI Supervisor & Tray Hub

0xAgent runs quietly in your **System Tray** (`0xAgent.exe`, ~15 KB, ~8 MB RAM) without cluttering your terminal with open console windows, freeing 100% of GPU VRAM and CPU for inference.

Manage the entire platform from any terminal via the unified `0xagent` CLI:

```bash
# Launch platform in silent background Tray Mode (default)
0xagent

# Launch interactive CLI settings, API keys & models manager
0xagent config

# Pull latest releases & updates from GitHub with 1-click rebuild
0xagent update

# Inspect live backend health, port bindings & telemetry
0xagent status

# Force purge GPU VRAM and terminate background inference workers
0xagent purge-vram

# Stop all background processes cleanly
0xagent stop
```

---

## 🚀 Key Features & Agent Harness

Unlike conventional wrappers requiring external servers (like Ollama or vLLM), **0xAgent is the first all-in-one platform featuring a native, built-in inference supervisor** and a production-grade autonomous agent harness out of the box with zero complex setup.

### 🧠 First-of-its-Kind Built-In Local Engine
- **Native `llama-server` Supervisor**: 1-click binary downloader and automatic GPU layer offloading (`-ngl`), Flash Attention (`-fa on`), quantized KV cache (`-ctk q8_0 -ctv q8_0`), and automated VRAM reclamation when switching models.
- **Hybrid Cloud Fallback**: Zero-latency switching to Google AI Studio (Gemini 3.6 Flash / Flash Lite) and Groq when local compute is constrained.
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
| `~/.0xagent/models/` | Local GGUF model files repository |
| `~/.0xagent/llama/` | Managed `llama-server.exe` binary builds |
| `~/.0xagent/personas/` | System personas & memory (`SOUL.md`, `USER.md`, `TOOLS.md`) |
| `~/.0xagent/sessions/` | Dialogue session history and branching checkpoints |
| `~/.0xagent/workspaces/` | Isolated workspace sandbox directories |
| `~/.0xagent/spill/` | Disk spilled logs for outputs exceeding 24 KB |

---

## 📜 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
