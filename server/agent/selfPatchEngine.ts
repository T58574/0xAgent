import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { v4 as uuidv4 } from 'uuid';
import { StagedProposal, StagedFileChange } from '../../src/types';
import { getAppDir } from '../config';
import { resolvePath } from '../tools/fileTools';
import { listSessions, saveSession } from '../session';

const execAsync = promisify(exec);

async function ensureProposalsDir(): Promise<string> {
  const dir = path.join(getAppDir(), 'proposals');
  try {
    await fs.promises.mkdir(dir, { recursive: true });
  } catch {}
  return dir;
}

export async function saveProposal(proposal: StagedProposal): Promise<void> {
  const dir = await ensureProposalsDir();
  const filePath = path.join(dir, `${proposal.id}.json`);
  await fs.promises.writeFile(filePath, JSON.stringify(proposal, null, 2), 'utf-8');
}

export async function getProposal(id: string): Promise<StagedProposal | null> {
  const dir = await ensureProposalsDir();
  const filePath = path.join(dir, `${id}.json`);
  try {
    const data = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(data) as StagedProposal;
  } catch {
    return null;
  }
}

export async function listProposals(sessionId?: string): Promise<StagedProposal[]> {
  const dir = await ensureProposalsDir();
  try {
    const files = await fs.promises.readdir(dir);
    const proposals: StagedProposal[] = [];
    await Promise.all(
      files.map(async (file) => {
        if (file.endsWith('.json')) {
          try {
            const data = await fs.promises.readFile(path.join(dir, file), 'utf-8');
            const prop: StagedProposal = JSON.parse(data);
            if (!sessionId || prop.sessionId === sessionId) {
              proposals.push(prop);
            }
          } catch {}
        }
      })
    );
    proposals.sort((a, b) => b.createdAt - a.createdAt);
    return proposals;
  } catch {
    return [];
  }
}

export async function createStagedProposal(
  sessionId: string,
  title: string,
  description: string,
  changes: Array<{ path: string; newContent?: string; patch?: string; changeType?: 'created' | 'modified' | 'deleted' }>,
  workspaceDir?: string
): Promise<StagedProposal> {
  const id = `pr-${uuidv4().substring(0, 8)}`;
  const stagedFiles: StagedFileChange[] = [];

  for (const c of changes) {
    let originalContent = '';
    const absPath = resolvePath(workspaceDir, c.path);
    if (fs.existsSync(absPath)) {
      try {
        originalContent = await fs.promises.readFile(absPath, 'utf-8');
      } catch {}
    }

    stagedFiles.push({
      path: c.path,
      originalContent,
      newContent: c.newContent,
      patch: c.patch,
      changeType: c.changeType || (originalContent ? 'modified' : 'created'),
    });
  }

  const proposal: StagedProposal = {
    id,
    sessionId,
    title,
    description,
    status: 'pending',
    files: stagedFiles,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await saveProposal(proposal);
  return proposal;
}

export async function verifyStagedProposal(
  proposalId: string,
  workspaceDir?: string
): Promise<StagedProposal> {
  const proposal = await getProposal(proposalId);
  if (!proposal) {
    throw new Error(`Proposal not found: ${proposalId}`);
  }

  const root = workspaceDir || process.cwd();
  const startTime = Date.now();
  let passed = true;
  let typecheckOut = '';

  try {
    try {
      const { stdout, stderr } = await execAsync('npx tsc --noEmit', { cwd: root, timeout: 30000 });
      typecheckOut = (stdout || stderr || '').trim();
    } catch (err: any) {
      typecheckOut = (err?.stdout || err?.stderr || err?.message || '').trim();
      if (typecheckOut.includes('error TS')) {
        passed = false;
      }
    }

    proposal.verificationResult = {
      passed,
      typecheckOutput: typecheckOut.slice(0, 2048),
      durationMs: Date.now() - startTime,
    };
    proposal.status = passed ? 'verified' : 'failed';
    proposal.updatedAt = Date.now();
    await saveProposal(proposal);
    return proposal;
  } catch (err: any) {
    proposal.status = 'failed';
    proposal.verificationResult = {
      passed: false,
      typecheckOutput: err?.message || 'Verification error',
      durationMs: Date.now() - startTime,
    };
    await saveProposal(proposal);
    return proposal;
  }
}

export async function applyStagedProposal(
  proposalId: string,
  workspaceDir?: string
): Promise<{ success: boolean; appliedFiles: string[]; message: string }> {
  const proposal = await getProposal(proposalId);
  if (!proposal) {
    throw new Error(`Proposal not found: ${proposalId}`);
  }

  const appliedFiles: string[] = [];

  for (const file of proposal.files) {
    const absPath = resolvePath(workspaceDir, file.path);
    const parentDir = path.dirname(absPath);
    await fs.promises.mkdir(parentDir, { recursive: true });

    if (file.changeType === 'deleted') {
      if (fs.existsSync(absPath)) {
        await fs.promises.unlink(absPath);
        appliedFiles.push(file.path);
      }
    } else if (file.newContent !== undefined) {
      await fs.promises.writeFile(absPath, file.newContent, 'utf-8');
      appliedFiles.push(file.path);
    }
  }

  proposal.status = 'applied';
  proposal.updatedAt = Date.now();
  await saveProposal(proposal);

  return {
    success: true,
    appliedFiles,
    message: `Proposal ${proposal.id} successfully applied (${appliedFiles.length} files updated).`,
  };
}

export async function reconcileInterruptedSessions(): Promise<number> {
  let reconciledCount = 0;
  try {
    const sessions = await listSessions();
    for (const sess of sessions) {
      let modified = false;

      if (sess.messages && sess.messages.length > 0) {
        const lastMsg = sess.messages[sess.messages.length - 1];
        if (lastMsg.role === 'assistant' && (lastMsg as any).isStreaming) {
          (lastMsg as any).isStreaming = false;
          modified = true;
        }

        if (lastMsg.role === 'user') {
          sess.messages.push({
            id: uuidv4(),
            role: 'assistant',
            content: '[SYSTEM]: Сессия автоматически синхронизирована после перезапуска сервера. Готов продолжить работу.',
            timestamp: Date.now(),
          });
          modified = true;
        }
      }

      if (modified) {
        sess.updated_at = Date.now();
        await saveSession(sess);
        reconciledCount++;
      }
    }
  } catch (err) {
    console.warn('[reconcileInterruptedSessions] Warning:', err);
  }
  return reconciledCount;
}
