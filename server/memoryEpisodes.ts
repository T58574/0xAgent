import {
  Episode,
  PersonaRelationship,
} from '../src/types';
import { getMemoryDb } from './memoryDb';

export const DEFAULT_SUBJECT_ID = 'user_default';

// ============================================================================
// 1. EPISODES CRUD & FTS5 SEARCH
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
// 2. PERSONA RELATIONSHIPS
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
