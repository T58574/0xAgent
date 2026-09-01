import { getVeronicaDb } from '../db/veronicaDb';
import { writeQueue } from '../db/writeQueue';
import { ProjectSnapshot } from '../types';

export class SnapshotCache {
  private static instance: SnapshotCache;

  private constructor() {}

  public static getInstance(): SnapshotCache {
    if (!SnapshotCache.instance) {
      SnapshotCache.instance = new SnapshotCache();
    }
    return SnapshotCache.instance;
  }

  /**
   * Recompute and save snapshot for a project
   */
  public async refreshSnapshot(projectName: string): Promise<ProjectSnapshot> {
    return writeQueue.enqueue(() => {
      const db = getVeronicaDb();
      const now = Date.now();

      // 1. Count active tasks
      const activeStmt = db.prepare(
        "SELECT COUNT(*) as count FROM agent_tasks WHERE project = ? AND status IN ('running', 'queued')"
      );
      const activeRes: any = activeStmt.get(projectName);
      const activeCount = activeRes?.count || 0;

      // 2. Count pending approvals
      const pendingStmt = db.prepare(
        "SELECT COUNT(*) as count FROM agent_tasks WHERE project = ? AND status = 'awaiting_approval'"
      );
      const pendingRes: any = pendingStmt.get(projectName);
      const pendingCount = pendingRes?.count || 0;

      // 3. Get recent 3 completed tasks
      const recentStmt = db.prepare(
        "SELECT id, skill, status, summary, finished_at FROM agent_tasks WHERE project = ? AND status IN ('completed', 'failed') ORDER BY started_at DESC LIMIT 3"
      );
      const recentTasks: any[] = recentStmt.all(projectName) as any[];

      // 4. Get recent 3 git commits
      const commitStmt = db.prepare(
        'SELECT commit_hash, message, branch, timestamp FROM git_commits WHERE project = ? ORDER BY timestamp DESC LIMIT 3'
      );
      const recentCommits: any[] = commitStmt.all(projectName) as any[];

      // 5. Compute dense context string (~150-250 tokens)
      const lastTask = recentTasks[0];
      const lastCommit = recentCommits[0];
      const denseSummary = [
        `PROJECT:${projectName}`,
        `ACTIVE_TASKS:${activeCount}`,
        `PENDING_APPROVALS:${pendingCount}`,
        lastTask ? `LAST_TASK:${lastTask.skill}(${lastTask.status}: ${lastTask.summary || 'ok'})` : 'LAST_TASK:none',
        lastCommit ? `LAST_COMMIT:[${lastCommit.commit_hash.substring(0, 7)}] ${lastCommit.message}` : 'LAST_COMMIT:none',
      ].join(' | ');

      const snapshot: ProjectSnapshot = {
        project: projectName,
        last_updated: now,
        active_tasks_count: activeCount,
        recent_completions: JSON.stringify(recentTasks),
        pending_attention_count: pendingCount,
        last_activity_at: lastTask?.finished_at || now,
        dense_context_summary: denseSummary,
      };

      // Upsert into project_snapshots
      const upsertStmt = db.prepare(`
        INSERT INTO project_snapshots (
          project, last_updated, active_tasks_count, recent_completions,
          pending_attention_count, last_activity_at, dense_context_summary
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project) DO UPDATE SET
          last_updated = excluded.last_updated,
          active_tasks_count = excluded.active_tasks_count,
          recent_completions = excluded.recent_completions,
          pending_attention_count = excluded.pending_attention_count,
          last_activity_at = excluded.last_activity_at,
          dense_context_summary = excluded.dense_context_summary
      `);

      upsertStmt.run(
        snapshot.project,
        snapshot.last_updated,
        snapshot.active_tasks_count,
        snapshot.recent_completions,
        snapshot.pending_attention_count,
        snapshot.last_activity_at,
        snapshot.dense_context_summary
      );

      return snapshot;
    });
  }

  /**
   * Get cached snapshot directly from DB without full table scans
   */
  public getSnapshot(projectName: string): ProjectSnapshot | null {
    const db = getVeronicaDb();
    const stmt = db.prepare('SELECT * FROM project_snapshots WHERE project = ?');
    const row: any = stmt.get(projectName);
    if (!row) return null;
    return {
      project: row.project,
      last_updated: Number(row.last_updated),
      active_tasks_count: Number(row.active_tasks_count),
      recent_completions: row.recent_completions,
      pending_attention_count: Number(row.pending_attention_count),
      last_activity_at: Number(row.last_activity_at),
      dense_context_summary: row.dense_context_summary,
    };
  }

  /**
   * Get all project snapshots
   */
  public getAllSnapshots(): ProjectSnapshot[] {
    const db = getVeronicaDb();
    const stmt = db.prepare('SELECT * FROM project_snapshots ORDER BY last_activity_at DESC');
    const rows: any[] = stmt.all() as any[];
    return rows.map((r) => ({
      project: r.project,
      last_updated: Number(r.last_updated),
      active_tasks_count: Number(r.active_tasks_count),
      recent_completions: r.recent_completions,
      pending_attention_count: Number(r.pending_attention_count),
      last_activity_at: Number(r.last_activity_at),
      dense_context_summary: r.dense_context_summary,
    }));
  }
}

export const snapshotCache = SnapshotCache.getInstance();
