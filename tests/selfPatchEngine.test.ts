import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  createStagedProposal,
  getProposal,
  listProposals,
  applyStagedProposal,
  reconcileInterruptedSessions,
} from '../server/agent/selfPatchEngine';

describe('Self-Improvement & Pull Request Staged Proposal Subsystem', () => {
  const testWorkspace = path.join(os.tmpdir(), `0xagent-proposal-test-${Date.now()}`);

  before(async () => {
    await fs.promises.mkdir(testWorkspace, { recursive: true });
    await fs.promises.writeFile(path.join(testWorkspace, 'demo.ts'), 'export const hello = "world";\n', 'utf-8');
  });

  after(async () => {
    try {
      await fs.promises.rm(testWorkspace, { recursive: true, force: true });
    } catch {}
  });

  it('should create and retrieve a staged proposal with file changes', async () => {
    const proposal = await createStagedProposal(
      'test-session-123',
      'Optimize parser and add type checks',
      'Refactors core routines with improved safety.',
      [
        {
          path: 'demo.ts',
          newContent: 'export const hello = "universe";\nexport const version = 2;\n',
          changeType: 'modified',
        },
        {
          path: 'newFeature.ts',
          newContent: 'export const feature = true;\n',
          changeType: 'created',
        },
      ],
      testWorkspace
    );

    assert.ok(proposal.id.startsWith('pr-'));
    assert.strictEqual(proposal.status, 'pending');
    assert.strictEqual(proposal.files.length, 2);

    const fetched = await getProposal(proposal.id);
    assert.ok(fetched);
    assert.strictEqual(fetched.title, 'Optimize parser and add type checks');
  });

  it('should list proposals filtered by sessionId', async () => {
    const all = await listProposals('test-session-123');
    assert.ok(all.length >= 1);
    assert.ok(all.some((p) => p.sessionId === 'test-session-123'));
  });

  it('should apply staged proposal atomically to workspace files', async () => {
    const proposal = await createStagedProposal(
      'test-session-apply',
      'Apply update test',
      'Testing atomic application.',
      [
        {
          path: 'demo.ts',
          newContent: 'export const hello = "applied_value";\n',
          changeType: 'modified',
        },
      ],
      testWorkspace
    );

    const result = await applyStagedProposal(proposal.id, testWorkspace);
    assert.strictEqual(result.success, true);
    assert.ok(result.appliedFiles.includes('demo.ts'));

    const content = await fs.promises.readFile(path.join(testWorkspace, 'demo.ts'), 'utf-8');
    assert.strictEqual(content, 'export const hello = "applied_value";\n');

    const updatedProp = await getProposal(proposal.id);
    assert.strictEqual(updatedProp?.status, 'applied');
  });

  it('should reconcile interrupted sessions without errors', async () => {
    const count = await reconcileInterruptedSessions();
    assert.ok(typeof count === 'number');
  });
});
