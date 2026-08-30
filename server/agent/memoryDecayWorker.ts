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

  // ==========================================================================
  // 1. HALF-LIFE CONFIDENCE DECAY
  // ==========================================================================
  const activeMemories = db.prepare(`
    SELECT id, confidence, last_used_at, created_at, usage_count, status
    FROM canonical_memories
    WHERE status = 'active'
      AND scope IN ('user', 'project', 'persona')
      AND (expires_at IS NULL OR expires_at > ?)
  `).all(nowDateIso) as any[];

  for (const mem of activeMemories) {
    const referenceTime = mem.last_used_at
      ? new Date(mem.last_used_at).getTime()
      : (typeof mem.created_at === 'number' ? mem.created_at : new Date(mem.created_at).getTime());

    if (isNaN(referenceTime)) continue;

    const daysSinceUse = (now - referenceTime) / (1000 * 60 * 60 * 24);
    if (daysSinceUse <= 1) continue; // No decay within the first 24 hours

    const decayFactor = Math.pow(0.5, daysSinceUse / HALF_LIFE_DAYS);
    const newConfidence = Math.max(0.01, Math.round(mem.confidence * decayFactor * 1000) / 1000);

    if (newConfidence < ARCHIVE_THRESHOLD) {
      db.prepare(`
        UPDATE canonical_memories
        SET status = 'archived', updated_at = ?
        WHERE id = ?
      `).run(now, mem.id);

      archivedCount++;

      // Log in memory audit log
      try {
        db.prepare(`
          INSERT INTO memory_audit_log (
            id, memory_id, event_type, old_state, new_state, actor_type, rationale, created_at
          ) VALUES (?, ?, 'auto_archived', ?, ?, 'system', 'decay_below_threshold', ?)
        `).run(
          `aud_${uuidv4().substring(0, 8)}`,
          mem.id,
          JSON.stringify({ status: 'active', confidence: mem.confidence }),
          JSON.stringify({ status: 'archived', confidence: newConfidence }),
          now
        );
      } catch {}
    } else if (newConfidence < mem.confidence - 0.02) {
      db.prepare(`
        UPDATE canonical_memories
        SET confidence = ?, updated_at = ?
        WHERE id = ?
      `).run(newConfidence, now, mem.id);

      decayedCount++;
    }
  }

  // ==========================================================================
  // 2. CONFLICT RESOLUTION & DEDUPLICATION
  // ==========================================================================
  const duplicateGroups = db.prepare(`
    SELECT scope, subject_id, IFNULL(persona_id, '') AS p_id, IFNULL(project_id, '') AS proj_id, domain, key, COUNT(*) as cnt
    FROM canonical_memories
    WHERE status = 'active'
    GROUP BY scope, subject_id, IFNULL(persona_id, ''), IFNULL(project_id, ''), domain, key
    HAVING cnt > 1
  `).all() as any[];

  for (const group of duplicateGroups) {
    const records = db.prepare(`
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
    `).all(group.scope, group.subject_id, group.p_id, group.proj_id, group.domain, group.key) as any[];

    if (records.length > 1) {
      const winner = records[0];
      const losers = records.slice(1);

      for (const loser of losers) {
        db.prepare(`
          UPDATE canonical_memories
          SET status = 'superseded', updated_at = ?
          WHERE id = ?
        `).run(now, loser.id);

        conflictsResolved++;

        try {
          db.prepare(`
            INSERT INTO memory_audit_log (
              id, memory_id, event_type, old_state, new_state, actor_type, rationale, created_at
            ) VALUES (?, ?, 'superseded', ?, ?, 'system', ?, ?)
          `).run(
            `aud_${uuidv4().substring(0, 8)}`,
            loser.id,
            JSON.stringify({ status: 'active', id: loser.id }),
            JSON.stringify({ status: 'superseded', winner_id: winner.id }),
            `Superseded by memory ${winner.id} with higher confidence`,
            now
          );
        } catch {}
      }
    }
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
