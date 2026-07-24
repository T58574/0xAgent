# 0xAgent Project Context & Architecture Guidelines

Welcome to the **0xAgent** workspace!

## Core Principles
1. **High Performance**: All agent operations and tools must run efficiently with minimal CPU overhead.
2. **Context Memory**: Always respect user memory items and workspace-level directives in `0xagent.md`.
3. **PowerShell Native**: Tool executions run inside Windows PowerShell environment.
4. **Safety Guards**: Never run long-running dev servers in background `<execute_command>`.

## Key Files
- `server/agent.ts`: Core AI loop, prompt assembly, stream handling, and tool execution dispatcher.
- `server/tools.ts`: Tool execution routines (`read_file`, `write_file`, `patch_file`, `list_dir`, `grep_search`, `execute_command`, `find0xAgentContext`).
- `server/index.ts`: Backend Express server and WebSocket endpoints.
- `src/App.tsx`: Frontend React UI root application.
