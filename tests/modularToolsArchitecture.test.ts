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
import { StreamingOutputCollector, handleOutputSpill, DEFAULT_SPILL_THRESHOLD } from '../server/agent/outputSpiller';

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

  await t.test('5. Streaming Output Spiller & 10KB Threshold Invariant', async () => {
    assert.strictEqual(DEFAULT_SPILL_THRESHOLD, 10 * 1024);

    // 1. In-memory collector below threshold
    const smallCollector = new StreamingOutputCollector('test_small', 10 * 1024);
    smallCollector.append('Short line 1\nShort line 2\n');
    const smallRes = await smallCollector.finalize();
    assert.strictEqual(smallRes.spilled, false);
    assert.strictEqual(smallRes.output, 'Short line 1\nShort line 2\n');

    // 2. Streaming collector exceeding 10 KB
    const largeCollector = new StreamingOutputCollector('test_large', 10 * 1024);
    for (let i = 1; i <= 200; i++) {
      largeCollector.append(`Line ${i}: ` + 'X'.repeat(80) + '\n');
    }
    const largeRes = await largeCollector.finalize();
    assert.strictEqual(largeRes.spilled, true);
    assert.ok(largeRes.filePath && fs.existsSync(largeRes.filePath));
    assert.ok(largeRes.output.includes('ВЫВОД СОКРАЩЕН'));
    assert.ok(largeRes.output.includes('Line 1:'));
    assert.ok(largeRes.output.includes('Line 200:'));

    // Clean up spill file
    if (largeRes.filePath) {
      try { fs.unlinkSync(largeRes.filePath); } catch {}
    }

    // 3. Static handleOutputSpill test
    const oversized = 'A\n'.repeat(6000);
    const spillStatic = await handleOutputSpill(oversized, 'static_tool', 10 * 1024);
    assert.strictEqual(spillStatic.spilled, true);
    assert.ok(spillStatic.output.includes('ВЫВОД СОКРАЩЕН'));
    if (spillStatic.filePath) {
      try { fs.unlinkSync(spillStatic.filePath); } catch {}
    }
  });
});
