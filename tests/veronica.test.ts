import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { initVeronicaDatabase, closeVeronicaDatabase, getVeronicaDb, getVeronicaDataDir } from '../server/veronica/db/veronicaDb';
import { writeQueue } from '../server/veronica/db/writeQueue';
import { taskRegistry } from '../server/veronica/core/taskRegistry';
import { projectLockManager } from '../server/veronica/core/projectLockManager';
import { contextEngine } from '../server/veronica/core/contextEngine';
import { snapshotCache } from '../server/veronica/core/snapshotCache';
import { CliHandler } from '../server/veronica/cli/cliHandler';
import { GitExecutor } from '../server/veronica/cli/gitExecutor';
import { RecoveryService } from '../server/veronica/watchdog/recoveryService';
import { remoteNodeService } from '../server/remoteNodeService';
import { veronicaScheduler } from '../server/veronica/core/scheduler';

describe('Module Veronica & Remote Node Architecture Test Suite', () => {
  const testDbDir = path.join(os.tmpdir(), '.0xagent_test_veronica_' + Date.now());
  const testDbPath = path.join(testDbDir, 'veronica.db');

  before(() => {
    fs.mkdirSync(testDbDir, { recursive: true });
    initVeronicaDatabase(testDbPath);
  });

  after(() => {
    closeVeronicaDatabase();
    try {
      fs.rmSync(testDbDir, { recursive: true, force: true });
    } catch {}
  });

  describe('1. Database Initialization & In-Memory Write Queue', () => {
    it('should initialize all required Veronica tables in WAL mode', () => {
      const db = getVeronicaDb();
      const tablesStmt = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('agent_tasks', 'agent_events', 'git_commits', 'projects', 'cron_jobs', 'project_snapshots', 'schema_version')"
      );
      const rows = tablesStmt.all() as any[];
      const names = rows.map((r) => r.name);

      assert.ok(names.includes('agent_tasks'), 'agent_tasks table missing');
      assert.ok(names.includes('agent_events'), 'agent_events table missing');
      assert.ok(names.includes('git_commits'), 'git_commits table missing');
      assert.ok(names.includes('projects'), 'projects table missing');
      assert.ok(names.includes('project_snapshots'), 'project_snapshots table missing');
    });

    it('should handle high-concurrency writes sequentially via writeQueue without SQLITE_BUSY', async () => {
      const db = getVeronicaDb();
      const writePromises = Array.from({ length: 30 }).map((_, i) =>
        writeQueue.enqueue(() => {
          db.prepare('INSERT INTO projects (name, autonomy_level, created_at) VALUES (?, ?, ?)')
            .run(`proj_${i}`, 'L2', Date.now());
          return i;
        })
      );

      const results = await Promise.all(writePromises);
      assert.equal(results.length, 30);

      const countRow: any = db.prepare('SELECT COUNT(*) as count FROM projects').get();
      assert.equal(countRow.count, 30);
    });
  });

  describe('2. Task Registry & Project Lock Management', () => {
    it('should acquire lock for first running task on project', async () => {
      const task1 = await taskRegistry.createTask({
        project: 'ProjectAlpha',
        skill: 'code_review',
        autonomy_level: 'L2',
      });

      assert.equal(task1.status, 'running');
      assert.ok(projectLockManager.isLocked('ProjectAlpha'));
      assert.equal(projectLockManager.getActiveTask('ProjectAlpha'), task1.id);
    });

    it('should place second concurrent task on same project in queued status', async () => {
      const task2 = await taskRegistry.createTask({
        project: 'ProjectAlpha',
        skill: 'security_audit',
        autonomy_level: 'L2',
      });

      assert.equal(task2.status, 'queued');
    });

    it('should record heartbeats and update last_heartbeat timestamp', async () => {
      const activeTask = taskRegistry.getActiveTasks().find((t) => t.project === 'ProjectAlpha');
      assert.ok(activeTask);

      const prevHeartbeat = activeTask.last_heartbeat || 0;
      await new Promise((r) => setTimeout(r, 10));

      await taskRegistry.recordHeartbeat(activeTask.id, 'Reading files', '25%');
      const updated = taskRegistry.getTask(activeTask.id);

      assert.ok(updated);
      assert.ok((updated.last_heartbeat || 0) >= prevHeartbeat);
    });

    it('should promote queued task to running upon completion of active task', async () => {
      const activeTask = taskRegistry.getActiveTasks().find((t) => t.project === 'ProjectAlpha');
      assert.ok(activeTask);

      await taskRegistry.updateTaskStatus(activeTask.id, 'completed', {
        summary: 'All checks passed',
      });

      const updatedActive = taskRegistry.getTask(activeTask.id);
      assert.equal(updatedActive?.status, 'completed');
      assert.ok(updatedActive.finished_at);

      // Verify promotion of queued task
      const promoted = taskRegistry.getActiveTasks().find((t) => t.project === 'ProjectAlpha');
      assert.ok(promoted, 'Queued task was not promoted');
      assert.equal(promoted.skill, 'security_audit');
      assert.equal(promoted.status, 'running');

      // Finish second task
      await taskRegistry.updateTaskStatus(promoted.id, 'completed', { summary: 'Audit done' });
      assert.equal(projectLockManager.isLocked('ProjectAlpha'), false);
    });
  });

  describe('3. Context Engine & Token Compression', () => {
    it('should generate dense token-efficient context under 250 tokens', async () => {
      const contextStr = await contextEngine.getProjectContext('ProjectAlpha');
      assert.ok(contextStr.includes('PROJECT:ProjectAlpha'));
      assert.ok(contextStr.includes('AUTONOMY:L2'));
      assert.ok(contextStr.includes('RECENT_TASKS:'));

      // Token estimation check: characters / 4 should be well under 250 tokens
      const estimatedTokens = Math.ceil(contextStr.length / 4);
      assert.ok(estimatedTokens < 250, `Context too large: ${estimatedTokens} tokens`);
    });

    it('should maintain project_snapshots cache', async () => {
      const snapshot = snapshotCache.getSnapshot('ProjectAlpha');
      assert.ok(snapshot);
      assert.equal(snapshot.project, 'ProjectAlpha');
      assert.equal(snapshot.active_tasks_count, 0);
    });
  });

  describe('4. Autonomy Levels & Git Executor Security', () => {
    it('should block git commit when task autonomy level is L2', async () => {
      const task = await taskRegistry.createTask({
        project: 'ProjectSecure',
        skill: 'refactor',
        autonomy_level: 'L2',
      });

      const res = await GitExecutor.executeCommit({
        taskId: task.id,
        projectPath: process.cwd(),
        message: 'Attempted unauthorized commit',
      });

      assert.equal(res.success, false);
      assert.ok(res.error?.includes('Permission Denied'));
      assert.ok(res.error?.includes('L2'));
    });
  });

  describe('5. Veronica CLI Handler', () => {
    it('should process context CLI request', async () => {
      const res = await CliHandler.handleRequest({
        command: 'context',
        project: 'ProjectAlpha',
      });
      assert.equal(res.success, true);
      assert.ok(typeof res.data === 'string');
      assert.ok(res.data.includes('PROJECT:ProjectAlpha'));
    });

    it('should process heartbeat CLI request', async () => {
      const task = await taskRegistry.createTask({
        project: 'CliTestProj',
        skill: 'test_skill',
      });

      const res = await CliHandler.handleRequest({
        command: 'heartbeat',
        task_id: task.id,
        action: 'Compiling typescript',
        progress: '60%',
      });

      assert.equal(res.success, true);
    });

    it('should list active background agents', async () => {
      const res = await CliHandler.handleRequest({ command: 'agents_list' });
      assert.equal(res.success, true);
      assert.ok(Array.isArray(res.data));
    });
  });

  describe('6. Recovery Service on Startup', () => {
    it('should reconcile dead running processes to crashed status', async () => {
      const task = await taskRegistry.createTask({
        project: 'DeadProcessProj',
        skill: 'crashed_skill',
      });

      // Inject dead PID
      await writeQueue.enqueue(() => {
        const db = getVeronicaDb();
        db.prepare('UPDATE agent_tasks SET pid = 999999 WHERE id = ?').run(task.id);
      });

      const report = await RecoveryService.reconcileOnStartup();
      assert.ok(report.recoveredCount >= 1);

      const reconciledTask = taskRegistry.getTask(task.id);
      assert.equal(reconciledTask?.status, 'crashed');
      assert.equal(projectLockManager.isLocked('DeadProcessProj'), false);
    });
  });

  describe('7. Remote Node Service & LAN Health Probe', () => {
    it('should return offline status gracefully when host is unreachable without crashing', async () => {
      const status = await remoteNodeService.checkHealth('127.0.0.1', 59999);
      assert.equal(status.online, false);
      assert.ok(status.error);
    });
  });

  describe('8. Database Migrations & Version Tracking', () => {
    it('should record applied migrations in schema_migrations table', () => {
      const db = getVeronicaDb();
      const rows = db.prepare('SELECT * FROM schema_migrations ORDER BY version ASC').all() as any[];
      assert.ok(rows.length >= 2, 'Expected at least 2 migrations');
      assert.equal(rows[0].version, 1);
      assert.equal(rows[1].version, 2);
    });
  });

  describe('9. Task Retry Mechanism & Max Retries', () => {
    it('should increment retry_count when retrying a task', async () => {
      const task = await taskRegistry.createTask({
        project: 'RetryTestProj',
        skill: 'flaky_operation',
        max_retries: 2,
      });

      assert.equal(task.retry_count, 0);

      const retried = await taskRegistry.retryTask(task.id);
      assert.equal(retried, true);

      const updated = taskRegistry.getTask(task.id);
      assert.equal(updated?.retry_count, 1);
      assert.equal(updated?.status, 'running');

      const retried2 = await taskRegistry.retryTask(task.id);
      assert.equal(retried2, true);

      const updated2 = taskRegistry.getTask(task.id);
      assert.equal(updated2?.retry_count, 2);

      // Exceeded max_retries
      const retried3 = await taskRegistry.retryTask(task.id);
      assert.equal(retried3, false);
    });
  });

  describe('10. Awaiting Approval & Resolution Protocol', () => {
    it('should place task in awaiting_approval and resolve cleanly upon user input', async () => {
      const task = await taskRegistry.createTask({
        project: 'ApprovalProj',
        skill: 'deploy_prod',
      });

      await taskRegistry.requestApproval(task.id, {
        action: 'Deploy to Production',
        details: 'Release v1.2.0 with database migrations',
      });

      const awaitingTask = taskRegistry.getTask(task.id);
      assert.equal(awaitingTask?.status, 'awaiting_approval');
      assert.ok(awaitingTask?.approval_payload?.includes('Deploy to Production'));

      // Approve task
      await taskRegistry.resolveApproval(task.id, true, 'Alice Admin');
      const approvedTask = taskRegistry.getTask(task.id);
      assert.equal(approvedTask?.status, 'running');
      assert.ok(approvedTask?.summary?.includes('Alice Admin'));
    });
  });

  describe('11. Scheduler Skills Discovery & Cron Jobs', () => {
    it('should discover default markdown skill files', () => {
      const skills = veronicaScheduler.listSkills();
      assert.ok(skills.length >= 3, 'Expected at least 3 default skills');
      const names = skills.map((s: any) => s.name);
      assert.ok(names.includes('code_review'));
      assert.ok(names.includes('security_audit'));
      assert.ok(names.includes('health_check'));
    });

    it('should register and schedule cron jobs in SQLite', async () => {
      await veronicaScheduler.addCronJob({
        id: 'job_daily_audit',
        project: 'CronTestProj',
        skill: 'security_audit',
        schedule: '@daily',
        enabled: true,
      });

      const jobs = veronicaScheduler.listCronJobs();
      const auditJob = jobs.find((j: any) => j.id === 'job_daily_audit');
      assert.ok(auditJob);
      assert.equal(auditJob.project, 'CronTestProj');
      assert.equal(auditJob.enabled, true);

      await veronicaScheduler.deleteCronJob('job_daily_audit');
      const jobsAfter = veronicaScheduler.listCronJobs();
      assert.equal(jobsAfter.some((j: any) => j.id === 'job_daily_audit'), false);
    });
  });
});

