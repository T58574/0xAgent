import { getVeronicaDb } from '../db/veronicaDb';
import { writeQueue } from '../db/writeQueue';
import { AntigravityUsage } from '../../../src/types';

export interface DialogMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface UserSessionState {
  userId: number;
  activeProject?: string;
  awaitingPromptForProject?: string;
  lastTaskId?: string;
  lastTaskProject?: string;
  lastTaskSummary?: string;
  lastMessageTime: number;
  messages: DialogMessage[];
  antigravityConversationId?: string;
  lastUsage?: AntigravityUsage;
  lastDurationSeconds?: number;
}

export class SessionStateManager {
  private userSessions: Map<number, UserSessionState> = new Map();
  private maxHistoryPerSession: number = 15;

  public getUserSession(userId: number): UserSessionState {
    let session = this.userSessions.get(userId);
    if (!session) {
      const recentMessages = this.loadConversationHistory(userId, this.maxHistoryPerSession);
      const meta = this.loadUserSessionMeta(userId);
      session = {
        userId,
        activeProject: meta?.active_project,
        awaitingPromptForProject: meta?.awaiting_prompt_for_project,
        lastTaskId: meta?.last_task_id,
        lastTaskProject: meta?.last_task_project,
        lastTaskSummary: meta?.last_task_summary,
        antigravityConversationId: meta?.antigravity_conversation_id,
        lastMessageTime: meta?.updated_at || Date.now(),
        messages: recentMessages,
      };
      this.userSessions.set(userId, session);
    }
    return session;
  }

  public resetSession(userId: number): void {
    const session = this.getUserSession(userId);
    session.messages = [];
    session.antigravityConversationId = undefined;
    session.awaitingPromptForProject = undefined;
    session.lastTaskId = undefined;
    session.lastTaskProject = undefined;
    session.lastTaskSummary = undefined;
    session.lastMessageTime = Date.now();

    this.persistSessionMeta(session);

    writeQueue.enqueue(() => {
      try {
        const db = getVeronicaDb();
        db.prepare('DELETE FROM telegram_conversations WHERE user_id = ?').run(userId);
        db.prepare('DELETE FROM telegram_user_sessions WHERE user_id = ?').run(userId);
      } catch {}
    }).catch(() => {});
  }

  public setActiveProject(userId: number, project: string): void {
    const session = this.getUserSession(userId);
    session.activeProject = project;
    session.awaitingPromptForProject = undefined;
    this.persistSessionMeta(session);
  }

  public setAwaitingPrompt(userId: number, project: string): void {
    const session = this.getUserSession(userId);
    session.activeProject = project;
    session.awaitingPromptForProject = project;
    this.persistSessionMeta(session);
  }

  public clearAwaitingPrompt(userId: number): void {
    const session = this.getUserSession(userId);
    session.awaitingPromptForProject = undefined;
    this.persistSessionMeta(session);
  }

  public persistMessage(userId: number, role: 'user' | 'assistant' | 'system', content: string): void {
    const now = Date.now();
    const session = this.getUserSession(userId);
    session.messages.push({ role, content, timestamp: now });

    if (session.messages.length > this.maxHistoryPerSession) {
      session.messages.shift();
    }

    writeQueue.enqueue(() => {
      try {
        const db = getVeronicaDb();
        db.prepare(
          'INSERT INTO telegram_conversations (user_id, role, content, timestamp) VALUES (?, ?, ?, ?)'
        ).run(userId, role, content, now);
      } catch {}
    }).catch(() => {});
  }

  public persistSessionMeta(session: UserSessionState): void {
    const now = Date.now();
    session.lastMessageTime = now;
    writeQueue.enqueue(() => {
      try {
        const db = getVeronicaDb();
        db.prepare(`
          INSERT INTO telegram_user_sessions 
            (user_id, active_project, awaiting_prompt_for_project, last_task_id, last_task_project, last_task_summary, antigravity_conversation_id, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            active_project = excluded.active_project,
            awaiting_prompt_for_project = excluded.awaiting_prompt_for_project,
            last_task_id = excluded.last_task_id,
            last_task_project = excluded.last_task_project,
            last_task_summary = excluded.last_task_summary,
            antigravity_conversation_id = excluded.antigravity_conversation_id,
            updated_at = excluded.updated_at
        `).run(
          session.userId,
          session.activeProject || null,
          session.awaitingPromptForProject || null,
          session.lastTaskId || null,
          session.lastTaskProject || null,
          session.lastTaskSummary || null,
          session.antigravityConversationId || null,
          now
        );
      } catch (err) {
        console.warn('[SessionStateManager] Failed to persist session metadata:', err);
      }
    }).catch(() => {});
  }

  private loadUserSessionMeta(userId: number): {
    active_project?: string;
    awaiting_prompt_for_project?: string;
    last_task_id?: string;
    last_task_project?: string;
    last_task_summary?: string;
    antigravity_conversation_id?: string;
    updated_at?: number;
  } | null {
    try {
      const db = getVeronicaDb();
      const row = db.prepare(
        'SELECT active_project, awaiting_prompt_for_project, last_task_id, last_task_project, last_task_summary, antigravity_conversation_id, updated_at FROM telegram_user_sessions WHERE user_id = ?'
      ).get(userId) as any;
      if (!row) return null;
      return {
        active_project: row.active_project || undefined,
        awaiting_prompt_for_project: row.awaiting_prompt_for_project || undefined,
        last_task_id: row.last_task_id || undefined,
        last_task_project: row.last_task_project || undefined,
        last_task_summary: row.last_task_summary || undefined,
        antigravity_conversation_id: row.antigravity_conversation_id || undefined,
        updated_at: row.updated_at ? Number(row.updated_at) : undefined,
      };
    } catch {
      return null;
    }
  }

  private loadConversationHistory(userId: number, limit: number = 15): DialogMessage[] {
    try {
      const db = getVeronicaDb();
      const rows = db.prepare(
        'SELECT role, content, timestamp FROM telegram_conversations WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?'
      ).all(userId, limit) as any[];

      return rows.reverse().map((r) => ({
        role: r.role as 'user' | 'assistant' | 'system',
        content: r.content,
        timestamp: Number(r.timestamp),
      }));
    } catch {
      return [];
    }
  }
}

export const sessionStateManager = new SessionStateManager();
