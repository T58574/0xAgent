import { v4 as uuidv4 } from 'uuid';
import { getMemoryDb } from '../memoryDb';
import { MemoryDecayStats } from '../../src/types';

export const HALF_LIFE_DAYS = 90; // 90 days = 50% confidence decay
export const ARCHIVE_THRESHOLD = 0.1; // confidence < 0.1 -> archived

/**
 * Runs a complete memory decay & conflict hygiene cycle.
 */
export async function runMemoryDecayCycle(): Promise<MemoryDecayStats> {
  const startTime = Date.now();
  const db = getMemoryDb();
  const now = Date.now();
  const nowDateIso = new Date().toISOString();

  let decayedCount = 0;
  let archivedCount = 0;
  let conflictsResolved = 0;

  // Wrap entire decay & hygiene cycle in an immediate transaction
  db.exec('BEGIN IMMEDIATE;');

  try {
    // ==========================================================================
    // 1. HALF-LIFE CONFIDENCE DECAY & ARCHIVAL (Batch SQL)
    // ==========================================================================
    // Identify memories eligible for decay (> 1 day old)
    const decayCandidates = db.prepare(`
      SELECT id, confidence, last_used_at, created_at
      FROM canonical_memories
      WHERE status = 'active'
        AND scope IN ('user', 'project', 'persona')
        AND (expires_at IS NULL OR expires_at > ?)
        AND (julianday('now') - julianday(COALESCE(NULLIF(last_used_at, ''), datetime(created_at / 1000, 'unixepoch')))) > 1.0
    `).all(nowDateIso) as any[];

    if (decayCandidates.length > 0) {
      // Fast in-database bulk decay calculation
      db.prepare(`
        UPDATE canonical_memories
        SET confidence = MAX(0.01, ROUND(confidence * POWER(0.5, (julianday('now') - julianday(COALESCE(NULLIF(last_used_at, ''), datetime(created_at / 1000, 'unixepoch')))) / 90.0), 3)),
            updated_at = ?
        WHERE status = 'active'
          AND scope IN ('user', 'project', 'persona')
          AND (expires_at IS NULL OR expires_at > ?)
          AND (julianday('now') - julianday(COALESCE(NULLIF(last_used_at, ''), datetime(created_at / 1000, 'unixepoch')))) > 1.0
      `).run(now, nowDateIso);

      decayedCount = decayCandidates.length;

      // Identify newly degraded memories falling below archival threshold (< 0.1)
      const archiveCandidates = db.prepare(`
        SELECT id, confidence
        FROM canonical_memories
        WHERE status = 'active' AND confidence < ?
      `).all(ARCHIVE_THRESHOLD) as any[];

      if (archiveCandidates.length > 0) {
        db.prepare(`
          UPDATE canonical_memories
          SET status = 'archived', updated_at = ?
          WHERE status = 'active' AND confidence < ?
        `).run(now, ARCHIVE_THRESHOLD);

        archivedCount = archiveCandidates.length;

        // Batch insert audit log for auto-archived memories
        const insertAuditStmt = db.prepare(`
          INSERT INTO memory_audit_log (
            memory_id, operation, old_status, new_status, reason, applied_by, actor_scope, timestamp
          ) VALUES (?, 'UPDATE', 'active', 'archived', 'decay_below_threshold', 'system', 'decay_worker', ?)
        `);

        for (const arch of archiveCandidates) {
          try {
            insertAuditStmt.run(arch.id, now);
          } catch {}
        }
      }
    }

    // ==========================================================================
    // 2. CONFLICT RESOLUTION & DEDUPLICATION (Batch SQL)
    // ==========================================================================
    const duplicateGroups = db.prepare(`
      SELECT scope, subject_id, IFNULL(persona_id, '') AS p_id, IFNULL(project_id, '') AS proj_id, domain, key, COUNT(*) as cnt
      FROM canonical_memories
      WHERE status = 'active'
      GROUP BY scope, subject_id, IFNULL(persona_id, ''), IFNULL(project_id, ''), domain, key
      HAVING cnt > 1
    `).all() as any[];

    if (duplicateGroups.length > 0) {
      const selectRecordsStmt = db.prepare(`
        SELECT id, confidence, updated_at, created_at
        FROM canonical_memories
        WHERE status = 'active'
          AND scope = ?
          AND subject_id = ?
          AND IFNULL(persona_id, '') = ?
          AND IFNULL(project_id, '') = ?
          AND domain = ?
          AND key = ?
        ORDER BY confidence DESC, updated_at DESC, created_at DESC
      `);

      const supersedeStmt = db.prepare(`
        UPDATE canonical_memories
        SET status = 'superseded', updated_at = ?
        WHERE id = ?
      `);

      const auditConflictStmt = db.prepare(`
        INSERT INTO memory_audit_log (
          memory_id, operation, old_status, new_status, reason, applied_by, actor_scope, timestamp
        ) VALUES (?, 'RESOLVE', 'active', 'superseded', ?, 'system', 'decay_worker', ?)
      `);

      for (const group of duplicateGroups) {
        const records = selectRecordsStmt.all(
          group.scope,
          group.subject_id,
          group.p_id,
          group.proj_id,
          group.domain,
          group.key
        ) as any[];

        if (records.length > 1) {
          const winner = records[0];
          const losers = records.slice(1);

          for (const loser of losers) {
            supersedeStmt.run(now, loser.id);
            conflictsResolved++;

            try {
              auditConflictStmt.run(
                loser.id,
                `Superseded by memory ${winner.id} with higher confidence (${winner.confidence})`,
                now
              );
            } catch {}
          }
        }
      }
    }

    db.exec('COMMIT;');
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch {}
    throw error;
  }

  const durationMs = Date.now() - startTime;
  const logId = `dec_${uuidv4().substring(0, 8)}`;

  // Save Cycle Log
  try {
    db.prepare(`
      INSERT INTO memory_decay_logs (
        id, decayed_count, archived_count, conflicts_resolved, duration_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(logId, decayedCount, archivedCount, conflictsResolved, durationMs, nowDateIso);

    // Save Telemetry Record
    db.prepare(`
      INSERT INTO evolution_telemetry (
        id, event_type, memories_decayed, memories_archived, conflicts_resolved, created_at
      ) VALUES (?, 'memory_decay_cycle', ?, ?, ?, ?)
    `).run(`tel_${uuidv4().substring(0, 8)}`, decayedCount, archivedCount, conflictsResolved, nowDateIso);
  } catch (err) {
    console.warn('[memoryDecayWorker] Failed to write decay log/telemetry:', err);
  }

  return {
    decayed_count: decayedCount,
    archived_count: archivedCount,
    conflicts_resolved: conflictsResolved,
    duration_ms: durationMs,
    timestamp: nowDateIso,
  };
}

let schedulerTimer: NodeJS.Timeout | null = null;

/**
 * Starts periodic background scheduler (every 6 hours).
 */
export function startMemoryDecayScheduler(intervalMs: number = 6 * 60 * 60 * 1000): void {
  if (schedulerTimer) return;
  schedulerTimer = setInterval(async () => {
    try {
      await runMemoryDecayCycle();
    } catch (err) {
      console.error('[memoryDecayScheduler] Error during scheduled decay cycle:', err);
    }
  }, intervalMs);
}

export function stopMemoryDecayScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
