import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  pruneToolResultText,
  pruneHistoricalMessages,
  DEFAULT_PRUNE_CONFIG,
} from '../server/agent/toolResultPruner';
import {
  canonicalizeArguments,
  LoopBreakerTracker,
} from '../server/agent/loopBreaker';
import {
  handleOutputSpill,
  getSpillDir,
} from '../server/agent/outputSpiller';
import { dispatchToolExecution } from '../server/agent/toolDispatcher';
import { createNewSession, loadSession, deleteSession } from '../server/session';
import { ChatMessage, AppConfig } from '../src/types';
import { ttsService } from '../server/ttsService';

describe('DeepSeek Harness Adaptations Test Suite', () => {
  before(() => {
    ttsService.setMuted(true);
  });

  describe('1. Model-Free Tool-Result Pruning (toolResultPruner)', () => {
    it('should keep tool output under threshold completely intact', () => {
      const shortText = 'Lines of short command output\nAll OK.';
      const res = pruneToolResultText(shortText, { thresholdChars: 100, headChars: 40, tailChars: 20 });
      assert.equal(res.wasPruned, false);
      assert.equal(res.text, shortText);
      assert.equal(res.originalLength, shortText.length);
    });

    it('should prune oversized tool results to bounded head + marker + tail', () => {
      const longText = 'A'.repeat(500) + 'MIDDLE_SECRET' + 'B'.repeat(500);
      const res = pruneToolResultText(longText, { thresholdChars: 200, headChars: 50, tailChars: 50 });
      assert.equal(res.wasPruned, true);
      assert.ok(res.text.startsWith('A'.repeat(50)));
      assert.ok(res.text.endsWith('B'.repeat(50)));
      assert.ok(res.text.includes('[... middle output pruned'));
      assert.ok(!res.text.includes('MIDDLE_SECRET'), 'Middle content must be pruned from text');
    });

    it('should prune old historical tool messages while keeping active recent messages unpruned', () => {
      const bigOutput = 'X'.repeat(8000);
      const messages: ChatMessage[] = [
        {
          id: '1',
          role: 'assistant',
          content: 'Running initial analysis',
          timestamp: 100,
          tool_calls: [{ id: 'tc1', name: 'grep_search', arguments: '{}', status: 'completed', output: bigOutput }],
        },
        {
          id: '2',
          role: 'tool',
          content: bigOutput,
          timestamp: 101,
        },
        {
          id: '3',
          role: 'user',
          content: 'Recent prompt',
          timestamp: 200,
        },
        {
          id: '4',
          role: 'assistant',
          content: 'Active turn',
          timestamp: 201,
          tool_calls: [{ id: 'tc2', name: 'read_file', arguments: '{}', status: 'completed', output: bigOutput }],
        },
      ];

      const pruned = pruneHistoricalMessages(messages, DEFAULT_PRUNE_CONFIG, 2);
      assert.equal(pruned.length, 4);

      // Historical messages should be pruned
      assert.ok(pruned[0].tool_calls![0].output!.includes('[... middle output pruned'));
      assert.ok(pruned[1].content.includes('[... middle output pruned'));

      // Most recent message should remain unpruned
      assert.equal(pruned[3].tool_calls![0].output, bigOutput, 'Recent tool output must not be pruned');
    });
  });

  describe('2. Repeat-Tool Loop Breaker (loopBreaker)', () => {
    it('should canonically sort JSON object keys regardless of insertion order', () => {
      const arg1 = { b: 2, a: 1, nested: { y: 'two', x: 'one' } };
      const arg2 = { nested: { x: 'one', y: 'two' }, a: 1, b: 2 };
      assert.equal(canonicalizeArguments(arg1), canonicalizeArguments(arg2));
    });

    it('should detect repeated calls and escalate to advisory reminder and halt', () => {
      const tracker = new LoopBreakerTracker();
      const sessId = 'test-session-loop';

      const r1 = tracker.trackCall(sessId, 'grep_search', { query: 'test' });
      assert.equal(r1.isLooping, false);
      assert.equal(r1.count, 1);

      const r2 = tracker.trackCall(sessId, 'grep_search', { query: 'test' });
      assert.equal(r2.isLooping, false);
      assert.equal(r2.count, 2);

      const r3 = tracker.trackCall(sessId, 'grep_search', { query: 'test' });
      assert.equal(r3.isLooping, true);
      assert.equal(r3.count, 3);
      assert.ok(r3.advisoryReminder?.includes('ПРЕДУПРЕЖДЕНИЕ'));

      const r4 = tracker.trackCall(sessId, 'grep_search', { query: 'test' });
      assert.equal(r4.count, 4);

      const r5 = tracker.trackCall(sessId, 'grep_search', { query: 'test' });
      assert.equal(r5.isLooping, true);
      assert.equal(r5.count, 5);
      assert.equal(r5.forceHalt, true);
      assert.ok(r5.advisoryReminder?.includes('КРИТИЧЕСКИЙ РАЗРЫВ ЦИКЛА'));

      // Changing arguments resets counter
      const rNew = tracker.trackCall(sessId, 'grep_search', { query: 'different' });
      assert.equal(rNew.isLooping, false);
      assert.equal(rNew.count, 1);
    });

    it('should be transparent to todo_write bookkeeping calls', () => {
      const tracker = new LoopBreakerTracker();
      const sessId = 'test-session-todo-transparent';

      tracker.trackCall(sessId, 'read_file', { path: 'a.ts' });
      tracker.trackCall(sessId, 'todo_write', [{ content: 'check', status: 'in_progress' }]);
      const r2 = tracker.trackCall(sessId, 'read_file', { path: 'a.ts' });

      assert.equal(r2.count, 2, 'todo_write must not reset the consecutive count');
    });
  });

  describe('3. Tool Output Spiller (outputSpiller)', () => {
    it('should preserve small outputs in memory without disk writing', async () => {
      const small = 'Small output 123';
      const res = await handleOutputSpill(small, 'test_tool', 1000);
      assert.equal(res.spilled, false);
      assert.equal(res.output, small);
    });

    it('should spill oversized output to local disk log and return preview with locator', async () => {
      const large = 'LINE OF OUTPUT\n'.repeat(500);
      const res = await handleOutputSpill(large, 'terminal_exec', 500);
      assert.equal(res.spilled, true);
      assert.ok(res.filePath, 'Spill file path must be defined');
      assert.ok(fs.existsSync(res.filePath!), 'Spilled log file must exist on disk');
      assert.ok(res.output.includes('ПОЛНЫЙ ЛОГ СОХРАНЕН В:'));

      const onDisk = fs.readFileSync(res.filePath!, 'utf-8');
      assert.equal(onDisk, large);
    });
  });

  describe('4. Dynamic Todo Management (todo_write tool & session state)', () => {
    it('should execute todo_write, update session active_todos, and format response', async () => {
      const session = await createNewSession('Todo Test Session', null);
      const mockConfig: AppConfig = {
        api_url: 'http://127.0.0.1:11434',
        model_name: 'test',
        system_prompt: '',
      };

      let broadcastEvent: string | null = null;
      let broadcastPayload: any = null;

      const mockBroadcast = (event: string, payload: any) => {
        broadcastEvent = event;
        broadcastPayload = payload;
      };

      const result = await dispatchToolExecution(
        {
          name: 'todo_write',
          arguments: {
            todos: [
              { content: 'Step 1: Setup', status: 'completed' },
              { content: 'Step 2: Implement core', status: 'in_progress' },
              { content: 'Step 3: Test', status: 'pending' },
            ],
          },
        },
        mockConfig,
        true,
        session.id,
        mockBroadcast
      );

      assert.ok(result.includes('ПЛАН ОБНОВЛЕН'));
      assert.ok(result.includes('Завершено: 1'));
      assert.ok(result.includes('В процессе: 1'));
      assert.ok(result.includes('Ожидает: 1'));

      // Check session on disk
      const reloaded = await loadSession(session.id);
      assert.ok(reloaded.active_todos);
      assert.equal(reloaded.active_todos.length, 3);
      assert.equal(reloaded.active_todos[0].status, 'completed');
      assert.equal(reloaded.active_todos[1].status, 'in_progress');

      // Check broadcast
      assert.equal(broadcastEvent, 'session-todos-updated');
      assert.equal(broadcastPayload.sessionId, session.id);
      assert.equal(broadcastPayload.todos.length, 3);

      await deleteSession(session.id);
    });
  });
});
