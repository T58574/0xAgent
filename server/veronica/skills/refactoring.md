# Skill: Automated Code Refactoring & Anti-Slop Cleanup

## Purpose
Safely eliminate dead code, reduce duplication, refactor bloated functions, and modernize syntax while maintaining 100% functional equivalence.

## Operational Instructions
1. Run `npm test` before making any modifications to establish a baseline.
2. Identify target files and apply atomic changes using `patch_file` with precise SEARCH/REPLACE blocks.
3. Invariants:
   - Zero placeholders: NEVER leave `// TODO` or truncated functions.
   - Preserve all non-modified comments, docstrings, and exports.
   - Strictly avoid breaking changes in public API signatures.
4. Run `npx tsc --noEmit` and `npm test` after each refactoring chunk.
5. If tests fail, autonomously diagnose and rollback or fix before finalizing.
6. Commit changes (if L3+) or record summary via `0xagent veronica report`.
