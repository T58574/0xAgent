# 0xAgent Backend API Reference

> **Base URL:** `http://localhost:3001/api` (or `https://localhost:3001/api`)  
> **WebSocket:** `ws://localhost:3001/ws` (or `wss://localhost:3001/ws`)  
> **Content-Type:** `application/json`

---

## 1. Table of Contents

- [Configuration](#2-configuration)
- [Chat Sessions](#3-chat-sessions)
- [Memory Engine v1.0](#4-memory-engine-v10)
- [Personas System](#5-personas-system)
- [Knowledge Vault (RAG)](#6-knowledge-vault-rag)
- [Skills](#7-skills)
- [Jarvis Companion & Voice](#8-jarvis-companion--voice)
- [Local LLM Server (llama.cpp)](#9-local-llm-server-llamacpp)
- [Hardware & Diagnostics](#10-hardware--diagnostics)
- [WebSocket Realtime Events](#11-websocket-realtime-events)

---

## 2. Configuration

### `GET /api/config`
Returns application settings.
- **Response:** `AppConfig`

### `POST /api/config`
Updates application settings (`~/.0xagent/config.json`).
- **Body:** `AppConfig`
- **Response:** `{ success: true }`

---

## 3. Chat Sessions

### `GET /api/sessions`
Returns list of session summaries.
- **Response:** `SessionSummary[]`

### `GET /api/sessions/:id`
Loads full chat session with messages.
- **Response:** `ChatSession`

### `POST /api/sessions`
Creates a new chat session.
- **Body:** `{ title?: string, workspace_dir?: string }`
- **Response:** `ChatSession`

### `DELETE /api/sessions/:id`
Deletes a chat session file.
- **Response:** `{ success: true }`

### `POST /api/sessions/:id/rollback`
Rolls back session history to a specific message ID.
- **Body:** `{ messageId: string }`
- **Response:** `{ success: true, session: ChatSession }`

---

## 4. Memory Engine v1.0

### `GET /api/memories`
Lists active canonical memories. Optional query string filter: `?query=...`
- **Response:** `MemoryItem[]`

### `POST /api/memories`
Creates or updates a memory item.
- **Body:** `{ key: string, value: string, category?: string, domain?: string, importance?: number, is_explicit?: boolean }`
- **Response:** `MemoryItem`

### `DELETE /api/memories/:id`
Marks a memory item as invalidated.
- **Response:** `{ success: boolean }`

### `GET /api/memories/candidates`
Returns list of candidate memories pending review ($0.70 \le \text{confidence} < 0.90$).
- **Response:** `CanonicalMemory[]`

### `POST /api/memories/resolve`
Resolves candidate or conflicting memories.
- **Body:** `{ memoryId: string, resolution: 'accept' | 'reject', reason?: string }`
- **Response:** `{ success: boolean }`

### `GET /api/memories/episodes`
Searches episodes via FTS5 full-text index.
- **Query Params:** `query` (string), `limit` (number, default: 10)
- **Response:** `Episode[]`

### `POST /api/memories/episodes`
Creates a new episodic memory record.
- **Body:** `{ sessionId?: string, title: string, summary: string, importance?: number, eventTimestamp?: number }`
- **Response:** `Episode`

### `GET /api/memories/relationships/:personaId`
Gets relationship state for the specified persona.
- **Response:** `PersonaRelationship`

### `POST /api/memories/relationships/:personaId`
Updates relationship state for the specified persona.
- **Body:** `Partial<PersonaRelationship>`
- **Response:** `PersonaRelationship`

---

## 5. Personas System

### `GET /api/personas`
Returns all available personas with metadata and active state.
- **Response:** `PersonaDetail[]`

### `POST /api/personas/activate`
Switches the active persona.
- **Body:** `{ id: string }`
- **Response:** `{ success: true, activeId: string }`

### `POST /api/personas`
Creates or updates a persona profile.
- **Body:** `{ id: string, name: string, description: string, soul: string, user: string, tools: string }`
- **Response:** `PersonaDetail`

---

## 6. Knowledge Vault (RAG)

### `GET /api/knowledge`
Lists all knowledge entries from the manifest.
- **Response:** `KnowledgeEntry[]`

### `POST /api/knowledge`
Creates or updates a knowledge entry.
- **Body:** `{ title: string, category: string, content: string, tags?: string[], summary?: string }`
- **Response:** `KnowledgeEntry`

### `DELETE /api/knowledge/:id`
Deletes a knowledge entry.
- **Response:** `{ success: boolean }`

---

## 7. Skills

### `GET /api/skills`
Returns all available AGY skill instruction definitions.
- **Response:** `SkillInfo[]`

### `GET /api/skills/:name`
Returns raw Markdown content of the specified skill.
- **Response:** `{ name: string, content: string }`

---

## 8. Jarvis Companion & Voice

### `GET /api/jarvis/state`
Returns aggregated companion telemetry, active workers, sparks, and speech status.
- **Response:** `JarvisState`

### `POST /api/jarvis/sparks/:id/accept`
Executes action associated with a spark proposal.
- **Response:** `{ success: boolean }`

### `POST /api/jarvis/sparks/:id/dismiss`
Dismisses a spark proposal.
- **Response:** `{ success: boolean }`

### `POST /api/tts/speak`
Synthesizes speech and returns cached base64 audio.
- **Body:** `{ text: string, category?: string }`
- **Response:** `{ audioBase64: string, cached: boolean }`

---

## 9. Local LLM Server (llama.cpp)

### `GET /api/llama/status`
Returns process status, host, port, active model, and PID.
- **Response:** `ServerStatusInfo`

### `POST /api/llama/start`
Launches `llama-server.exe` with configured model and hardware flags.
- **Response:** `{ success: boolean, message: string }`

### `POST /api/llama/stop`
Terminates running `llama-server.exe` process.
- **Response:** `{ success: boolean }`

### `GET /api/llama/models`
Scans `~/.0xagent/models/` and returns available GGUF files with binary metadata.
- **Response:** `GgufModelInfo[]`

---

## 10. Hardware & Diagnostics

### `GET /api/hardware`
Detects GPU, VRAM capacity, CPU, and recommends optimal Vulkan/CUDA offload parameters.
- **Response:** `HardwareInfo`

### `GET /api/diagnostics`
Runs 7-point health check across SQLite, TTS, GGUF paths, and process supervisors.
- **Response:** `DiagnosticReport`

---

## 11. WebSocket Realtime Events

Connect via `ws://localhost:3001/ws` (or `wss://localhost:3001/ws`).

| Event Name | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `agent-user-message` | Client $\to$ Server | `{ sessionId, content }` | Sends prompt to agent execution loop |
| `agent-message-start` | Server $\to$ Client | `{ id, role, sessionId }` | Indicates assistant response stream started |
| `agent-message-chunk` | Server $\to$ Client | `{ id, chunk, sessionId }` | Live streaming token chunk |
| `agent-status-changed` | Server $\to$ Client | `{ sessionId, status }` | `idle`, `thinking`, `executing_tool` |
| `agent-tools-updated` | Server $\to$ Client | `{ sessionId, tools }` | Tool execution status and approval requests |
| `jarvis-state-updated` | Server $\to$ Client | `JarvisState` | Realtime visualizer and spark updates |
