# Skill: Incident Response & Crash Diagnostics

## Purpose
Investigate unhandled exceptions, process crash logs, watchdog timeouts, or server panics and formulate verified remediation.

## Operational Instructions
1. Inspect latest entries in `~/.0xagent/veronica/logs/` and server logs.
2. Extract the exact stacktrace, active task ID, and environment state at the time of failure.
3. Perform root-cause analysis:
   - Identify line number, broken assumption, race condition, or unhandled rejection.
   - Inspect related files and reproduce the failure via unit test if possible.
4. Prepare minimal, verified patch with regression tests.
5. Record incident diagnostics in Veronica journal via `0xagent veronica report`.
