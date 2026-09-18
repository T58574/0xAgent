# 0xAgent Documentation Hub

Welcome to the **0xAgent** technical documentation. This directory is structured for fast indexing by both human developers and autonomous AI agents.

---

## 📚 Documentation Map

```text
docs/
├── README.md               ← You are here: Master Documentation Hub & Index
├── architecture.md         ← High-level System Architecture & Core Subsystems
├── memory-engine.md        ← Memory Engine v1.0 (SQLite, FTS5, Write Policy, Router)
├── proxies.md              ← Proxy configuration & batch import guide
├── LOCAL_MODELS_GUIDE.md   ← Local LLM Guide (llama.cpp, FastMTP, Speculative Decoding)
├── GEMINI.md               ← Developer & AI Agent Invariants Blueprint
└── api/
    └── README.md           ← Complete REST API & WebSocket Protocol Reference
```

---

## 🧭 Quick Navigation by Topic

| Subsystem / Topic | Description | Primary Document |
| :--- | :--- | :--- |
| **System Overview & Components** | Overall architecture, processes, data directory layout, and execution loop | [`architecture.md`](./architecture.md) |
| **Memory & Personalization** | SQLite canonical store, Write Policy, Deterministic Router, Episodes & Persona views | [`memory-engine.md`](./memory-engine.md) |
| **Proxy & Network Management** | Tor, SOCKS5, HTTP proxies, routing rules, and batch import format | [`proxies.md`](./proxies.md) |
| **Local Models & Inference** | Hardware detection, llama.cpp flags, FastMTP speculative decoding, and VRAM tuning | [`LOCAL_MODELS_GUIDE.md`](./LOCAL_MODELS_GUIDE.md) |
| **REST & WebSocket API** | Endpoints for sessions, memories, personas, knowledge vault, and realtime events | [`api/README.md`](./api/README.md) |
| **Developer Guidelines** | Core invariants, single source of truth rules, and zero-slop standards | [`GEMINI.md`](./GEMINI.md) |

---

## 🛠️ Architecture at a Glance

```text
┌────────────────────────────────────────────────────────────────────────┐
│                               0xAGENT                                  │
│                                                                        │
│   Frontend (React 19 + Vite) ◄───[ WebSocket / REST ]───► Backend API  │
│   - Monaco Code Editor                                 (Express :3001) │
│   - Chat Timeline & Reasoning HUD                                      │
│   - Memory & Skills Management                                         │
│   - Knowledge Vault & RAG Index                                        │
│                                                                        │
│   Backend Subsystems:                                                  │
│   ├─ Agent Orchestrator (agent.ts, loopBreaker, outputSpiller)         │
│   ├─ Memory Engine v1.0 (SQLite WAL, FTS5, Deterministic Router)       │
│   ├─ Telegram Bot Subsystem (GrammY, Private Local Assistant)          │
│   ├─ FastMTP Manager (Speculative Draft Decoding)                      │
│   └─ llama.cpp Supervisor (Hardware Detection & GGUF Parser)           │
└────────────────────────────────────────────────────────────────────────┘
```
