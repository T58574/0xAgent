import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { ttsService, getPhraseFilename, PRESET_PHRASES } from '../server/ttsService';
import { proactiveCompanion } from '../server/agent/proactiveCompanion';
import { jarvisSupervisor } from '../server/agent/jarvisSupervisor';
import { initPersonas, getPersonaDetail } from '../server/personas';

describe('Jarvis Companion & Voice Intercom Test Suite', () => {

  describe('1. TTS Engine & Caching Logic (ttsService)', () => {
    it('should generate consistent and unique md5 filenames for different phrases', () => {
      const fn1 = getPhraseFilename('На связи, сэр.', 'ru-RU-SvetlanaNeural', '+20%');
      const fn2 = getPhraseFilename('На связи, сэр.', 'ru-RU-SvetlanaNeural', '+20%');
      const fn3 = getPhraseFilename('На связи, сэр.', 'ru-RU-DmitryNeural', '+20%');
      const fn4 = getPhraseFilename('Другая фраза.', 'ru-RU-SvetlanaNeural', '+20%');

      assert.equal(fn1, fn2, 'Same phrase and voice must produce identical filename');
      assert.notEqual(fn1, fn3, 'Different voice must produce different filename');
      assert.notEqual(fn1, fn4, 'Different phrase must produce different filename');
      assert.match(fn1, /^tts_[a-f0-9]{10}\.mp3$/, 'Filename must match tts_<hash>.mp3 pattern');
    });

    it('should have all preset phrase categories defined and populated', () => {
      const requiredCategories = ['greeting', 'spark_ready', 'companion_calm', 'success', 'error', 'background_task'];
      for (const cat of requiredCategories) {
        assert.ok(Array.isArray(PRESET_PHRASES[cat]), `Category ${cat} must be an array`);
        assert.ok(PRESET_PHRASES[cat].length > 0, `Category ${cat} must not be empty`);
        for (const phrase of PRESET_PHRASES[cat]) {
          assert.equal(typeof phrase, 'string');
          assert.ok(phrase.trim().length > 0);
        }
      }
    });

    it('should synthesize and cache speech with base64 audio output', async () => {
      const testPhrase = 'Тест автономного модуля Джарвис';
      const result = await ttsService.speakText(testPhrase, {
        voice: 'ru-RU-SvetlanaNeural',
        rate: '+20%',
        playOnSpeaker: false, // Do not play sound in automated CI/test run
      });

      assert.equal(result.success, true, 'TTS synthesis must succeed');
      assert.equal(result.phrase, testPhrase, 'Returned phrase must match input');
      assert.ok(result.audioBase64, 'audioBase64 must be present');
      assert.ok(result.audioBase64.startsWith('data:audio/mp3;base64,'), 'audioBase64 must have proper MIME prefix');
      assert.ok(result.audioBase64.length > 100, 'audioBase64 payload must not be empty');

      // Second call must hit disk cache
      const cachedResult = await ttsService.speakText(testPhrase, {
        voice: 'ru-RU-SvetlanaNeural',
        rate: '+20%',
        playOnSpeaker: false,
      });
      assert.equal(cachedResult.success, true);
      assert.equal(cachedResult.cached, true, 'Subsequent synthesis must hit disk cache');
    });

    it('should select and play a valid phrase from a preset category', async () => {
      const phrase = await ttsService.playCategory('greeting');
      assert.ok(phrase, 'Category playback must return a chosen phrase');
      assert.ok(PRESET_PHRASES.greeting.includes(phrase), 'Returned phrase must belong to category');
    });
  });

  describe('2. Proactive Companion & Spark Engine (proactiveCompanion)', () => {
    it('should create a valid spark proposal and prepend to active sparks', async () => {
      const testSpark = {
        title: 'Тестовая искра автономности',
        category: 'feature_spark' as const,
        description: 'Проверка создания карточки искры',
        suggestedAction: 'Запустить юнит-тесты',
        voicePhrase: 'Сэр, юнит-тесты готовы.',
      };

      const created = await proactiveCompanion.createSparkProposal(testSpark);
      assert.ok(created.id.startsWith('spark-'), 'Spark ID must be formatted with spark- prefix');
      assert.equal(created.status, 'pending', 'Initial status must be pending');
      assert.equal(created.title, testSpark.title);
      assert.equal(created.category, testSpark.category);
      assert.ok(created.timestamp > 0);

      const sparks = proactiveCompanion.getActiveSparks();
      assert.ok(sparks.some((s) => s.id === created.id), 'Active sparks must contain the newly created spark');
    });

    it('should accept a spark and change its status to accepted', async () => {
      const spark = await proactiveCompanion.createSparkProposal({
        title: 'Искра для принятия',
        category: 'code_polish',
        description: 'Проверка подтверждения',
      });

      const accepted = proactiveCompanion.acceptSpark(spark.id);
      assert.ok(accepted, 'acceptSpark must return the accepted spark');
      assert.equal(accepted?.status, 'accepted');
    });

    it('should dismiss a spark and change its status to dismissed', async () => {
      const spark = await proactiveCompanion.createSparkProposal({
        title: 'Искра для отклонения',
        category: 'exploration',
        description: 'Проверка скрытия',
      });

      proactiveCompanion.dismissSpark(spark.id);
      const sparks = proactiveCompanion.getActiveSparks();
      const target = sparks.find((s) => s.id === spark.id);
      assert.equal(target?.status, 'dismissed');
    });

    it('should generate an autonomous spark on demand without human prompt', async () => {
      const spark = await proactiveCompanion.triggerAutonomousSpark();
      assert.ok(spark, 'Autonomous spark generator must return a proposal');
      assert.ok(spark.title.length > 0, 'Autonomous spark must have a title');
      assert.ok(spark.description.length > 0, 'Autonomous spark must have a description');
      assert.equal(spark.status, 'pending');
    });

    it('should record user activity timestamp', () => {
      assert.doesNotThrow(() => {
        proactiveCompanion.recordUserActivity();
      });
    });
  });

  describe('3. Jarvis Supervisor & State Aggregation (jarvisSupervisor)', () => {
    it('should return complete aggregated state with activeSparks and tts status', () => {
      const state = jarvisSupervisor.getState();
      assert.ok(state.isActive !== undefined, 'isActive must be defined');
      assert.ok(Array.isArray(state.activeWorkers), 'activeWorkers must be an array');
      assert.ok(Array.isArray(state.recentActivities), 'recentActivities must be an array');
      assert.ok(Array.isArray(state.activeSparks), 'activeSparks must be an array in supervisor state');
      assert.equal(typeof state.isSpeaking, 'boolean', 'isSpeaking must be boolean');
      assert.ok(state.updatedAt > 0);
    });
  });

  describe('4. Personas System & Jarvis Companion Profile', () => {
    it('should initialize and load jarvis_companion persona correctly', () => {
      initPersonas();
      const detail = getPersonaDetail('jarvis_companion');
      assert.ok(detail, 'jarvis_companion persona must exist');
      assert.equal(detail.metadata.id, 'jarvis_companion');
      assert.ok(detail.soul.includes('SOUL.md — Джарвис'), 'SOUL.md must contain Jarvis persona definitions');
      assert.ok(detail.soul.includes('ZERO-GUILT'), 'SOUL.md must enforce zero-guilt directive');
      assert.ok(detail.soul.includes('PUSH OVER PULL'), 'SOUL.md must enforce push over pull directive');
      assert.ok(detail.tools.length > 0, 'TOOLS.md must not be empty');
      assert.ok(detail.user.length > 0, 'USER.md must not be empty');
    });
  });
});
