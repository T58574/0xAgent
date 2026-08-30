import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { userQuestionService } from '../server/agent/userQuestionService';
import { executeCodeProgram } from '../server/agent/codeRuntime';
import { evaluateToolPermission, isPathInsideWorkspace } from '../server/agent/permissionGuard';
import { forkSession, deriveMessagesFromEvents } from '../server/agent/sessionEvents';
import { runCompactionPipeline } from '../server/agent/compactionPipeline';
import { AppConfig, ChatSession, SessionEvent } from '../src/types';
import { saveSession, deleteSession } from '../server/session';

describe('Agent Harness Innovations Subsystem Test Suite', () => {
  before(() => {
    process.env.NODE_ENV = 'test';
  });
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

    it('should enforce execution timeout and prevent async infinite hangs', async () => {
      const hangingCode = `
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return { finished: true };
      `;
      const result = await executeCodeProgram(hangingCode, dummyConfig, { timeoutMs: 150 });
      assert.equal(result.success, false);
      assert.ok(result.error?.includes('timeout budget'));
    });

    it('should protect host prototypes against sandbox pollution attempts', async () => {
      const maliciousCode = `
        Object.prototype.pollutedSecret = 'EXPLOITED';
        return { polluted: true };
      `;
      const result = await executeCodeProgram(maliciousCode, dummyConfig);
      assert.equal(result.success, true);
      assert.equal((Object.prototype as any).pollutedSecret, undefined, 'Host Object.prototype must not be polluted');
      delete (Object.prototype as any).pollutedSecret;
    });
  });

  describe('3. Permission Presets & Security Matrix Subsystem (Two Automation Modes)', () => {
    it('should auto-approve safe vectors and require approval for mutating vectors in partial automation (prompt)', () => {
      // Safe vectors: auto-approved without confirmation
      const checkRead = evaluateToolPermission('read_file', { path: 'test.txt' }, 'prompt');
      assert.equal(checkRead.allowed, true);
      assert.equal(checkRead.requiresApproval, false);

      const checkSearch = evaluateToolPermission('grep_search', { query: 'test' }, 'prompt');
      assert.equal(checkSearch.allowed, true);
      assert.equal(checkSearch.requiresApproval, false);

      const checkMem = evaluateToolPermission('recall_memories', { query: 'user' }, 'prompt');
      assert.equal(checkMem.allowed, true);
      assert.equal(checkMem.requiresApproval, false);

      // Mutating vectors: require user confirmation (requiresApproval = true)
      const checkWrite = evaluateToolPermission('write_file', { path: 'test.txt' }, 'prompt');
      assert.equal(checkWrite.allowed, true);
      assert.equal(checkWrite.requiresApproval, true);

      const checkExec = evaluateToolPermission('execute_command', { command: 'dir' }, 'prompt');
      assert.equal(checkExec.allowed, true);
      assert.equal(checkExec.requiresApproval, true);

      const checkPatch = evaluateToolPermission('patch_file', { path: 'test.txt' }, 'prompt');
      assert.equal(checkPatch.allowed, true);
      assert.equal(checkPatch.requiresApproval, true);
    });

    it('should auto-execute all tools without confirmation in full automation (unrestricted)', () => {
      const checkWrite = evaluateToolPermission('write_file', { path: 'test.txt' }, 'unrestricted');
      assert.equal(checkWrite.allowed, true);
      assert.equal(checkWrite.requiresApproval, false);

      const checkExec = evaluateToolPermission('execute_command', { command: 'dir' }, 'unrestricted');
      assert.equal(checkExec.allowed, true);
      assert.equal(checkExec.requiresApproval, false);

      const checkRead = evaluateToolPermission('read_file', { path: 'test.txt' }, 'unrestricted');
      assert.equal(checkRead.allowed, true);
      assert.equal(checkRead.requiresApproval, false);
    });

    it('should validate workspace boundary containment with isPathInsideWorkspace', () => {
      const workspace = path.resolve(os.tmpdir(), 'test_workspace_0xagent');
      if (!fs.existsSync(workspace)) fs.mkdirSync(workspace, { recursive: true });

      assert.equal(isPathInsideWorkspace('nested/file.ts', workspace), true);
      assert.equal(isPathInsideWorkspace('../../../escaped.txt', workspace), false);
      assert.equal(isPathInsideWorkspace('sub/dir/../../../../escaped.txt', workspace), false);
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

      try {
        await saveSession(initialSession);

        const forked = await forkSession(sourceId, 'm2', 'Branched Architecture');
        assert.notEqual(forked.id, sourceId);
        assert.equal(forked.title, 'Branched Architecture');
        assert.equal(forked.messages.length, 2);
        assert.deepEqual(
          forked.messages.map((m) => m.id),
          ['m1', 'm2']
        );

        await deleteSession(forked.id);
      } finally {
        await deleteSession(sourceId);
      }
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

  describe('5. 4-Tier Compaction Pipeline Subsystem', () => {
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
