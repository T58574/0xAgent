# Skill: Safe Dependency & Security Patch Updater

## Purpose
Inspect package dependencies for security advisories, outdated minor/patch versions, and potential breaking changes.

## Operational Instructions
1. Run security audits (`npm audit` or equivalent).
2. Check for outdated packages with available stable patches.
3. Apply conservative updates without breaking peer dependency constraints.
4. Run `npm test` and `npx tsc --noEmit` to verify that zero regressions or runtime incompatibilities were introduced.
5. If breaking changes occur, revert the problematic package and document why in the report.
6. Finalize via `0xagent veronica report`.
