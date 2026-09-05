import crypto from 'node:crypto';
import { getVeronicaDb } from '../db/veronicaDb';
import { writeQueue } from '../db/writeQueue';
import { AgentTask, AgentEvent, TaskStatus, AutonomyLevel } from '../types';
import { projectLockManager } from './projectLockManager';
import { snapshotCache } from './snapshotCache';
import { notificationService } from '../telegram/notificationService';
import { antigravityAdapter } from '../adapters/antigravityAdapter';

export class TaskRegistry {
  private static instance: TaskRegistry;

  private constructor() {}

  public static getInstance(): TaskRegistry {
    if (!TaskRegistry.instance) {
      TaskRegistry.instance = new TaskRegistry();
    }
    return TaskRegistry.instance;
  }

  /**
   * Create a new agent task record in SQLite
   */
  public async createTask(params: {
    project: string;
    skill: string;
    runtime_profile?: string;
    autonomy_level?: AutonomyLevel;
    custom_prompt?: string;
    max_retries?: number;
  }): Promise<AgentTask> {
    const id = crypto.randomUUID();
    const task_token = crypto.randomBytes(16).toString('hex');
    const started_at = Date.now();
    const runtime_profile = params.runtime_profile || 'default';
    const autonomy_level = params.autonomy_level || 'L2';
    const veronica_version = '1.0.0';
    const max_retries = params.max_retries ?? 2;

    // Determine initial status based on global sequential lock (Concurrency = 1)
    const isLocked = projectLockManager.isGlobalLocked() || projectLockManager.isLocked(params.project);
    const status: TaskStatus = isLocked ? 'queued' : 'running';

    if (status === 'running') {
      projectLockManager.acquireGlobalLock(id, params.project);
    }

    const task: AgentTask = {
      id,
      runtime_profile,
      project: params.project,
      skill: params.skill,
      status,
      started_at,
      autonomy_level,
      veronica_version,
      last_heartbeat: started_at,
      task_token,
      retry_count: 0,
      max_retries,
      custom_prompt: params.custom_prompt,
    };

    await writeQueue.enqueue(() => {
      const db = getVeronicaDb();
      const stmt = db.prepare(`
        INSERT INTO agent_tasks (
          id, runtime_profile, project, skill, status, started_at,
          autonomy_level, veronica_version, last_heartbeat, task_token,
          retry_count, max_retries, custom_prompt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        task.id,
        task.runtime_profile,
        task.project,
        task.skill,
        task.status,
        task.started_at,
        task.autonomy_level,
        task.veronica_version,
        task.last_heartbeat ?? null,
        task.task_token,
        task.retry_count ?? 0,
        task.max_retries ?? 2,
        task.custom_prompt || null
      );

      // Add creation event
      const eventStmt = db.prepare(`
        INSERT INTO agent_events (task_id, event_type, timestamp, message)
        VALUES (?, 'system', ?, ?)
      `);
      eventStmt.run(task.id, started_at, `Task ${task.id} initialized with status: ${status}`);
    });

    await snapshotCache.refreshSnapshot(params.project);
    return task;
  }

  /**
   * Update task status, optional summary and result
   */
  public async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    options?: {
      summary?: string;
      result_json?: string;
      error_message?: string;
      pid?: number;
      approval_payload?: string;
      skip_retry?: boolean;
    }
  ): Promise<void> {
    const task = this.getTask(taskId);
    if (!task) return;

    const isTerminal = ['completed', 'failed', 'timeout', 'crashed', 'cancelled'].includes(status);
    const finished_at = isTerminal ? Date.now() : null;

    await writeQueue.enqueue(() => {
      const db = getVeronicaDb();
      const updates: string[] = ['status = ?'];
      const values: any[] = [status];

      if (finished_at) {
        updates.push('finished_at = ?');
        values.push(finished_at);
      }
      if (options?.summary !== undefined) {
        updates.push('summary = ?');
        values.push(options.summary);
      }
      if (options?.result_json !== undefined) {
        updates.push('result_json = ?');
        values.push(options.result_json);
      }
      if (options?.error_message !== undefined) {
        updates.push('error_message = ?');
        values.push(options.error_message);
      }
      if (options?.pid !== undefined) {
        updates.push('pid = ?');
        values.push(options.pid);
      }
      if (options?.approval_payload !== undefined) {
        updates.push('approval_payload = ?');
        values.push(options.approval_payload);
      }

      values.push(taskId);
      const sql = `UPDATE agent_tasks SET ${updates.join(', ')} WHERE id = ?`;
      db.prepare(sql).run(...values);

      // Event log
      const eventStmt = db.prepare(`
        INSERT INTO agent_events (task_id, event_type, timestamp, message)
        VALUES (?, 'system', ?, ?)
      `);
      eventStmt.run(taskId, Date.now(), `Status changed to: ${status}${options?.summary ? ` (${options.summary})` : ''}`);
    });

    // Handle automated retry if failed/crashed and not explicitly skipped
    if (!options?.skip_retry && (status === 'failed' || status === 'crashed') && (task.retry_count || 0) < (task.max_retries || 2)) {
      this.retryTask(taskId).catch(() => {});
      return;
    }

    // Release global and project lock if terminal
    if (isTerminal) {
      projectLockManager.releaseGlobalLock(taskId);
      this.promoteNextQueuedTask(task.project).catch(() => {});
    }

    await snapshotCache.refreshSnapshot(task.project);
  }

  /**
   * Real-time checkpoint of conversation_id for task recovery and granular resume
   */
  public async checkpointConversationId(taskId: string, conversationId: string): Promise<void> {
    const task = this.getTask(taskId);
    if (!task || !conversationId) return;

    await writeQueue.enqueue(() => {
      const db = getVeronicaDb();
      let currentResult: any = {};
      if (task.result_json) {
        try {
          currentResult = JSON.parse(task.result_json);
        } catch {}
      }
      currentResult.conversation_id = conversationId;
      const updatedJson = JSON.stringify(currentResult);

      db.prepare('UPDATE agent_tasks SET result_json = ? WHERE id = ?').run(updatedJson, taskId);
    });
  }

  /**
   * Automatically retry a failed or interrupted task reusing its conversation checkpoint
   */
  public async retryTask(taskId: string): Promise<boolean> {
    const task = this.getTask(taskId);
    if (!task) return false;

    const currentRetries = task.retry_count || 0;
    const maxRetries = task.max_retries || 2;

    if (currentRetries >= maxRetries) {
      return false;
    }

    const nextRetry = currentRetries + 1;
    await writeQueue.enqueue(() => {
      const db = getVeronicaDb();
      db.prepare('UPDATE agent_tasks SET retry_count = ? WHERE id = ?').run(nextRetry, taskId);
      db.prepare(`
        INSERT INTO agent_events (task_id, event_type, timestamp, message)
        VALUES (?, 'warning', ?, ?)
      `).run(taskId, Date.now(), `Retrying task (Attempt ${nextRetry} of ${maxRetries})`);
    });

    let resumeConvoId: string | undefined = undefined;
    if (task.result_json) {
      try {
        const parsed = JSON.parse(task.result_json);
        resumeConvoId = parsed.conversation_id;
      } catch {}
    }

    // Re-launch task asynchronously reusing taskId and conversation checkpoint so watchdog tracks the new PID
    try {
      await antigravityAdapter.spawnTask({
        project: task.project,
        skill: task.skill,
        runtime_profile: task.runtime_profile,
        autonomy_level: task.autonomy_level,
        custom_prompt: task.custom_prompt || undefined,
        existing_task_id: taskId,
        conversation_id: resumeConvoId,
        continue_recent: !resumeConvoId,
      });
      return true;
    } catch {
      await this.updateTaskStatus(taskId, 'failed', {
        summary: 'Failed to restart task process on retry',
        skip_retry: true,
      });
      return false;
    }
  }

  /**
   * Put task into awaiting_approval state and alert Telegram
   */
  public async requestApproval(taskId: string, payload: { action: string; details: string }): Promise<void> {
    const task = this.getTask(taskId);
    if (!task) return;

    await this.updateTaskStatus(taskId, 'awaiting_approval', {
      approval_payload: JSON.stringify(payload),
      summary: `Awaiting approval for: ${payload.action}`,
    });

    // Send Telegram alert with inline buttons
    notificationService.notifyApprovalRequired({ ...task, status: 'awaiting_approval' }, payload).catch(() => {});
  }

  /**
   * Resolve user approval decision (approve or reject)
   */
  public async resolveApproval(taskId: string, approved: boolean, reviewer: string = 'Telegram User'): Promise<void> {
    const task = this.getTask(taskId);
    if (!task || task.status !== 'awaiting_approval') return;

    if (approved) {
      await this.updateTaskStatus(taskId, 'running', {
        summary: `Approved by ${reviewer}`,
      });
      await this.logEvent({
        task_id: taskId,
        event_type: 'decision',
        timestamp: Date.now(),
        message: `Action approved by ${reviewer}`,
      });
    } else {
      await this.updateTaskStatus(taskId, 'cancelled', {
        summary: `Rejected by ${reviewer}`,
      });
      await this.logEvent({
        task_id: taskId,
        event_type: 'decision',
        timestamp: Date.now(),
        message: `Action rejected by ${reviewer}`,
      });
    }
  }

  private isPromotingQueue: boolean = false;

  /**
   * Promotes the next queued task in the global sequential FIFO queue (Concurrency = 1)
   * and spawns its execution via AntigravityAdapter.
   */
  public async promoteNextQueuedTask(preferredProject?: string): Promise<AgentTask | null> {
    if (this.isPromotingQueue) return null;
    if (projectLockManager.isGlobalLocked()) return null;

    this.isPromotingQueue = true;
    try {
      const db = getVeronicaDb();
      let row: any = null;

      if (preferredProject) {
        row = db.prepare(
          "SELECT * FROM agent_tasks WHERE project = ? AND status = 'queued' ORDER BY started_at ASC LIMIT 1"
        ).get(preferredProject);
      }

      if (!row) {
        row = db.prepare(
          "SELECT * FROM agent_tasks WHERE status = 'queued' ORDER BY started_at ASC LIMIT 1"
        ).get();
      }

      if (!row) return null;

      const nextTaskId = row.id;
      const nextProject = row.project;

      if (!projectLockManager.acquireGlobalLock(nextTaskId, nextProject)) {
        return null;
      }

      await this.updateTaskStatus(nextTaskId, 'running', {
        summary: 'Promoted from global sequential FIFO queue to running',
      });

      // In production, asynchronously launch the real OS agent task via AntigravityAdapter
      if (!process.env.NODE_TEST_CONTEXT && process.env.NODE_ENV !== 'test') {
        antigravityAdapter.spawnTask({
          project: nextProject,
          skill: row.skill,
          runtime_profile: row.runtime_profile,
          autonomy_level: row.autonomy_level,
          custom_prompt: row.custom_prompt || undefined,
          existing_task_id: nextTaskId,
        }).catch((spawnErr) => {
          console.error(`[Veronica Task Queue] Failed to spawn promoted task ${nextTaskId}:`, spawnErr);
        });
      }

      return this.getTask(nextTaskId);
    } finally {
      this.isPromotingQueue = false;
    }
  }

  /**
   * Backwards-compatible alias for queue promotion
   */
  public async promoteQueuedTask(project?: string): Promise<AgentTask | null> {
    return this.promoteNextQueuedTask(project);
  }

  /**
   * Record heartbeat from agent
   */
  public async recordHeartbeat(taskId: string, action?: string, progress?: string): Promise<void> {
    const now = Date.now();
    await writeQueue.enqueue(() => {
      const db = getVeronicaDb();
      const taskExists = db.prepare('SELECT id FROM agent_tasks WHERE id = ?').get(taskId);
      if (!taskExists) {
        return;
      }
      db.prepare('UPDATE agent_tasks SET last_heartbeat = ? WHERE id = ?').run(now, taskId);

      const msg = action ? `Heartbeat: ${action}${progress ? ` (${progress})` : ''}` : 'Heartbeat';
      db.prepare(`
        INSERT INTO agent_events (task_id, event_type, timestamp, message)
        VALUES (?, 'heartbeat', ?, ?)
      `).run(taskId, now, msg);
    });
  }

  /**
   * Record task event (progress, decision, warning, error)
   */
  public async logEvent(event: AgentEvent): Promise<void> {
    await writeQueue.enqueue(() => {
      const db = getVeronicaDb();
      const taskExists = db.prepare('SELECT id FROM agent_tasks WHERE id = ?').get(event.task_id);
      if (!taskExists) {
        return;
      }
      db.prepare(`
        INSERT INTO agent_events (task_id, event_type, timestamp, message, data_json)
        VALUES (?, ?, ?, ?, ?)
      `).run(event.task_id, event.event_type, event.timestamp, event.message, event.data_json || null);
    });
  }

  /**
   * Get single task by ID
   */
  public getTask(taskId: string): AgentTask | null {
    const db = getVeronicaDb();
    const stmt = db.prepare('SELECT * FROM agent_tasks WHERE id = ?');
    const row: any = stmt.get(taskId);
    if (!row) return null;
    return {
      id: row.id,
      runtime_profile: row.runtime_profile,
      project: row.project,
      skill: row.skill,
      status: row.status as TaskStatus,
      started_at: Number(row.started_at),
      finished_at: row.finished_at ? Number(row.finished_at) : null,
      summary: row.summary,
      result_json: row.result_json,
      error_message: row.error_message,
      autonomy_level: row.autonomy_level as AutonomyLevel,
      veronica_version: row.veronica_version,
      pid: row.pid ? Number(row.pid) : null,
      last_heartbeat: row.last_heartbeat ? Number(row.last_heartbeat) : null,
      task_token: row.task_token,
      retry_count: row.retry_count ? Number(row.retry_count) : 0,
      max_retries: row.max_retries ? Number(row.max_retries) : 2,
      approval_payload: row.approval_payload,
      custom_prompt: row.custom_prompt,
    };
  }

  /**
   * List tasks by query filters
   */
  public listTasks(options?: {
    project?: string;
    status?: TaskStatus;
    limit?: number;
  }): AgentTask[] {
    const db = getVeronicaDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (options?.project) {
      conditions.push('project = ?');
      params.push(options.project);
    }
    if (options?.status) {
      conditions.push('status = ?');
      params.push(options.status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options?.limit || 50;
    params.push(limit);

    const stmt = db.prepare(`SELECT * FROM agent_tasks ${where} ORDER BY started_at DESC LIMIT ?`);
    const rows: any[] = stmt.all(...params) as any[];

    return rows.map((r) => ({
      id: r.id,
      runtime_profile: r.runtime_profile,
      project: r.project,
      skill: r.skill,
      status: r.status as TaskStatus,
      started_at: Number(r.started_at),
      finished_at: r.finished_at ? Number(r.finished_at) : null,
      summary: r.summary,
      result_json: r.result_json,
      error_message: r.error_message,
      autonomy_level: r.autonomy_level as AutonomyLevel,
      veronica_version: r.veronica_version,
      pid: r.pid ? Number(r.pid) : null,
      last_heartbeat: r.last_heartbeat ? Number(r.last_heartbeat) : null,
      task_token: r.task_token,
      retry_count: r.retry_count ? Number(r.retry_count) : 0,
      max_retries: r.max_retries ? Number(r.max_retries) : 2,
      approval_payload: r.approval_payload,
      custom_prompt: r.custom_prompt,
    }));
  }

  /**
   * Get active tasks currently running
   */
  public getActiveTasks(): AgentTask[] {
    return this.listTasks({ status: 'running' as TaskStatus });
  }
}

export const taskRegistry = TaskRegistry.getInstance();
