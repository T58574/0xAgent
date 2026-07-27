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
} from '../session';
import {
  getWorkspaceTree,
  executeReadFile,
  executeWriteFile,
  selectWorkspaceNative,
  selectFileNative,
  find0xAgentContext,
} from '../tools';

export const workspaceRouter = Router();

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
workspaceRouter.get('/sessions', (_req, res) => {
  try {
    const sessions = listSessions();
    res.json(sessions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

workspaceRouter.get('/sessions/:id', (req, res) => {
  try {
    const session = loadSession(req.params.id);
    res.json(session);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

workspaceRouter.post('/sessions', (req, res) => {
  try {
    const { title, workspace_dir } = req.body || {};
    const newSession = createNewSession(title, workspace_dir);
    res.json(newSession);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

workspaceRouter.post('/sessions/:id/save', (req, res) => {
  try {
    saveSession(req.body);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

workspaceRouter.delete('/sessions/:id', (req, res) => {
  try {
    deleteSession(req.params.id);
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
    if (!audioBase64 || !apiKey) {
      res.status(400).json({ error: 'audioBase64 и apiKey обязательны' });
      return;
    }

    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const formData = new FormData();
    const file = new File([audioBuffer], 'speech.webm', { type: 'audio/webm' });
    formData.append('file', file);
    formData.append('model', 'whisper-large-v3');

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
      },
      body: formData,
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      throw new Error(`Groq API error (${groqRes.status}): ${errText}`);
    }

    const data: any = await groqRes.json();
    res.json({ text: data.text || '' });
  } catch (err: any) {
    console.error('Transcription error:', err);
    res.status(500).json({ error: err.message });
  }
});
