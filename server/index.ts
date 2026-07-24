import express from 'express';
import cors from 'cors';
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { WebSocketServer, WebSocket } from 'ws';
import { loadConfig, saveConfig } from './config';
import {
  listSessions,
  loadSession,
  saveSession,
  createNewSession,
  deleteSession,
} from './session';
import {
  getWorkspaceTree,
  executeReadFile,
  executeWriteFile,
  selectWorkspaceNative,
  selectFileNative,
} from './tools';
import {
  runAgentLoop,
  cancelAgentSession,
  respondToToolConfirmation,
} from './agent';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
});

function broadcast(event: string, payload: any): void {
  const message = JSON.stringify({ event, payload });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// Config endpoints
app.get('/api/config', (_req, res) => {
  try {
    const cfg = loadConfig();
    res.json(cfg);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config', (req, res) => {
  try {
    saveConfig(req.body);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Real Local LAN IPs endpoint for mobile network sharing
app.get('/api/get-local-ips', (_req, res) => {
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
app.get('/api/sessions', (_req, res) => {
  try {
    const sessions = listSessions();
    res.json(sessions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sessions/:id', (req, res) => {
  try {
    const session = loadSession(req.params.id);
    res.json(session);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/sessions', (req, res) => {
  try {
    const { title } = req.body;
    const newSession = createNewSession(title);
    res.json(newSession);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions/:id/save', (req, res) => {
  try {
    saveSession(req.body);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sessions/:id', (req, res) => {
  try {
    deleteSession(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Native Workspace & File Dialogs
app.post('/api/select-workspace', (_req, res) => {
  try {
    const folder = selectWorkspaceNative();
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

app.post('/api/select-file', (req, res) => {
  try {
    const { filter } = req.body;
    const filePath = selectFileNative(filter);
    res.json({ filePath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/workspace-tree', (req, res) => {
  try {
    const workspaceDir = req.query.workspaceDir as string | undefined;
    const tree = getWorkspaceTree(workspaceDir);
    res.json(tree);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/read-file-raw', (req, res) => {
  try {
    const filePath = req.query.path as string;
    const content = executeReadFile(null, filePath);
    res.json({ content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/write-file-raw', (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    executeWriteFile(null, filePath, content);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Groq Whisper Voice Transcription
app.post('/api/transcribe-audio', async (req, res) => {
  try {
    const { audioBase64, apiKey } = req.body;
    if (!audioBase64 || !apiKey) {
      res.status(400).json({ error: 'audioBase64 и apiKey обязательны' });
      return;
    }

    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: 'audio/webm' });
    formData.append('file', blob, 'speech.webm');
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
      throw new Error(`Groq API error: ${errText}`);
    }

    const data: any = await groqRes.json();
    res.json({ text: data.text || '' });
  } catch (err: any) {
    console.error('Transcription error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Llama.cpp Installer & Model Downloader
app.post('/api/install-llama', async (_req, res) => {
  try {
    const appDir = path.join(os.homedir(), '.0xagent');
    const llamaDir = path.join(appDir, 'llama');
    if (!fs.existsSync(llamaDir)) {
      fs.mkdirSync(llamaDir, { recursive: true });
    }

    const exePath = path.join(llamaDir, 'llama-server.exe');
    if (fs.existsSync(exePath)) {
      const cfg = loadConfig();
      if (!cfg.local_server) cfg.local_server = {};
      cfg.local_server.exe_path = exePath;
      saveConfig(cfg);
      res.json({ exePath, message: 'llama-server.exe уже установлен!' });
      return;
    }

    const releasesRes = await fetch('https://api.github.com/repos/ggerganov/llama.cpp/releases/latest', {
      headers: { 'User-Agent': '0xAgent' }
    });
    
    if (!releasesRes.ok) {
      throw new Error('Failed to fetch llama.cpp latest github release');
    }

    const releaseData: any = await releasesRes.json();
    const asset = releaseData.assets?.find((a: any) => a.name.includes('bin-win-cuda') || a.name.includes('bin-win-x64'));
    
    if (!asset) {
      throw new Error('No Windows binary asset found in latest llama.cpp release');
    }

    const zipPath = path.join(llamaDir, asset.name);
    const downloadRes = await fetch(asset.browser_download_url);
    const arrayBuf = await downloadRes.arrayBuffer();
    fs.writeFileSync(zipPath, Buffer.from(arrayBuf));

    execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${llamaDir}' -Force"`);

    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    const cfg = loadConfig();
    if (!cfg.local_server) cfg.local_server = {};
    cfg.local_server.exe_path = exePath;
    saveConfig(cfg);

    res.json({ exePath, message: 'llama.cpp успешно установлен!' });
  } catch (err: any) {
    console.error('Llama install error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/gguf-models', (_req, res) => {
  const models = [
    {
      id: 'qwen2.5-coder-7b',
      name: 'Qwen2.5 Coder 7B Instruct (Q4_K_M)',
      desc: 'Лучшая модель для написания кода (4.7 GB)',
      filename: 'Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf',
      url: 'https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/qwen2.5-coder-7b-instruct-q4_k_m.gguf',
      size: '4.7 GB',
    },
    {
      id: 'llama-3.2-3b',
      name: 'Llama 3.2 3B Instruct (Q4_K_M)',
      desc: 'Быстрая компактная модель от Meta (2.0 GB)',
      filename: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
      url: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
      size: '2.0 GB',
    },
    {
      id: 'deepseek-r1-qwen-7b',
      name: 'DeepSeek R1 Distill Qwen 7B (Q4_K_M)',
      desc: 'Мощная модель с рефлексией <think> (4.7 GB)',
      filename: 'DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf',
      url: 'https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-7B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf',
      size: '4.7 GB',
    },
  ];
  res.json(models);
});

app.post('/api/download-model', async (req, res) => {
  try {
    const { downloadUrl, fileName } = req.body;
    const appDir = path.join(os.homedir(), '.0xagent');
    const modelsDir = path.join(appDir, 'models');
    if (!fs.existsSync(modelsDir)) {
      fs.mkdirSync(modelsDir, { recursive: true });
    }

    const modelPath = path.join(modelsDir, fileName);
    if (fs.existsSync(modelPath)) {
      const cfg = loadConfig();
      if (!cfg.local_server) cfg.local_server = {};
      cfg.local_server.model_path = modelPath;
      saveConfig(cfg);
      res.json({ modelPath, message: 'Модель уже загружена!' });
      return;
    }

    broadcast('agent-error', `Начало загрузки GGUF: ${fileName}`);
    const downloadRes = await fetch(downloadUrl);
    if (!downloadRes.ok) throw new Error(`Download failed: ${downloadRes.statusText}`);

    const fileStream = fs.createWriteStream(modelPath);
    // @ts-ignore
    const body = downloadRes.body;
    if (body) {
      // @ts-ignore
      for await (const chunk of body) {
        fileStream.write(chunk);
      }
    }
    fileStream.end();

    const cfg = loadConfig();
    if (!cfg.local_server) cfg.local_server = {};
    cfg.local_server.model_path = modelPath;
    saveConfig(cfg);

    broadcast('agent-error', `Загрузка завершена: ${fileName}`);
    res.json({ modelPath, message: 'Модель успешно загружена!' });
  } catch (err: any) {
    console.error('Model download error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Agent execution endpoints
app.post('/api/send-message', (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }

  const config = loadConfig();
  runAgentLoop(sessionId, config, broadcast).catch((err) => {
    console.error('Agent loop error:', err);
    broadcast('agent-error', `Agent runtime error: ${err.message}`);
    broadcast('agent-status-changed', 'idle');
  });

  res.json({ success: true });
});

app.post('/api/cancel-agent', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId) {
    cancelAgentSession(sessionId);
  }
  res.json({ success: true });
});

app.post('/api/respond-to-tool', (req, res) => {
  const { sessionId, toolCallId, approve } = req.body;
  const ok = respondToToolConfirmation(sessionId, toolCallId, approve);
  res.json({ success: ok });
});

server.listen(PORT, () => {
  console.log(`🚀 0xAgent Local Server running at http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server listening on ws://localhost:${PORT}/ws`);
});
