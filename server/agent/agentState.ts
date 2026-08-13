import { v4 as uuidv4 } from 'uuid';
import { saveSession } from '../session';

export interface PendingConfirmation {
  sessionId: string;
  toolCallId: string;
  resolve: (approved: boolean | string) => void;
}

export const activeConfirmations = new Map<string, PendingConfirmation>();
export const activeCancelTokens = new Set<string>();
export const activeRunningLoops = new Set<string>();

export function handleAgentError(
  session: any,
  sessionId: string,
  broadcast: (event: string, payload: any) => void,
  errMsg: string
): void {
  session.messages.push({
    id: uuidv4(),
    role: 'assistant',
    content: errMsg,
    timestamp: Date.now(),
  });
  session.updated_at = Date.now();
  saveSession(session);
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

export function cancelAgentSession(sessionId: string): void {
  activeCancelTokens.add(sessionId);

  for (const [key, pending] of activeConfirmations.entries()) {
    if (pending.sessionId === sessionId) {
      pending.resolve(false);
      activeConfirmations.delete(key);
    }
  }
}
