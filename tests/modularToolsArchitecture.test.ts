import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  resolvePath,
  executeReadFile,
  executeWriteFile,
  executePatchFile,
  executeCreateDirectory,
  executeGetFileInfo,
  executeListDir,
  executeGrepSearch,
  executeShellCommand,
  find0xAgentContext,
  getWorkspace0xAgentMdContext,
} from '../server/tools';

test('Modular Tools & Abstractions Architecture Test Suite', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), '0xagent-tools-test-'));

  t.after(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  await t.test('1. Sandboxed Path Resolution & Boundary Check', () => {
    const inside = resolvePath(tmpDir, 'test.txt');
    assert.strictEqual(inside, path.normalize(path.resolve(tmpDir, 'test.txt')));

    // Should throw on directory traversal attempts escaping workspace boundary
    assert.throws(() => {
      resolvePath(tmpDir, '../../escaped.txt');
    }, /outside the active workspace directory/i);
  });

  await t.test('2. File I/O & Fuzzy Search/Replace Patching', () => {
    const testFilePath = path.join(tmpDir, 'sample.ts');
    const initialContent = [
      'export function calculateSum(a: number, b: number): number {',
      '  const result = a + b;',
      '  return result;',
      '}',
    ].join('\n');

    executeWriteFile(tmpDir, 'sample.ts', initialContent);
    const readBack = executeReadFile(tmpDir, 'sample.ts');
    assert.strictEqual(readBack, initialContent);

    // Apply SEARCH / REPLACE patch block
    const patch = [
      '<<<<<<< SEARCH',
      '  const result = a + b;',
      '  return result;',
      '=======',
      '  const result = (a + b) * 2;',
      '  return result;',
      '>>>>>>> REPLACE',
    ].join('\n');

    const patchResult = executePatchFile(tmpDir, 'sample.ts', patch);
    assert.match(patchResult, /applied 1 patch block/i);

    const patchedContent = executeReadFile(tmpDir, 'sample.ts');
    assert.ok(patchedContent.includes('(a + b) * 2;'));
  });

  await t.test('3. Shell Safety & Destructive Command Interception', async () => {
    // Dangerous commands must be blocked immediately
    const blockedOutput = await executeShellCommand(tmpDir, 'del /s /q c:\\system32\\drivers');
    assert.match(blockedOutput, /SYSTEM BLOCKED/i);

    // Safe command execution
    const safeOutput = await executeShellCommand(tmpDir, 'echo 0xAgent-Sanity-Check');
    assert.match(safeOutput, /0xAgent-Sanity-Check/i);
  });

  await t.test('4. Workspace Context & Metadata Introspection', () => {
    const contextContent = '# Workspace Rules\nKeep all abstractions clean.';
    executeWriteFile(tmpDir, '0xagent.md', contextContent);

    const found = find0xAgentContext(tmpDir);
    assert.ok(found);
    assert.strictEqual(found?.content, contextContent);

    const fullContext = getWorkspace0xAgentMdContext(tmpDir);
    assert.ok(fullContext.includes('BEGIN 0xagent.md DIRECTIVES'));
    assert.ok(fullContext.includes('Keep all abstractions clean.'));
  });
});
