import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { ChatSession } from '../src/types';
import { getAppDir } from './config';

async function ensureSessionsDir(): Promise<string> {
  const dir = path.join(getAppDir(), 'sessions');
  try {
    await fs.promises.mkdir(dir, { recursive: true });
  } catch {}
  return dir;
}

export async function listSessions(): Promise<ChatSession[]> {
  const dir = await ensureSessionsDir();
  try {
    const files = await fs.promises.readdir(dir);
    const sessions: ChatSession[] = [];

    await Promise.all(
      files.map(async (file) => {
        if (file.endsWith('.json')) {
          try {
            const fullPath = path.join(dir, file);
            const data = await fs.promises.readFile(fullPath, 'utf-8');
            const session: ChatSession = JSON.parse(data);
            sessions.push(session);
          } catch (err) {
            console.error(`Failed to read session file ${file}:`, err);
          }
        }
      })
    );

    sessions.sort((a, b) => b.updated_at - a.updated_at);
    return sessions;
  } catch (err) {
    console.error('Failed to list sessions:', err);
    return [];
  }
}

export async function loadSession(id: string): Promise<ChatSession> {
  const dir = await ensureSessionsDir();
  const filePath = path.join(dir, `${id}.json`);
  const data = await fs.promises.readFile(filePath, 'utf-8');
  return JSON.parse(data) as ChatSession;
}

export async function saveSession(session: ChatSession): Promise<void> {
  const dir = await ensureSessionsDir();
  const filePath = path.join(dir, `${session.id}.json`);
  await fs.promises.writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
}

const ADJECTIVES = ['swift', 'quantum', 'amber', 'hyper', 'neon', 'stellar', 'cyber', 'nova', 'apex', 'nexus', 'vital', 'spectral', 'zenith', 'pulse', 'echo', 'prism', 'vortex'];
const NOUNS = ['falcon', 'matrix', 'orbit', 'spark', 'flux', 'beacon', 'core', 'vector', 'haven', 'forge', 'pulse', 'strata', 'prism', 'relay', 'lattice'];

export function generateWorkspaceSlug(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const hex = Math.random().toString(36).substring(2, 6);
  return `${adj}-${noun}-${hex}`;
}

export async function createAutoWorkspaceDir(): Promise<{ slug: string; path: string }> {
  const slug = generateWorkspaceSlug();
  const workspacesRoot = path.join(getAppDir(), 'workspaces');
  const targetDir = path.join(workspacesRoot, slug);
  await fs.promises.mkdir(targetDir, { recursive: true });
  return { slug, path: targetDir };
}

export async function createNewSession(title?: string, workspace_dir?: string | null): Promise<ChatSession> {
  const now = Date.now();
  let resolvedWs = workspace_dir || null;
  let finalTitle = title;

  if (workspace_dir === 'auto') {
    const autoWs = await createAutoWorkspaceDir();
    resolvedWs = autoWs.path;
    if (!finalTitle || finalTitle === 'New Session' || finalTitle === 'Новый диалог' || finalTitle === 'Быстрый чат') {
      finalTitle = `Чат (${autoWs.slug})`;
    }
  }

  const session: ChatSession = {
    id: uuidv4(),
    title: finalTitle || 'New Session',
    workspace_dir: resolvedWs,
    messages: [],
    created_at: now,
    updated_at: now,
  };
  await saveSession(session);
  return session;
}

export async function updateSessionWorkspace(id: string, workspace_dir: string | null): Promise<ChatSession> {
  const session = await loadSession(id);
  session.workspace_dir = workspace_dir || null;
  session.updated_at = Date.now();
  await saveSession(session);
  return session;
}

export async function rollbackSession(
  id: string,
  targetMessageId: string,
  mode: 'to_user_edit' | 'to_assistant' = 'to_user_edit'
): Promise<{ session: ChatSession; restoredContent: string }> {
  const session = await loadSession(id);
  const targetIndex = session.messages.findIndex((m) => m.id === targetMessageId);
  if (targetIndex === -1) {
    throw new Error(`Message with ID ${targetMessageId} not found in session.`);
  }

  let restoredContent = '';
  if (mode === 'to_user_edit') {
    restoredContent = session.messages[targetIndex].content || '';
    // Truncate history before this user message so user can edit and resend
    session.messages = session.messages.slice(0, targetIndex);
  } else {
    // Truncate history after this assistant message
    session.messages = session.messages.slice(0, targetIndex + 1);
  }

  session.updated_at = Date.now();
  await saveSession(session);
  return { session, restoredContent };
}

export function isAutoWorkspaceDir(dirPath?: string | null): boolean {
  if (!dirPath) return false;
  const normalized = path.resolve(dirPath).toLowerCase();
  const workspacesRoot = path.resolve(path.join(getAppDir(), 'workspaces')).toLowerCase();
  return normalized.startsWith(workspacesRoot) && normalized !== workspacesRoot;
}

export async function cleanupOrphanWorkspaces(): Promise<{ removed: string[]; retained: string[] }> {
  const workspacesRoot = path.join(getAppDir(), 'workspaces');
  const removed: string[] = [];
  const retained: string[] = [];

  if (!fs.existsSync(workspacesRoot)) {
    return { removed, retained };
  }

  try {
    const sessions = await listSessions();
    const activeWorkspacePaths = new Set(
      sessions
        .map((s) => s.workspace_dir)
        .filter(Boolean)
        .map((p) => path.resolve(p!).toLowerCase())
    );

    const entries = await fs.promises.readdir(workspacesRoot);
    for (const entry of entries) {
      const fullPath = path.join(workspacesRoot, entry);
      const normalized = path.resolve(fullPath).toLowerCase();

      if (activeWorkspacePaths.has(normalized)) {
        retained.push(entry);
      } else {
        try {
          await fs.promises.rm(fullPath, { recursive: true, force: true });
          removed.push(entry);
        } catch (err) {
          console.error(`Failed to clean up orphan workspace ${entry}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('Failed to run cleanupOrphanWorkspaces:', err);
  }

  return { removed, retained };
}

export async function deleteSession(id: string): Promise<void> {
  const dir = await ensureSessionsDir();
  const filePath = path.join(dir, `${id}.json`);

  try {
    if (fs.existsSync(filePath)) {
      const data = await fs.promises.readFile(filePath, 'utf-8');
      const session: ChatSession = JSON.parse(data);

      // Clean up auto-generated ephemeral sandbox workspace if tied to this session
      if (session.workspace_dir && isAutoWorkspaceDir(session.workspace_dir)) {
        if (fs.existsSync(session.workspace_dir)) {
          await fs.promises.rm(session.workspace_dir, { recursive: true, force: true });
        }
      }
    }
  } catch (err) {
    console.error(`Error reading session ${id} before deletion:`, err);
  }

  // Clean up any spilled tool output log files for this session
  try {
    const spillDir = path.join(getAppDir(), 'spill');
    if (fs.existsSync(spillDir)) {
      const files = await fs.promises.readdir(spillDir);
      for (const f of files) {
        if (f.startsWith(id) || f.includes(id)) {
          await fs.promises.unlink(path.join(spillDir, f)).catch(() => {});
        }
      }
    }
  } catch {}

  // Delete session file
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // ignore if missing
  }

  // Background cleanup of any lingering orphan sandbox folders
  cleanupOrphanWorkspaces().catch(() => {});
}


