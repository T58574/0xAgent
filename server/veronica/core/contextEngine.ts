import { getVeronicaDb } from '../db/veronicaDb';
import { snapshotCache } from './snapshotCache';

export interface ContextOptions {
  task?: string;
  recent?: boolean;
  architecture?: boolean;
}

export class ContextEngine {
  private static instance: ContextEngine;

  private constructor() {}

  public static getInstance(): ContextEngine {
    if (!ContextEngine.instance) {
      ContextEngine.instance = new ContextEngine();
    }
    return ContextEngine.instance;
  }

  /**
   * Produce ultra-dense single-line or compact token-efficient context (< 250 tokens)
   */
  public async getProjectContext(project: string, options?: ContextOptions): Promise<string> {
    const snapshot = snapshotCache.getSnapshot(project) || (await snapshotCache.refreshSnapshot(project));
    const db = getVeronicaDb();

    const parts: string[] = [];
    parts.push(`PROJECT:${project}`);

    // Project metadata
    const projStmt = db.prepare('SELECT autonomy_level, settings_json FROM projects WHERE name = ?');
    const projRow: any = projStmt.get(project);
    const autonomy = projRow?.autonomy_level || 'L2';
    parts.push(`AUTONOMY:${autonomy}`);

    // Active task context if requested
    if (options?.task) {
      const taskStmt = db.prepare('SELECT id, skill, status, started_at FROM agent_tasks WHERE id = ?');
      const taskRow: any = taskStmt.get(options.task);
      if (taskRow) {
        parts.push(`CURRENT_TASK:[${taskRow.id.substring(0, 8)}] skill=${taskRow.skill} status=${taskRow.status}`);
      }
    }

    // Recent 3 completed tasks
    let recentTasks: any[] = [];
    try {
      recentTasks = JSON.parse(snapshot.recent_completions || '[]');
    } catch {
      recentTasks = [];
    }

    if (recentTasks.length > 0) {
      const taskSummaries = recentTasks
        .map((t) => `${t.skill}:${t.status}${t.summary ? `(${t.summary.substring(0, 40)})` : ''}`)
        .join(';');
      parts.push(`RECENT_TASKS:[${taskSummaries}]`);
    } else {
      parts.push('RECENT_TASKS:none');
    }

    // Recent 2 git commits
    const commitStmt = db.prepare(
      'SELECT commit_hash, message, branch, timestamp FROM git_commits WHERE project = ? ORDER BY timestamp DESC LIMIT 2'
    );
    const commits: any[] = commitStmt.all(project) as any[];
    if (commits.length > 0) {
      const commitSummaries = commits
        .map((c) => `${c.commit_hash.substring(0, 7)}:"${c.message.substring(0, 35)}"`)
        .join(';');
      parts.push(`COMMITS:[${commitSummaries}]`);
    } else {
      parts.push('COMMITS:none');
    }

    // Constraints & rules
    parts.push('RULES:use_cli_for_updates;do_not_edit_docs_directly;keep_changes_minimal');

    return parts.join(' | ');
  }
}

export const contextEngine = ContextEngine.getInstance();
