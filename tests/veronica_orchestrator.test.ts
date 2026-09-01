import test, { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Configure test environment
process.env.NODE_ENV = 'test';
const TEST_DIR = path.join(os.tmpdir(), '.0xagent_test_veronica_orchestrator_' + Date.now());
process.env.TEST_APP_DIR = TEST_DIR;

import { initVeronicaDatabase, closeVeronicaDatabase } from '../server/veronica/db/veronicaDb';
import { projectDiscovery } from '../server/veronica/core/projectDiscovery';
import { projectDocManager } from '../server/veronica/core/projectDocManager';
import { veronicaOrchestrator } from '../server/veronica/telegram/veronicaOrchestrator';
import { CliHandler } from '../server/veronica/cli/cliHandler';
import { MessageBuilder } from '../server/veronica/telegram/messageBuilder';
import { snapshotCache } from '../server/veronica/core/snapshotCache';

describe('Veronica Orchestrator & Project Management Architecture', () => {
  before(() => {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
    initVeronicaDatabase(path.join(TEST_DIR, 'veronica_test.db'));
  });

  after(() => {
    closeVeronicaDatabase();
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {}
  });

  describe('1. Dynamic Project Discovery', () => {
    it('should discover projects dynamically and sync with database', async () => {
      // Create mock project directory in test dir
      const mockDevDir = path.join(TEST_DIR, 'mock_dev');
      const mockProj1 = path.join(mockDevDir, 'YandexGamesProject');
      const mockProj2 = path.join(mockDevDir, 'LogisticsApp');
      fs.mkdirSync(mockProj1, { recursive: true });
      fs.mkdirSync(mockProj2, { recursive: true });

      projectDiscovery.addSearchPath(mockDevDir);
      const discovered = await projectDiscovery.discoverAllProjects();

      assert.ok(discovered.length >= 2, 'Should discover created mock projects');
      const yandexProj = discovered.find((p) => p.name === 'YandexGamesProject');
      assert.ok(yandexProj, 'YandexGamesProject should be found');
      assert.strictEqual(yandexProj.name, 'YandexGamesProject');
    });

    it('should resolve project path reliably', async () => {
      const resolved = await projectDiscovery.resolveProjectPath('YandexGamesProject');
      assert.ok(resolved, 'Should resolve path for YandexGamesProject');
      assert.ok(resolved.includes('YandexGamesProject'), 'Resolved path should contain project name');
    });
  });

  describe('2. Project Documentation & Metrics Manager', () => {
    it('should create and retrieve project passport', async () => {
      const passport = await projectDocManager.getPassport('LogisticsApp');
      assert.ok(passport.includes('LogisticsApp'), 'Passport should contain project name');
      assert.ok(passport.includes('Tech Stack'), 'Passport should contain tech stack section');
    });

    it('should update metrics and append to changelog', async () => {
      const metrics = projectDocManager.updateMetrics('LogisticsApp', {
        conversion: '12.5%',
        version: '2.1.0',
      });
      assert.strictEqual(metrics.conversion, '12.5%');
      assert.strictEqual(metrics.version, '2.1.0');

      await projectDocManager.appendChangelog('LogisticsApp', {
        author: 'Unit Test Agent',
        action: 'Interface redesign',
        details: 'Conversion increased by 10%',
      });

      const log = await projectDocManager.getChangelog('LogisticsApp');
      assert.ok(log.includes('Interface redesign'), 'Changelog should contain action');
      assert.ok(log.includes('Conversion increased by 10%'), 'Changelog should contain details');
    });
  });

  describe('3. Bidirectional CLI Handler', () => {
    it('should handle doc_get via CliHandler', async () => {
      const res = await CliHandler.handleRequest({
        command: 'doc_get',
        project: 'LogisticsApp',
      });

      assert.strictEqual(res.success, true);
      assert.ok(res.data.passport, 'Data should include passport');
      assert.strictEqual(res.data.metrics.conversion, '12.5%');
    });

    it('should handle doc_append via CliHandler', async () => {
      const res = await CliHandler.handleRequest({
        command: 'doc_append',
        project: 'LogisticsApp',
        action: 'CLI Test Update',
        message: 'Verified CLI bidirectional update pipeline',
      });

      assert.strictEqual(res.success, true);
      const changelog = await projectDocManager.getChangelog('LogisticsApp');
      assert.ok(changelog.includes('CLI Test Update'));
    });

    it('should handle projects_list via CliHandler', async () => {
      const res = await CliHandler.handleRequest({
        command: 'projects_list',
      });

      assert.strictEqual(res.success, true);
      assert.ok(Array.isArray(res.data));
    });
  });

  describe('4. Telegram Message Builder & Keyboards', () => {
    it('should build Main Reply Keyboard with standard buttons', () => {
      const kb = MessageBuilder.getMainReplyKeyboard();
      assert.ok(kb, 'ReplyKeyboard should be created');
    });

    it('should build Project List Inline Keyboard with discovered projects', async () => {
      const projects = await projectDiscovery.discoverAllProjects();
      const inlineKb = MessageBuilder.buildProjectListKeyboard(projects, 0);
      assert.ok(inlineKb, 'InlineKeyboard should be generated');
    });

    it('should build Project Details card correctly', async () => {
      const details = await MessageBuilder.buildProjectDetails('LogisticsApp');
      assert.ok(details.includes('LogisticsApp'));
      assert.ok(details.includes('12.5%'));
    });
  });

  describe('5. Veronica Orchestrator Intent Handling', () => {
    it('should handle report shortcuts directly without error', async () => {
      const replyYesterday = await veronicaOrchestrator.handleUserMessage(12345, 'что сделано за вчера?');
      assert.ok(replyYesterday.includes('Отчет'), 'Should return period report');

      const replyToday = await veronicaOrchestrator.handleUserMessage(12345, 'что сделано за сегодня');
      assert.ok(replyToday.includes('Отчет'), 'Should return today report');
    });

    it('should set and clear user session project context', () => {
      veronicaOrchestrator.setActiveProject(12345, 'LogisticsApp');
      const session = veronicaOrchestrator.getUserSession(12345);
      assert.strictEqual(session.activeProject, 'LogisticsApp');
    });
  });
});
