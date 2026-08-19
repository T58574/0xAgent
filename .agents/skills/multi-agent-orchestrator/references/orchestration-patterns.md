# Orchestration Patterns & Role Guidelines

## Ideal Subagent Role Archetypes

1. **Backend Engine Optimizer**
   - Focus: Modularization of routers, schema definitions, tool parsers, and system processes.
   - Rule: Keep files under 300 LOC. Use declarative tables over manual switch/regex blocks.

2. **Frontend Services & Atoms Optimizer**
   - Focus: API client consolidation, type definitions, atomic UI components.
   - Rule: Replace inline styling duplicate trees with reusable atom components.

3. **Chat & UI Decoupler**
   - Focus: Popovers, modal dialogs, empty hero screens, floating bars.
   - Rule: Decouple presentation from container state logic.

4. **QA & Security Lead**
   - Focus: Unit/integration tests, path traversal security, memory hygiene.
   - Rule: Zero test failures and clean builds before delivery.
