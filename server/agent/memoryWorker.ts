import { addOrUpdateMemory, upsertPersonaRelationship } from '../memory';
import { getMemoryDb } from '../memoryDb';

export interface MemoryConversationEvent {
  sessionId: string;
  userMessage: string;
  assistantMessage: string;
  personaId: string;
  timestamp: number;
}

class MemoryEventQueue {
  private queue: MemoryConversationEvent[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly IDLE_DEBOUNCE_MS = 20000; // 20s of silence
  private readonly MAX_BATCH_SIZE = 5;

  public pushEvent(event: MemoryConversationEvent): void {
    this.queue.push(event);

    // If max batch reached, process immediately
    if (this.queue.length >= this.MAX_BATCH_SIZE) {
      this.flushQueue();
      return;
    }

    // Reset debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.flushQueue();
    }, this.IDLE_DEBOUNCE_MS);
  }

  public flushSession(sessionId: string): void {
    const sessionEvents = this.queue.filter((e) => e.sessionId === sessionId);
    if (sessionEvents.length > 0) {
      this.queue = this.queue.filter((e) => e.sessionId !== sessionId);
      this.processBatch(sessionEvents);
    }
  }

  public flushQueue(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.queue.length === 0) return;

    const eventsToProcess = [...this.queue];
    this.queue = [];
    this.processBatch(eventsToProcess);
  }

  private processBatch(events: MemoryConversationEvent[]): void {
    try {
      for (const ev of events) {
        this.extractAndIngest(ev);
      }
    } catch (err) {
      console.warn('[memoryWorker] Batch extraction error:', err);
    }
  }

  private extractAndIngest(event: MemoryConversationEvent): void {
    const userText = event.userMessage.trim();
    if (!userText) return;

    const db = getMemoryDb();
    const sourceId = `src_${event.sessionId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Record source provenance
    try {
      db.prepare(`
        INSERT OR IGNORE INTO memory_sources (id, session_id, message_id, source_type, raw_quote, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(sourceId, event.sessionId, null, 'conversation_extraction', userText, Date.now());
    } catch {}

    // 1. Explicit / Direct Preferences & Profile Pattern Matching
    const explicitNameMatch = userText.match(/(?:меня зовут|мое имя|моё имя|зови меня)\s+([А-Яа-яA-Za-z0-9_-]+)/i);
    if (explicitNameMatch) {
      addOrUpdateMemory('preferred_name', explicitNameMatch[1], 'profile', {
        domain: 'identity',
        isExplicit: true,
        confidence: 1.0,
        sourceId,
        actorScope: event.personaId,
      });
    }

    const explicitLocationMatch = userText.match(/(?:я живу в|переехал в|нахожусь в|мой город)\s+([А-Яа-яA-Za-z0-9_-]+)/i);
    if (explicitLocationMatch) {
      addOrUpdateMemory('location', explicitLocationMatch[1], 'profile', {
        domain: 'identity',
        isExplicit: true,
        confidence: 0.95,
        sourceId,
        actorScope: event.personaId,
      });
    }

    const explicitDislikeMatch = userText.match(/(?:не люблю|терпеть не могу|ненавижу|больше не использую)\s+([^.,!?\n]+)/i);
    if (explicitDislikeMatch) {
      addOrUpdateMemory(`dislike_${explicitDislikeMatch[1].trim().slice(0, 20)}`, explicitDislikeMatch[1].trim(), 'preference', {
        domain: 'lifestyle',
        isExplicit: false,
        confidence: 0.88,
        sourceId,
        actorScope: event.personaId,
      });
    }

    const explicitLikeMatch = userText.match(/(?:обожаю|очень люблю|мне нравится|мой любимый)\s+([^.,!?\n]+)/i);
    if (explicitLikeMatch) {
      addOrUpdateMemory(`favorite_${explicitLikeMatch[1].trim().slice(0, 20)}`, explicitLikeMatch[1].trim(), 'preference', {
        domain: 'lifestyle',
        isExplicit: false,
        confidence: 0.85,
        sourceId,
        actorScope: event.personaId,
      });
    }

    // 2. Persona Relationship Increment
    upsertPersonaRelationship({
      persona_id: event.personaId,
      interaction_count: 1,
      warmth: 0.6,
      familiarity: 0.55,
    });
  }
}

export const memoryWorker = new MemoryEventQueue();
