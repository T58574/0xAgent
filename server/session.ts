import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { ChatSession } from '../src/types';
import { getAppDir } from './config';

function getSessionsDir(): string {
  const dir = path.join(getAppDir(), 'sessions');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function listSessions(): ChatSession[] {
  const dir = getSessionsDir();
  const files = fs.readdirSync(dir);
  const sessions: ChatSession[] = [];

  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const fullPath = path.join(dir, file);
        const data = fs.readFileSync(fullPath, 'utf-8');
        const session: ChatSession = JSON.parse(data);
        sessions.push(session);
      } catch (err) {
        console.error(`Failed to read session file ${file}:`, err);
      }
    }
  }

  sessions.sort((a, b) => b.updated_at - a.updated_at);
  return sessions;
}

export function loadSession(id: string): ChatSession {
  const dir = getSessionsDir();
  const filePath = path.join(dir, `${id}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Session with ID ${id} not found.`);
  }
  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data) as ChatSession;
}

export function saveSession(session: ChatSession): void {
  const dir = getSessionsDir();
  const filePath = path.join(dir, `${session.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
}

export function createNewSession(title: string): ChatSession {
  const now = Date.now();
  const session: ChatSession = {
    id: uuidv4(),
    title: title || 'New Session',
    messages: [],
    created_at: now,
    updated_at: now,
  };
  saveSession(session);
  return session;
}

export function deleteSession(id: string): void {
  const dir = getSessionsDir();
  const filePath = path.join(dir, `${id}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
