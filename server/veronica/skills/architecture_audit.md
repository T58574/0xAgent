# Skill: Deep Architecture & Modularity Audit

## Purpose
Analyze the structural integrity, separation of concerns, dependency graphs, and architectural compliance across the repository.

## Operational Instructions
1. Discover project files, module boundaries, and entry points.
2. Check for:
   - Circular imports and tight coupling between domain modules.
   - God-objects and files exceeding recommended size thresholds (>400 lines).
   - Compliance with Single Source of Truth for types and schemas.
   - Adherence to Atomic UI and Design System standards.
3. Formulate an architectural report with:
   - `[VERDICT]` (Overall architectural health)
   - `[SCORE:X/10]` (Numerical rating with breakdown)
   - `[RISKS]` (Bottlenecks, scalability limits, tech debt)
   - `[RECOMMENDATIONS]` (Prioritized P0/P1/P2 refactoring steps)
4. Record results via `0xagent veronica report --status completed --summary "<summary>"`.
