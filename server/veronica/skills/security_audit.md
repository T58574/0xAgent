# Skill: Security & OPSEC Audit

## Purpose
Inspect the repository for security vulnerabilities, open ports, unescaped queries, injection risks, and dependency flaws.

## Operational Instructions
1. Run automated vulnerability checks against package dependencies.
2. Search for:
   - Command injection vulnerabilities in `exec`/`spawn` calls.
   - SQL injection risks (ensure prepared statements and single-quote literal invariants).
   - Sensitive environment variables exposed in client-facing bundles.
   - Missing authentication guards on public API routes.
3. If critical security vulnerabilities are discovered:
   - Request review / approval if fix requires L3+ autonomy.
   - Record finding in audit log via `0xagent veronica error` or `0xagent veronica report`.
