import { DatabaseSync } from 'node:sqlite';
import {
  CanonicalMemory,
  MemoryAuditEntry,
  MemoryCategory,
  MemoryStatus,
  MemoryScope,
  MemoryItem,
} from '../src/types';
import { getMemoryDb } from './memoryDb';

export const DEFAULT_SUBJECT_ID = 'user_default';

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

export interface AddMemoryOptions {
  scope?: MemoryScope;
  subjectId?: string;
  projectId?: string | null;
  personaId?: string | null;
  sessionId?: string | null;
  domain?: string;
  displayText?: string | null;
  isExplicit?: boolean | number;
  confidence?: number;
  importance?: number;
  sourceId?: string;
  actorScope?: string;
  expiresAt?: string | null;
}

export function logAuditEntry(db: DatabaseSync, entry: MemoryAuditEntry): void {
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

export function mapCanonicalToMemoryItem(row: any): MemoryItem {
  return {
    id: row.id,
    scope: row.scope || 'user',
    key: row.key,
    value: row.value,
    category: row.category,
    subject_id: row.subject_id,
    project_id: row.project_id || null,
    persona_id: row.persona_id || null,
    session_id: row.session_id || null,
    domain: row.domain,
    display_text: row.display_text || null,
    confidence: row.confidence,
    is_explicit: row.is_explicit,
    importance: row.importance,
    status: row.status,
    source_id: row.source_id || null,
    usage_count: row.usage_count || 0,
    last_used_at: row.last_used_at || null,
    expires_at: row.expires_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function addOrUpdateMemory(
  key: string,
  value: string,
  category?: string,
  options: AddMemoryOptions = {}
): MemoryItem | null {
  const db = getMemoryDb();
  const now = Date.now();
  const scope: MemoryScope = options.scope || (category === 'project_convention' || category === 'architecture' ? 'project' : 'user');
  const subjectId = scope === 'user' ? (options.subjectId || DEFAULT_SUBJECT_ID) : DEFAULT_SUBJECT_ID;
  const projectId = options.projectId || null;
  const personaId = options.personaId || null;
  const sessionId = options.sessionId || null;
  const displayText = options.displayText || null;
  const expiresAt = options.expiresAt || null;
  const cat = normalizeCategory(category);
  const domain = options.domain || 'general';
  const isExp = options.isExplicit ? 1 : 0;
  const conf = options.confidence !== undefined ? options.confidence : (isExp ? 1.0 : 0.85);
  const imp = options.importance !== undefined ? options.importance : 3;
  const sourceId = options.sourceId || null;
  const actorScope = options.actorScope || (isExp ? 'user_explicit' : 'extractor_worker');

  // Memory Write Policy
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
      db.prepare(`
        UPDATE canonical_memories 
        SET confidence = MAX(confidence, ?), last_confirmed_at = ?, updated_at = ?,
            scope = ?, project_id = COALESCE(?, project_id), persona_id = COALESCE(?, persona_id),
            session_id = COALESCE(?, session_id), display_text = COALESCE(?, display_text)
        WHERE id = ?
      `).run(conf, now, now, scope, projectId, personaId, sessionId, displayText, existing.id);

      return mapCanonicalToMemoryItem({
        ...existing,
        scope,
        project_id: projectId || existing.project_id,
        persona_id: personaId || existing.persona_id,
        session_id: sessionId || existing.session_id,
        display_text: displayText || existing.display_text,
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
      id, scope, subject_id, project_id, persona_id, session_id, category, domain, key, value, display_text, confidence, is_explicit, importance, status, source_id, expires_at, created_at, updated_at, last_confirmed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(newId, scope, subjectId, projectId, personaId, sessionId, cat, domain, key, value, displayText, conf, isExp, imp, status, sourceId, expiresAt, now, now, now);

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
    scope,
    key,
    value,
    category: cat,
    subject_id: subjectId,
    project_id: projectId,
    persona_id: personaId,
    session_id: sessionId,
    domain,
    display_text: displayText,
    confidence: conf,
    is_explicit: isExp,
    importance: imp,
    status,
    source_id: sourceId,
    createdAt: now,
    updatedAt: now,
  };
}

export function getUserMemories(subjectId: string = DEFAULT_SUBJECT_ID): MemoryItem[] {
  const db = getMemoryDb();
  const rows = db.prepare(`
    SELECT * FROM canonical_memories
    WHERE scope = 'user' AND subject_id = ? AND status = 'active'
    ORDER BY importance DESC, updated_at DESC
  `).all(subjectId) as any[];
  return rows.map(mapCanonicalToMemoryItem);
}

export function getProjectMemories(projectId: string): MemoryItem[] {
  const db = getMemoryDb();
  const rows = db.prepare(`
    SELECT * FROM canonical_memories
    WHERE scope = 'project' AND project_id = ? AND status = 'active'
    ORDER BY importance DESC, updated_at DESC
  `).all(projectId) as any[];
  return rows.map(mapCanonicalToMemoryItem);
}

export function getPersonaMemories(personaId: string): MemoryItem[] {
  const db = getMemoryDb();
  const rows = db.prepare(`
    SELECT * FROM canonical_memories
    WHERE scope = 'persona' AND persona_id = ? AND status = 'active'
    ORDER BY importance DESC, updated_at DESC
  `).all(personaId) as any[];
  return rows.map(mapCanonicalToMemoryItem);
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
