import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  CuiClient,
  TerminalCui,
  SettingsTui,
  ModelTui,
  CommandPickerTui,
  PersonaTui,
  InteractivePrompt,
  stripAnsi,
  visibleLength,
  padLineToBorder,
  wrapText,
  c,
} from '../bin/cui.js';

describe('0xAgent CUI & CLI Runner Subsystem Test Suite', () => {
  const tempWorkspace = path.join(os.tmpdir(), '0xagent_cui_test_' + Date.now());

  test('1. CuiClient initialization and configuration loading', () => {
    const client = new CuiClient({
      workspaceDir: tempWorkspace,
      quiet: true,
      json: false,
    });

    assert.equal(client.workspaceDir, tempWorkspace);
    assert.equal(client.isQuiet, true);
    assert.equal(client.isJson, false);
    assert.equal(client.port, 3001);
    assert.equal(client.host, '127.0.0.1');

    const cfg = client.loadConfig();
    assert.ok(typeof cfg === 'object');
  });

  test('2. ANSI Color formatting tokens integrity', () => {
    assert.ok(c.reset.includes('\x1b[0m'));
    assert.ok(c.cyan.includes('\x1b[36m'));
    assert.ok(c.green.includes('\x1b[32m'));
    assert.ok(c.yellow.includes('\x1b[33m'));
    assert.ok(c.red.includes('\x1b[31m'));
    assert.ok(c.gray.includes('\x1b[90m'));
  });

  test('3. TerminalCui banner rendering without exceptions', () => {
    const client = new CuiClient({ workspaceDir: tempWorkspace, quiet: true });
    const cui = new TerminalCui(client);

    // Capture console.log output during renderBanner
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    try {
      cui.renderBanner({ selectedModel: 'test-model', permissionPreset: 'prompt' }, { metadata: { name: 'Test Persona' } });
      assert.ok(logs.length > 0);
      assert.ok(logs.some((l) => l.includes('0xAgent CUI')));
    } finally {
      console.log = origLog;
    }
  });

  test('4. TerminalCui renderHelp contains all required commands', () => {
    const client = new CuiClient({ workspaceDir: tempWorkspace, quiet: true });
    const cui = new TerminalCui(client);

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    try {
      cui.renderHelp();
      const output = logs.join('\n');
      assert.ok(output.includes('/help'));
      assert.ok(output.includes('/settings'));
      assert.ok(output.includes('/model'));
      assert.ok(output.includes('/persona'));
      assert.ok(output.includes('/server'));
      assert.ok(output.includes('/config'));
      assert.ok(output.includes('/status'));
      assert.ok(output.includes('/compact'));
      assert.ok(output.includes('/clear'));
      assert.ok(output.includes('/exit'));
    } finally {
      console.log = origLog;
    }
  });

  test('5. CuiClient session initialization fallback', async () => {
    const client = new CuiClient({
      workspaceDir: tempWorkspace,
      port: 39999, // Unreachable port to trigger safe fallback
    });

    const sid = await client.initSession('Test Fallback Session');
    assert.ok(sid.startsWith('cli_'));
    assert.equal(client.sessionId, sid);
  });

  test('6. ANSI helpers: stripAnsi, visibleLength, padLineToBorder, wrapText', () => {
    const colored = `${c.cyan}Hello ${c.bold}World${c.reset}`;
    assert.equal(stripAnsi(colored), 'Hello World');
    assert.equal(visibleLength(colored), 11);

    const padded = padLineToBorder('  Test', 30);
    assert.ok(padded.includes('│'));
    const plainPadded = stripAnsi(padded);
    assert.equal(plainPadded.length, 30);
    assert.equal(plainPadded.startsWith('│  Test'), true);
    assert.equal(plainPadded.endsWith('│'), true);

    const longText = 'The quick brown fox jumps over the lazy dog and tests word wrapping';
    const wrapped = wrapText(longText, 20);
    assert.ok(wrapped.length >= 3);
    for (const line of wrapped) {
      assert.ok(line.length <= 25, `Line exceeded expected wrap: ${line}`);
    }
  });

  test('7. SettingsTui configuration, auto_open_browser default, and toggle logic', () => {
    const client = new CuiClient({ workspaceDir: tempWorkspace, quiet: true });
    const tui = new SettingsTui(client);

    assert.ok(tui.settings.length >= 10);
    const autoBrowserSetting = tui.settings.find((s) => s.key === 'auto_open_browser');
    assert.ok(autoBrowserSetting, 'auto_open_browser setting must exist');
    assert.equal(autoBrowserSetting.default, false, 'Default auto_open_browser must be false');
    assert.equal(autoBrowserSetting.type, 'boolean');

    // Test toggleSetting on boolean
    tui.cfg.auto_open_browser = false;
    tui.toggleSetting(autoBrowserSetting);
    assert.equal(tui.cfg.auto_open_browser, true);
    tui.toggleSetting(autoBrowserSetting);
    assert.equal(tui.cfg.auto_open_browser, false);

    // Test toggleSetting on select
    const themeSetting = tui.settings.find((s) => s.key === 'active_theme');
    assert.ok(themeSetting);
    tui.cfg.active_theme = 'graphite';
    tui.toggleSetting(themeSetting, 1);
    assert.equal(tui.cfg.active_theme, 'light');
    tui.toggleSetting(themeSetting, 1);
    assert.equal(tui.cfg.active_theme, 'graphite');

    // Test filter matching
    tui.filter = 'browser';
    const filtered = tui.getFilteredSettings();
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].key, 'auto_open_browser');

    tui.filter = 'nonexistent_setting_xyz';
    assert.equal(tui.getFilteredSettings().length, 0);

    // Test fallback rendering
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      tui.renderFallback();
      assert.ok(logs.some((l) => l.includes('Auto Open Browser')));
      assert.ok(logs.some((l) => l.includes('0xagent config set')));
    } finally {
      console.log = origLog;
    }
  });

  test('8. ModelTui initialization, real local GGUF models, and effort slider', () => {
    const client = new CuiClient({ workspaceDir: tempWorkspace, quiet: true });
    const tui = new ModelTui(client);

    assert.ok(tui.effortOptions.includes('auto'));
    assert.ok(tui.effortOptions.includes('high'));
    assert.ok(tui.effortOptions.includes('medium'));
    assert.ok(tui.effortOptions.includes('low'));

    // Check models list
    assert.ok(tui.models.length >= 1);
    const localModels = tui.models.filter((m) => m.type === 'local');
    assert.ok(localModels.length >= 1);

    // Verify absence of hallucinated cloud models
    assert.equal(tui.models.some((m) => m.id.includes('claude')), false, 'Claude models must NOT be in 0xAgent');
    assert.equal(tui.models.some((m) => m.id.includes('gpt-4o')), false, 'GPT models must NOT be in 0xAgent');

    // Test slider bar rendering
    const barHigh = tui.renderSliderBar('high');
    assert.ok(barHigh.includes('◎'));

    // Test fallback rendering
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      tui.renderFallback();
      assert.ok(logs.some((l) => l.includes('Available Models')));
    } finally {
      console.log = origLog;
    }
  });

  test('9. CommandPickerTui slash commands and filtering', () => {
    const client = new CuiClient({ workspaceDir: tempWorkspace, quiet: true });
    const tui = new CommandPickerTui(client);

    assert.ok(tui.commands.some((c) => c.cmd === '/settings'));
    assert.ok(tui.commands.some((c) => c.cmd === '/model'));
    assert.ok(tui.commands.some((c) => c.cmd === '/persona'));
    assert.ok(tui.commands.some((c) => c.cmd === '/server'));
    assert.ok(tui.commands.some((c) => c.cmd === '/status'));
    assert.ok(tui.commands.some((c) => c.cmd === '/compact'));
    assert.ok(tui.commands.some((c) => c.cmd === '/clear'));
    assert.ok(tui.commands.some((c) => c.cmd === '/help'));
    assert.ok(tui.commands.some((c) => c.cmd === '/exit'));

    tui.filter = 'set';
    const filtered = tui.getFilteredCommands();
    assert.ok(filtered.some((c) => c.cmd === '/settings'));

    // Test fallback rendering
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      tui.renderFallback();
      assert.ok(logs.some((l) => l.includes('Available Commands')));
    } finally {
      console.log = origLog;
    }
  });

  test('10. PersonaTui initialization and fallback rendering', () => {
    const client = new CuiClient({ workspaceDir: tempWorkspace, quiet: true });
    const tui = new PersonaTui(client);

    assert.ok(tui.personas.length >= 1);
    assert.ok(tui.personas.some((p) => p.id === 'core' || p.is_active !== undefined));

    // Test fallback rendering
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      tui.renderFallback();
      assert.ok(logs.some((l) => l.includes('Available Personas')));
    } finally {
      console.log = origLog;
    }
  });

  test('11. InteractivePrompt real-time matching and command palette', () => {
    const prompt = new InteractivePrompt();

    // Regular text (no slash) should return no matching commands
    prompt.inputBuffer = 'hello world';
    assert.equal(prompt.getMatchingCommands().length, 0);

    // Slash alone should return all available commands
    prompt.inputBuffer = '/';
    const all = prompt.getMatchingCommands();
    assert.ok(all.length >= 8);
    assert.ok(all.some((c: any) => c.cmd === '/model'));
    assert.ok(all.some((c: any) => c.cmd === '/settings'));

    // Filter by partial command name
    prompt.inputBuffer = '/m';
    const mHits = prompt.getMatchingCommands();
    assert.ok(mHits.some((c: any) => c.cmd === '/model'));

    prompt.inputBuffer = '/pers';
    const persHits = prompt.getMatchingCommands();
    assert.equal(persHits.length, 1);
    assert.equal(persHits[0].cmd, '/persona');
  });
});
