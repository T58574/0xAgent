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

export async function createNewSession(title?: string, workspace_dir?: string | null): Promise<ChatSession> {
  const now = Date.now();
  const session: ChatSession = {
    id: uuidv4(),
    title: title || 'New Session',
    workspace_dir: workspace_dir || null,
    messages: [],
    created_at: now,
    updated_at: now,
  };
  await saveSession(session);
  return session;
}

export async function deleteSession(id: string): Promise<void> {
  const dir = await ensureSessionsDir();
  const filePath = path.join(dir, `${id}.json`);
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // ignore if missing
  }
}
