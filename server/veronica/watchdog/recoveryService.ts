import { getVeronicaDb } from '../db/veronicaDb';
import { taskRegistry } from '../core/taskRegistry';
import { projectLockManager } from '../core/projectLockManager';

export class RecoveryService {
  public static async reconcileOnStartup(): Promise<{
    recoveredCount: number;
    queuedCount: number;
  }> {
    const db = getVeronicaDb();
    let recoveredCount = 0;
    let queuedCount = 0;

    try {
      // Find all tasks recorded as 'running'
      const stmt = db.prepare("SELECT id, pid, project FROM agent_tasks WHERE status = 'running'");
      const runningTasks = stmt.all() as any[];

      for (const t of runningTasks) {
        let isAlive = false;
        if (t.pid) {
          try {
            isAlive = process.kill(t.pid, 0);
          } catch {
            isAlive = false;
          }
        }

        if (!isAlive) {
          await taskRegistry.updateTaskStatus(t.id, 'crashed', {
            summary: 'Reconciled on server restart: process was dead',
          });
          projectLockManager.releaseLock(t.project, t.id);
          recoveredCount++;
        } else {
          // Process is surprisingly still alive; acquire lock
          projectLockManager.acquireLock(t.project, t.id);
        }
      }

      // Check queued tasks
      const queuedStmt = db.prepare("SELECT COUNT(*) as count FROM agent_tasks WHERE status = 'queued'");
      const queuedRes: any = queuedStmt.get();
      queuedCount = queuedRes?.count || 0;

      if (recoveredCount > 0) {
        console.log(`[Veronica Recovery] [OK] Cleaned up ${recoveredCount} orphaned tasks on boot.`);
      }
    } catch (err) {
      console.error('[Veronica Recovery] Error during startup reconciliation:', err);
    }

    return { recoveredCount, queuedCount };
  }
}
