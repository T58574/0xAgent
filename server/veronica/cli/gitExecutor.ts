import { exec } from 'node:child_process';
import util from 'node:util';
import { getVeronicaDb } from '../db/veronicaDb';
import { writeQueue } from '../db/writeQueue';
import { taskRegistry } from '../core/taskRegistry';

const execAsync = util.promisify(exec);

export class GitExecutor {
  public static async executeCommit(params: {
    taskId: string;
    projectPath: string;
    message: string;
    files?: string[];
  }): Promise<{ success: boolean; commitHash?: string; error?: string }> {
    const task = taskRegistry.getTask(params.taskId);
    if (!task) {
      return { success: false, error: `Task ${params.taskId} not found` };
    }

    // Check autonomy level (L3+ required for committing)
    const autonomy = task.autonomy_level;
    if (['L0', 'L1', 'L2'].includes(autonomy)) {
      return {
        success: false,
        error: `Permission Denied: Autonomy level ${autonomy} prohibits automated git commits (requires L3+)`,
      };
    }

    try {
      const cwd = params.projectPath;
      const filesToAdd = params.files && params.files.length > 0 ? params.files.map((f) => `"${f}"`).join(' ') : '.';

      // 1. git add
      await execAsync(`git add ${filesToAdd}`, { cwd });

      // 2. git commit with standardized format
      const commitMsg = `[veronica:${params.taskId.substring(0, 8)}] ${params.message.replace(/"/g, '\\"')}`;
      await execAsync(`git commit -m "${commitMsg}"`, { cwd });

      // 3. Get commit hash & branch
      const hashRes = await execAsync('git rev-parse HEAD', { cwd });
      const commitHash = hashRes.stdout.trim();

      const branchRes = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd });
      const branch = branchRes.stdout.trim();

      // 4. Record commit in git_commits table
      await writeQueue.enqueue(() => {
        const db = getVeronicaDb();
        db.prepare(`
          INSERT INTO git_commits (task_id, project, commit_hash, branch, message, files_changed, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          params.taskId,
          task.project,
          commitHash,
          branch,
          params.message,
          JSON.stringify(params.files || []),
          Date.now()
        );
      });

      return { success: true, commitHash };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Git commit failed' };
    }
  }

  public static async executeRollback(params: {
    taskId: string;
    projectPath: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const db = getVeronicaDb();
      const stmt = db.prepare('SELECT commit_hash FROM git_commits WHERE task_id = ? ORDER BY timestamp DESC LIMIT 1');
      const row: any = stmt.get(params.taskId);
      if (!row) {
        return { success: false, error: `No git commit found for task ${params.taskId}` };
      }

      await execAsync(`git revert --no-edit ${row.commit_hash}`, { cwd: params.projectPath });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Git rollback failed' };
    }
  }
}
