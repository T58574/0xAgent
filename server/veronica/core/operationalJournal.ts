import { getVeronicaDb } from '../db/veronicaDb';
import { writeQueue } from '../db/writeQueue';
import { snapshotCache } from './snapshotCache';
import { projectDocManager } from './projectDocManager';

export interface OperationalJournalEntry {
  id?: number;
  timestamp: number;
  project: string;
  task_id?: string | null;
  agent: string;
  operation_type: string;
  status: string;
  summary: string;
  changes?: string[] | null;
  important?: boolean;
  commit_hash?: string | null;
  metadata?: Record<string, any> | null;
}

export interface JournalDigestResult {
  period: string;
  periodLabel: string;
  sinceTimestamp: number;
  untilTimestamp: number;
  completedCount: number;
  failedCount: number;
  totalEvents: number;
  entries: OperationalJournalEntry[];
  importantHighlights: string[];
}

export class OperationalJournalService {
  private static instance: OperationalJournalService;

  private constructor() {}

  public static getInstance(): OperationalJournalService {
    if (!OperationalJournalService.instance) {
      OperationalJournalService.instance = new OperationalJournalService();
    }
    return OperationalJournalService.instance;
  }

  /**
   * Log an operational event into the canonical SQLite operational journal
   */
  public async logEntry(
    entry: Omit<OperationalJournalEntry, 'id' | 'timestamp'> & { timestamp?: number }
  ): Promise<OperationalJournalEntry> {
    const timestamp = entry.timestamp || Date.now();
    const agent = entry.agent || 'agent';
    const status = entry.status || 'completed';
    const operation_type = entry.operation_type || 'task_completion';
    const important = entry.important ? 1 : 0;
    const task_id = entry.task_id || null;
    const commit_hash = entry.commit_hash || null;

    let changesJson: string | null = null;
    if (Array.isArray(entry.changes)) {
      changesJson = JSON.stringify(entry.changes);
    } else if (typeof entry.changes === 'string') {
      changesJson = JSON.stringify([entry.changes]);
    }

    const metadataJson = entry.metadata ? JSON.stringify(entry.metadata) : null;

    let insertedId: number | bigint = 0;

    await writeQueue.enqueue(() => {
      const db = getVeronicaDb();
      const stmt = db.prepare(`
        INSERT INTO operational_journal (
          timestamp, project, task_id, agent, operation_type,
          status, summary, changes_json, important, commit_hash, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const res = stmt.run(
        timestamp,
        entry.project,
        task_id,
        agent,
        operation_type,
        status,
        entry.summary,
        changesJson,
        important,
        commit_hash,
        metadataJson
      );

      insertedId = res.lastInsertRowid;
    });

    // Mirror to Markdown changelog asynchronously for human visibility
    projectDocManager
      .appendChangelog(entry.project, {
        author: agent,
        taskId: task_id || undefined,
        action: `${operation_type} [${status}]`,
        details: entry.summary + (entry.changes && entry.changes.length > 0 ? ` (Changes: ${entry.changes.join(', ')})` : ''),
      })
      .catch(() => {});

    // Refresh project snapshot cache
    snapshotCache.refreshSnapshot(entry.project).catch(() => {});

    return {
      id: Number(insertedId),
      timestamp,
      project: entry.project,
      task_id,
      agent,
      operation_type,
      status,
      summary: entry.summary,
      changes: entry.changes || null,
      important: Boolean(entry.important),
      commit_hash,
      metadata: entry.metadata || null,
    };
  }

  /**
   * Query history entries from the operational journal
   */
  public getHistory(
    project?: string,
    options?: {
      limit?: number;
      offset?: number;
      importantOnly?: boolean;
      sinceTimestamp?: number;
      untilTimestamp?: number;
      task_id?: string;
    }
  ): OperationalJournalEntry[] {
    const db = getVeronicaDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (project) {
      conditions.push('project = ?');
      params.push(project);
    }
    if (options?.importantOnly) {
      conditions.push('important = 1');
    }
    if (options?.sinceTimestamp !== undefined) {
      conditions.push('timestamp >= ?');
      params.push(options.sinceTimestamp);
    }
    if (options?.untilTimestamp !== undefined) {
      conditions.push('timestamp <= ?');
      params.push(options.untilTimestamp);
    }
    if (options?.task_id) {
      conditions.push('task_id = ?');
      params.push(options.task_id);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    params.push(limit, offset);

    const sql = `
      SELECT * FROM operational_journal
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(sql).all(...params) as any[];

    return rows.map((r) => this.mapRow(r));
  }

  /**
   * Compute structured executive period digest for today, yesterday, or week
   */
  public getPeriodDigest(period: 'today' | 'yesterday' | 'week' | 'all', project?: string): JournalDigestResult {
    const now = new Date();
    let sinceTimestamp = 0;
    let untilTimestamp = Date.now();
    let periodLabel = 'За всё время';

    if (period === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      sinceTimestamp = startOfDay.getTime();
      periodLabel = 'За сегодня';
    } else if (period === 'yesterday') {
      const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      sinceTimestamp = startOfYesterday.getTime();
      untilTimestamp = endOfYesterday.getTime();
      periodLabel = 'За вчера';
    } else if (period === 'week') {
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0);
      sinceTimestamp = startOfWeek.getTime();
      periodLabel = 'За последние 7 дней';
    }

    const entries = this.getHistory(project, {
      sinceTimestamp,
      untilTimestamp,
      limit: 100,
    });

    let completedCount = 0;
    let failedCount = 0;
    const importantHighlights: string[] = [];

    for (const e of entries) {
      if (e.status === 'completed' || e.status === 'success') {
        completedCount++;
      } else if (e.status === 'failed' || e.status === 'crashed' || e.status === 'error') {
        failedCount++;
      }

      if (e.important) {
        importantHighlights.push(`[${e.project}] ${e.summary}`);
      }
    }

    return {
      period,
      periodLabel,
      sinceTimestamp,
      untilTimestamp,
      completedCount,
      failedCount,
      totalEvents: entries.length,
      entries,
      importantHighlights,
    };
  }

  private mapRow(r: any): OperationalJournalEntry {
    let changes: string[] | null = null;
    if (r.changes_json) {
      try {
        changes = JSON.parse(r.changes_json);
      } catch {
        changes = [r.changes_json];
      }
    }

    let metadata: Record<string, any> | null = null;
    if (r.metadata_json) {
      try {
        metadata = JSON.parse(r.metadata_json);
      } catch {}
    }

    return {
      id: Number(r.id),
      timestamp: Number(r.timestamp),
      project: r.project,
      task_id: r.task_id || null,
      agent: r.agent || 'agent',
      operation_type: r.operation_type,
      status: r.status,
      summary: r.summary,
      changes,
      important: Boolean(r.important),
      commit_hash: r.commit_hash || null,
      metadata,
    };
  }
}

export const operationalJournal = OperationalJournalService.getInstance();