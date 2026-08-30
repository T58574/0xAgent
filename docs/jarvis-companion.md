# Jarvis Companion & Voice Intercom System

> **Subsystem:** Jarvis Proactive Companion & Voice Intercom  
> **Status:** Production Active  
> **Components:** `server/jarvisSupervisor.ts`, `server/proactiveCompanion.ts`, `server/ttsService.ts`, `server/agent/voiceDaemonManager.ts`, `server/voice_daemon.py`

---

## 1. Overview

The **Jarvis Companion** is an autonomous assistant subsystem that provides real-time voice interaction, proactive suggestions (*Sparks*), and background system monitoring for 0xAgent.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Jarvis Companion Topology                       │
├──────────────────────────────────┬─────────────────────────────────────┤
│      Voice & Audio Ingestion     │        Proactive Sparks Engine      │
│  ┌─────────────────────────────┐ │  ┌────────────────────────────────┐ │
│  │ Local Python Voice Daemon   │ │  │ proactiveCompanion.ts          │ │
│  │ (Moonshine / sherpa-onnx)   │ │  │ - Background activity watcher  │ │
│  │             ↓               │ │  │ - Autonomous spark proposals   │ │
│  │ voiceMacroService.ts        │ │  │ - Error incident interceptor   │ │
│  │ (0-token OS shortcuts)      │ │  └────────────────────────────────┘ │
│  └─────────────────────────────┘ │                 │                   │
│                │                 │                 ▼                   │
│                ▼                 │  ┌────────────────────────────────┐ │
│  ┌─────────────────────────────┐ │  │ Frontend JarvisSanctuary &     │ │
│  │ ttsService.ts (Audio TTS)   │◄┼──┤ JarvisWidget Floating HUD      │ │
│  │ - MD5-cached audio files    │ │  │ (Realtime Audio Visualizer)    │ │
│  └─────────────────────────────┘ │  └────────────────────────────────┘ │
└──────────────────────────────────┴─────────────────────────────────────┘
```

---

## 2. Key Components

### A. Proactive Sparks Engine (`server/proactiveCompanion.ts`)
- **Sparks**: Actionable suggestions generated autonomously without waiting for explicit human prompts (e.g. recommending test runs, identifying stale processes, summarizing recent file modifications).
- **Incident Interception**: Automatically catches server warnings/errors and creates triage spark proposals with 1-click execution.

### B. Voice Daemon & Speech-to-Text (`server/agent/voiceDaemonManager.ts` & `server/voice_daemon.py`)
- Native Python background process running lightweight local ONNX speech models (Moonshine / Sherpa-onnx / Whisper).
- Streams live transcription events over IPC to `voiceDaemonManager.ts`.

### C. Zero-Token OS Voice Macros (`server/agent/voiceMacroService.ts`)
- Recognizes predefined voice shortcuts (e.g. *"открой редактор"*, *"очисти память"*, *"статус системы"*) and executes OS actions immediately without invoking LLM tokens.

### D. TTS Audio Synthesis (`server/ttsService.ts`)
- Generates speech audio for conversational responses, categorized into preset rapid soundbites and dynamic speech generation.
- Caches generated base64 audio by MD5 hash on disk to eliminate redundant synthesis latency.
