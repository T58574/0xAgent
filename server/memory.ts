import { DatabaseSync } from 'node:sqlite';
import {
  CanonicalMemory,
  Episode,
  PersonaRelationship,
  MemoryAuditEntry,
  MemoryCategory,
  MemoryStatus,
  MemoryItem,
} from '../src/types';
import { getMemoryDb } from './memoryDb';

export { getMemoryDb };

export type {
  CanonicalMemory,
  Episode,
  PersonaRelationship,
  MemoryAuditEntry,
  MemoryCategory,
  MemoryStatus,
  MemoryItem,
};

const DEFAULT_SUBJECT_ID = 'user_default';

export function normalizeCategory(c?: string): MemoryCategory {
  const valid: MemoryCategory[] = [
    'profile',
    'preference',
    'interest',
    'fact',
    'user_preference',
    'project_convention',
    'architecture',
    'general',
  ];
  if (c && valid.includes(c as MemoryCategory)) {
    return c as MemoryCategory;
  }
  return 'fact';
}

// ============================================================================
// 1. CANONICAL MEMORIES CRUD & WRITE POLICY
// ============================================================================

export interface AddMemoryOptions {
  subjectId?: string;
  domain?: string;
  isExplicit?: boolean | number;
  confidence?: number;
  importance?: number;
  sourceId?: string;
  actorScope?: string;
}

export function addOrUpdateMemory(
  key: string,
  value: string,
  category?: string,
  options: AddMemoryOptions = {}
): MemoryItem | null {
  const db = getMemoryDb();
  const now = Date.now();
  const subjectId = options.subjectId || DEFAULT_SUBJECT_ID;
  const cat = normalizeCategory(category);
  const domain = options.domain || 'general';
  const isExp = options.isExplicit ? 1 : 0;
  const conf = options.confidence !== undefined ? options.confidence : (isExp ? 1.0 : 0.85);
  const imp = options.importance !== undefined ? options.importance : 3;
  const sourceId = options.sourceId || null;
  const actorScope = options.actorScope || 'user_explicit';

  // Memory Write Policy
  // Explicit commands bypass confidence gate.
  // Weak inferences (< 0.70) are discarded (IGNORE).
  // Medium inferences (0.70 <= conf < 0.90) are saved as 'candidate'.
  // Strong inferences (>= 0.90) or explicit are saved as 'active'.
  let status: MemoryStatus = 'active';
  if (!isExp) {
    if (conf < 0.7) {
      return null; // IGNORE
    } else if (conf < 0.9) {
      status = 'candidate';
    }
  }

  // Check if an active record exists with the exact natural key identity
  const existing = db.prepare(`
    SELECT * FROM canonical_memories 
    WHERE subject_id = ? AND category = ? AND domain = ? AND key = ? AND status = 'active'
  `).get(subjectId, cat, domain, key) as any;

  if (existing) {
    if (existing.value === value) {
      // Re-confirmation: update timestamp and confidence
      db.prepare(`
        UPDATE canonical_memories 
        SET confidence = MAX(confidence, ?), last_confirmed_at = ?, updated_at = ?
        WHERE id = ?
      `).run(conf, now, now, existing.id);

      return mapCanonicalToMemoryItem({
        ...existing,
        confidence: Math.max(existing.confidence, conf),
        last_confirmed_at: now,
        updated_at: now,
      });
    }

    // Value changed: mark old active record as superseded
    db.prepare(`
      UPDATE canonical_memories 
      SET status = 'superseded', updated_at = ? 
      WHERE id = ?
    `).run(now, existing.id);

    logAuditEntry(db, {
      memory_id: existing.id,
      operation: 'UPDATE',
      old_status: 'active',
      new_status: 'superseded',
      old_value: existing.value,
      new_value: value,
      reason: `Superseded by new value for ${key}`,
      applied_by: isExp ? 'user_explicit' : 'extractor_worker',
      actor_scope: actorScope,
      timestamp: now,
    });
  }

  const newId = `mem_${now}_${Math.random().toString(36).substring(2, 6)}`;
  db.prepare(`
    INSERT INTO canonical_memories (
      id, subject_id, category, domain, key, value, confidence, is_explicit, importance, status, source_id, created_at, updated_at, last_confirmed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(newId, subjectId, cat, domain, key, value, conf, isExp, imp, status, sourceId, now, now, now);

  logAuditEntry(db, {
    memory_id: newId,
    operation: 'NEW',
    new_status: status,
    new_value: value,
    reason: `Created ${status} fact: ${key}`,
    applied_by: isExp ? 'user_explicit' : 'extractor_worker',
    actor_scope: actorScope,
    timestamp: now,
  });

  return {
    id: newId,
    key,
    value,
    category: cat,
    subject_id: subjectId,
    domain,
    confidence: conf,
    is_explicit: isExp,
    importance: imp,
    status,
    createdAt: now,
    updatedAt: now,
  };
}

export function loadMemories(subjectId: string = DEFAULT_SUBJECT_ID): MemoryItem[] {
  const db = getMemoryDb();
  const rows = db.prepare(`
    SELECT * FROM canonical_memories 
    WHERE subject_id = ? AND status = 'active'
    ORDER BY importance DESC, updated_at DESC
  `).all(subjectId) as any[];

  return rows.map(mapCanonicalToMemoryItem);
}

export function getCanonicalMemories(
  subjectId: string = DEFAULT_SUBJECT_ID,
  status: MemoryStatus = 'active'
): CanonicalMemory[] {
  const db = getMemoryDb();
  return db.prepare(`
    SELECT * FROM canonical_memories 
    WHERE subject_id = ? AND status = ?
    ORDER BY importance DESC, updated_at DESC
  `).all(subjectId, status) as unknown as CanonicalMemory[];
}

export function deleteMemory(keyOrId: string, subjectId: string = DEFAULT_SUBJECT_ID): boolean {
  const db = getMemoryDb();
  const now = Date.now();
  const row = db.prepare(`
    SELECT * FROM canonical_memories 
    WHERE subject_id = ? AND (id = ? OR LOWER(key) = LOWER(?)) AND status != 'invalidated'
  `).get(subjectId, keyOrId, keyOrId) as any;

  if (!row) {
    return false;
  }

  db.prepare(`
    UPDATE canonical_memories 
    SET status = 'invalidated', updated_at = ? 
    WHERE id = ?
  `).run(now, row.id);

  logAuditEntry(db, {
    memory_id: row.id,
    operation: 'INVALIDATE',
    old_status: row.status,
    new_status: 'invalidated',
    old_value: row.value,
    reason: `Invalidated by user command / delete request for ${keyOrId}`,
    applied_by: 'user_explicit',
    timestamp: now,
  });

  return true;
}

export function queryMemories(query: string, subjectId: string = DEFAULT_SUBJECT_ID): MemoryItem[] {
  const db = getMemoryDb();
  if (!query || query.trim() === '*' || query.trim() === '') {
    return loadMemories(subjectId);
  }

  const q = `%${query.trim().toLowerCase()}%`;
  const rows = db.prepare(`
    SELECT * FROM canonical_memories 
    WHERE subject_id = ? AND status = 'active' AND (
      LOWER(key) LIKE ? OR LOWER(value) LIKE ? OR LOWER(category) LIKE ? OR LOWER(domain) LIKE ?
    )
    ORDER BY importance DESC, updated_at DESC
  `).all(subjectId, q, q, q, q) as any[];

  return rows.map(mapCanonicalToMemoryItem);
}

// ============================================================================
// 2. EPISODES CRUD & FTS5 SEARCH
// ============================================================================

export function saveEpisode(params: {
  sessionId: string;
  title: string;
  summary: string;
  importance?: number;
  eventTimestamp?: number;
  subjectId?: string;
  sourceId?: string;
}): Episode {
  const db = getMemoryDb();
  const now = Date.now();
  const id = `ep_${now}_${Math.random().toString(36).substring(2, 6)}`;
  const subjectId = params.subjectId || DEFAULT_SUBJECT_ID;
  const imp = params.importance || 3;
  const evTime = params.eventTimestamp || now;

  db.prepare(`
    INSERT INTO episodes (
      id, subject_id, session_id, title, summary, importance, lifecycle, event_timestamp, source_id, created_at, last_accessed_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
  `).run(id, subjectId, params.sessionId, params.title, params.summary, imp, evTime, params.sourceId || null, now, now);

  return {
    id,
    subject_id: subjectId,
    session_id: params.sessionId,
    title: params.title,
    summary: params.summary,
    importance: imp,
    lifecycle: 'active',
    event_timestamp: evTime,
    source_id: params.sourceId,
    created_at: now,
    last_accessed_at: now,
  };
}

export function searchEpisodesFts(
  query: string,
  limit: number = 5,
  subjectId: string = DEFAULT_SUBJECT_ID
): Episode[] {
  const db = getMemoryDb();
  if (!query || !query.trim()) {
    return [];
  }

  // Sanitize query for FTS5 syntax
  const sanitized = query
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(' OR ');

  if (!sanitized) {
    return [];
  }

  try {
    const rows = db.prepare(`
      SELECT e.* FROM episodes e
      JOIN episodes_fts f ON e.rowid = f.rowid
      WHERE e.subject_id = ? AND e.lifecycle = 'active' AND episodes_fts MATCH ?
      ORDER BY bm25(episodes_fts) ASC, e.event_timestamp DESC
      LIMIT ?
    `).all(subjectId, sanitized, limit) as unknown as Episode[];

    const now = Date.now();
    for (const r of rows) {
      db.prepare('UPDATE episodes SET last_accessed_at = ? WHERE id = ?').run(now, r.id);
    }
    return rows;
  } catch (err) {
    console.warn('[memory] FTS query error fallback:', err);
    return [];
  }
}

// ============================================================================
// 3. PERSONA RELATIONSHIPS
// ============================================================================

export function getPersonaRelationship(
  personaId: string,
  subjectId: string = DEFAULT_SUBJECT_ID
): PersonaRelationship {
  const db = getMemoryDb();
  const row = db.prepare(`
    SELECT * FROM persona_relationships 
    WHERE subject_id = ? AND persona_id = ?
  `).get(subjectId, personaId) as any;

  if (row) {
    let refs: string[] = [];
    try {
      refs = row.shared_references ? JSON.parse(row.shared_references) : [];
    } catch {}
    return {
      ...row,
      shared_references: refs,
    };
  }

  // Default initial relationship
  return {
    subject_id: subjectId,
    persona_id: personaId,
    familiarity: 0.5,
    formality: 0.5,
    warmth: 0.6,
    humor_level: 0.5,
    preferred_address: undefined,
    relationship_summary: 'Начальная стадия взаимодействия. Общение конструктивное и прямое.',
    shared_references: [],
    interaction_count: 0,
    updated_at: Date.now(),
  };
}

export function upsertPersonaRelationship(
  data: Partial<PersonaRelationship> & { persona_id: string; subject_id?: string }
): PersonaRelationship {
  const db = getMemoryDb();
  const now = Date.now();
  const subjectId = data.subject_id || DEFAULT_SUBJECT_ID;
  const current = getPersonaRelationship(data.persona_id, subjectId);

  const updated: PersonaRelationship = {
    ...current,
    ...data,
    subject_id: subjectId,
    persona_id: data.persona_id,
    interaction_count: (current.interaction_count || 0) + (data.interaction_count !== undefined ? data.interaction_count : 1),
    updated_at: now,
  };

  const refsJson = JSON.stringify(updated.shared_references || []);

  db.prepare(`
    INSERT INTO persona_relationships (
      subject_id, persona_id, familiarity, formality, warmth, humor_level, preferred_address, relationship_summary, shared_references, interaction_count, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(subject_id, persona_id) DO UPDATE SET
      familiarity = excluded.familiarity,
      formality = excluded.formality,
      warmth = excluded.warmth,
      humor_level = excluded.humor_level,
      preferred_address = excluded.preferred_address,
      relationship_summary = excluded.relationship_summary,
      shared_references = excluded.shared_references,
      interaction_count = excluded.interaction_count,
      updated_at = excluded.updated_at
  `).run(
    subjectId,
    updated.persona_id,
    updated.familiarity,
    updated.formality,
    updated.warmth,
    updated.humor_level,
    updated.preferred_address || null,
    updated.relationship_summary || null,
    refsJson,
    updated.interaction_count,
    now
  );

  return updated;
}

// ============================================================================
// 4. CANDIDATES & CONFLICT RESOLUTION
// ============================================================================

export function getCandidateMemories(subjectId: string = DEFAULT_SUBJECT_ID): CanonicalMemory[] {
  return getCanonicalMemories(subjectId, 'candidate');
}

export function resolveConflict(
  memoryId: string,
  resolution: 'accept' | 'reject',
  reason?: string
): boolean {
  const db = getMemoryDb();
  const now = Date.now();
  const row = db.prepare('SELECT * FROM canonical_memories WHERE id = ?').get(memoryId) as any;
  if (!row) return false;

  const newStatus: MemoryStatus = resolution === 'accept' ? 'active' : 'invalidated';
  db.prepare('UPDATE canonical_memories SET status = ?, updated_at = ? WHERE id = ?').run(newStatus, now, memoryId);

  logAuditEntry(db, {
    memory_id: memoryId,
    operation: 'RESOLVE',
    old_status: row.status,
    new_status: newStatus,
    reason: reason || `Manual resolution: ${resolution}`,
    applied_by: 'admin',
    timestamp: now,
  });

  return true;
}

// ============================================================================
// 5. DETERMINISTIC MEMORY ROUTER & DYNAMIC TOKEN BUDGET (0..400 Tokens)
// ============================================================================

export interface MemoryRoutingResult {
  injectedFacts: CanonicalMemory[];
  injectedEpisodes: Episode[];
  relationship: PersonaRelationship;
  tokenCountEstimate: number;
}

export function routeAndRankMemories(options: {
  userQuery?: string;
  activePersonaId?: string;
  subjectId?: string;
  maxTokenBudget?: number;
}): MemoryRoutingResult {
  const subjectId = options.subjectId || DEFAULT_SUBJECT_ID;
  const personaId = options.activePersonaId || 'default';
  const query = (options.userQuery || '').trim().toLowerCase();
  const maxTokens = options.maxTokenBudget || 400;

  const relationship = getPersonaRelationship(personaId, subjectId);

  // Invariant 1: Casual dialogue / empty greetings -> 0 memories injected
  const isCasual =
    query.length === 0 ||
    /^(привет|хай|здравствуй|hello|hi|hey|ok|ок|спасибо|thanks|ясно|понял|давай|продолжи|следующий|круто)[\s!.,?]*$/i.test(
      query
    );

  if (isCasual) {
    return {
      injectedFacts: [],
      injectedEpisodes: [],
      relationship,
      tokenCountEstimate: estimateTokens(relationship.relationship_summary || ''),
    };
  }

  const db = getMemoryDb();
  const allActiveFacts = db.prepare(`
    SELECT * FROM canonical_memories 
    WHERE subject_id = ? AND status = 'active'
    ORDER BY importance DESC, updated_at DESC
  `).all(subjectId) as unknown as CanonicalMemory[];

  // Scoring facts
  const scoredFacts = allActiveFacts.map((f) => {
    let score = f.importance * 1.5 + f.confidence * 2.0;
    const keyLower = f.key.toLowerCase();
    const valLower = f.value.toLowerCase();

    // Query lexical match
    const keyWords = keyLower.split(/[_\s-]+/);
    if (query.includes(keyLower) || keyLower.includes(query) || keyWords.some((w) => w.length >= 2 && query.includes(w))) {
      score += 5.0;
    }
    if (query.includes(valLower)) {
      score += 3.0;
    }
    // High priority domains / concepts
    if (
      (query.includes('gpu') || query.includes('видеокарт') || query.includes('железо') || query.includes('card')) &&
      (f.domain === 'hardware' || f.key.includes('gpu') || f.value.toLowerCase().includes('radeon') || f.value.toLowerCase().includes('nvidia'))
    ) {
      score += 6.0;
    }
    if (
      (query.includes('язык') || query.includes('language') || query.includes('русск') || query.includes('english')) &&
      (f.key.includes('language') || f.value.toLowerCase().includes('russian') || f.value.toLowerCase().includes('english'))
    ) {
      score += 6.0;
    }

    return { fact: f, score };
  });

  scoredFacts.sort((a, b) => b.score - a.score);

  // Episodic search if query triggers past recall
  let matchedEpisodes: Episode[] = [];
  const isEpisodicQuery =
    /помнишь|вчера|прошлый раз|когда мы|рассказывал|обсуждали|поездк|remember|last time|discussed/i.test(query);

  if (isEpisodicQuery) {
    matchedEpisodes = searchEpisodesFts(query, 3, subjectId);
  }

  // Dynamic Token Budgeting
  let currentTokens = 0;
  const finalFacts: CanonicalMemory[] = [];
  const finalEpisodes: Episode[] = [];

  for (const item of scoredFacts) {
    const line = `- [${item.fact.category.toUpperCase()}] ${item.fact.key}: ${item.fact.value}`;
    const tokens = estimateTokens(line);
    if (currentTokens + tokens <= maxTokens * 0.75) {
      finalFacts.push(item.fact);
      currentTokens += tokens;
    }
    if (finalFacts.length >= 8) break;
  }

  for (const ep of matchedEpisodes) {
    const line = `- [EPISODE ${ep.title}]: ${ep.summary}`;
    const tokens = estimateTokens(line);
    if (currentTokens + tokens <= maxTokens) {
      finalEpisodes.push(ep);
      currentTokens += tokens;
    }
  }

  return {
    injectedFacts: finalFacts,
    injectedEpisodes: finalEpisodes,
    relationship,
    tokenCountEstimate: currentTokens,
  };
}

export function getSystemPromptMemoryContext(activePersonaId: string = 'default', userQuery?: string): string {
  const result = routeAndRankMemories({ activePersonaId, userQuery });
  const lines: string[] = [];

  // Persona Relationship Context (if defined and non-trivial)
  if (result.relationship.relationship_summary && result.relationship.interaction_count > 0) {
    lines.push(`## Relationship Dynamics with User:`);
    lines.push(`- Dynamics: ${result.relationship.relationship_summary}`);
    if (result.relationship.preferred_address) {
      lines.push(`- Preferred Address: ${result.relationship.preferred_address}`);
    }
    if (result.relationship.shared_references && result.relationship.shared_references.length > 0) {
      lines.push(`- Shared References: ${result.relationship.shared_references.join(', ')}`);
    }
  }

  // Canonical User Memories
  if (result.injectedFacts.length > 0) {
    lines.push(`## Known Facts & Preferences:`);
    for (const f of result.injectedFacts) {
      lines.push(`- [${f.category.toUpperCase()}] ${f.key}: ${f.value}`);
    }
  }

  // Relevant Episodes
  if (result.injectedEpisodes.length > 0) {
    lines.push(`## Relevant Past Episodes:`);
    for (const ep of result.injectedEpisodes) {
      lines.push(`- [${ep.title}]: ${ep.summary}`);
    }
  }

  if (lines.length === 0) {
    return '';
  }

  return `\n\n# Dynamic Persona & User Memory View\n${lines.join('\n')}`;
}

// Helpers
function mapCanonicalToMemoryItem(row: any): MemoryItem {
  return {
    id: row.id,
    key: row.key,
    value: row.value,
    category: row.category,
    subject_id: row.subject_id,
    domain: row.domain,
    confidence: row.confidence,
    is_explicit: row.is_explicit,
    importance: row.importance,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function logAuditEntry(db: DatabaseSync, entry: MemoryAuditEntry): void {
  try {
    db.prepare(`
      INSERT INTO memory_audit_log (
        memory_id, operation, old_status, new_status, old_value, new_value, reason, applied_by, actor_scope, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.memory_id,
      entry.operation,
      entry.old_status || null,
      entry.new_status || null,
      entry.old_value || null,
      entry.new_value || null,
      entry.reason || null,
      entry.applied_by,
      entry.actor_scope || null,
      entry.timestamp
    );
  } catch (err) {
    console.warn('[memory] Audit log error:', err);
  }
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}
