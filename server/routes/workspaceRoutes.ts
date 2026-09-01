import { Router } from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, saveConfig, getAppDir } from '../config';
import {
  listSessions,
  loadSession,
  saveSession,
  createNewSession,
  deleteSession,
  createAutoWorkspaceDir,
  updateSessionWorkspace,
  rollbackSession,
  cleanupOrphanWorkspaces,
} from '../session';
import { forkSession } from '../agent/sessionEvents';
import {
  getWorkspaceTree,
  executeReadFile,
  executeWriteFile,
  selectWorkspaceNative,
  selectFileNative,
  find0xAgentContext,
} from '../tools';
import {
  listProposals,
  getProposal,
  createStagedProposal,
  verifyStagedProposal,
  applyStagedProposal,
} from '../agent/selfPatchEngine';

export const workspaceRouter = Router();

// Dynamic Jarvis workspace directory endpoint (cross-platform, user-agnostic)
workspaceRouter.get('/jarvis/workspace', (_req, res) => {
  try {
    const jarvisDir = path.join(getAppDir(), 'workspaces', 'Jarvis');
    if (!fs.existsSync(jarvisDir)) {
      fs.mkdirSync(jarvisDir, { recursive: true });
    }
    res.json({ workspaceDir: jarvisDir });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Auto workspace generator (Antigravity-like ephemeral/isolated sandbox workspaces)
workspaceRouter.post('/workspaces/create-auto', async (_req, res) => {
  try {
    const result = await createAutoWorkspaceDir();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Manual / maintenance orphan workspaces cleanup (removes leftover sandboxes not tied to any active session)
workspaceRouter.post('/workspaces/cleanup-orphans', async (_req, res) => {
  try {
    const result = await cleanupOrphanWorkspaces();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update specific session workspace
workspaceRouter.post('/sessions/:id/workspace', async (req, res) => {
  try {
    const { workspace_dir } = req.body || {};
    const updated = await updateSessionWorkspace(req.params.id, workspace_dir || null);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Rollback session context to specific message and restore prompt
workspaceRouter.post('/sessions/:id/rollback', async (req, res) => {
  try {
    const { targetMessageId, mode } = req.body || {};
    if (!targetMessageId) {
      return res.status(400).json({ error: 'targetMessageId is required' });
    }
    const result = await rollbackSession(req.params.id, targetMessageId, mode || 'to_user_edit');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Fork session checkpoint
workspaceRouter.post('/sessions/:id/fork', async (req, res) => {
  try {
    const { fromMessageId, newTitle } = req.body || {};
    const forked = await forkSession(req.params.id, fromMessageId, newTitle);
    res.json(forked);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Real Local LAN IPs endpoint for mobile network sharing
workspaceRouter.get('/get-local-ips', (_req, res) => {
  try {
    const interfaces = os.networkInterfaces();
    const urls: string[] = [];
    const clientPort = process.env.CLIENT_PORT || '5173';
    const proto = process.env.DISABLE_HTTPS === 'true' ? 'http' : 'https';

    for (const devName in interfaces) {
      const iface = interfaces[devName];
      if (!iface) continue;
      for (const alias of iface) {
        if (alias.family === 'IPv4' && !alias.internal) {
          urls.push(`${proto}://${alias.address}:${clientPort}`);
        }
      }
    }

    if (urls.length === 0) {
      urls.push(`${proto}://127.0.0.1:${clientPort}`);
    }

    res.json({ urls });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Session endpoints
workspaceRouter.get('/sessions', async (_req, res) => {
  try {
    const sessions = await listSessions();
    res.json(sessions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

workspaceRouter.get('/sessions/:id', async (req, res) => {
  try {
    const session = await loadSession(req.params.id);
    res.json(session);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

workspaceRouter.post('/sessions', async (req, res) => {
  try {
    const { title, workspace_dir } = req.body || {};
    const newSession = await createNewSession(title, workspace_dir);
    res.json(newSession);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

workspaceRouter.post('/sessions/:id/save', async (req, res) => {
  try {
    await saveSession(req.body);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

workspaceRouter.delete('/sessions/:id', async (req, res) => {
  try {
    await deleteSession(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Native Workspace & File Dialogs
workspaceRouter.post('/select-workspace', async (_req, res) => {
  try {
    const folder = await selectWorkspaceNative();
    if (folder) {
      const cfg = loadConfig();
      cfg.workspace_dir = folder;
      saveConfig(cfg);
      res.json({ folder });
    } else {
      res.json({ folder: null });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

workspaceRouter.post('/select-file', async (req, res) => {
  try {
    const { filter } = req.body;
    const filePath = await selectFileNative(filter);
    res.json({ filePath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

workspaceRouter.get('/workspace-tree', (req, res) => {
  try {
    const workspaceDir = req.query.workspaceDir as string | undefined;
    const tree = getWorkspaceTree(workspaceDir);
    res.json(tree);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

workspaceRouter.get('/workspace-context', (req, res) => {
  try {
    const cfg = loadConfig();
    const targetDir = (req.query.workspaceDir as string) || cfg.workspace_dir || process.cwd();
    const found = find0xAgentContext(targetDir);
    if (found) {
      res.json({ loaded: true, filePath: found.filePath, filename: path.basename(found.filePath), content: found.content });
    } else {
      res.json({ loaded: false, filePath: null, filename: null, content: null });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

workspaceRouter.get('/read-file-raw', (req, res) => {
  try {
    const filePath = req.query.path as string;
    const workspaceDir = (req.query.workspaceDir as string) || null;
    const content = executeReadFile(workspaceDir, filePath);
    res.json({ content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

workspaceRouter.post('/write-file-raw', (req, res) => {
  try {
    const { path: filePath, content, workspaceDir } = req.body;
    executeWriteFile(workspaceDir || null, filePath, content);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// Self-Improvement & Pull Request Staged Proposals Endpoints
workspaceRouter.get('/staging/proposals', async (req, res) => {
  try {
    const sessionId = req.query.sessionId as string | undefined;
    const proposals = await listProposals(sessionId);
    res.json({ proposals });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list proposals' });
  }
});

workspaceRouter.get('/staging/proposals/:id', async (req, res) => {
  try {
    const proposal = await getProposal(req.params.id);
    if (!proposal) {
      res.status(404).json({ error: 'Proposal not found' });
      return;
    }
    res.json({ proposal });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get proposal' });
  }
});

workspaceRouter.post('/staging/proposals', async (req, res) => {
  try {
    const { sessionId, title, description, changes, workspaceDir } = req.body;
    if (!sessionId || !title || !Array.isArray(changes)) {
      res.status(400).json({ error: 'sessionId, title, and changes array are required' });
      return;
    }
    const proposal = await createStagedProposal(sessionId, title, description || '', changes, workspaceDir);
    res.json({ success: true, proposal });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create proposal' });
  }
});

workspaceRouter.post('/staging/proposals/:id/verify', async (req, res) => {
  try {
    const { workspaceDir } = req.body;
    const proposal = await verifyStagedProposal(req.params.id, workspaceDir);
    res.json({ success: true, proposal });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to verify proposal' });
  }
});

workspaceRouter.post('/staging/proposals/:id/apply', async (req, res) => {
  try {
    const { workspaceDir } = req.body;
    const result = await applyStagedProposal(req.params.id, workspaceDir);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to apply proposal' });
  }
});
