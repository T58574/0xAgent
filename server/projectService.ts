import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getMemoryDb } from './memoryDb';
import { ProjectRecord } from '../src/types';

/**
 * Normalize filesystem path for consistent hashing and comparisons.
 */
export function normalizeWorkspacePath(dirPath: string): string {
  try {
    const resolved = path.resolve(dirPath);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  } catch {
    return dirPath.trim();
  }
}

/**
 * Extract git remote URL if directory is inside a git repository.
 */
export function extractGitRemote(workspaceDir: string): string | null {
  try {
    let curr = path.resolve(workspaceDir);
    while (curr && curr !== path.dirname(curr)) {
      const gitConfigPath = path.join(curr, '.git', 'config');
      if (fs.existsSync(gitConfigPath)) {
        const content = fs.readFileSync(gitConfigPath, 'utf-8');
        const match = content.match(/\[remote\s+"origin"\][\s\S]*?url\s*=\s*([^\r\n]+)/i);
        if (match && match[1]) {
          return match[1].trim();
        }
        // Check any remote
        const anyRemoteMatch = content.match(/url\s*=\s*([^\r\n]+)/i);
        if (anyRemoteMatch && anyRemoteMatch[1]) {
          return anyRemoteMatch[1].trim();
        }
        break;
      }
      curr = path.dirname(curr);
    }
  } catch {}
  return null;
}

/**
 * Generate a deterministic fingerprint for a project workspace.
 */
export function computeProjectFingerprint(workspaceDir: string, gitRemote?: string | null): string {
  const norm = normalizeWorkspacePath(workspaceDir);
  const baseName = path.basename(norm);
  if (gitRemote && gitRemote.trim()) {
    return crypto.createHash('sha256').update(`git:${gitRemote.trim()}:${baseName}`).digest('hex').substring(0, 16);
  }
  return crypto.createHash('sha256').update(`dir:${norm}`).digest('hex').substring(0, 16);
}

/**
 * Resolve or register a ProjectRecord for a given workspace directory.
 */
export function resolveProjectForWorkspace(workspaceDir?: string | null): ProjectRecord {
  const db = getMemoryDb();
  const rawPath = workspaceDir || process.cwd();
  const normalized = normalizeWorkspacePath(rawPath);
  const baseName = path.basename(normalized) || 'default-project';
  const gitRemote = extractGitRemote(rawPath);
  const fingerprint = computeProjectFingerprint(rawPath, gitRemote);

  // 1. Check path alias first
  const aliasRow = db.prepare(`
    SELECT p.* FROM projects p
    JOIN project_path_aliases a ON p.id = a.project_id
    WHERE a.normalized_path = ?
    LIMIT 1
  `).get(normalized) as any;

  if (aliasRow) {
    db.prepare(`UPDATE projects SET last_seen_at = datetime('now') WHERE id = ?`).run(aliasRow.id);
    db.prepare(`UPDATE project_path_aliases SET last_seen_at = datetime('now') WHERE project_id = ? AND normalized_path = ?`).run(aliasRow.id, normalized);
    return {
      id: aliasRow.id,
      name: aliasRow.name,
      repo_root: aliasRow.repo_root,
      workspace_dir: aliasRow.workspace_dir,
      git_remote: aliasRow.git_remote,
      fingerprint: aliasRow.fingerprint,
      status: aliasRow.status,
      created_at: aliasRow.created_at,
      updated_at: aliasRow.updated_at,
      last_seen_at: aliasRow.last_seen_at,
    };
  }

  // 2. Check fingerprint
  const existing = db.prepare(`
    SELECT * FROM projects WHERE fingerprint = ? LIMIT 1
  `).get(fingerprint) as any;

  if (existing) {
    // Record new alias if workspace moved
    try {
      db.prepare(`
        INSERT OR IGNORE INTO project_path_aliases (project_id, path, normalized_path, last_seen_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(existing.id, rawPath, normalized);
    } catch {}

    db.prepare(`
      UPDATE projects 
      SET last_seen_at = datetime('now'), workspace_dir = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(rawPath, existing.id);

    return {
      id: existing.id,
      name: existing.name,
      repo_root: existing.repo_root,
      workspace_dir: rawPath,
      git_remote: existing.git_remote,
      fingerprint: existing.fingerprint,
      status: existing.status,
      created_at: existing.created_at,
      updated_at: existing.updated_at,
      last_seen_at: existing.last_seen_at,
    };
  }

  // 3. Create new project record
  const projectId = `proj_${fingerprint.substring(0, 10)}`;
  const now = new Date().toISOString();

  try {
    db.prepare(`
      INSERT INTO projects (id, name, repo_root, workspace_dir, git_remote, fingerprint, status, created_at, updated_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
    `).run(projectId, baseName, rawPath, rawPath, gitRemote, fingerprint, now, now, now);

    db.prepare(`
      INSERT OR REPLACE INTO project_path_aliases (project_id, path, normalized_path, last_seen_at)
      VALUES (?, ?, ?, ?)
    `).run(projectId, rawPath, normalized, now);
  } catch (err) {
    // In case of conflict, retrieve existing
    const fallback = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(projectId) as any;
    if (fallback) return fallback;
  }

  return {
    id: projectId,
    name: baseName,
    repo_root: rawPath,
    workspace_dir: rawPath,
    git_remote: gitRemote,
    fingerprint,
    status: 'active',
    created_at: now,
    updated_at: now,
    last_seen_at: now,
  };
}
