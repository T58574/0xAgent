# Skill: System Health & Test Suite Check

## Purpose
Ensure all unit, subsystem, and integration tests pass cleanly and typecheck has 0 errors.

## Operational Instructions
1. Run `npx tsc --noEmit` and verify TypeScript compilation.
2. Run `npm test` and ensure all test suites pass with 0 failures.
3. If test failure occurs:
   - Identify broken assertion and file.
   - Fix bug adhering to architectural invariants.
   - Re-verify until 100% test pass is achieved.
4. Report test results to Veronica via `0xagent veronica report`.
