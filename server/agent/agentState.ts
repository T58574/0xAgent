import { v4 as uuidv4 } from 'uuid';
import { saveSession, loadSession, setActiveStreamGetter } from '../session';
import { cancelPendingApprovalsForSession } from './approvalManager';

export interface PendingConfirmation {
  sessionId: string;
  toolCallId: string;
  resolve: (approved: boolean | string) => void;
}

export interface ActiveStreamState {
  sessionId: string;
  assistantMessageId: string;
  content: string;
  startTime: number;
  tokensPerSec?: number;
  tokenCount?: number;
  contextUsed?: number;
  contextMax?: number;
  modelName?: string;
}

export const activeConfirmations = new Map<string, PendingConfirmation>();
export const activeCancelTokens = new Set<string>();
export const activeRunningLoops = new Set<string>();
export const activeSessionStreams = new Map<string, ActiveStreamState>();

// Wire session hydrator with in-memory stream buffer
setActiveStreamGetter((id: string) => activeSessionStreams.get(id));

export function registerActiveSessionStream(sessionId: string, state: ActiveStreamState): void {
  activeSessionStreams.set(sessionId, state);
}

export function updateActiveSessionStream(
  sessionId: string,
  chunk: string,
  metrics?: { tokensPerSec?: number; tokenCount?: number; contextUsed?: number; contextMax?: number; modelName?: string }
): void {
  const current = activeSessionStreams.get(sessionId);
  if (current) {
    current.content += chunk;
    if (metrics?.tokensPerSec !== undefined) current.tokensPerSec = metrics.tokensPerSec;
    if (metrics?.tokenCount !== undefined) current.tokenCount = metrics.tokenCount;
    if (metrics?.contextUsed !== undefined) current.contextUsed = metrics.contextUsed;
    if (metrics?.contextMax !== undefined) current.contextMax = metrics.contextMax;
    if (metrics?.modelName) current.modelName = metrics.modelName;
  }
}

export function getActiveSessionStream(sessionId: string): ActiveStreamState | undefined {
  return activeSessionStreams.get(sessionId);
}

export function removeActiveSessionStream(sessionId: string): void {
  activeSessionStreams.delete(sessionId);
}

export async function handleAgentError(
  session: any,
  sessionId: string,
  broadcast: (event: string, payload: any) => void,
  errMsg: string
): Promise<void> {
  session.messages.push({
    id: uuidv4(),
    role: 'assistant',
    content: errMsg,
    timestamp: Date.now(),
  });
  session.updated_at = Date.now();
  await saveSession(session);
  broadcast('agent-error', { sessionId, message: errMsg });
  broadcast('agent-status-changed', { sessionId, status: 'idle' });
}

export function respondToToolConfirmation(sessionId: string, toolCallId: string, approve: boolean | string): boolean {
  const key = `${sessionId}:${toolCallId}`;
  let pending = activeConfirmations.get(key);

  if (!pending) {
    for (const [k, p] of activeConfirmations.entries()) {
      if (p.toolCallId === toolCallId || k.endsWith(`:${toolCallId}`)) {
        pending = p;
        activeConfirmations.delete(k);
        break;
      }
    }
  } else {
    activeConfirmations.delete(key);
  }

  if (pending) {
    pending.resolve(approve);
    return true;
  }
  return false;
}

export async function cancelAgentSession(sessionId: string): Promise<void> {
  activeCancelTokens.add(sessionId);

  // Cancel any active legacy confirmations and L2 approvals
  cancelPendingApprovalsForSession(sessionId, 'Session cancelled by user');

  for (const [key, pending] of activeConfirmations.entries()) {
    if (pending.sessionId === sessionId) {
      pending.resolve(false);
      activeConfirmations.delete(key);
    }
  }

  // Preserve accumulated stream in session history so context is not lost when stopped
  const activeStream = activeSessionStreams.get(sessionId);
  if (activeStream && activeStream.content.trim()) {
    try {
      const session = await loadSession(sessionId);
      let finalContent = activeStream.content.trim();
      if (finalContent.includes('<think>') && !finalContent.includes('</think>')) {
        finalContent += '\n</think>';
      }
      finalContent += '\n\n*[Генерация остановлена пользователем]*';

      const existingIdx = session.messages.findIndex((m: any) => m.id === activeStream.assistantMessageId);
      if (existingIdx !== -1) {
        session.messages[existingIdx].content = finalContent;
      } else {
        session.messages.push({
          id: activeStream.assistantMessageId,
          role: 'assistant',
          content: finalContent,
          timestamp: activeStream.startTime || Date.now(),
          metrics: {
            tokensPerSec: activeStream.tokensPerSec || 0,
            tokenCount: activeStream.tokenCount || 0,
            contextUsed: activeStream.contextUsed || 0,
            contextMax: activeStream.contextMax || 16384,
            modelName: activeStream.modelName || 'agent',
          },
        });
      }
      session.updated_at = Date.now();
      await saveSession(session);
    } catch (err) {
      console.warn('[agentState] Failed to persist partial stream on cancellation:', err);
    }
    activeSessionStreams.delete(sessionId);
  }
}
