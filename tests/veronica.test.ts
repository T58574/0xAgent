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
import { antigravityAdapter, resolveAntigravityModelAndEffort, isAntigravityModel, VeronicaStreamEvent, parseAgyModelsOutput, DEFAULT_ANTIGRAVITY_MODELS } from '../server/veronica/adapters/antigravityAdapter';
import { reloadVeronicaModule, getVeronicaStatus, shutdownVeronicaModule } from '../server/veronica';
import { createVeronicaRouter } from '../server/routes/veronicaRoutes';
import { operationalJournal } from '../server/veronica/core/operationalJournal';
import { taskPromptBuilder } from '../server/veronica/core/taskPromptBuilder';
import { buildFullSystemPrompt } from '../server/agent/promptBuilder';
import { VeronicaOrchestrator } from '../server/veronica/telegram/veronicaOrchestrator';
import { getDefaultConfig } from '../server/config';
import { voiceThoughtService } from '../server/veronica/telegram/voiceThoughtService';
import { markdownToTelegramHtml, extractButtonsToInlineKeyboard, handleResponseAttachments, splitHtmlIntoBalancedChunks } from '../server/veronica/telegram/handlers/telegramUtils';
import { notificationService } from '../server/veronica/telegram/notificationService';
import { StreamingOutputCollector, readSpillFile, getSpillFilePath, handleOutputSpill } from '../server/agent/outputSpiller';

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
      await taskRegistry.updateTaskStatus(task.id, 'completed');
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
      await taskRegistry.updateTaskStatus(task.id, 'completed');
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
      const origFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        throw new Error('connect ECONNREFUSED 127.0.0.1:59999');
      };
      try {
        const status = await remoteNodeService.checkHealth('127.0.0.1', 59999);
        assert.equal(status.online, false);
        assert.ok(status.error);
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('should return online status when remote node endpoint responds successfully', async () => {
      const origFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ slots_total: 4, slots_idle: 4, model: 'qwen2.5-coder' }),
      } as any);
      try {
        const status = await remoteNodeService.checkHealth('127.0.0.1', 11434);
        assert.equal(status.online, true);
        assert.equal(status.slotsTotal, 4);
        assert.equal(status.slotsIdle, 4);
        assert.equal(status.model, 'qwen2.5-coder');
      } finally {
        globalThis.fetch = origFetch;
      }
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
    let origSpawnTask: typeof antigravityAdapter.spawnTask;

    before(() => {
      origSpawnTask = antigravityAdapter.spawnTask;
      antigravityAdapter.spawnTask = async (options: any) => {
        return (taskRegistry.getTask(options.existing_task_id) || { id: options.existing_task_id, status: 'running' }) as any;
      };
    });

    after(() => {
      antigravityAdapter.spawnTask = origSpawnTask;
    });

    it('should increment retry_count when retrying a task', async () => {
      const task = await taskRegistry.createTask({
        project: 'RetryTestProj',
        skill: 'flaky_operation',
        max_retries: 2,
      });

      assert.equal(task.retry_count, 0);

      // Verify conversation checkpointing
      await taskRegistry.checkpointConversationId(task.id, 'convo-checkpoint-xyz');
      const taskWithCheck = taskRegistry.getTask(task.id);
      assert.ok(taskWithCheck?.result_json?.includes('convo-checkpoint-xyz'), 'Checkpoint should be persisted in result_json');

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
      await taskRegistry.updateTaskStatus(task.id, 'completed');
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
      await taskRegistry.updateTaskStatus(task.id, 'completed');
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

    it('should parse various schedule formats correctly via parseSimpleSchedule', () => {
      assert.equal(veronicaScheduler.parseSimpleSchedule('@hourly'), 3600000);
      assert.equal(veronicaScheduler.parseSimpleSchedule('@daily'), 86400000);
      assert.equal(veronicaScheduler.parseSimpleSchedule('@weekly'), 604800000);
      assert.equal(veronicaScheduler.parseSimpleSchedule('@monthly'), 2592000000);
      assert.equal(veronicaScheduler.parseSimpleSchedule('every_15m'), 900000);
      assert.equal(veronicaScheduler.parseSimpleSchedule('every_2h'), 7200000);
      assert.equal(veronicaScheduler.parseSimpleSchedule('30 mins'), 1800000);
      assert.equal(veronicaScheduler.parseSimpleSchedule('4 hours'), 14400000);
      assert.equal(veronicaScheduler.parseSimpleSchedule('*/20 * * * *'), 1200000);
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
      assert.equal(isAntigravityModel('local:ornith-1.5-9b-crack-q8_0.gguf', 'veronica'), false);
      assert.equal(isAntigravityModel('Ornith-1.5-9B-CRACK-Q8_0.gguf', 'veronica'), false);
      assert.equal(resolveAntigravityModelAndEffort('local:ornith-1.5-9b-crack-q8_0.gguf').model, undefined);
      assert.equal(resolveAntigravityModelAndEffort('Ornith-1.5-9B-CRACK-Q8_0.gguf').model, undefined);
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

    it('should maintain and reset Antigravity conversation ID in VeronicaOrchestrator user sessions', () => {
      const orchestrator = VeronicaOrchestrator.getInstance();
      const testUserId = 99887766;

      const userSession = orchestrator.getUserSession(testUserId);
      assert.equal(userSession.antigravityConversationId, undefined);

      // Simulate first turn capturing conversation ID
      userSession.antigravityConversationId = 'conv-test-uuid-1234';
      assert.equal(orchestrator.getUserSession(testUserId).antigravityConversationId, 'conv-test-uuid-1234');

      // Resetting session should clear antigravityConversationId
      orchestrator.resetSession(testUserId);
      assert.equal(orchestrator.getUserSession(testUserId).antigravityConversationId, undefined);
    });

    it('should parse agy models output into grouped families and raw models list', () => {
      const mockCliOutput = `
Fetching available models...
gemini-3.8-flash-high\tGemini 3.8 Flash (High)
gemini-3.8-flash-medium\tGemini 3.8 Flash (Medium)
gemini-3.8-flash-low\tGemini 3.8 Flash (Low)
gemini-3.7-flash-high\tGemini 3.7 Flash (High)
gemini-3.7-flash-low\tGemini 3.7 Flash (Low)
claude-sonnet-4-6\tClaude Sonnet 4.6 (Thinking)
gpt-oss-120b-medium\tGPT-OSS 120B (Medium)
`;
      const parsed = parseAgyModelsOutput(mockCliOutput);

      assert.ok(parsed.models.length >= 4);
      assert.ok(parsed.rawModels.length >= 7);

      // Check Gemini 3.8 Flash family
      const g38 = parsed.models.find((m) => m.slug === 'gemini-3.8-flash');
      assert.ok(g38, 'Should extract gemini-3.8-flash family');
      assert.deepEqual(g38.supportedEfforts, ['low', 'medium', 'high']);
      assert.equal(g38.name, 'Gemini 3.8 Flash');

      // Check Claude Sonnet standalone
      const claude = parsed.models.find((m) => m.slug === 'claude-sonnet-4-6');
      assert.ok(claude, 'Should extract claude-sonnet-4-6');
      assert.deepEqual(claude.supportedEfforts, []);

      // Check inherit model presence
      assert.ok(parsed.models.some((m) => m.slug === 'inherit'));
      assert.ok(parsed.rawModels.some((m) => m.slug === 'inherit'));
    });

    it('should resolve Gemini 3.8 Flash models with effort or encoded slug', () => {
      const g38High = resolveAntigravityModelAndEffort('gemini-3.8-flash', 'high');
      assert.equal(g38High.model, 'gemini-3.8-flash-high');
      assert.equal(g38High.effort, undefined);

      const g38Direct = resolveAntigravityModelAndEffort('gemini-3.8-flash-medium');
      assert.equal(g38Direct.model, 'gemini-3.8-flash-medium');
      assert.equal(g38Direct.effort, undefined);
    });

    it('should provide fallback default models and raw models list', () => {
      const models = antigravityAdapter.getAvailableAntigravityModels();
      assert.ok(models.some((m) => m.slug === 'gemini-3.8-flash'));

      const rawModels = antigravityAdapter.getAvailableRawAntigravityModels();
      assert.ok(rawModels.length >= 7);
      assert.ok(rawModels.some((m) => m.slug.includes('3.8') || m.slug.includes('3.7')));
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
      assert.equal(typeof status.today_completed, 'number');
      assert.equal(typeof status.today_failed, 'number');
      assert.ok(status.today_completed >= 0);
      assert.ok(status.today_failed >= 0);

      const stats = taskRegistry.getTodayTaskStats();
      assert.equal(typeof stats.completed, 'number');
      assert.equal(typeof stats.failed, 'number');
      assert.equal(status.today_completed, stats.completed);
      assert.equal(status.today_failed, stats.failed);
    });

    it('should create valid router with createVeronicaRouter', () => {
      const router = createVeronicaRouter(() => {});
      assert.ok(router);
      assert.equal(typeof router.use, 'function');
    });

    it('should handle GET /tasks and GET /tasks/:id via router', async () => {
      const created = await taskRegistry.createTask({
        project: 'route-test-proj',
        task_description: 'Test router tasks endpoint',
      });

      const router = createVeronicaRouter(() => {});

      let tasksJson: any = null;
      const mockReqTasks: any = {
        method: 'GET',
        url: '/tasks?project=route-test-proj',
        query: { project: 'route-test-proj' },
        headers: {},
      };
      const mockResTasks: any = {
        json: (data: any) => { tasksJson = data; return mockResTasks; },
        status: () => mockResTasks,
      };

      await new Promise<void>((resolve) => {
        router.handle(mockReqTasks, mockResTasks, () => resolve());
        resolve();
      });

      assert.ok(tasksJson, 'GET /tasks should return JSON response');
      assert.ok(Array.isArray(tasksJson.tasks), 'tasks should be an array');
      assert.ok(tasksJson.tasks.some((t: any) => t.id === created.id));

      let taskDetailJson: any = null;
      const mockReqDetail: any = {
        method: 'GET',
        url: `/tasks/${created.id}`,
        params: { id: created.id },
        headers: {},
      };
      const mockResDetail: any = {
        json: (data: any) => { taskDetailJson = data; return mockResDetail; },
        status: () => mockResDetail,
      };

      await new Promise<void>((resolve) => {
        router.handle(mockReqDetail, mockResDetail, () => resolve());
        resolve();
      });

      assert.ok(taskDetailJson, 'GET /tasks/:id should return JSON response');
      assert.equal(taskDetailJson.task?.id, created.id);
      assert.equal(taskDetailJson.task?.project, 'route-test-proj');
    });
  });

  describe('15. Speech-To-Text (STT) Engine Selection & Configuration', () => {
    it('should define default stt_engine as auto in default config', () => {
      const config = getDefaultConfig();
      assert.equal(config.veronica?.stt_engine, 'auto');
    });

    it('should support explicit stt_engine choices in VeronicaConfig', () => {
      const engines = ['auto', 'local', 'groq', 'vosk'] as const;
      for (const eng of engines) {
        const customConfig = {
          ...getDefaultConfig(),
          veronica: {
            ...getDefaultConfig().veronica,
            stt_engine: eng,
          },
        };
        assert.equal(customConfig.veronica.stt_engine, eng);
      }
    });

    it('should instantiate VoiceThoughtService and expose transcribeAudio method', () => {
      assert.ok(voiceThoughtService);
      assert.equal(typeof voiceThoughtService.transcribeAudio, 'function');
      assert.equal(typeof voiceThoughtService.downloadTelegramAudio, 'function');
      assert.equal(typeof voiceThoughtService.structureThought, 'function');
    });
  });

  describe('16. Telegram Modern Markdown & Deduplication Invariants', () => {
    it('should convert modern rich markdown to Telegram HTML formatting', () => {
      const input = `### Заголовок
**Жирный текст** и *курсив*.
Код в строке: \`npm test\` и ссылка: [Telegram](https://telegram.org).
> Это блок цитаты
**> Это раскрываемая цитата
\`\`\`ts
const answer = 42;
\`\`\``;

      const html = markdownToTelegramHtml(input);
      assert.ok(html.includes('<b>Заголовок</b>'), 'Header conversion failed');
      assert.ok(html.includes('<b>Жирный текст</b>'), 'Bold conversion failed');
      assert.ok(html.includes('<i>курсив</i>'), 'Italic conversion failed');
      assert.ok(html.includes('<code>npm test</code>'), 'Inline code conversion failed');
      assert.ok(html.includes('<a href="https://telegram.org">Telegram</a>'), 'Link conversion failed');
      assert.ok(html.includes('<blockquote>Это блок цитаты</blockquote>'), 'Blockquote conversion failed');
      assert.ok(html.includes('<blockquote expandable>Это раскрываемая цитата</blockquote>'), 'Expandable blockquote failed');
      assert.ok(html.includes('<pre><code class="language-ts">const answer = 42;</code></pre>'), 'Code block failed');
    });

    it('should format markdown tables into Telegram card bullets and escape stray tags', () => {
      const input = `| Параметр | Значение | Описание |
| :--- | :--- | :--- |
| **Model** | \`gemini-3.8\` | Основная модель |
| **Effort** | \`medium\` | Баланс скорости |

Список задач:
* **Пункт 1** с тегом <continue> и <10 КБ
* **Пункт 2** без ошибок
---`;

      const html = markdownToTelegramHtml(input);
      assert.ok(html.includes('• <b>Model</b>'), 'Table row 1 title failed');
      assert.ok(html.includes('▫️ <i>Значение:</i> <code>gemini-3.8</code>'), 'Table row 1 column failed');
      assert.ok(html.includes('• <b>Пункт 1</b>'), 'List bullet conversion failed');
      assert.ok(!html.includes('<continue>'), 'Stray tag <continue> should be escaped');
      assert.ok(html.includes('&lt;continue&gt;'), 'Stray tag should be escaped as &lt;continue&gt;');
      assert.ok(html.includes('━━━━━━━━━━━━━━━━━━━━━━'), 'Divider conversion failed');
    });

    it('should balance open HTML tags across message chunk splits', () => {
      const longText = '<b>' + 'A'.repeat(2500) + '</b> <i>' + 'B'.repeat(2500) + '</i>';
      const chunks = splitHtmlIntoBalancedChunks(longText, 3000);
      assert.ok(chunks.length >= 2, 'Should split into at least 2 chunks');
      for (const chunk of chunks) {
        const opens = (chunk.match(/<([a-z0-9]+)>/gi) || []).length;
        const closes = (chunk.match(/<\/([a-z0-9]+)>/gi) || []).length;
        assert.equal(opens, closes, `Chunk has unbalanced HTML tags: ${chunk.substring(0, 50)}...`);
      }
    });

    it('should convert markdown in-text buttons and wrap consecutive buttons into button rows', () => {
      const input = `Выберите действие:
[🔄 Продолжить](btn:veronica:continue:123) [📁 Проекты](btn:veronica:projects_menu)
[🌐 Документация](btn-url:https://telegram.org)
[📋 Скопировать](copy:git status)`;

      const html = markdownToTelegramHtml(input);
      assert.ok(html.includes('<tg-button type="callback_data" data="veronica:continue:123">🔄 Продолжить</tg-button>'), 'Callback button failed');
      assert.ok(html.includes('<tg-button type="callback_data" data="veronica:projects_menu">📁 Проекты</tg-button>'), 'Second callback button failed');
      assert.ok(html.includes('<tg-button-row align="center">'), 'Button row wrap failed');
      assert.ok(html.includes('<tg-button type="url" url="https://telegram.org">🌐 Документация</tg-button>'), 'URL button failed');
      assert.ok(html.includes('<tg-button type="copy_text" text="git status">📋 Скопировать</tg-button>'), 'Copy text button failed');
    });

    it('should extract in-text buttons into standard InlineKeyboard for backward compatibility fallback', () => {
      const html = `Информация по задаче
<tg-button-row align="center">
  <tg-button type="callback_data" data="veronica:continue:abc">🔄 Продолжить</tg-button>
  <tg-button type="url" url="https://github.com">🌐 GitHub</tg-button>
</tg-button-row>`;

      const extracted = extractButtonsToInlineKeyboard(html);
      assert.ok(!extracted.cleanedHtml.includes('<tg-button'), 'Buttons should be stripped from cleaned HTML');
      assert.ok(!extracted.cleanedHtml.includes('<tg-button-row'), 'Row tags should be stripped');
      assert.ok(extracted.keyboard !== undefined, 'Keyboard should be extracted');
    });

    it('should detect and handle file attachment directives in Veronica output', async () => {
      const tmpFile = path.join(os.tmpdir(), `veronica_test_${Date.now()}.txt`);
      fs.writeFileSync(tmpFile, 'Test attachment content');

      const mockCtx: any = {
        chat: { id: 12345 },
        replyWithDocument: async (doc: any, opts: any) => {
          return { message_id: 1, doc, opts };
        },
      };

      const replyWithAttachment = `Вот результат проверки: [file: ${tmpFile}]`;
      const processed = await handleResponseAttachments(mockCtx, replyWithAttachment);

      assert.ok(!processed.includes(`[file: ${tmpFile}]`), 'Directive should be replaced');
      assert.ok(processed.includes('отправлен во вложении'), 'Attachment notice should be present');

      try { fs.unlinkSync(tmpFile); } catch {}
    });

    it('should deduplicate completed task notifications', () => {
      const testTaskId = 'test-dedup-task-' + Date.now();
      assert.equal(notificationService.isTaskNotified(testTaskId), false);

      notificationService.markTaskNotified(testTaskId);
      assert.equal(notificationService.isTaskNotified(testTaskId), true);

      notificationService.resetTaskNotification(testTaskId);
      assert.equal(notificationService.isTaskNotified(testTaskId), false);
    });
  });

  describe('17. Task Checkpoints, Granular Resume & Streaming Spiller Invariants', () => {
    it('should build a granular resume prompt that bypasses Phase 1 reconnaissance', () => {
      const resumePrompt = taskPromptBuilder.buildResumeTaskPrompt({
        project: '0xAgent',
        task_id: 'abc-123-uuid',
        custom_prompt: 'Исправить баг в парсере',
        previous_summary: 'Найдена причина сбоя в строке 42',
        checkpoint_info: 'Выполнено 5 шагов',
      });

      assert.ok(resumePrompt.includes('[VERONICA TASK RESUMPTION PROTOCOL]'), 'Header missing');
      assert.ok(resumePrompt.includes('Task ID: abc-123-uuid'), 'Task ID missing');
      assert.ok(resumePrompt.includes('DO NOT RESTART FROM SCRATCH'), 'Continuation directive missing');
      assert.ok(resumePrompt.includes('Prior Progress: Найдена причина сбоя в строке 42'), 'Previous progress missing');
      assert.ok(!resumePrompt.includes('PHASE 1: RECONNAISSANCE'), 'Should not contain initial reconnaissance phase');
    });

    it('should format Cyrillic italics with typography punctuation and model thoughts', () => {
      const input = `Параметры:
*курсив*: значение;
«*цитата*» и [*ссылка*]
<think>Внутренние размышления модели</think>
\`\`\`ts const x = 1;\`\`\``;

      const html = markdownToTelegramHtml(input);
      assert.ok(html.includes('<i>курсив</i>:'), 'Italic before colon failed');
      assert.ok(html.includes('«<i>цитата</i>»'), 'Italic in Cyrillic quotes failed');
      assert.ok(html.includes('[<i>ссылка</i>]'), 'Italic in brackets failed');
      assert.ok(html.includes('<blockquote expandable>'), 'Model thought blockquote missing');
      assert.ok(html.includes('💭 Внутренние размышления модели'), 'Thought text missing');
      assert.ok(html.includes('<pre><code class="language-ts">const x = 1;</code></pre>'), 'Single-line code block failed');
    });

    it('should stream large output and automatically spill to disk when exceeding 10 KB threshold', async () => {
      const collector = new StreamingOutputCollector('test_tool', 10 * 1024);

      // Generate 25 KB of line data
      for (let i = 0; i < 500; i++) {
        collector.append(`Line ${i}: Some detailed operational telemetry log entry with extra details\n`);
      }

      const result = await collector.finalize();
      assert.equal(result.spilled, true, 'Output exceeding 10 KB should be spilled');
      assert.ok(result.originalSize > 10 * 1024, 'Original size should exceed 10 KB');
      assert.ok(result.filePath && fs.existsSync(result.filePath), 'Spill file should exist on disk');
      assert.ok(result.output.includes('ВЫВОД СОКРАЩЕН'), 'Omission marker should be present');
      assert.ok(result.output.includes('ПОЛНЫЙ ЛОГ СОХРАНЕН В:'), 'Path marker should be present');
      assert.ok(result.output.includes('Line 0:'), 'Head lines should be preserved');
      assert.ok(result.output.includes('Line 499:'), 'Tail lines should be preserved');

      // Cleanup
      if (result.filePath) {
        try { fs.unlinkSync(result.filePath); } catch {}
      }
    });

    it('should handle <continue> user command by resuming last task context', async () => {
      const orchestrator = VeronicaOrchestrator.getInstance();
      const testUser = 999888;
      orchestrator.resetSession(testUser);

      // 1. Sending <continue> without prior task informs the user cleanly
      const noTaskReply = await orchestrator.handleUserMessage(testUser, '<continue>');
      assert.ok(noTaskReply.includes('Нет предыдущей задачи для продолжения'), 'Should report no task');

      // 2. Mock a previous task in session
      const testTask = await taskRegistry.createTask({
        project: '0xAgent',
        skill: 'custom_task',
        custom_prompt: 'Исходная задача',
      });
      await taskRegistry.checkpointConversationId(testTask.id, 'convo-checkpoint-xyz');

      const session = orchestrator.getUserSession(testUser);
      session.lastTaskId = testTask.id;
      session.lastTaskProject = '0xAgent';
      orchestrator.persistSessionMeta(session);

      // 3. User sends <continue>
      const continueReply = await orchestrator.handleUserMessage(testUser, '<continue>');
      assert.ok(continueReply.includes('Возобновляю задачу'), 'Should report resuming task');
      assert.ok(continueReply.includes(testTask.id.substring(0, 8)), 'Should include task ID');
      assert.ok(continueReply.includes('Контекст и чекпоинт диалога Antigravity сохранены'), 'Checkpoint notice missing');
    });

    it('should resume task via taskRegistry.resumeTask and reset retry_count', async () => {
      projectLockManager.releaseGlobalLock();
      const task = await taskRegistry.createTask({
        project: 'test-resume-proj',
        skill: 'code_review',
        custom_prompt: 'Начальный анализ',
      });
      await taskRegistry.checkpointConversationId(task.id, 'convo-test-resume-123');
      await taskRegistry.updateTaskStatus(task.id, 'failed', { error_message: 'Mock network drop' });

      // Verify it is failed
      const failedTask = taskRegistry.getTask(task.id);
      assert.equal(failedTask?.status, 'failed');

      // Now resume with follow-up prompt
      const resumed = await taskRegistry.resumeTask(task.id, 'Исправь замечания и заверши');
      assert.ok(resumed);
      assert.equal(resumed?.id, task.id);
      assert.equal(resumed?.project, 'test-resume-proj');
      assert.equal(resumed?.custom_prompt, 'Исправь замечания и заверши');
      assert.equal(resumed?.retry_count, 0);

      const refreshedTask = taskRegistry.getTask(task.id);
      assert.equal(refreshedTask?.retry_count, 0);
      assert.equal(refreshedTask?.custom_prompt, 'Исправь замечания и заверши');
      projectLockManager.releaseGlobalLock(task.id);
    });

    it('should route POST /tasks/:id/resume through Express router', async () => {
      projectLockManager.releaseGlobalLock();
      const task = await taskRegistry.createTask({
        project: 'route-resume-proj',
        skill: 'audit',
        custom_prompt: 'Проверка безопасности',
      });
      await taskRegistry.checkpointConversationId(task.id, 'convo-route-resume-abc');

      const router = createVeronicaRouter(() => {});
      let resumeResponse: any = null;
      let statusCode = 200;

      const mockReq: any = {
        method: 'POST',
        url: `/tasks/${task.id}/resume`,
        params: { id: task.id },
        body: { custom_prompt: 'Продолжай аудит дальше' },
        headers: {},
      };

      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 1000);
        const mockRes: any = {
          json: (data: any) => {
            resumeResponse = data;
            clearTimeout(timer);
            resolve();
            return mockRes;
          },
          status: (code: number) => {
            statusCode = code;
            return mockRes;
          },
        };
        router.handle(mockReq, mockRes, () => {
          clearTimeout(timer);
          resolve();
        });
      });

      projectLockManager.releaseGlobalLock(task.id);

      assert.equal(statusCode, 200);
      assert.ok(resumeResponse);
      assert.equal(resumeResponse.success, true);
      assert.equal(resumeResponse.task?.id, task.id);
      assert.equal(resumeResponse.task?.project, 'route-resume-proj');
    });

    it('should queue resumed task when system is already executing another task (global sequential concurrency = 1)', async () => {
      projectLockManager.releaseGlobalLock();

      // 1. Create and start a primary task that holds the global lock
      const primaryTask = await taskRegistry.createTask({
        project: 'busy-project',
        skill: 'heavy_task',
      });
      assert.equal(projectLockManager.isGlobalLocked(), true);
      assert.equal(projectLockManager.getActiveGlobalTask(), primaryTask.id);

      // 2. Create another task in another project
      const secondaryTask = await taskRegistry.createTask({
        project: 'secondary-project',
        skill: 'secondary_task',
      });
      assert.equal(secondaryTask.status, 'queued');

      // Now resume secondaryTask explicitly
      const resumedSecondary = await taskRegistry.resumeTask(secondaryTask.id, 'Попытка возобновить пока занято');
      assert.ok(resumedSecondary);
      assert.equal(resumedSecondary?.status, 'queued');

      // 3. Clean up locks
      projectLockManager.releaseGlobalLock(primaryTask.id);
      projectLockManager.releaseGlobalLock(secondaryTask.id);
      projectLockManager.releaseGlobalLock();
    });
  });

  describe('26. Agent Events Timeline & Spill Log Delivery', () => {
    it('should retrieve task events chronologically and respect limit', async () => {
      projectLockManager.releaseGlobalLock();
      const task = await taskRegistry.createTask({
        project: 'events-timeline-proj',
        skill: 'event_test',
      });

      // Record multiple heartbeats / events
      await taskRegistry.recordHeartbeat(task.id, 'Step 1: Init', '10%');
      await taskRegistry.recordHeartbeat(task.id, 'Step 2: Progress', '50%');
      await taskRegistry.recordHeartbeat(task.id, 'Step 3: Done', '100%');

      const allEvents = taskRegistry.getTaskEvents(task.id);
      assert.ok(allEvents.length >= 3, 'Should have at least 3 events');

      // Verify chronological ordering (timestamp ASC)
      for (let i = 1; i < allEvents.length; i++) {
        assert.ok(
          allEvents[i].timestamp >= allEvents[i - 1].timestamp,
          'Events must be sorted chronologically ASC'
        );
      }

      // Verify limit
      const limitedEvents = taskRegistry.getTaskEvents(task.id, 2);
      assert.equal(limitedEvents.length, 2);

      projectLockManager.releaseGlobalLock(task.id);
      projectLockManager.releaseGlobalLock();
    });

    it('should route GET /tasks/:id/events through Express router', async () => {
      projectLockManager.releaseGlobalLock();
      const task = await taskRegistry.createTask({
        project: 'route-events-proj',
        skill: 'events_route',
      });
      await taskRegistry.recordHeartbeat(task.id, 'Checking system health', '30%');

      const router = createVeronicaRouter(() => {});
      let eventsResponse: any = null;
      let statusCode = 200;

      const mockReq: any = {
        method: 'GET',
        url: `/tasks/${task.id}/events`,
        params: { id: task.id },
        query: { limit: '10' },
        headers: {},
      };

      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 1000);
        const mockRes: any = {
          json: (data: any) => {
            eventsResponse = data;
            clearTimeout(timer);
            resolve();
            return mockRes;
          },
          status: (code: number) => {
            statusCode = code;
            return mockRes;
          },
        };
        router.handle(mockReq, mockRes, () => {
          clearTimeout(timer);
          resolve();
        });
      });

      projectLockManager.releaseGlobalLock(task.id);
      projectLockManager.releaseGlobalLock();

      assert.equal(statusCode, 200);
      assert.ok(eventsResponse);
      assert.equal(eventsResponse.success, true);
      assert.equal(eventsResponse.taskId, task.id);
      assert.ok(Array.isArray(eventsResponse.events));
      assert.ok(eventsResponse.events.length >= 1);
    });

    it('should enforce strict path traversal protection on spill files', async () => {
      // Relative traversals
      assert.equal(await getSpillFilePath('../secret.log'), null);
      assert.equal(await getSpillFilePath('../../etc/passwd.log'), null);
      assert.equal(await getSpillFilePath('..\\windows\\system32.log'), null);

      // Disallowed extensions
      assert.equal(await getSpillFilePath('test.txt'), null);
      assert.equal(await getSpillFilePath('test.json'), null);
      assert.equal(await getSpillFilePath('test.sh'), null);
      assert.equal(await getSpillFilePath(''), null);

      // Non-existent file
      const nonExistent = await readSpillFile('non_existent_random_file_999.log');
      assert.equal(nonExistent, null);
    });

    it('should persist spilled output, read it via readSpillFile, and serve via Express router', async () => {
      // 1. Generate spilled file (>10 KB)
      const bigContent = 'Log line sample :: ' + 'X'.repeat(100) + '\n';
      const repeatedContent = bigContent.repeat(120); // ~14 KB
      const spillResult = await handleOutputSpill(repeatedContent, 'veronica_test', 5000);

      assert.equal(spillResult.spilled, true);
      assert.ok(spillResult.filePath);
      const fileName = path.basename(spillResult.filePath!);

      // 2. Read back via readSpillFile
      const readResult = await readSpillFile(fileName);
      assert.ok(readResult);
      assert.equal(readResult.fileName, fileName);
      assert.equal(readResult.content, repeatedContent);
      assert.ok(readResult.size > 10000);

      const router = createVeronicaRouter(() => {});

      // 3. Test GET /spill/:fileName (JSON preview)
      let previewResponse: any = null;
      let previewStatus = 200;
      const previewReq: any = {
        method: 'GET',
        url: `/spill/${fileName}`,
        params: { fileName },
        query: {},
        headers: {},
      };

      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 1000);
        const mockRes: any = {
          json: (data: any) => {
            previewResponse = data;
            clearTimeout(timer);
            resolve();
            return mockRes;
          },
          status: (code: number) => {
            previewStatus = code;
            return mockRes;
          },
        };
        router.handle(previewReq, mockRes, () => {
          clearTimeout(timer);
          resolve();
        });
      });

      assert.equal(previewStatus, 200);
      assert.ok(previewResponse);
      assert.equal(previewResponse.success, true);
      assert.equal(previewResponse.fileName, fileName);
      assert.equal(previewResponse.content, repeatedContent);

      // 4. Test GET /spill/:fileName?download=1 (Attachment stream)
      let downloadedBody: any = null;
      let downloadStatus = 200;
      const responseHeaders: Record<string, string> = {};
      const downloadReq: any = {
        method: 'GET',
        url: `/spill/${fileName}?download=1`,
        params: { fileName },
        query: { download: '1' },
        headers: {},
      };

      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 1000);
        const mockRes: any = {
          setHeader: (k: string, v: string) => {
            responseHeaders[k.toLowerCase()] = v;
            return mockRes;
          },
          send: (body: any) => {
            downloadedBody = body;
            clearTimeout(timer);
            resolve();
            return mockRes;
          },
          status: (code: number) => {
            downloadStatus = code;
            return mockRes;
          },
        };
        router.handle(downloadReq, mockRes, () => {
          clearTimeout(timer);
          resolve();
        });
      });

      assert.equal(downloadStatus, 200);
      assert.equal(downloadedBody, repeatedContent);
      assert.ok(responseHeaders['content-disposition']?.includes('attachment;'));
      assert.ok(responseHeaders['content-type']?.includes('text/plain'));

      // 5. Test GET /spill/:fileName 404 on path traversal attempt
      let traversalStatus = 200;
      let traversalResponse: any = null;
      const traversalReq: any = {
        method: 'GET',
        url: '/spill/..%2Fsecret.log',
        params: { fileName: '../secret.log' },
        query: {},
        headers: {},
      };

      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 1000);
        const mockRes: any = {
          json: (data: any) => {
            traversalResponse = data;
            clearTimeout(timer);
            resolve();
            return mockRes;
          },
          status: (code: number) => {
            traversalStatus = code;
            return mockRes;
          },
        };
        router.handle(traversalReq, mockRes, () => {
          clearTimeout(timer);
          resolve();
        });
      });

      assert.equal(traversalStatus, 404);
      assert.equal(traversalResponse?.success, false);

      // Cleanup test spill file
      try {
        if (spillResult.filePath && fs.existsSync(spillResult.filePath)) {
          fs.unlinkSync(spillResult.filePath);
        }
      } catch {}
    });
  });
});


