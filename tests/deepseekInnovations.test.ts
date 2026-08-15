import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { userQuestionService } from '../server/agent/userQuestionService';
import { executeCodeProgram } from '../server/agent/codeRuntime';
import { evaluateToolPermission, isPathInsideWorkspace } from '../server/agent/permissionGuard';
import { forkSession, deriveMessagesFromEvents } from '../server/agent/sessionEvents';
import { subagentOrchestrator } from '../server/agent/subagentOrchestrator';
import { runCompactionPipeline } from '../server/agent/compactionPipeline';
import { AppConfig, ChatSession, SessionEvent } from '../src/types';
import { saveSession } from '../server/session';

describe('DeepSeek Harness Innovations Subsystem Test Suite', () => {
  const dummyConfig: AppConfig = {
    api_url: 'http://127.0.0.1:8080/v1',
    model_name: 'test-model',
    workspace_dir: os.tmpdir(),
    permission_preset: 'prompt',
  };

  describe('1. Interactive User Questions Subsystem', () => {
    it('should register a question and resolve it asynchronously when answered', async () => {
      const toolCallId = 'test_q_' + Date.now();
      const questionPromise = userQuestionService.askQuestions({
        sessionId: 'test_session',
        toolCallId,
        questions: [
          {
            id: 'q1',
            question: 'Выберите вариант реализации:',
            options: [{ label: 'Вариант А' }, { label: 'Вариант Б' }],
          },
        ],
      });

      assert.ok(userQuestionService.getPendingRequest(toolCallId));

      const resolved = userQuestionService.resolveQuestion(toolCallId, {
        answers: [{ id: 'q1', selected: ['Вариант А'] }],
      });

      assert.equal(resolved, true);
      const answerResult = await questionPromise;
      assert.deepEqual(answerResult.answers[0].selected, ['Вариант А']);
      assert.equal(userQuestionService.getPendingRequest(toolCallId), undefined);
    });

    it('should reject asking questions if question list is empty', async () => {
      await assert.rejects(async () => {
        await userQuestionService.askQuestions({
          sessionId: 'test_session',
          toolCallId: 'empty_q',
          questions: [],
        });
      });
    });
  });

  describe('2. Sandboxed Code Mode Runtime Subsystem', () => {
    it('should execute JS program, capture return value and console logs', async () => {
      const code = `
        console.log("Starting calculation");
        const a = 10;
        const b = 25;
        console.log("Summing:", a + b);
        return { total: a + b, ok: true };
      `;

      const result = await executeCodeProgram(code, dummyConfig);
      assert.equal(result.success, true);
      assert.equal(result.value.total, 35);
      assert.equal(result.value.ok, true);
      assert.ok(result.logs.some((l) => l.includes('Summing: 35')));
      assert.ok(result.executionTimeMs >= 0);
    });

    it('should safely handle execution syntax or runtime errors without crashing the host', async () => {
      const badCode = `throw new Error("Deliberate sandbox error");`;
      const result = await executeCodeProgram(badCode, dummyConfig);
      assert.equal(result.success, false);
      assert.ok(result.error?.includes('Deliberate sandbox error'));
    });
  });

  describe('3. Permission Presets & Security Matrix Subsystem', () => {
    it('should reject mutating tools when readonly preset is active', () => {
      const checkWrite = evaluateToolPermission('write_file', { path: 'test.txt' }, 'readonly');
      assert.equal(checkWrite.allowed, false);
      assert.ok(checkWrite.reason?.includes('readonly'));

      const checkExec = evaluateToolPermission('execute_command', { command: 'dir' }, 'readonly');
      assert.equal(checkExec.allowed, false);

      const checkRead = evaluateToolPermission('read_file', { path: 'test.txt' }, 'readonly');
      assert.equal(checkRead.allowed, true);
      assert.equal(checkRead.requiresApproval, false);
    });

    it('should allow tools without confirmation in unrestricted preset', () => {
      const checkWrite = evaluateToolPermission('write_file', { path: 'test.txt' }, 'unrestricted');
      assert.equal(checkWrite.allowed, true);
      assert.equal(checkWrite.requiresApproval, false);
    });

    it('should prevent workspace escape in workspace-write preset', () => {
      const workspace = path.resolve(os.tmpdir(), 'test_workspace_0xagent');
      if (!fs.existsSync(workspace)) fs.mkdirSync(workspace, { recursive: true });

      assert.equal(isPathInsideWorkspace('nested/file.ts', workspace), true);
      assert.equal(isPathInsideWorkspace('../../../escaped.txt', workspace), false);

      const checkEscape = evaluateToolPermission(
        'write_file',
        { path: '../../../escaped.txt' },
        'workspace-write',
        workspace
      );
      assert.equal(checkEscape.allowed, false);
      assert.ok(checkEscape.reason?.includes('workspace-write'));
    });
  });

  describe('4. Session Event-Sourcing & Forking Subsystem', () => {
    it('should fork a session from a specific message checkpoint', async () => {
      const sourceId = 'test_source_' + Date.now();
      const initialSession: ChatSession = {
        id: sourceId,
        title: 'Main Architectural Goal',
        workspace_dir: os.tmpdir(),
        messages: [
          { id: 'm1', role: 'user', content: 'First message', timestamp: 1000 },
          { id: 'm2', role: 'assistant', content: 'First response', timestamp: 2000 },
          { id: 'm3', role: 'user', content: 'Second message', timestamp: 3000 },
          { id: 'm4', role: 'assistant', content: 'Second response', timestamp: 4000 },
        ],
        created_at: 1000,
        updated_at: 4000,
      };

      await saveSession(initialSession);

      const forked = await forkSession(sourceId, 'm2', 'Branched Architecture');
      assert.notEqual(forked.id, sourceId);
      assert.equal(forked.title, 'Branched Architecture');
      assert.equal(forked.messages.length, 2);
      assert.deepEqual(
        forked.messages.map((m) => m.id),
        ['m1', 'm2']
      );
    });

    it('should derive deterministic ChatMessages from raw SessionEvents stream', () => {
      const events: SessionEvent[] = [
        { id: 'e1', type: 'user/message', timestamp: 1000, payload: { content: 'Hello' } },
        { id: 'e2', type: 'assistant/message', timestamp: 2000, payload: { content: 'Hi there' } },
        { id: 'e3', type: 'tool/result', timestamp: 3000, payload: { output: 'Done' } },
      ];

      const messages = deriveMessagesFromEvents(events);
      assert.equal(messages.length, 3);
      assert.equal(messages[0].role, 'user');
      assert.equal(messages[0].content, 'Hello');
      assert.equal(messages[1].role, 'assistant');
      assert.equal(messages[2].role, 'tool');
    });
  });

  describe('5. Continuable Subagents Orchestration Subsystem', () => {
    it('should spawn subagents, track status and allow interruption', async () => {
      const sub = await subagentOrchestrator.spawnSubagent(
        'parent_sess_1',
        'Performance Benchmark Subagent',
        'Analyze CPU bottlenecks',
        dummyConfig
      );

      assert.ok(sub.id);
      assert.equal(sub.role, 'Performance Benchmark Subagent');
      assert.ok(subagentOrchestrator.getSubagent(sub.id));

      const stopped = subagentOrchestrator.interruptSubagent(sub.id);
      assert.equal(stopped, true);

      const updated = subagentOrchestrator.getSubagent(sub.id);
      assert.equal(updated?.status, 'interrupted');
    });

    it('should list subagents filtered by parent session', () => {
      const list = subagentOrchestrator.listSubagents('parent_sess_1');
      assert.ok(Array.isArray(list));
    });
  });

  describe('6. 4-Tier Compaction Pipeline Subsystem', () => {
    it('should run compaction pipeline and produce valid message payloads', async () => {
      const testSession: ChatSession = {
        id: 'compaction_sess',
        title: 'Compaction Test',
        messages: [
          { id: 'm1', role: 'user', content: 'Step 1', timestamp: 1000 },
          { id: 'm2', role: 'assistant', content: '<think>Reasoning thoughts</think>Answer 1', timestamp: 2000 },
          { id: 'm3', role: 'tool', content: 'Tool execution result output', timestamp: 3000 },
          { id: 'm4', role: 'user', content: 'Step 2', timestamp: 4000 },
        ],
        created_at: 1000,
        updated_at: 4000,
      };

      const result = await runCompactionPipeline(testSession, dummyConfig, 'System Prompt Content');
      assert.ok(result.messages.length > 0);
      assert.equal(result.messages[0].role, 'system');
      assert.ok(result.estimatedTokens > 0);
    });
  });
});
