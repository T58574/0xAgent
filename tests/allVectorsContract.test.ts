import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { sanitizeTextForCloud, filterCloudPayload } from '../server/agent/cloudPrivacyFilter';
import { inferPromptMode, allocateScopedMemories, PROMPT_MODE_BUDGETS } from '../server/budgetManager';
import { evaluateProposalRisk, DECLARATIVE_RISK_RULES } from '../server/personaRiskRules';
import { executeAutonomousReflection } from '../server/agent/reflectionPipeline';
import { runEvaluationHarness } from '../server/evalHarness';
import { getMemoryDb, setCustomDbPath } from '../server/memoryDb';
import { CanonicalMemory, Episode, ChatMessage } from '../src/types';

describe('All-Vector Memory & Evolution Contract v2 Test Suite', () => {
  const testDbDir = path.join(os.tmpdir(), `0xagent_test_allvectors_${Date.now()}`);
  const testDbPath = path.join(testDbDir, 'test_memory.db');

  before(() => {
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }
    setCustomDbPath(testDbPath);
  });

  describe('1. Cloud Privacy Filter (Path & Secret Sanitization)', () => {
    it('should sanitize Windows and Unix home directory paths to tilde', () => {
      const text = 'Opening configuration at C:\\Users\\Administrator\\AppData\\Local\\0xagent\\config.json';
      const res = sanitizeTextForCloud(text, { userHome: 'C:\\Users\\Administrator' });
      assert.ok(!res.sanitized.includes('C:\\Users\\Administrator'), 'Absolute user home must be redacted');
      assert.ok(res.sanitized.includes('~'), 'Should replace home path with tilde');
      assert.ok(res.redactedTypes.includes('local_path'));
    });

    it('should sanitize API keys and bearer tokens', () => {
      const text = 'Using key AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6 with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz';
      const res = sanitizeTextForCloud(text);
      assert.ok(!text.includes('[REDACTED_GOOGLE_API_KEY]'));
      assert.ok(res.sanitized.includes('[REDACTED_GOOGLE_API_KEY]'));
      assert.ok(res.sanitized.includes('[REDACTED_GENERIC_BEARER]'));
      assert.equal(res.redactionsCount, 2);
    });

    it('should sanitize chat payload array', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Here is my password: "superSecretPassword123"' },
        { role: 'assistant', content: 'Saved file to C:\\Users\\developer\\project\\index.ts' },
      ];

      const { sanitizedMessages, totalRedactions } = filterCloudPayload(messages, { userHome: 'C:\\Users\\developer' });
      assert.ok(totalRedactions >= 2);
      assert.ok(!sanitizedMessages[0].content.includes('superSecretPassword123'));
      assert.ok(!sanitizedMessages[1].content.includes('C:\\Users\\developer'));
    });
  });

  describe('2. PromptMode & Scoped Token Budget Enforcement', () => {
    it('should correctly infer PromptMode from user intent', () => {
      assert.equal(inferPromptMode('Привет!'), 'small_talk');
      assert.equal(inferPromptMode('Ошибка TypeError: undefined is not a function'), 'debugging');
      assert.equal(inferPromptMode('Давай спроектируем модульную архитектуру БД'), 'architecture_review');
      assert.equal(inferPromptMode('Напиши компонент кнопки на React'), 'coding_task');
      assert.equal(inferPromptMode('Расскажи о себе'), 'chat_assist');
    });

    it('should strictly enforce hard budget caps and drop overflowing memories', () => {
      const facts: CanonicalMemory[] = [
        { id: 'f1', subject_id: 'u1', category: 'preference', key: 'k1', value: 'v1 '.repeat(20), importance: 0.9, confidence: 1.0, status: 'active', source_event_id: 'e1', created_at: '', updated_at: '', scope: 'user' },
        { id: 'f2', subject_id: 'u1', category: 'preference', key: 'k2', value: 'v2 '.repeat(20), importance: 0.8, confidence: 1.0, status: 'active', source_event_id: 'e1', created_at: '', updated_at: '', scope: 'user' },
        { id: 'f3', subject_id: 'u1', category: 'preference', key: 'k3', value: 'v3 '.repeat(20), importance: 0.7, confidence: 1.0, status: 'active', source_event_id: 'e1', created_at: '', updated_at: '', scope: 'user' },
      ];

      const plan = allocateScopedMemories(facts, [], 'small_talk');
      assert.ok(plan.totalEstimatedTokens <= PROMPT_MODE_BUDGETS.small_talk.total_max);
      assert.ok(plan.droppedCount > 0, 'Should drop facts that exceed small_talk budget');
    });
  });

  describe('3. Declarative Risk Matrix Scoring', () => {
    it('should score critical risk for CORE.md and SOUL.md delete', () => {
      const r1 = evaluateProposalRisk('CORE.md', null, 'append');
      assert.equal(r1.riskLevel, 'critical');
      assert.equal(r1.requiresApproval, true);

      const r2 = evaluateProposalRisk('SOUL.md', 'identity', 'delete_section');
      assert.equal(r2.riskLevel, 'critical');

      const r3 = evaluateProposalRisk('SOUL.md', 'safety', 'replace_section');
      assert.equal(r3.riskLevel, 'critical');
    });

    it('should score high risk for SOUL.md append and USER_PINNED.md', () => {
      const r1 = evaluateProposalRisk('SOUL.md', 'habits', 'append');
      assert.equal(r1.riskLevel, 'high');

      const r2 = evaluateProposalRisk('USER_PINNED.md', 'rules', 'append');
      assert.equal(r2.riskLevel, 'high');
    });

    it('should score medium risk for TOOLS.md append and low risk for USER.md append', () => {
      const r1 = evaluateProposalRisk('TOOLS.md', 'git_rules', 'append');
      assert.equal(r1.riskLevel, 'medium');

      const r2 = evaluateProposalRisk('USER.md', 'profile', 'append');
      assert.equal(r2.riskLevel, 'low');
    });
  });

  describe('4. Autonomous Reflection Pipeline', () => {
    it('should synthesize episode and distill project conventions from dialogue', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'В этом проекте всегда используй pnpm вместо npm для установки пакетов.' },
        { role: 'assistant', content: 'Принято, зафиксировал правило сборки с pnpm.' },
      ];

      const result = await executeAutonomousReflection({
        sessionId: 'sess_reflection_test',
        messages,
        workspaceDir: path.join(os.tmpdir(), 'mock_workspace_ref'),
        activePersonaId: 'default',
      });

      assert.ok(result.episodeId, 'Episode ID must be generated');
      assert.ok(result.extractedFactsCount > 0, 'Should extract project convention fact');
      assert.ok(result.promotedMemories.some((m) => m.includes('pnpm') || m.includes('convention')));
    });
  });

  describe('5. Continuous Evaluation Benchmark Harness', () => {
    it('should execute golden tasks harness and achieve >= 90% overall compliance score', () => {
      const summary = runEvaluationHarness();
      assert.ok(summary.totalTasks >= 4, 'Must have at least 4 benchmark tasks');
      assert.ok(summary.overallScore >= 90, `Overall score must be >= 90%, got ${summary.overallScore}%`);
      assert.equal(summary.passedTasks, summary.totalTasks, 'All golden benchmark tasks must pass');
    });
  });
});
