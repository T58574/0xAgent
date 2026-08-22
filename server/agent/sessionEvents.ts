import { v4 as uuidv4 } from 'uuid';
import { ChatSession, ChatMessage, SessionEvent } from '../../src/types';
import { loadSession, saveSession } from '../session';

/**
 * Event Sourcing and Session Forking module.
 */

/**
 * Forks an existing session from a specific message checkpoint or end of history,
 * creating an isolated branched session with preserved context.
 */
export async function forkSession(
  sourceSessionId: string,
  fromMessageId?: string,
  newTitle?: string
): Promise<ChatSession> {
  const source = await loadSession(sourceSessionId);
  if (!source) {
    throw new Error(`Source session '${sourceSessionId}' not found.`);
  }

  let branchedMessages: ChatMessage[] = [];
  if (fromMessageId) {
    const idx = source.messages.findIndex((m) => m.id === fromMessageId);
    if (idx !== -1) {
      branchedMessages = source.messages.slice(0, idx + 1);
    } else {
      branchedMessages = [...source.messages];
    }
  } else {
    branchedMessages = [...source.messages];
  }

  const branchedId = uuidv4();
  const branchedSession: ChatSession = {
    id: branchedId,
    title: newTitle || `${source.title} (Ветка)`,
    workspace_dir: source.workspace_dir || null,
    active_todos: source.active_todos ? JSON.parse(JSON.stringify(source.active_todos)) : undefined,
    messages: JSON.parse(JSON.stringify(branchedMessages)),
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  await saveSession(branchedSession);
  return branchedSession;
}

/**
 * Reconstructs deterministic ChatMessages from an immutable stream of SessionEvents.
 */
export function deriveMessagesFromEvents(events: SessionEvent[]): ChatMessage[] {
  const messages: ChatMessage[] = [];

  for (const ev of events) {
    switch (ev.type) {
      case 'user/message':
        messages.push({
          id: ev.id,
          role: 'user',
          content: ev.payload?.content || '',
          timestamp: ev.timestamp,
          images: ev.payload?.images,
        });
        break;

      case 'assistant/message':
        messages.push({
          id: ev.id,
          role: 'assistant',
          content: ev.payload?.content || '',
          timestamp: ev.timestamp,
          tool_calls: ev.payload?.tool_calls,
          metrics: ev.payload?.metrics,
        });
        break;

      case 'tool/result':
        messages.push({
          id: ev.id,
          role: 'tool',
          content: ev.payload?.output || '',
          timestamp: ev.timestamp,
        });
        break;

      default:
        break;
    }
  }

  return messages;
}
