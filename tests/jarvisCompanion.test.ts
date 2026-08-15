import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { ttsService, getPhraseFilename, PRESET_PHRASES } from '../server/ttsService';
import { proactiveCompanion } from '../server/agent/proactiveCompanion';
import { jarvisSupervisor } from '../server/agent/jarvisSupervisor';
import { initPersonas, getPersonaDetail } from '../server/personas';
import { logger } from '../server/logger';
import { processWatcher } from '../server/agent/processWatcher';
import { voiceDaemonManager } from '../server/agent/voiceDaemonManager';
import { voiceMacroService } from '../server/agent/voiceMacroService';
import { jarvisDiagnostics } from '../server/agent/jarvisDiagnostics';

describe('Jarvis Companion & Voice Intercom Test Suite', () => {
  before(() => {
    ttsService.setMuted(true);
  });

  after(() => {
    try { proactiveCompanion.stop(); } catch {}
    try { processWatcher.stopScanner(); } catch {}
    try { jarvisSupervisor.stopLoop(); } catch {}
  });

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
      const requiredCategories = [
        'greeting',
        'listening',
        'spark_ready',
        'companion_calm',
        'gaming_momentum',
        'coding_flow',
        'late_night',
        'success',
        'error',
        'background_task',
        'processing',
      ];
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
        voice: 'ru-RU-DmitryNeural',
        rate: '+15%',
        pitch: '-5Hz',
        playOnSpeaker: false, // Do not play sound in automated CI/test run
      });

      assert.equal(result.success, true, 'TTS synthesis must succeed');
      assert.equal(result.phrase, testPhrase, 'Returned phrase must match input');
      assert.ok(result.audioBase64, 'audioBase64 must be present');
      assert.ok(result.audioBase64.startsWith('data:audio/mp3;base64,'), 'audioBase64 must have proper MIME prefix');
      assert.ok(result.audioBase64.length > 100, 'audioBase64 payload must not be empty');

      // Second call must hit disk cache
      const cachedResult = await ttsService.speakText(testPhrase, {
        voice: 'ru-RU-DmitryNeural',
        rate: '+15%',
        pitch: '-5Hz',
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
      assert.ok(created.directivePrompt && created.directivePrompt.includes('JARVIS AUTONOMOUS INITIATIVE'), 'Spark must have a rich directivePrompt');
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

    it('should intercept server error logs and create an error_incident spark', async () => {
      logger.error('DatabaseModule', 'Connection pool exhausted: simulated test failure');
      
      // Allow async hook to create spark
      await new Promise((resolve) => setTimeout(resolve, 50));

      const sparks = proactiveCompanion.getActiveSparks();
      const errorSpark = sparks.find((s) => s.category === 'error_incident');
      assert.ok(errorSpark, 'Error watchdog must create an error_incident spark on logger.error');
      assert.ok(errorSpark.title.includes('DatabaseModule'));
      assert.equal(errorSpark.status, 'pending');
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

  describe('5. OS Process & Focus Watcher (processWatcher)', () => {
    it('should query OS process status without errors', async () => {
      const status = await processWatcher.performScan();
      assert.ok(status, 'Status must be defined');
      assert.ok(['coding', 'gaming', 'browsing', 'idle'].includes(status.state), 'State must be one of allowed states');
      assert.ok(typeof status.detectedApp === 'string');
      assert.ok(status.lastScanTimestamp > 0);
    });
  });

  describe('6. Native Desktop Voice Daemon (voiceDaemonManager)', () => {
    it('should report correct initial daemon state and allow broadcast updates', () => {
      assert.equal(typeof voiceDaemonManager.isRunning(), 'boolean');
      assert.doesNotThrow(() => {
        voiceDaemonManager.broadcastState('idle');
      });
    });

    it('should find python voice_daemon script on disk', () => {
      const scriptPath = path.resolve(process.cwd(), 'scripts/voice_daemon.py');
      assert.ok(fs.existsSync(scriptPath), 'voice_daemon.py script must exist in scripts/ directory');
      const content = fs.readFileSync(scriptPath, 'utf-8');
      assert.ok(content.includes('VoiceDaemon'), 'Script must define VoiceDaemon class');
      assert.ok(content.includes('WAKE_WORDS'), 'Script must define wake words');
      assert.ok(content.includes('GAIN_BOOST'), 'Script must define gain boost');
    });
  });

  describe('7. Voice Macro Service & Leading Greeting Stripper', () => {
    it('should strip leading greetings and trailing stop words cleanly', () => {
      const v1 = ttsService.cleanLeadingJarvisPhrase('Слушаю вас, сэр. Поставь на паузу трек');
      assert.equal(v1.cleanText, 'Поставь на паузу трек');
      assert.equal(v1.isOnlyGreeting, false);

      const v2 = ttsService.cleanLeadingJarvisPhrase('Слушаю вас, сэр.');
      assert.equal(v2.cleanText, '');
      assert.equal(v2.isOnlyGreeting, true);

      const v3 = ttsService.cleanLeadingJarvisPhrase('Да, сэр. Создай компонент кнопки');
      assert.equal(v3.cleanText, 'Создай компонент кнопки');
      assert.equal(v3.isOnlyGreeting, false);

      const v4 = ttsService.cleanLeadingJarvisPhrase('На связи, открой код стоп');
      assert.equal(v4.cleanText, 'открой код');
      assert.equal(v4.isOnlyGreeting, false);
    });

    it('should correctly intercept Windows voice macros and identify actions', () => {
      const media = voiceMacroService.processCommand('поставь на паузу трек');
      assert.equal(media.handled, true);
      assert.equal(media.action, 'media_play_pause');

      const nextTrack = voiceMacroService.processCommand('следующий трек');
      assert.equal(nextTrack.handled, true);
      assert.equal(nextTrack.action, 'media_next');

      const volUp = voiceMacroService.processCommand('сделай громче звук');
      assert.equal(volUp.handled, true);
      assert.equal(volUp.action, 'vol_up');

      const volDown = voiceMacroService.processCommand('тише');
      assert.equal(volDown.handled, true);
      assert.equal(volDown.action, 'vol_down');

      const volMute = voiceMacroService.processCommand('выключи звук');
      assert.equal(volMute.handled, true);
      assert.equal(volMute.action, 'vol_mute');

      const minimize = voiceMacroService.processCommand('сверни все окна');
      assert.equal(minimize.handled, true);
      assert.equal(minimize.action, 'minimize_all');

      const launchCode = voiceMacroService.processCommand('открой код');
      assert.equal(launchCode.handled, true);
      assert.equal(launchCode.action, 'launch_code');

      const aiQuery = voiceMacroService.processCommand('напиши функцию для бинарного поиска');
      assert.equal(aiQuery.handled, false, 'AI coding query must pass through to model');
    });
  });

  describe('8. System Diagnostics & Synthetic Dialogue Simulation', () => {
    it('should run full system diagnostics and return a structured report', async () => {
      const report = await jarvisDiagnostics.runFullDiagnostics();
      assert.ok(report, 'Report must be returned');
      assert.ok(['healthy', 'degraded'].includes(report.overallStatus), `Overall status should be healthy/degraded, got: ${report.overallStatus}`);
      assert.ok(report.totalChecks >= 6, 'Total checks should be at least 6');
      assert.equal(report.failedChecks, 0, 'No diagnostic check should fail');
      assert.ok(report.durationMs >= 0);
      assert.ok(Array.isArray(report.checks));
    });

    it('should simulate voice dialogue with macro execution', async () => {
      const sim = await jarvisDiagnostics.simulateVoiceDialogue('Слушаю вас, сэр. Поставь на паузу трек');
      assert.equal(sim.cleanedCommand, 'Поставь на паузу трек');
      assert.equal(sim.macroHandled, true);
      assert.equal(sim.macroAction, 'Медиа: Воспроизведение / Пауза');
      assert.equal(sim.isOnlyGreeting, false);
      assert.ok(sim.ttsSpokenPhrase);
    });

    it('should simulate voice dialogue with AI command passthrough', async () => {
      const sim = await jarvisDiagnostics.simulateVoiceDialogue('Да, сэр. Проверь статус сборки ветки dev');
      assert.equal(sim.cleanedCommand, 'Проверь статус сборки ветки dev');
      assert.equal(sim.macroHandled, false);
      assert.equal(sim.isOnlyGreeting, false);
      assert.equal(sim.ttsSpokenPhrase, 'Команда принята: Проверь статус сборки ветки dev');
    });
  });
});
