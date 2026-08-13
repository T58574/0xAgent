# 🚀 0xAgent (v2.0.0) — Autonomous Local AI Agent & Web-IDE

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19-cyan.svg)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-green.svg)](https://nodejs.org/)
[![llama.cpp](https://img.shields.io/badge/llama.cpp-Local--Inference-orange.svg)](https://github.com/ggerganov/llama.cpp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**0xAgent** is a state-of-the-art autonomous AI coding agent and Web-IDE designed for local model execution (`llama.cpp`) and cloud LLM APIs (Gemini, Groq). It features complete workspace sandboxing, autonomous code planning, multi-file fuzzy patching, live terminal command execution, and long-term memory.

---

## ✨ Key Features

- 🧠 **Dual Execution Stack**: Run local GGUF models via embedded `llama.cpp` server or switch to Cloud APIs (Gemini 3.6 Flash, Gemma 4 31B, Flash Lite).
- 📋 **Planning & Autonomous Agent Loop**: Automatic step-by-step diagnostic workflow, task planning (`planning_mode`), and iterative self-correction.
- 🛡️ **Workspace Sandboxing & Security**: Strict boundary enforcement to prevent path traversal, local interface binding (`127.0.0.1`), CORS hardening, and master password authentication.
- ⚡ **High-Performance Async Engine**: Non-blocking `fs.promises` Event Loop architecture with 50ms token stream throttling in React 19 (zero DOM lag at 100+ tokens/sec).
- 🛠️ **Advanced Tooling Stack**:
  - `patch_file`: Multi-block fuzzy whitespace-matching search/replace patcher.
  - `read_file`, `write_file`, `list_dir`, `grep_search`.
  - `execute_command`: Live PowerShell execution inside active workspace.
  - `web_search` & `read_web_page`: Zero-token-cost web searching & compressed Markdown reader.
  - `knowledge_base` & `memory`: Long-term fact recall and persistent knowledge vault.
- 🎨 **Glassmorphic UI**: 4 dynamic themes (`obsidian`, `cyber`, `graphite`, `matrix`), code viewer with zero-XSS tokenizer, split-screen IDE layout, and telemetry overlays.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    0xAgent Web Frontend                     │
│           (React 19 + Vite + Tailwind CSS + WS)             │
└──────────────────────────────┬──────────────────────────────┘
                               │ WebSocket & REST API
┌──────────────────────────────▼──────────────────────────────┐
│                    0xAgent Node.js Backend                  │
│       (Express + Async Engine + Tool Dispatcher + Auth)     │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
┌──────────────▼──────────────┐┌──────────────▼──────────────┐
│     Local llama.cpp Server   ││    Google Gemini API / Groq │
│     (GGUF / Hardware GPU)   ││      (Cloud Models Stack)   │
└─────────────────────────────┘└─────────────────────────────┘
```

---

## 📦 Requirements

- **Node.js**: `v18.x` or higher
- **OS**: Windows 10/11 (PowerShell support)
- **Local Models**: Any GGUF quantization file (optional, required only for local offline execution)

---

## ⚡ Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/user/0xAgent.git
cd 0xAgent
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start Development Server
Runs both Express backend (`http://127.0.0.1:3001`) and Vite frontend (`http://127.0.0.1:5173`):
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```

---

## 🛡️ Security Features

- **Sandboxed Operations**: All file manipulations (`read_file`, `patch_file`, `write_file`) are strictly restricted to the specified `workspace_dir`.
- **Local Network Safety**: Backend server defaults to `127.0.0.1` binding with restricted CORS policies.
- **System Protection**: Destructive commands (`system32`, disk format, recursive root deletion) are blocked at the tool execution level.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for details.
