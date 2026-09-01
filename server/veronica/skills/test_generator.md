# Skill: Automated Unit & Integration Test Generator

## Purpose
Generate comprehensive, robust test suites covering positive paths, boundary conditions, malicious payloads, and concurrency edge cases.

## Operational Instructions
1. Inspect the target source file (functions, classes, interfaces, error paths).
2. Write complete test suites in `tests/` using the native Node.js test runner (`node:test` + `node:assert/strict`).
3. Requirements:
   - Zero mocking of core business invariants where real runtime is available.
   - Explicit verification of boundary conditions, empty states, null/undefined handling.
   - Concurrency stress tests with `Promise.all()` where I/O or queues are involved.
4. Execute `npm test` and ensure all newly added tests pass cleanly.
5. Finalize task via `0xagent veronica report`.
