---
name: multi-agent-orchestrator
description: >-
  Audit codebase architecture, identify bottlenecks, security issues and line bloat,
  formulate a structured execution plan, and orchestrate parallel subagents for multi-domain tasks.
  Use this skill when the user asks to act as an orchestrator, run an audit, review codebase metrics,
  or distribute and delegate tasks to subagents (/orchestrate).
---

# Multi-Agent Codebase Orchestrator & Audit Skill

This skill turns the agent into a **Chief System Orchestrator** for full-scope architectural audits, codebase optimization, and parallel subagent delegation.

---

## 🎯 When to Use This Skill
- User invokes `/orchestrate` or asks to act as an orchestrator.
- Major codebase audits (detecting God files, line bloat, security flaws, unoptimized modules).
- Complex refactoring tasks that can be split into parallel independent tracks (Backend, Frontend UI/UX, API Client/Types, Tests).

---

## 📋 Orchestrator Execution Protocol

### Phase 1: Codebase Audit & Metrics Collection
1. **Directory & Structure Analysis**:
   - Inspect workspace layout via `find_by_name` or `list_dir`.
   - Identify critical configuration files (`package.json`, `tsconfig.json`, `GEMINI.md`, `README.md`).
2. **Metrics & Bloat Detection**:
   - Calculate total Lines of Code (LOC) across Backend (`server/`), Frontend (`src/`), and Tests.
   - Identify top largest files (>400-500 LOC) and repetitive boilerplates.
3. **Security & Air-Gap Verification**:
   - Verify network isolation (no unauthorized outgoing telemetry, leaks, or unmonitored HTTP requests).
   - Check file hygiene (temporary files, uncleaned sandbox directories, spill dumps).

### Phase 2: Work Breakdown Structure & Subagent Delegation
Divide the plan into 2-4 decoupled work streams and launch parallel subagents via `invoke_subagent`:

- **Subagent 1: Backend Engine Optimizer** (`role: 'Backend Engine Optimizer'`, `TypeName: 'self'`):
  - Target: Server routes, CLI builders, tool parsers, process managers.
  - Objective: Modularize files >300 lines, replace repetitive imperative loops with declarative registries.
- **Subagent 2: Frontend Services & Atoms Optimizer** (`role: 'Frontend Services & Atoms Optimizer'`, `TypeName: 'self'`):
  - Target: API client, types, reusable UI atoms, settings tabs.
  - Objective: Centralize generic request wrappers, eliminate duplicated Tailwind style classes.
- **Subagent 3: UI/UX & Component Decoupler** (`role: 'Chat UI Decoupler'`, `TypeName: 'self'`):
  - Target: Large view monoliths (`FloatingCommandBar`, `ChatArea`, popovers, modal dialogues).
  - Objective: Extract popovers and HUD cards into dedicated components.
- **Subagent 4: QA & Security Lead** (`role: 'QA & Security Engineer'`, `TypeName: 'self'`):
  - Target: Test suites, build pipeline, regression checks.
  - Objective: Verify 100% test pass rate and clean build.

### Phase 3: Reactive Monitoring & Supervision
1. Rely on reactive event notifications — do not poll in busy loops.
2. If guidance or correction is needed, message running subagents using `send_message`.
3. Kill subagents upon completion via `manage_subagents` (`Action: 'kill_all'`) to free resources.

### Phase 4: Final Consolidation & Delivery
1. Run automated build (`npm run build`) and test suite (`npm test`).
2. Generate a structured before-and-after comparison table showing:
   - File LOC reductions (percentage and line counts).
   - Architectural benefits and modular design patterns.
   - Zero-regression test verification status.
3. Commit and push clean changes to the repository.
