# Skill: Automated Code Review

## Purpose
Perform deep architectural, quality, and security static review of recent changes in the repository.

## Operational Instructions
1. Inspect `git status` and `git diff` against `main` or the latest commit.
2. Check for:
   - Potential race conditions and memory leaks.
   - Proper error handling on all asynchronous operations.
   - Absence of hardcoded credentials, API keys, or plaintext passwords.
   - Compliance with repository design patterns and type strictness.
3. Formulate concise report with `[VERDICT]`, `[SCORE:X/10]`, and prioritized recommendations.
4. Finalize task via `0xagent veronica report --status completed --summary "<summary>"`.
