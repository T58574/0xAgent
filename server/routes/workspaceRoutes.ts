import { Router } from 'express';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, saveConfig } from '../config';
import {
  listSessions,
  loadSession,
  saveSession,
  createNewSession,
  deleteSession,
  createAutoWorkspaceDir,
  updateSessionWorkspace,
  rollbackSession,
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

export const workspaceRouter = Router();

// Auto workspace generator (Antigravity-like ephemeral/isolated sandbox workspaces)
workspaceRouter.post('/workspaces/create-auto', async (_req, res) => {
  try {
    const result = await createAutoWorkspaceDir();
    res.json(result);
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
    const clientPort = '5173';

    for (const devName in interfaces) {
      const iface = interfaces[devName];
      if (!iface) continue;
      for (const alias of iface) {
        if (alias.family === 'IPv4' && !alias.internal) {
          urls.push(`http://${alias.address}:${clientPort}`);
        }
      }
    }

    if (urls.length === 0) {
      urls.push(`http://127.0.0.1:${clientPort}`);
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
    const content = executeReadFile(null, filePath);
    res.json({ content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

workspaceRouter.post('/write-file-raw', (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    executeWriteFile(null, filePath, content);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Groq Whisper Voice Transcription
workspaceRouter.post('/transcribe-audio', async (req, res) => {
  try {
    const { audioBase64, apiKey } = req.body;
    const config = loadConfig();
    const effectiveKey = (apiKey || config.groq_api_key || process.env.GROQ_API_KEY || '').trim();

    if (!audioBase64) {
      res.status(400).json({ error: 'audioBase64 обязателен' });
      return;
    }
    if (!effectiveKey) {
      res.status(400).json({ error: 'Groq API ключ не задан в настройках' });
      return;
    }

    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const formData = new FormData();
    const file = new File([audioBuffer], 'speech.webm', { type: 'audio/webm' });
    formData.append('file', file);
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('language', 'ru');
    formData.append('response_format', 'json');
    formData.append('temperature', '0.0');

    const groqEndpoint = process.env.GROQ_STT_ENDPOINT || 'https://api.groq.com/openai/v1/audio/transcriptions';
    let groqRes = await fetch(groqEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${effectiveKey}`,
      },
      body: formData,
    });

    // Fallback to whisper-large-v3 if turbo model unavailable
    if (!groqRes.ok && groqRes.status === 404) {
      const fallbackData = new FormData();
      fallbackData.append('file', new File([audioBuffer], 'speech.webm', { type: 'audio/webm' }));
      fallbackData.append('model', 'whisper-large-v3');
      fallbackData.append('language', 'ru');
      groqRes = await fetch(groqEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${effectiveKey}`,
        },
        body: fallbackData,
      });
    }

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      throw new Error(`Groq API error (${groqRes.status}): ${errText}`);
    }

    const data: any = await groqRes.json();
    res.json({ text: (data.text || '').trim() });
  } catch (err: any) {
    console.error('Transcription error:', err);
    res.status(500).json({ error: err.message || 'Ошибка транскрибации Groq' });
  }
});
