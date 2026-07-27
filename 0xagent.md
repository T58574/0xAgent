# 0xAgent Project Context & Architecture Guidelines

Welcome to the **0xAgent** workspace!

---

## 🚨 MANDATORY AGENT TOOL MAINTENANCE PROTOCOL
1. **Unified Tools Registry**: Whenever ANY new execution tool is added to `server/tools.ts` or `server/agent.ts`, its XML tool specification **MUST ALWAYS** be added to `UNIFIED_SYSTEM_TOOLS_MD` in `server/personas.ts` and updated in `TOOLS.md`.
2. **Unified Tool Availability**: All 16+ tools (`read_file`, `write_file`, `patch_file`, `create_directory`, `get_file_info`, `list_dir`, `grep_search`, `execute_command`, `remember_fact`, `recall_memories`, `list_skills`, `execute_skill`, `search_sessions`, `run_scratch_script`, `ask_user`, `spawn_subagent`) must remain documented in `UNIFIED_SYSTEM_TOOLS_MD`.

---

## 🛠️ ARCHITECTURAL BEST PRACTICES & LESSONS LEARNED

### 1. Non-Blocking Server Execution
- **Native Dialogs**: Always use async promises (`child_process.exec`) for native Windows file/folder browser dialogs (`selectWorkspaceNative`, `selectFileNative`). NEVER call synchronous `execSync` for UI popups as it freezes the Node.js event loop and blocks WebSocket communication.
- **Background Processes**: Never run long-running dev servers (`npm run dev`, `vite`) inside `<execute_command>`. Execute one-off build/test commands instead.

### 2. Resilient File Patching (`executePatchFile`)
- File patch matching must handle CRLF vs LF line endings and whitespace variations (`trimEnd()` and line-by-line `trim()` fallbacks) to prevent failed code updates when LLMs produce slightly different indentation.

### 3. Clean Frontend Codebase & Zero Duplicate Code
- **No Dead Files**: Do not leave unused `.tsx` files in `src/components/` (e.g., deleted `Header.tsx`, `BottomPanel.tsx`, `FileViewer.tsx`, `ColorsTab.tsx`).
- **No Duplicate JSX Rendering**: Never call a render helper function (e.g. `renderStreamingBanner()`) while also duplicating its raw JSX inline inside the parent container.
- **Shared Utilities**: Place reusable helper functions (e.g., `getWorkspaceBaseName`) in `src/utils/helpers.ts` rather than duplicating them in individual components.

### 4. Anti-Repetition Loop Protection
- Monitor assistant tool signatures (`name + arguments`). If an agent attempts 3 identical tool calls with identical parameters in a row, trigger an anti-loop warning and inject a diagnostic prompt directive.

---

## Key Project Files
- `server/agent.ts`: Core AI execution loop, prompt assembly, stream handler, anti-loop breaker.
- `server/tools.ts`: Tool execution routines (`read_file`, `write_file`, `patch_file`, `create_directory`, `get_file_info`, `list_dir`, `grep_search`, `execute_command`).
- `server/personas.ts`: Master persona management & `UNIFIED_SYSTEM_TOOLS_MD` tool registry.
- `server/index.ts`: Express backend and WebSocket real-time event dispatcher.
- `src/App.tsx`: React application entry view.
- `src/components/NotionMarkdown.tsx`: High-performance markdown and math parser with rich inline formatting.
