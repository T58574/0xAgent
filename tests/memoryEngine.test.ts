import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  setCustomDbPath,
  closeMemoryDb,
  getMemoryDb,
} from '../server/memoryDb';
import {
  addOrUpdateMemory,
  loadMemories,
  getCanonicalMemories,
  getCandidateMemories,
  deleteMemory,
  queryMemories,
  resolveConflict,
  saveEpisode,
  searchEpisodesFts,
  getPersonaRelationship,
  upsertPersonaRelationship,
  routeAndRankMemories,
  getSystemPromptMemoryContext,
} from '../server/memory';
import { memoryWorker } from '../server/agent/memoryWorker';

describe('0xAgent Memory Engine v1.0 Test Suite', () => {
  let testDbDir: string;
  let testDbPath: string;

  beforeEach(() => {
    testDbDir = path.join(os.tmpdir(), `0xagent_mem_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
    fs.mkdirSync(testDbDir, { recursive: true });
    testDbPath = path.join(testDbDir, 'test_memory.db');
    setCustomDbPath(testDbPath);
  });

  afterEach(() => {
    closeMemoryDb();
    setCustomDbPath(null);
    try {
      if (fs.existsSync(testDbDir)) {
        fs.rmSync(testDbDir, { recursive: true, force: true });
      }
    } catch {}
  });

  test('1. Database Initialization & Invariant Checks', () => {
    const db = getMemoryDb();
    assert.ok(db, 'Database instance should be initialized');

    // Check WAL mode
    const pragmaRow = db.prepare('PRAGMA journal_mode;').get() as { journal_mode: string };
    assert.equal(pragmaRow.journal_mode.toLowerCase(), 'wal', 'Journal mode must be WAL');

    // Check initial seeded memories
    const memories = loadMemories();
    assert.ok(memories.length >= 2, 'Initial default memories should be present');
    const lang = memories.find((m) => m.key === 'preferred_language');
    assert.ok(lang, 'preferred_language should be seeded');
    assert.equal(lang.value, 'Russian');
  });

  test('2. Write Policy & Confidence Gating (Explicit vs Candidate vs Ignore)', () => {
    // Explicit user command: always active
    const explicitMem = addOrUpdateMemory('editor_theme', 'monokai', 'preference', {
      isExplicit: true,
      domain: 'ide',
    });
    assert.ok(explicitMem);
    assert.equal(explicitMem.status, 'active');
    assert.equal(explicitMem.is_explicit, 1);

    // Strong implicit inference (confidence >= 0.90): saved as active
    const strongMem = addOrUpdateMemory('favorite_game', 'Cyberpunk 2077', 'interest', {
      isExplicit: false,
      confidence: 0.92,
      domain: 'gaming',
    });
    assert.ok(strongMem);
    assert.equal(strongMem.status, 'active');

    // Medium implicit inference (0.70 <= confidence < 0.90): saved as candidate
    const candidateMem = addOrUpdateMemory('potential_hobby', 'baking', 'interest', {
      isExplicit: false,
      confidence: 0.78,
      domain: 'lifestyle',
    });
    assert.ok(candidateMem);
    assert.equal(candidateMem.status, 'candidate');

    const candidates = getCandidateMemories();
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].key, 'potential_hobby');

    // Weak inference (confidence < 0.70): IGNORE (discarded)
    const weakMem = addOrUpdateMemory('random_guess', 'skateboarding', 'interest', {
      isExplicit: false,
      confidence: 0.55,
    });
    assert.equal(weakMem, null, 'Weak inference below 0.70 must be discarded');
  });

  test('3. Natural Unique Identity & Superseding on Value Update', () => {
    // Insert initial active fact
    const initial = addOrUpdateMemory('dev_framework', 'React', 'preference', {
      domain: 'tech',
      isExplicit: true,
    });
    assert.ok(initial);

    // Update with same value: re-confirms without duplication
    const reconfirm = addOrUpdateMemory('dev_framework', 'React', 'preference', {
      domain: 'tech',
      isExplicit: true,
    });
    assert.equal(reconfirm?.id, initial.id);

    // Update with NEW value: supersedes old fact
    const updated = addOrUpdateMemory('dev_framework', 'SolidJS', 'preference', {
      domain: 'tech',
      isExplicit: true,
    });
    assert.ok(updated);
    assert.notEqual(updated.id, initial.id);
    assert.equal(updated.value, 'SolidJS');

    // Check canonical status
    const all = getCanonicalMemories('user_default', 'superseded');
    assert.equal(all.length, 1);
    assert.equal(all[0].value, 'React');

    const activeList = loadMemories();
    const activeFramework = activeList.find((m) => m.key === 'dev_framework');
    assert.equal(activeFramework?.value, 'SolidJS');
  });

  test('4. Conflict Resolution State Transitions', () => {
    // Create candidate memory
    const candidate = addOrUpdateMemory('travel_destination', 'Tokyo', 'interest', {
      confidence: 0.82,
    });
    assert.ok(candidate);
    assert.equal(candidate.status, 'candidate');

    // Accept candidate
    const resolved = resolveConflict(candidate.id, 'accept', 'Confirmed by user review');
    assert.equal(resolved, true);

    const activeMemories = loadMemories();
    const found = activeMemories.find((m) => m.key === 'travel_destination');
    assert.ok(found);
    assert.equal(found.value, 'Tokyo');
  });

  test('5. Episodic Memory & FTS5 Lexical Search with Triggers', () => {
    const ep1 = saveEpisode({
      sessionId: 'sess_1',
      title: 'Поездка в Токио',
      summary: 'Обсуждали путешествие по Японии, посещение храмов в Киото и прогулки по Сибуе.',
      importance: 4,
    });
    assert.ok(ep1.id);

    const ep2 = saveEpisode({
      sessionId: 'sess_2',
      title: 'Настройка Vulkan драйверов',
      summary: 'Устраняли проблемы с VRAM на видеокарте AMD Radeon RX 7800 XT.',
      importance: 3,
    });
    assert.ok(ep2.id);

    // Search via FTS5
    const resultsJapan = searchEpisodesFts('Японии');
    assert.equal(resultsJapan.length, 1);
    assert.equal(resultsJapan[0].title, 'Поездка в Токио');

    const resultsGpu = searchEpisodesFts('Radeon VRAM');
    assert.equal(resultsGpu.length, 1);
    assert.equal(resultsGpu[0].title, 'Настройка Vulkan драйверов');

    // Robustness against malformed FTS5 syntax, unbalanced quotes and operators
    const adversarialQueries = [
      '"""',
      'AND OR NOT NEAR',
      'foo* OR (bar AND',
      'SELECT * FROM canonical_memories; --',
      '   ',
      '%%%$$$###@@@!!!',
    ];

    for (const q of adversarialQueries) {
      assert.doesNotThrow(() => {
        const res = searchEpisodesFts(q);
        assert.ok(Array.isArray(res), `Query '${q}' must return array without crashing SQLite FTS5`);
      });
    }
  });

  test('6. Persona-Scoped Relationship Isolation', () => {
    // Relationship with default persona
    upsertPersonaRelationship({
      persona_id: 'default',
      familiarity: 0.8,
      formality: 0.2,
      warmth: 0.85,
      preferred_address: 'Алекс',
      relationship_summary: 'Давние напарники, общаемся на ты.',
      shared_references: ['Проект 0xAgent'],
    });

    // Relationship with architect persona
    upsertPersonaRelationship({
      persona_id: 'architect',
      familiarity: 0.4,
      formality: 0.9,
      warmth: 0.4,
      preferred_address: 'Сэр',
      relationship_summary: 'Строго деловой инженерный контакт.',
      shared_references: ['Рефакторинг ядра'],
    });

    const relDefault = getPersonaRelationship('default');
    assert.equal(relDefault.preferred_address, 'Алекс');
    assert.equal(relDefault.formality, 0.2);

    const relArch = getPersonaRelationship('architect');
    assert.equal(relArch.preferred_address, 'Сэр');
    assert.equal(relArch.formality, 0.9);
  });

  test('7. Deterministic Memory Router & Dynamic Token Budget (0..400 Tokens)', () => {
    // Invariant: Casual chat -> 0 memories injected
    const casualRes = routeAndRankMemories({
      userQuery: 'Привет!',
      activePersonaId: 'default',
    });
    assert.equal(casualRes.injectedFacts.length, 0, 'Casual greeting must inject 0 facts');
    assert.equal(casualRes.injectedEpisodes.length, 0);

    // Technical query -> High priority domain facts injected
    addOrUpdateMemory('gpu_card', 'AMD Radeon RX 7800 XT (Vulkan backend recommended)', 'architecture', {
      domain: 'hardware',
      isExplicit: true,
      importance: 4,
    });

    const techRes = routeAndRankMemories({
      userQuery: 'Какая у меня видеокарта и GPU?',
      activePersonaId: 'default',
      maxTokenBudget: 300,
    });
    assert.ok(techRes.injectedFacts.length > 0);
    const gpuFact = techRes.injectedFacts.find((f) => f.key === 'gpu_card');
    assert.ok(gpuFact, 'GPU fact should be selected for GPU query');

    // System prompt context formatting
    const context = getSystemPromptMemoryContext('default', 'Какая у меня видеокарта?');
    assert.ok(context.includes('Dynamic Persona & User Memory View'));
    assert.ok(context.includes('AMD Radeon RX 7800 XT'));
  });

  test('8. Async Debounced Memory Worker Ingestion', () => {
    memoryWorker.pushEvent({
      sessionId: 'test_session_1',
      userMessage: 'Кстати, меня зовут Виктор и я живу в Берлине',
      assistantMessage: 'Приятно познакомиться, Виктор!',
      personaId: 'default',
      timestamp: Date.now(),
    });

    // Flush immediately for test
    memoryWorker.flushQueue();

    const memories = loadMemories();
    const nameMem = memories.find((m) => m.key === 'preferred_name');
    assert.ok(nameMem, 'preferred_name should be extracted by background worker');
    assert.equal(nameMem.value, 'Виктор');

    const locMem = memories.find((m) => m.key === 'location');
    assert.ok(locMem, 'location should be extracted by background worker');
    assert.equal(locMem.value, 'Берлине');
  });
});
