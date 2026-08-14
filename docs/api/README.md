# 0xAgent Backend API Reference

> Base URL: `http://localhost:3001/api`  
> WebSocket: `ws://localhost:3001/ws`  
> Content-Type: `application/json`

---

## Table of Contents

- [Configuration](#configuration)
- [Chat Sessions](#chat-sessions)
- [Agent Execution](#agent-execution)
- [System Prompts](#system-prompts)
- [Memory](#memory)
- [Skills](#skills)
- [Workspace & Files](#workspace--files)
- [Local LLM Server (llama.cpp)](#local-llm-server-llamacpp)
- [GGUF Model Management](#gguf-model-management)
- [Hardware Detection](#hardware-detection)
- [Audio Transcription](#audio-transcription)
- [Network](#network)
- [WebSocket Events](#websocket-events)

---

## Configuration

### `GET /api/config`
Returns the full application configuration.

**Response:** `AppConfig` object (see [Types](#types)).

### `POST /api/config`
Saves the full application configuration to `~/.0xagent/config.json`.

**Body:** `AppConfig` object.  
**Response:** `{ success: true }`

---

## Chat Sessions

### `GET /api/sessions`
Lists all saved chat sessions.

**Response:** `ChatSession[]`

### `GET /api/sessions/:id`
Loads a specific session by ID.

**Response:** `ChatSession`  
**Error:** `404` if session not found.

### `POST /api/sessions`
Creates a new chat session.

**Body:** `{ title: string }`  
**Response:** `ChatSession`

### `POST /api/sessions/:id/save`
Saves/updates a chat session.

**Body:** Full `ChatSession` object.  
**Response:** `{ success: true }`

### `DELETE /api/sessions/:id`
Deletes a session.

**Response:** `{ success: true }`

---

## Agent Execution

### `POST /api/send-message`
Triggers the agent loop for a session. The last user message in the session is processed by the LLM. Results are streamed via WebSocket events.

**Body:** `{ sessionId: string }`  
**Response:** `{ success: true }`

> **Note:** This is a non-blocking call. The agent runs asynchronously and pushes results via WebSocket.

### `POST /api/cancel-agent`
Cancels the active agent execution for a session.

**Body:** `{ sessionId: string }`  
**Response:** `{ success: true }`

### `POST /api/respond-to-tool`
Approves or rejects a pending tool call confirmation.

**Body:**
```json
{
  "sessionId": "string",
  "toolCallId": "string",
  "approve": true | false
}
```
**Response:** `{ success: boolean }`

---

## System Prompts

Files stored in `~/.0xagent/prompts/`. Each file is a `.md` document.

### `GET /api/prompts`
Lists all available prompt files.

**Response:** `PromptFileInfo[]`

### `GET /api/prompts/:filename`
Returns the content of a specific prompt file.

**Response:** `{ filename: string, content: string }`

### `POST /api/prompts/:filename`
Creates or updates a prompt file.

**Body:** `{ content: string }`  
**Response:** `{ success: true }`

### `DELETE /api/prompts/:filename`
Deletes a prompt file.

**Response:** `{ success: true }`

### `POST /api/prompts-select`
Sets the active system prompt file.

**Body:** `{ filename: string }`  
**Response:** Updated `AppConfig`

---

## Memory

Persistent agent facts stored in `~/.0xagent/memory.json`.

### `GET /api/memories`
Lists all memories. Supports optional `?query=<text>` to filter by keyword.

**Response:** `MemoryItem[]`

### `POST /api/memories`
Adds or updates a memory entry.

**Body:**
```json
{
  "key": "string",
  "value": "string",
  "category": "user_preference" | "project_convention" | "architecture" | "fact" | "general"
}
```
**Response:** `MemoryItem`

### `DELETE /api/memories/:id`
Deletes a memory entry.

**Response:** `{ success: boolean }`

---

## Skills

Extensible agent skill instruction files stored in `~/.0xagent/skills/`.

### `GET /api/skills`
Lists all skills.

**Response:** `SkillInfo[]`

### `GET /api/skills/:name`
Returns the content of a specific skill.

**Response:** `{ name: string, content: string }`

### `POST /api/skills/:name`
Creates or updates a skill.

**Body:** `{ content: string }`  
**Response:** `{ success: true }`

### `DELETE /api/skills/:name`
Deletes a skill.

**Response:** `{ success: true }`

---

## Workspace & Files

### `POST /api/select-workspace`
Opens a native folder picker dialog to select the active workspace directory. Saves the selection to config.

**Response:** `{ folder: string | null }`

### `POST /api/select-file`
Opens a native file picker dialog.

**Body:** `{ filter?: string }` — e.g. `"Executable Files (*.exe)|*.exe|All Files (*.*)|*.*"`  
**Response:** `{ filePath: string | null }`

### `GET /api/workspace-tree`
Returns the file tree of the active workspace.

**Query:** `?workspaceDir=<path>` (optional override)  
**Response:** `FileNode[]`

### `GET /api/read-file-raw`
Reads a file's raw content.

**Query:** `?path=<absolute_file_path>`  
**Response:** `{ content: string }`

### `POST /api/write-file-raw`
Writes content to a file.

**Body:** `{ path: string, content: string }`  
**Response:** `{ success: true }`

---

## Local LLM Server (llama.cpp)

### `POST /api/start-local-server`
Spawns a local `llama-server.exe` child process. Auto-detects executable in `~/.0xagent/llama/` and model in `~/.0xagent/models/` if not explicitly set. Kills any orphaned process on the target port before launching.

**Body (all fields optional):**
```json
{
  "exePath": "C:\\...\\llama-server.exe",
  "modelPath": "C:\\...\\model.gguf",
  "host": "127.0.0.1",
  "port": 11434,
  "ctxSize": 4096,
  "gpuLayers": 99,
  "threads": 8,
  "batchSize": 2048,
  "ubatchSize": 512,
  "temp": 0.7,
  "repeatPenalty": 1.1,
  "minP": 0.08,
  "flashAttn": false,
  "mmap": true,
  "mlock": false,
  "embedding": false,
  "contBatching": false
}
```
**Response:** `{ success: true, host: string, port: number, message: string }`

> Logs are streamed via WebSocket event `llama-server-log`.

### `POST /api/stop-local-server`
Terminates the active llama-server process tree.

**Response:** `{ success: true, message: string }`

### `GET /api/server-status`
Returns live state of the local llama-server child process.

**Response:**
```json
{
  "running": true,
  "pid": 12345,
  "exePath": "C:\\...\\llama-server.exe",
  "modelPath": "C:\\...\\model.gguf",
  "host": "127.0.0.1",
  "port": 11434
}
```

### `GET /api/server-health`
Proxies a health check to the local llama.cpp server.

**Query:** `?host=127.0.0.1&port=11434`  
**Response:** `{ ok: boolean, status: "ok" | "loading" | "stopped" }`

### `GET /api/server-slots`
Queries live inference slot metrics from the llama.cpp server.

**Query:** `?host=127.0.0.1&port=11434`  
**Response:** `{ ok: boolean, totalSlots: number, activeSlots: number }`

---

## GGUF Model Management

### `GET /api/llama-releases`
Fetches GitHub releases for `ggerganov/llama.cpp` with a 15-minute TTL cache.

**Query:** `?refresh=true` to force cache invalidation.  
**Response:** Array of release objects with `tag`, `name`, `published_at`, `assets[]`.

### `GET /api/installed-llama-versions`
Scans `~/.0xagent/llama/` for locally installed llama.cpp versions.

**Response:** `{ tag: string, exePath: string, isCurrent: boolean }[]`

### `POST /api/install-llama-version`
Downloads and installs a specific llama.cpp release from GitHub, or switches to an already-installed version.

**Body:**
```json
{
  "tag": "b10099",
  "downloadUrl": "https://github.com/.../llama-b10099-bin-win-cuda.zip",
  "assetName": "llama-b10099-bin-win-cuda.zip"
}
```
**Response:** `{ exePath: string, message: string }`

### `POST /api/select-installed-llama`
Switches the active llama.cpp version to an already-installed one (no download).

**Body:** `{ exePath: string }`  
**Response:** `{ exePath: string, message: string }`

### `GET /api/gguf-models`
Returns a static list of recommended GGUF models with download URLs.

**Response:** Array of `{ id, name, desc, filename, url, size }`

### `POST /api/download-model`
Downloads a GGUF model to `~/.0xagent/models/`.

**Body:** `{ downloadUrl: string, fileName: string }`  
**Response:** `{ modelPath: string }`

### `POST /api/parse-gguf`
Parses GGUF file headers and returns model metadata.

**Body:** `{ filePath: string }`  
**Response:** `GgufMetadata`

### `GET /api/scan-models-dir`
Recursively scans a directory for `.gguf` files and returns their metadata.

**Query:** `?dirPath=<path>` (defaults to `~/.0xagent/models/`)  
**Response:** `{ dirPath: string, models: GgufMetadata[] }`

---

## Hardware Detection

### `GET /api/detect-hardware`
Auto-detects GPU hardware using `Win32_VideoController` (Windows) or Apple Silicon (macOS).

**Response:** `HardwareInfo`
```json
{
  "vendor": "NVIDIA" | "AMD" | "Intel" | "Apple" | "CPU",
  "gpuName": "AMD Radeon RX 7800 XT",
  "recommendedBuild": "Vulkan (bin-win-vulkan)",
  "recommendedAssetKeywords": ["bin-win-vulkan", "bin-win-x64"],
  "isAutoDetected": true
}
```

---

## Audio Transcription

### `POST /api/transcribe-audio`
Transcribes audio via the Groq Whisper API.

**Body:**
```json
{
  "audioBase64": "<base64 encoded audio>",
  "apiKey": "gsk_..."
}
```
**Response:** `{ text: string }`

---

## Network

### `GET /api/get-local-ips`
Returns all local IPv4 network addresses for LAN access to the UI.

**Response:** `{ urls: string[] }` — e.g. `["http://192.168.1.50:5173"]`

---

## WebSocket Events

WebSocket connection path: `ws://localhost:3001/ws`

All messages are JSON: `{ event: string, payload: any }`

| Event | Payload | Description |
|---|---|---|
| `agent-status-changed` | `"idle" \| "thinking" \| "waiting_approval" \| "executing_tool"` | Agent execution status changed |
| `agent-message-start` | `{ sessionId, messageId }` | New assistant message started |
| `agent-token-stream` | `{ sessionId, messageId, token, fullContent }` | Streaming token from LLM |
| `agent-tools-updated` | `{ sessionId, messageId, tools: ToolCallInfo[] }` | Tool calls parsed from response |
| `agent-tool-status-changed` | `{ sessionId, toolCallId, status, output? }` | Tool execution status update |
| `agent-error` | `string \| { sessionId, message }` | System error or status notification |
| `llama-server-log` | `string` | Live stdout/stderr output from llama-server process (ANSI stripped) |
| `llama-server-status` | `{ status: "running" \| "stopped", pid?, host?, port?, error? }` | Real-time llama-server process status update |

---

## Types

### `AppConfig`
```typescript
interface AppConfig {
  api_url: string;               // LLM API endpoint (e.g. "http://127.0.0.1:11434/v1")
  model_name: string;            // Model identifier
  system_prompt: string;         // Active system prompt text
  active_prompt_file?: string;   // Active prompt filename
  workspace_dir?: string;        // Active workspace directory path
  groq_api_key?: string;         // Groq API key for Whisper transcription
  active_theme?: string;         // UI theme name
  theme_colors?: ThemeColors;    // Custom theme color overrides
  reasoning_enabled?: boolean;   // Show <think> reasoning blocks
  temperature?: number;          // LLM temperature
  max_tokens?: number;           // Max response tokens
  api_timeout_sec?: number;      // API request timeout
  auto_save_history?: boolean;   // Auto-save chat sessions
  sound_notifications?: boolean; // Audio notifications
  compact_chat?: boolean;        // Compact chat layout
  local_server?: LocalServerConfig;
}
```

### `LocalServerConfig`
```typescript
interface LocalServerConfig {
  exe_path?: string;        // Path to llama-server.exe
  model_path?: string;      // Path to .gguf model file
  host?: string;            // Server bind host (default: "127.0.0.1")
  port?: number;            // Server bind port (default: 11434)
  ctx_size?: number;        // Context window size (-c)
  threads?: number;         // CPU threads (-t)
  gpu_layers?: number;      // GPU offload layers (-ngl)
  temp?: number;            // Temperature (--temp)
  batch_size?: number;      // Batch size (-b)
  ubatch_size?: number;     // Micro-batch size (-ub)
  min_p?: number;           // Min P sampling (--min-p)
  repeat_penalty?: number;  // Repeat penalty (--repeat-penalty)
  flash_attn?: boolean;     // Flash Attention (-fa)
  embedding?: boolean;      // Embedding mode (--embedding)
  cont_batching?: boolean;  // Continuous batching (--cont-batching)
  prompt_cache?: boolean;   // Prompt cache toggle
  mlock?: boolean;          // Lock model in RAM (--mlock)
  mmap?: boolean;           // Memory-map model (--mmap / --no-mmap)
}
```

### `ChatSession`
```typescript
interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  created_at: number;   // Unix timestamp ms
  updated_at: number;   // Unix timestamp ms
}
```

### `ChatMessage`
```typescript
interface ChatMessage {
  id: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  timestamp: number;
  tool_calls?: ToolCallInfo[];
}
```

### `ToolCallInfo`
```typescript
interface ToolCallInfo {
  id: string;
  name: string;
  arguments: string;  // JSON string
  status: "pending" | "approved" | "rejected" | "running" | "completed" | "error";
  output?: string;
}
```

### `GgufMetadata`
```typescript
interface GgufMetadata {
  filePath: string;
  fileName: string;
  fileSizeFormatted: string;
  fileSizeBytes: number;
  magicValid: boolean;
  version: number;
  architecture: string;
  modelName: string;
  quantization: string;
  blockCount: number;
  contextLength: number;
  expertCount: number;
  isMmproj: boolean;
}
```
