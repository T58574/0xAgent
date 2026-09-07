import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {
  evaluateToolPermission,
  isForbiddenPrivacyPath,
  FORBIDDEN_PRIVACY_TOOLS,
} from '../server/agent/permissionGuard';
import {
  executeReadFile,
  executeWriteFile,
  executePatchFile,
  executeDeleteFile,
  executeCreateDirectory,
  executeGetFileInfo,
  executeListDir,
  executeGrepSearch,
} from '../server/tools/fileTools';
import { executeShellCommand } from '../server/tools/shellTools';
import { executeCodeProgram } from '../server/agent/codeRuntime';
import { dispatchToolExecution } from '../server/agent/toolDispatcher';
import { generateToolsMdContent, loadToolsToggles } from '../server/toolsConfig';
import { AppConfig } from '../src/types';

const mockConfig: AppConfig = {
  workspace_dir: process.cwd(),
  permission_preset: 'unrestricted',
};

describe('Zero-Trust System Privacy Guard', () => {
  const home = os.homedir();
  const sessionFilePath = path.join(home, '.0xagent', 'sessions', 'test-session-123.json');
  const memoryDbPath = path.join(home, '.0xagent', 'memory.db');
  const transcriptPath = path.join(home, '.gemini', 'antigravity', 'brain', 'xyz', 'logs', 'transcript.jsonl');
  const veronicaDbPath = path.join(home, '.0xagent', 'veronica', 'veronica.db');
  const userMdPath = path.join(home, '.0xagent', 'personas', 'default', 'USER.md');
  const normalFilePath = path.join(process.cwd(), 'package.json');

  test('isForbiddenPrivacyPath accurately classifies sensitive data vs normal files', () => {
    assert.equal(isForbiddenPrivacyPath(sessionFilePath), true);
    assert.equal(isForbiddenPrivacyPath(memoryDbPath), true);
    assert.equal(isForbiddenPrivacyPath(transcriptPath), true);
    assert.equal(isForbiddenPrivacyPath(veronicaDbPath), true);
    assert.equal(isForbiddenPrivacyPath(userMdPath), true);
    assert.equal(isForbiddenPrivacyPath('transcript.jsonl'), true);
    assert.equal(isForbiddenPrivacyPath('transcript_full.jsonl'), true);
    assert.equal(isForbiddenPrivacyPath('conversation_summaries.db'), true);

    // Normal project files must NOT be blocked
    assert.equal(isForbiddenPrivacyPath(normalFilePath), false);
    assert.equal(isForbiddenPrivacyPath('src/session.ts'), false);
    assert.equal(isForbiddenPrivacyPath('src/memory.ts'), false);
  });

  test('evaluateToolPermission blocks forbidden privacy tools', () => {
    assert.equal(FORBIDDEN_PRIVACY_TOOLS.has('search_sessions'), true);
    assert.equal(FORBIDDEN_PRIVACY_TOOLS.has('recall_memories'), true);

    const sessionPerm = evaluateToolPermission('search_sessions', { query: 'secret' }, 'unrestricted');
    assert.equal(sessionPerm.allowed, false);
    assert.match(sessionPerm.reason || '', /SYSTEM PRIVACY GUARD/i);

    const memoryPerm = evaluateToolPermission('recall_memories', { query: 'test' }, 'unrestricted');
    assert.equal(memoryPerm.allowed, false);
    assert.match(memoryPerm.reason || '', /SYSTEM PRIVACY GUARD/i);
  });

  test('evaluateToolPermission blocks access to protected paths in file tools', () => {
    const readSessionPerm = evaluateToolPermission('read_file', { path: sessionFilePath }, 'unrestricted');
    assert.equal(readSessionPerm.allowed, false);
    assert.match(readSessionPerm.reason || '', /protected at the system level/i);

    const readMemPerm = evaluateToolPermission('read_file', { path: memoryDbPath }, 'unrestricted');
    assert.equal(readMemPerm.allowed, false);

    const normalPerm = evaluateToolPermission('read_file', { path: normalFilePath }, 'unrestricted');
    assert.equal(normalPerm.allowed, true);
  });

  test('dispatchToolExecution hard-rejects search_sessions and recall_memories', async () => {
    const sessionRes = await dispatchToolExecution(
      { name: 'search_sessions', arguments: { query: 'test' } },
      mockConfig,
      true
    );
    assert.match(sessionRes, /SYSTEM PRIVACY GUARD|SECURITY REJECTED/i);

    const memRes = await dispatchToolExecution(
      { name: 'recall_memories', arguments: { query: 'test' } },
      mockConfig,
      true
    );
    assert.match(memRes, /SYSTEM PRIVACY GUARD|SECURITY REJECTED/i);
  });

  test('fileTools operations throw [SECURITY ACCESS DENIED] on protected privacy targets', () => {
    assert.throws(() => executeReadFile(null, sessionFilePath), /SECURITY ACCESS DENIED/);
    assert.throws(() => executeReadFile(null, memoryDbPath), /SECURITY ACCESS DENIED/);
    assert.throws(() => executeWriteFile(null, sessionFilePath, 'bad data'), /SECURITY ACCESS DENIED/);
    assert.throws(() => executePatchFile(null, sessionFilePath, '<<<<<<< SEARCH\n=======\n>>>>>>> REPLACE'), /SECURITY ACCESS DENIED/);
    assert.throws(() => executeDeleteFile(null, sessionFilePath), /SECURITY ACCESS DENIED/);
    assert.throws(() => executeCreateDirectory(null, path.join(home, '.0xagent', 'sessions', 'sub')), /SECURITY ACCESS DENIED/);
    assert.throws(() => executeGetFileInfo(null, sessionFilePath), /SECURITY ACCESS DENIED/);
    assert.throws(() => executeListDir(null, path.join(home, '.0xagent', 'sessions')), /SECURITY ACCESS DENIED/);
    assert.throws(() => executeGrepSearch(null, 'password', path.join(home, '.0xagent', 'sessions')), /SECURITY ACCESS DENIED/);
  });

  test('executeShellCommand blocks shell execution targeting protected privacy files', async () => {
    const res1 = await executeShellCommand(null, 'Get-Content ~/.0xagent/sessions/abc.json');
    assert.match(res1, /PRIVACY GUARD/i);

    const res2 = await executeShellCommand(null, 'cat ~/.0xagent/memory.db');
    assert.match(res2, /PRIVACY GUARD/i);

    const res3 = await executeShellCommand(null, 'type transcript.jsonl');
    assert.match(res3, /PRIVACY GUARD/i);
  });

  test('codeRuntime sandboxed JS throws security errors when invoking privacy tools', async () => {
    const runResMem = await executeCodeProgram(
      'await tools.recall_memories({ query: "secret" });',
      mockConfig
    );
    assert.equal(runResMem.success, false);
    assert.match(runResMem.error || '', /SECURITY ACCESS DENIED/);

    const runResSess = await executeCodeProgram(
      'await tools.search_sessions({ query: "secret" });',
      mockConfig
    );
    assert.equal(runResSess.success, false);
    assert.match(runResSess.error || '', /SECURITY ACCESS DENIED/);
  });

  test('toolsConfig and TOOLS.md completely exclude search_sessions and recall_memories', () => {
    const toggles = loadToolsToggles();
    assert.equal(toggles.recall_memories, false);
    assert.equal(toggles.search_sessions, false);

    const toolsMd = generateToolsMdContent(toggles);
    assert.equal(toolsMd.includes('<recall_memories'), false);
    assert.equal(toolsMd.includes('<search_sessions'), false);
  });
});
