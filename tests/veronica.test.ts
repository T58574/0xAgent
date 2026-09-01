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
import { initPersonas, listPersonas, getPersonaDetail } from '../server/personas';
import { antigravityAdapter, resolveAntigravityModelAndEffort, isAntigravityModel, VeronicaStreamEvent } from '../server/veronica/adapters/antigravityAdapter';
import { reloadVeronicaModule, getVeronicaStatus, shutdownVeronicaModule } from '../server/veronica';
import { createVeronicaRouter } from '../server/routes/veronicaRoutes';
import { operationalJournal } from '../server/veronica/core/operationalJournal';
import { taskPromptBuilder } from '../server/veronica/core/taskPromptBuilder';
import { buildFullSystemPrompt } from '../server/agent/promptBuilder';

describe('Module Veronica & Remote Node Architecture Test Suite', () => {
  const testDbDir = path.join(os.tmpdir(), '.0xagent_test_veronica_' + Date.now());
  const testDbPath = path.join(testDbDir, 'veronica.db');

  before(() => {
    fs.mkdirSync(testDbDir, { recursive: true });
    initVeronicaDatabase(testDbPath);
  });

  after(() => {
    shutdownVeronicaModule();
    closeVeronicaDatabase();
    try {
      fs.rmSync(testDbDir, { recursive: true, force: true });
    } catch {}
  });

  describe('1. Database Initialization & In-Memory Write Queue', () => {
    it('should initialize all required Veronica tables in WAL mode', () => {
      const db = getVeronicaDb();
      const tablesStmt = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('agent_tasks', 'agent_events', 'git_commits', 'projects', 'cron_jobs', 'project_snapshots', 'operational_journal', 'telegram_conversations', 'schema_version')"
      );
      const rows = tablesStmt.all() as any[];
      const names = rows.map((r) => r.name);

      assert.ok(names.includes('agent_tasks'), 'agent_tasks table missing');
      assert.ok(names.includes('agent_events'), 'agent_events table missing');
      assert.ok(names.includes('git_commits'), 'git_commits table missing');
      assert.ok(names.includes('projects'), 'projects table missing');
      assert.ok(names.includes('project_snapshots'), 'project_snapshots table missing');
      assert.ok(names.includes('operational_journal'), 'operational_journal table missing');
      assert.ok(names.includes('telegram_conversations'), 'telegram_conversations table missing');
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

  describe('5. Veronica CLI Handler & Operational Journal', () => {
    it('should process context CLI request with specialized flags', async () => {
      const res = await CliHandler.handleRequest({
        command: 'context',
        project: 'ProjectAlpha',
        recent: true,
        architecture: true,
      });
      assert.equal(res.success, true);
      assert.ok(typeof res.data === 'string');
      assert.ok(res.data.includes('PROJECT:ProjectAlpha'));
      assert.ok(res.data.includes('AUTONOMY:L2'));
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

    it('should process report CLI request and write to operational_journal', async () => {
      const task = await taskRegistry.createTask({
        project: 'CliTestProj',
        skill: 'refactor_skill',
      });

      const res = await CliHandler.handleRequest({
        command: 'report',
        task_id: task.id,
        project: 'CliTestProj',
        status: 'completed',
        summary: 'Refactored auth routes cleanly',
        changes: ['src/routes/auth.ts', 'tests/auth.test.ts'],
        important: true,
      });

      assert.equal(res.success, true);
      assert.equal(res.data.status, 'completed');
      assert.ok(res.data.journal_id);

      // Verify journal entry
      const history = operationalJournal.getHistory('CliTestProj', { limit: 5 });
      assert.ok(history.length >= 1);
      const entry = history.find((h) => h.summary.includes('Refactored auth routes'));
      assert.ok(entry);
      assert.equal(entry.status, 'completed');
      assert.equal(entry.important, true);
      assert.ok(Array.isArray(entry.changes));
      assert.equal(entry.changes?.[0], 'src/routes/auth.ts');
    });

    it('should record state updates via CLI state_update command', async () => {
      const res = await CliHandler.handleRequest({
        command: 'state_update',
        project: 'CliTestProj',
        summary: 'Updated project conversion indicator',
        metrics: { conversion: '15.4%' },
        important: true,
      });

      assert.equal(res.success, true);
      assert.ok(res.data.id);
    });

    it('should compute executive period digests via operationalJournal', () => {
      const digestToday = operationalJournal.getPeriodDigest('today');
      assert.ok(digestToday);
      assert.ok(typeof digestToday.completedCount === 'number');
      assert.ok(Array.isArray(digestToday.entries));
      assert.ok(Array.isArray(digestToday.importantHighlights));
    });

    it('should build rich autonomous task prompt via taskPromptBuilder', async () => {
      const prompt = await taskPromptBuilder.buildAutonomousTaskPrompt({
        project: 'ProjectAlpha',
        skill: 'feature_impl',
        custom_prompt: 'Add biometric login toggle',
        task_id: 'test-task-12345',
        autonomy_level: 'L3',
      });

      assert.ok(prompt.includes('Project: ProjectAlpha'));
      assert.ok(prompt.includes('Task ID: test-task-12345'));
      assert.ok(prompt.includes('Add biometric login toggle'));
      assert.ok(prompt.includes('0xagent veronica context'));
      assert.ok(prompt.includes('0xagent veronica report'));
      assert.ok(prompt.includes('[ORCHESTRATOR CLI PROTOCOL & INVARIANTS]'));
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
      assert.ok(rows.length >= 3, `Expected at least 3 migrations, got ${rows.length}`);
      assert.equal(rows[0].version, 1);
      assert.equal(rows[1].version, 2);
      assert.equal(rows[2].version, 3);
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
    it('should discover all default markdown skill files', () => {
      const skills = veronicaScheduler.listSkills();
      assert.ok(skills.length >= 10, `Expected at least 10 skills, got ${skills.length}`);
      const names = skills.map((s: any) => s.name);
      assert.ok(names.includes('code_review'));
      assert.ok(names.includes('security_audit'));
      assert.ok(names.includes('health_check'));
      assert.ok(names.includes('git_sync'));
      assert.ok(names.includes('architecture_audit'));
      assert.ok(names.includes('refactoring'));
      assert.ok(names.includes('test_generator'));
      assert.ok(names.includes('doc_sync'));
      assert.ok(names.includes('dependency_updater'));
      assert.ok(names.includes('incident_responder'));
    });

    it('should retrieve skill content correctly', () => {
      const content = veronicaScheduler.getSkillContent('code_review');
      assert.ok(content);
      assert.ok(content.includes('Skill: Automated Code Review'));
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

  describe('12. Veronica Persona Integration', () => {
    it('should seed Veronica persona with valid SOUL.md directives', () => {
      initPersonas();
      const personas = listPersonas();
      const veronica = personas.find((p: any) => p.id === 'veronica');
      assert.ok(veronica, 'Veronica persona should exist');
      assert.equal(veronica.name, 'Вероника (Veronica AI)');

      const detail = getPersonaDetail('veronica');
      assert.ok(detail);
      assert.ok(detail.soul.includes('Вероника'));
      assert.ok(detail.soul.includes('L0-L5'));
    });
  });

  describe('13. Antigravity Adapter & SSE / WebSocket Streaming Events', () => {
    it('should list available Antigravity models and specialized agents', () => {
      const models = antigravityAdapter.getAvailableAntigravityModels();
      assert.ok(models.length >= 7, 'Should have multiple Antigravity models');
      assert.ok(models.some((m) => m.slug === 'gemini-3.7-flash'));
      assert.ok(models.some((m) => m.slug === 'gemini-3.6-flash'));
      assert.ok(models.some((m) => m.slug === 'gemini-3.1-pro'));
      assert.ok(models.some((m) => m.slug === 'claude-sonnet-4-6'));

      const agents = antigravityAdapter.getAvailableAntigravityAgents();
      assert.ok(agents.length >= 6, 'Should list default and specialized agents');
      assert.ok(agents.some((a) => a.slug === 'critic'));
      assert.ok(agents.some((a) => a.slug === 'research'));
    });

    it('should buffer stream events and allow subscribers to receive live chunks', () => {
      const testTaskId = 'stream_test_' + Date.now();
      const receivedEvents: VeronicaStreamEvent[] = [];

      const unsubscribe = antigravityAdapter.subscribeTaskStream(testTaskId, (ev) => {
        receivedEvents.push(ev);
      });

      // Emit simulated chunks
      antigravityAdapter.emitStreamEvent({
        taskId: testTaskId,
        type: 'stdout',
        chunk: 'Analyzing files...',
        timestamp: Date.now(),
      });

      antigravityAdapter.emitStreamEvent({
        taskId: testTaskId,
        type: 'stdout',
        chunk: 'Generating patch...',
        timestamp: Date.now(),
      });

      antigravityAdapter.emitStreamEvent({
        taskId: testTaskId,
        type: 'end',
        status: 'completed',
        summary: 'All tasks completed successfully',
        timestamp: Date.now(),
      });

      unsubscribe();

      assert.equal(receivedEvents.length, 3);
      assert.equal(receivedEvents[0].chunk, 'Analyzing files...');
      assert.equal(receivedEvents[2].status, 'completed');

      // Verify buffer replay
      const buffer = antigravityAdapter.getTaskStreamBuffer(testTaskId);
      assert.equal(buffer.length, 3);
    });

    it('should broadcast events through setBroadcaster if registered', () => {
      const broadcastEvents: { event: string; payload: any }[] = [];
      antigravityAdapter.setBroadcaster((event, payload) => {
        broadcastEvents.push({ event, payload });
      });

      const testTaskId = 'broadcast_test_' + Date.now();
      antigravityAdapter.emitStreamEvent({
        taskId: testTaskId,
        type: 'status',
        status: 'running',
        chunk: 'Starting process',
        timestamp: Date.now(),
      });

      assert.ok(broadcastEvents.some((b) => b.event === 'veronica-stream-chunk'));
      assert.ok(broadcastEvents.some((b) => b.event === 'veronica-task-status'));
    });

    it('should resolve Antigravity model and effort cleanly without illegal effort flags', () => {
      // Claude & GPT-OSS never have effort
      const claudeSonnet = resolveAntigravityModelAndEffort('claude-sonnet-4-6', 'high');
      assert.equal(claudeSonnet.model, 'claude-sonnet-4-6');
      assert.equal(claudeSonnet.effort, undefined);

      const claudeOpus = resolveAntigravityModelAndEffort('claude-opus-4-6-thinking', 'medium');
      assert.equal(claudeOpus.model, 'claude-opus-4-6-thinking');
      assert.equal(claudeOpus.effort, undefined);

      const gptOss = resolveAntigravityModelAndEffort('gpt-oss-120b-medium', 'high');
      assert.equal(gptOss.model, 'gpt-oss-120b-medium');
      assert.equal(gptOss.effort, undefined);

      // Gemini 3.7 default is low
      const geminiDefault = resolveAntigravityModelAndEffort('gemini-3.7-flash');
      assert.equal(geminiDefault.model, 'gemini-3.7-flash-low');
      assert.equal(geminiDefault.effort, undefined);

      // Gemini 3.7 with high
      const geminiHigh = resolveAntigravityModelAndEffort('gemini-3.7-flash', 'high');
      assert.equal(geminiHigh.model, 'gemini-3.7-flash-high');
      assert.equal(geminiHigh.effort, undefined);

      // Gemini 3.1 Pro clamps medium to low
      const geminiProMedium = resolveAntigravityModelAndEffort('gemini-3.1-pro', 'medium');
      assert.equal(geminiProMedium.model, 'gemini-3.1-pro-low');
      assert.equal(geminiProMedium.effort, undefined);
    });

    it('should correctly classify Antigravity models vs local GGUF models', () => {
      assert.equal(isAntigravityModel('gemini-3.7-flash'), true);
      assert.equal(isAntigravityModel('claude-sonnet-4-6'), true);
      assert.equal(isAntigravityModel('antigravity:inherit'), true);
      assert.equal(isAntigravityModel('inherit'), true);
      assert.equal(isAntigravityModel('agy'), true);
      assert.equal(isAntigravityModel(null, 'veronica'), true);

      assert.equal(isAntigravityModel('local:qwen2.5-coder-32b.gguf'), false);
      assert.equal(isAntigravityModel('my-model.gguf'), false);
    });

    it('should build clean system prompt without 23 XML tools when Antigravity model is selected', () => {
      const agyConfig: any = {
        model_name: 'gemini-3.7-flash',
        workspace_dir: 'C:\\test\\workspace',
      };
      const agyPrompt = buildFullSystemPrompt(agyConfig);

      // Antigravity prompt should contain persona & environment, Veronica CLI protocol, but NOT 23 XML tool specifications or approval gates
      assert.ok(agyPrompt.includes('# CONVERSATION & LANGUAGE STANDARD:'));
      assert.ok(agyPrompt.includes('# AGENT PERSONA:'));
      assert.ok(agyPrompt.includes('# SYSTEM ENVIRONMENT'));
      assert.ok(agyPrompt.includes('# 0XAGENT & VERONICA CLI PROTOCOL'));
      assert.ok(!agyPrompt.includes('TOOL REGISTRY & XML SPECIFICATION'), 'Should not contain XML tool registry for Antigravity');
      assert.ok(!agyPrompt.includes('TWO-TIER APPROVAL & INTERACTION PROTOCOL'), 'Should not contain Two-Tier approval gate for Antigravity');
      assert.ok(!agyPrompt.includes('<patch_file'), 'Should not contain <patch_file> specs for Antigravity');
      assert.ok(!agyPrompt.includes('<read_file'), 'Should not contain <read_file> specs for Antigravity');

      // Local GGUF prompt MUST retain full tool registry
      const localConfig: any = {
        model_name: 'local:qwen2.5-coder-32b.gguf',
        workspace_dir: 'C:\\test\\workspace',
      };
      const localPrompt = buildFullSystemPrompt(localConfig);
      assert.ok(localPrompt.includes('TOOL REGISTRY & XML SPECIFICATION'), 'Should contain XML tool registry for local GGUF');
      assert.ok(localPrompt.includes('TWO-TIER APPROVAL & INTERACTION PROTOCOL'), 'Should contain Two-Tier approval gate for local GGUF');
      assert.ok(localPrompt.includes('<patch_file'), 'Should contain <patch_file> for local GGUF');
    });
  });

  describe('14. Graceful Hot-Reload Invariant', () => {
    it('should reload Veronica module gracefully without throwing or breaking status', async () => {
      const reloadRes = await reloadVeronicaModule();
      assert.equal(reloadRes.success, true);
      assert.ok(reloadRes.status.db_healthy, 'DB should remain healthy after hot-reload');
      assert.equal(typeof reloadRes.timestamp, 'number');

      const status = getVeronicaStatus();
      assert.equal(status.enabled, true);
      assert.equal(status.db_healthy, true);
    });

    it('should create valid router with createVeronicaRouter', () => {
      const router = createVeronicaRouter(() => {});
      assert.ok(router);
      assert.equal(typeof router.use, 'function');
    });
  });
});

