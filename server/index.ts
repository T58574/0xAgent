import express from 'express';
import cors from 'cors';
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { execSync, spawn, ChildProcess } from 'node:child_process';
import { WebSocketServer, WebSocket } from 'ws';
import {
  loadConfig,
  saveConfig,
} from './config';
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
  find0xAgentContext,
} from './tools';
import {
  runAgentLoop,
  cancelAgentSession,
  respondToToolConfirmation,
} from './agent';
import { parseGgufMetadata, GgufMetadata } from './ggufParser';
import { detectGpuHardware } from './hardware';
import { loadMemories, addOrUpdateMemory, deleteMemory, queryMemories } from './memory';
import { listSkills, readSkill, writeSkill, deleteSkill } from './skills';
import {
  listPersonas,
  getPersonaDetail,
  setActivePersona,
  createPersona,
  updatePersonaFile,
  updatePersonaMetadata,
  deletePersona,
} from './personas';
import { loadSummarizerPrompt, saveSummarizerPrompt } from './summarizer';
import {
  isPasswordSet,
  setupMasterPassword,
  loginMasterPassword,
  changeMasterPassword,
  verifySessionToken,
  revokeSessionToken,
  checkBruteForceLockout,
} from './auth';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Auth verification middleware for API requests
app.use((req, res, next) => {
  const publicAuthPaths = [
    '/api/auth/status',
    '/api/auth/setup',
    '/api/auth/login',
  ];

  if (!req.path.startsWith('/api/') || publicAuthPaths.includes(req.path)) {
    return next();
  }

  if (isPasswordSet()) {
    const authHeader = req.headers.authorization;
    const queryToken = req.query.token as string | undefined;
    const token = authHeader || queryToken;

    if (!verifySessionToken(token)) {
      res.status(401).json({ error: 'Unauthorized: Требуется авторизация мастер-паролем' });
      return;
    }
  }

  next();
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const clients = new Set<WebSocket>();

wss.on('connection', (ws, req) => {
  const urlParams = new URLSearchParams((req.url || '').split('?')[1] || '');
  const token = urlParams.get('token') || (req.headers['sec-websocket-protocol'] as string);

  if (isPasswordSet() && !verifySessionToken(token)) {
    console.warn('[WEBSOCKET SECURITY] Rejected unauthenticated WebSocket connection request');
    ws.close(4001, 'Unauthorized');
    return;
  }

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

// Authentication Endpoints
app.get('/api/auth/status', (req, res) => {
  const token = req.headers.authorization || (req.query.token as string);
  const passwordSet = isPasswordSet();
  const authenticated = !passwordSet || verifySessionToken(token);
  const lockout = checkBruteForceLockout();
  res.json({
    isPasswordSet: passwordSet,
    isAuthenticated: authenticated,
    locked: lockout.locked,
    remainingSec: lockout.remainingSec,
  });
});

app.post('/api/auth/setup', (req, res) => {
  const { password } = req.body || {};
  const result = setupMasterPassword(password);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.post('/api/auth/login', (req, res) => {
  const { password } = req.body || {};
  const result = loginMasterPassword(password);
  if (result.success) {
    res.json(result);
  } else {
    res.status(401).json(result);
  }
});

app.post('/api/auth/change-password', (req, res) => {
  const token = req.headers.authorization || (req.query.token as string);
  if (!verifySessionToken(token)) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  const { currentPassword, newPassword } = req.body || {};
  const result = changeMasterPassword(currentPassword, newPassword);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers.authorization || (req.query.token as string);
  revokeSessionToken(token);
  res.json({ success: true });
});

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


// Memory Endpoints (~/.0xagent/memory.json)
app.get('/api/memories', (req, res) => {
  try {
    const query = req.query.query as string;
    const list = query ? queryMemories(query) : loadMemories();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/memories', (req, res) => {
  try {
    const { key, value, category } = req.body;
    const item = addOrUpdateMemory(key, value, category);
    res.json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/memories/:id', (req, res) => {
  try {
    const success = deleteMemory(req.params.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Skills Endpoints (~/.0xagent/skills/)
app.get('/api/skills', (_req, res) => {
  try {
    const skills = listSkills();
    res.json(skills);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/skills/:name', (req, res) => {
  try {
    const content = readSkill(req.params.name);
    res.json({ name: req.params.name, content });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/skills/:name', (req, res) => {
  try {
    const { content } = req.body;
    writeSkill(req.params.name, content || '');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/skills/:name', (req, res) => {
  try {
    deleteSkill(req.params.name);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Personas & Modification Window Endpoints (~/.0xagent/personas/)
app.get('/api/personas', (_req, res) => {
  try {
    const personas = listPersonas();
    res.json(personas);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/personas/:id', (req, res) => {
  try {
    const detail = getPersonaDetail(req.params.id);
    if (!detail) {
      res.status(404).json({ error: 'Persona not found' });
      return;
    }
    res.json(detail);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/personas', (req, res) => {
  try {
    const { name, description, icon } = req.body || {};
    const created = createPersona(name, description, icon);
    res.json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/personas/:id/activate', (req, res) => {
  try {
    const personas = setActivePersona(req.params.id);
    res.json(personas);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/personas/:id/file', (req, res) => {
  try {
    const { filename, content } = req.body;
    if (!['SOUL.md', 'TOOLS.md', 'USER.md'].includes(filename)) {
      res.status(400).json({ error: 'Filename must be SOUL.md, TOOLS.md, or USER.md' });
      return;
    }
    const updated = updatePersonaFile(req.params.id, filename, content || '');
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/personas/:id/meta', (req, res) => {
  try {
    const updated = updatePersonaMetadata(req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/personas/:id', (req, res) => {
  try {
    deletePersona(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Summarizer Prompt Endpoints (~/.0xagent/prompts/summarizer.md)
app.get('/api/summarizer-prompt', (_req, res) => {
  try {
    const content = loadSummarizerPrompt();
    res.json({ content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/summarizer-prompt', (req, res) => {
  try {
    const { content } = req.body;
    saveSummarizerPrompt(content || '');
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
    const { title, workspace_dir } = req.body || {};
    const newSession = createNewSession(title, workspace_dir);
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
app.post('/api/select-workspace', async (_req, res) => {
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

app.post('/api/select-file', async (req, res) => {
  try {
    const { filter } = req.body;
    const filePath = await selectFileNative(filter);
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

app.get('/api/workspace-context', (req, res) => {
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
    // Using File object guarantees filename="speech.webm" in multipart/form-data header
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
app.post('/api/parse-gguf', (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath || !fs.existsSync(filePath)) {
      res.status(400).json({ error: 'Valid filePath is required' });
      return;
    }
    const meta = parseGgufMetadata(filePath);
    res.json(meta);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Recursively scan directory for GGUF model files & extract metadata
app.get('/api/scan-models-dir', async (req, res) => {
  try {
    const targetDir = (req.query.dirPath as string) || path.join(os.homedir(), '.0xagent', 'models');
    if (!fs.existsSync(targetDir)) {
      res.json({ dirPath: targetDir, models: [] });
      return;
    }

    const models: GgufMetadata[] = [];

    async function scanDir(dir: string, depth: number) {
      if (depth > 3 || models.length > 100) return;
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (models.length > 100) break;
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!['.git', 'node_modules', 'dist', 'build', '.idea', '.vscode'].includes(entry.name)) {
              await scanDir(fullPath, depth + 1);
            }
          } else if (entry.isFile() && entry.name.endsWith('.gguf')) {
            models.push(parseGgufMetadata(fullPath));
          }
        }
      } catch {}
    }

    await scanDir(targetDir, 0);
    res.json({ dirPath: targetDir, models });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GPU Hardware Auto-Detector
app.get('/api/detect-hardware', (_req, res) => {
  try {
    const hw = detectGpuHardware();
    res.json(hw);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Persistent Server Logs Buffer & File Storage (~/.0xagent/logs/llama-server.log)
const serverLogsBuffer: string[] = [];
const LLAMA_LOG_DIR = path.join(os.homedir(), '.0xagent', 'logs');
const LLAMA_LOG_FILE = path.join(LLAMA_LOG_DIR, 'llama-server.log');

if (!fs.existsSync(LLAMA_LOG_DIR)) {
  try {
    fs.mkdirSync(LLAMA_LOG_DIR, { recursive: true });
  } catch {}
}

function appendServerLog(msg: string): void {
  if (!msg) return;
  const timeStr = new Date().toLocaleTimeString();
  const formatted = msg.startsWith('[') ? msg : `[${timeStr}] ${msg}`;

  serverLogsBuffer.push(formatted);
  if (serverLogsBuffer.length > 1000) {
    serverLogsBuffer.shift();
  }

  broadcast('llama-server-log', formatted);

  try {
    fs.appendFileSync(LLAMA_LOG_FILE, `${formatted}\n`, 'utf-8');
  } catch {}
}

// Endpoint to fetch full historical server log lines & log file path
app.get('/api/server-logs', (_req, res) => {
  try {
    const isRunning = activeLlamaProcess !== null && !activeLlamaProcess.killed;
    res.json({
      logs: serverLogsBuffer,
      logFilePath: LLAMA_LOG_FILE,
      running: isRunning,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Server Health Checker (/health polling)
app.get('/api/server-health', async (req, res) => {
  try {
    const cfg = loadConfig();
    const host = (req.query.host as string) || cfg.local_server?.host || '127.0.0.1';
    const port = (req.query.port as string) || cfg.local_server?.port || 11434;
    const isProcessRunning = activeLlamaProcess !== null && !activeLlamaProcess.killed;

    try {
      const response = await fetch(`http://${host}:${port}/health`, { signal: AbortSignal.timeout(1800) });
      const data: any = await response.json().catch(() => ({}));
      const isHealthy = response.ok || data.status === 'ok' || data.status === 'loading model' || data.status === 'no slot available';

      res.json({
        ok: isHealthy || isProcessRunning,
        status: data.status || (isProcessRunning ? 'loading' : 'stopped'),
        processRunning: isProcessRunning,
      });
    } catch {
      res.json({
        ok: isProcessRunning,
        status: isProcessRunning ? 'loading' : 'stopped',
        processRunning: isProcessRunning,
      });
    }
  } catch {
    const isProcessRunning = activeLlamaProcess !== null && !activeLlamaProcess.killed;
    res.json({ ok: isProcessRunning, status: isProcessRunning ? 'loading' : 'stopped', processRunning: isProcessRunning });
  }
});

// Server Live Slot Metrics (/slots polling)
app.get('/api/server-slots', async (req, res) => {
  try {
    const host = (req.query.host as string) || '127.0.0.1';
    const port = (req.query.port as string) || '11434';
    const response = await fetch(`http://${host}:${port}/slots`, { signal: AbortSignal.timeout(1500) });
    if (response.ok) {
      const slotsData: any[] = await response.json();
      const activeSlots = slotsData.filter((s) => s.state !== 0 && s.is_processing).length;
      res.json({ ok: true, totalSlots: slotsData.length, activeSlots });
    } else {
      res.json({ ok: false, totalSlots: 0, activeSlots: 0 });
    }
  } catch {
    res.json({ ok: false, totalSlots: 0, activeSlots: 0 });
  }
});

// Llama.cpp GitHub Release Parser & Installer with Version Retention

// 1. Fetch GitHub Releases list for ggerganov/llama.cpp with 15-min TTL Cache
let cachedLlamaReleases: any[] | null = null;
let lastLlamaFetchTime: number = 0;
const LLAMA_RELEASES_TTL_MS = 15 * 60 * 1000; // 15 minutes

app.get('/api/llama-releases', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const now = Date.now();

    if (!forceRefresh && cachedLlamaReleases && now - lastLlamaFetchTime < LLAMA_RELEASES_TTL_MS) {
      res.json(cachedLlamaReleases);
      return;
    }

    const response = await fetch('https://api.github.com/repos/ggerganov/llama.cpp/releases?per_page=15', {
      headers: { 'User-Agent': '0xAgent-LocalApp' }
    });

    if (!response.ok) {
      if (cachedLlamaReleases) {
        res.json(cachedLlamaReleases);
        return;
      }
      throw new Error(`GitHub API error (${response.status}): ${response.statusText}`);
    }

    const releases: any[] = await response.json();
    const formatted = releases.map((rel) => {
      const zipAssets = (rel.assets || [])
        .filter((a: any) => a.name.endsWith('.zip') || a.name.endsWith('.tar.gz') || a.name.endsWith('.exe'))
        .map((a: any) => ({
          name: a.name,
          download_url: a.browser_download_url,
          size: `${(a.size / (1024 * 1024)).toFixed(1)} MB`,
        }));

      return {
        tag: rel.tag_name,
        name: rel.name || rel.tag_name,
        published_at: rel.published_at,
        assets: zipAssets,
      };
    });

    cachedLlamaReleases = formatted;
    lastLlamaFetchTime = now;

    res.json(formatted);
  } catch (err: any) {
    console.error('Failed to fetch llama releases:', err);
    if (cachedLlamaReleases) {
      res.json(cachedLlamaReleases);
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

let activeLlamaProcess: ChildProcess | null = null;

// Kill any process occupying a given port (handles orphaned llama-server from tsx restarts)
function killProcessOnPort(port: number): void {
  try {
    if (process.platform === 'win32') {
      const output = execSync(
        `netstat -ano | findstr ":${port}" | findstr "LISTENING"`,
        { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
      ).trim();
      const lines = output.split(/\r?\n/).filter(Boolean);
      const pids = new Set<string>();
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') pids.add(pid);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
          console.log(`[llama.cpp] Killed orphaned process PID ${pid} on port ${port}`);
        } catch {}
      }
    }
  } catch {
    // No process found on port — safe to proceed
  }
}

function stripAnsiCodes(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '').replace(/\r/g, '');
}

let isIntentionalStop = false;
let lastLaunchParams: any = null;

function stopLlamaServerProcess() {
  isIntentionalStop = true;
  if (activeLlamaProcess) {
    try {
      if (process.platform === 'win32' && activeLlamaProcess.pid) {
        execSync(`taskkill /F /T /PID ${activeLlamaProcess.pid}`, { stdio: 'ignore' });
      } else {
        activeLlamaProcess.kill('SIGKILL');
      }
    } catch {}
    activeLlamaProcess = null;
    broadcast('llama-server-status', { status: 'stopped' });
  }
}

// Graceful process exit handlers for 0xAgent backend node process
const cleanupOnExit = () => {
  stopLlamaServerProcess();
};
process.on('SIGINT', () => { cleanupOnExit(); process.exit(0); });
process.on('SIGTERM', () => { cleanupOnExit(); process.exit(0); });
process.on('exit', () => { cleanupOnExit(); });
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  cleanupOnExit();
  process.exit(1);
});

// Live server status query route
app.get('/api/server-status', (_req, res) => {
  try {
    const cfg = loadConfig();
    const host = cfg.local_server?.host || '127.0.0.1';
    const port = cfg.local_server?.port || 11434;
    const isRunning = activeLlamaProcess !== null && !activeLlamaProcess.killed;
    res.json({
      running: isRunning,
      host,
      port,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// 2. Start Local Llama.cpp Server Endpoint
app.post('/api/start-local-server', (req, res) => {
  try {
    stopLlamaServerProcess();

    const cfg = loadConfig();
    const body = req.body || {};
    
    const host = body.host || cfg.local_server?.host || '127.0.0.1';
    const port = body.port || cfg.local_server?.port || 11434;

    // Kill orphaned llama-server processes that may still hold the port
    killProcessOnPort(port);
    let targetExe = body.exePath || cfg.local_server?.exe_path || '';
    let targetModel = body.modelPath || cfg.local_server?.model_path || '';

    // Auto-detect installed llama.cpp binary if missing
    if (!targetExe || !fs.existsSync(targetExe)) {
      const llamaDir = path.join(os.homedir(), '.0xagent', 'llama');
      if (fs.existsSync(llamaDir)) {
        const rootExe = path.join(llamaDir, 'llama-server.exe');
        if (fs.existsSync(rootExe)) {
          targetExe = rootExe;
        } else {
          const items = fs.readdirSync(llamaDir, { withFileTypes: true });
          for (const item of items) {
            if (item.isDirectory()) {
              const subExe = path.join(llamaDir, item.name, 'llama-server.exe');
              const altExe = path.join(llamaDir, item.name, 'llama.exe');
              if (fs.existsSync(subExe)) { targetExe = subExe; break; }
              if (fs.existsSync(altExe)) { targetExe = altExe; break; }
            }
          }
        }
      }
    }

    // Auto-detect downloaded GGUF model if missing
    if (!targetModel || !fs.existsSync(targetModel)) {
      const modelsDir = path.join(os.homedir(), '.0xagent', 'models');
      if (fs.existsSync(modelsDir)) {
        const files = fs.readdirSync(modelsDir);
        const gguf = files.find((f) => f.endsWith('.gguf'));
        if (gguf) targetModel = path.join(modelsDir, gguf);
      }
    }

    const missingExe = !targetExe || !fs.existsSync(targetExe);
    const missingModel = !targetModel || !fs.existsSync(targetModel);

    if (missingExe || missingModel) {
      const details: string[] = [];
      if (missingExe) details.push(`Исполняемый файл (llama-server.exe) не найден: "${targetExe || 'не задан'}"`);
      if (missingModel) details.push(`Файл GGUF модели (.gguf) не найден: "${targetModel || 'не задан'}"`);
      const errorMsg = `Не удалось запустить сервер llama.cpp:\n${details.join('\n')}`;
      console.error(`[llama.cpp] ${errorMsg}`);
      broadcast('llama-server-log', `[ERROR] ${errorMsg}`);
      broadcast('llama-server-status', { status: 'stopped', error: errorMsg });
      res.status(400).json({ success: false, error: errorMsg });
      return;
    }

    cfg.api_url = `http://${host}:${port}/v1`;
    if (!cfg.local_server) cfg.local_server = {};
    cfg.local_server.exe_path = targetExe;
    cfg.local_server.model_path = targetModel;
    cfg.local_server.host = host;
    cfg.local_server.port = port;
    saveConfig(cfg);

    const args: string[] = [
      '-m', targetModel,
      '--host', host,
      '--port', String(port),
    ];

    const getVal = (bodyVal: any, cfgVal: any) => bodyVal !== undefined && bodyVal !== null ? bodyVal : cfgVal;

    const ctxVal = getVal(body.ctxSize, cfg.local_server?.ctx_size ?? 65536);
    if (typeof ctxVal === 'number' && ctxVal > 0) args.push('-c', String(ctxVal));

    const nglVal = getVal(body.gpuLayers, cfg.local_server?.gpu_layers ?? 99);
    if (typeof nglVal === 'number') args.push('-ngl', String(nglVal));

    const rawThreads = getVal(body.threads, cfg.local_server?.threads);
    const threadsVal = typeof rawThreads === 'number' && rawThreads > 0 ? rawThreads : 12;
    args.push('-t', String(threadsVal));

    const embVal = getVal(body.embedding, cfg.local_server?.embedding);
    if (embVal === true) args.push('--embedding');

    const ubatchVal = getVal(body.ubatchSize, cfg.local_server?.ubatch_size ?? 512);
    let batchVal = getVal(body.batchSize, cfg.local_server?.batch_size ?? 2048);

    // If embedding is enabled, llama-server requires n_batch <= n_ubatch
    if (embVal === true && typeof batchVal === 'number' && typeof ubatchVal === 'number' && batchVal > ubatchVal) {
      batchVal = ubatchVal;
    }

    if (typeof batchVal === 'number' && batchVal > 0) args.push('-b', String(batchVal));
    if (typeof ubatchVal === 'number' && ubatchVal > 0) args.push('-ub', String(ubatchVal));

    const tempVal = getVal(body.temp, cfg.local_server?.temp ?? 1.05);
    if (typeof tempVal === 'number') args.push('--temp', String(tempVal));

    const rpVal = getVal(body.repeatPenalty, cfg.local_server?.repeat_penalty ?? 1.1);
    if (typeof rpVal === 'number') args.push('--repeat-penalty', String(rpVal));

    const minPVal = getVal(body.minP, cfg.local_server?.min_p ?? 0.08);
    if (typeof minPVal === 'number') args.push('--min-p', String(minPVal));

    const topKVal = getVal(body.topK, cfg.local_server?.top_k ?? 40);
    if (typeof topKVal === 'number') args.push('--top-k', String(topKVal));

    const topPVal = getVal(body.topP, cfg.local_server?.top_p ?? 1);
    if (typeof topPVal === 'number') args.push('--top-p', String(topPVal));

    const predictVal = getVal(body.predict, cfg.local_server?.predict);
    if (typeof predictVal === 'number' && predictVal > 0) args.push('-n', String(predictVal));

    // Flash Attention: only pass -fa on if explicitly set to true
    const faVal = getVal(body.flashAttn, cfg.local_server?.flash_attn);
    if (faVal === true) {
      args.push('-fa', 'on');
    }

    const mmapVal = getVal(body.mmap, cfg.local_server?.mmap ?? true);
    if (mmapVal === false) args.push('--no-mmap');

    const mlockVal = getVal(body.mlock, cfg.local_server?.mlock);
    if (mlockVal === true) args.push('--mlock');

    const cbVal = getVal(body.contBatching, cfg.local_server?.cont_batching ?? true);
    if (cbVal !== false) args.push('--cont-batching');

    // Multi-slot parallel processing (default 2 parallel execution slots)
    const npVal = getVal(body.parallelSlots, cfg.local_server?.parallel_slots ?? 2);
    if (typeof npVal === 'number' && npVal > 0) args.push('--parallel', String(npVal));

    // Prefix Caching & Instant TTFT
    const crVal = getVal(body.cacheReuse, cfg.local_server?.cache_reuse ?? 256);
    if (typeof crVal === 'number' && crVal > 0) args.push('--cache-reuse', String(crVal));

    // Slot Save Directory
    const defaultSlotsDir = path.join(os.homedir(), '.0xagent', 'slots');
    const slotsDir = getVal(body.slotSavePath, cfg.local_server?.slot_save_path || defaultSlotsDir);
    if (slotsDir && typeof slotsDir === 'string') {
      try {
        if (!fs.existsSync(slotsDir)) {
          fs.mkdirSync(slotsDir, { recursive: true });
        }
      } catch {}
      args.push('--slot-save-path', slotsDir);
    }

    // Additional Custom CLI Arguments (e.g. --tensor-split 1,1)
    const extraCustomArgs = getVal(body.customArgs, cfg.local_server?.custom_args);
    if (extraCustomArgs && typeof extraCustomArgs === 'string' && extraCustomArgs.trim()) {
      const tokens = extraCustomArgs.trim().split(/\s+/).filter(Boolean);
      args.push(...tokens);
    }

    // Save launch parameters for Watchdog Auto-Recovery
    isIntentionalStop = false;
    lastLaunchParams = { targetExe, args, host, port };

    // Log full launch command for diagnostics
    const cmdLine = `${path.basename(targetExe)} ${args.join(' ')}`;
    console.log(`[llama.cpp] Spawning: ${cmdLine}`);
    appendServerLog(`[CMD] ${cmdLine}`);

    activeLlamaProcess = spawn(targetExe, args, { cwd: path.dirname(targetExe) });

    broadcast('llama-server-status', {
      status: 'running',
      pid: activeLlamaProcess.pid,
      host,
      port,
      exePath: targetExe,
      modelPath: targetModel,
    });

    let lastLogText = '';
    let lastLogTime = 0;

    const handleLogData = (data: Buffer) => {
      const cleanStr = stripAnsiCodes(data.toString()).trim();
      if (!cleanStr) return;
      const now = Date.now();
      if (cleanStr === lastLogText && now - lastLogTime < 150) {
        return; // Suppress duplicate line emitted simultaneously on stdout & stderr
      }
      lastLogText = cleanStr;
      lastLogTime = now;
      appendServerLog(cleanStr);
    };

    activeLlamaProcess.stdout?.on('data', handleLogData);
    activeLlamaProcess.stderr?.on('data', handleLogData);

    activeLlamaProcess.on('error', (err) => {
      console.error('[llama.cpp] Process error:', err.message);
      appendServerLog(`[ERROR] ${err.message}`);
      broadcast('llama-server-status', { status: 'stopped', error: err.message });
      broadcast('agent-error', `Ошибка сервера llama.cpp: ${err.message}`);
      activeLlamaProcess = null;
    });

    activeLlamaProcess.on('exit', (code, signal) => {
      const exitMsg = `[llama.cpp] Процесс завершён (код: ${code}, сигнал: ${signal})`;
      console.log(exitMsg);
      appendServerLog(exitMsg);

      if (!isIntentionalStop && lastLaunchParams) {
        console.warn(`[Watchdog 🛡️] ALERT: llama-server process died unexpectedly! Auto-recovering in 1.5s...`);
        appendServerLog(`[WATCHDOG 🛡️] WARNING: Process crashed (code ${code}). Auto-recovering in 1.5s...`);
        broadcast('llama-server-status', { status: 'recovering' });
        activeLlamaProcess = null;

        setTimeout(() => {
          if (!activeLlamaProcess && !isIntentionalStop && lastLaunchParams) {
            console.log(`[Watchdog 🛡️] Auto-respawning llama-server...`);
            const p = lastLaunchParams;
            activeLlamaProcess = spawn(p.targetExe, p.args, { cwd: path.dirname(p.targetExe) });
            activeLlamaProcess.stdout?.on('data', handleLogData);
            activeLlamaProcess.stderr?.on('data', handleLogData);
            broadcast('llama-server-status', {
              status: 'running',
              pid: activeLlamaProcess.pid,
              host: p.host,
              port: p.port,
            });
          }
        }, 1500);
      } else {
        broadcast('llama-server-status', { status: 'stopped', code, signal });
        activeLlamaProcess = null;
      }
    });

    res.json({ success: true, host, port, pid: activeLlamaProcess.pid, message: `Локальный сервер запущен на http://${host}:${port}/v1` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/stop-local-server', (_req, res) => {
  try {
    stopLlamaServerProcess();
    res.json({ success: true, message: 'Локальный сервер остановлен' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Scan locally saved/installed llama.cpp versions
app.get('/api/installed-llama-versions', (_req, res) => {
  try {
    const appDir = path.join(os.homedir(), '.0xagent');
    const llamaDir = path.join(appDir, 'llama');
    const cfg = loadConfig();
    const activeExe = cfg.local_server?.exe_path || '';

    const installed: { tag: string; exePath: string; isCurrent: boolean }[] = [];

    if (fs.existsSync(llamaDir)) {
      const items = fs.readdirSync(llamaDir, { withFileTypes: true });

      // Check root llamaDir executable
      const rootExe = path.join(llamaDir, 'llama-server.exe');
      if (fs.existsSync(rootExe)) {
        installed.push({
          tag: 'default',
          exePath: rootExe,
          isCurrent: activeExe.toLowerCase() === rootExe.toLowerCase(),
        });
      }

      // Check version subdirectories
      for (const item of items) {
        if (item.isDirectory()) {
          const subDir = path.join(llamaDir, item.name);
          const exePath = path.join(subDir, 'llama-server.exe');
          const altExePath = path.join(subDir, 'llama.exe');
          
          let targetExe = '';
          if (fs.existsSync(exePath)) targetExe = exePath;
          else if (fs.existsSync(altExePath)) targetExe = altExePath;

          if (targetExe) {
            installed.push({
              tag: item.name,
              exePath: targetExe,
              isCurrent: activeExe.toLowerCase() === targetExe.toLowerCase(),
            });
          }
        }
      }
    }

    res.json(installed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Install selected llama.cpp version from GitHub or switch to existing version
app.post('/api/install-llama-version', async (req, res) => {
  try {
    const { tag, downloadUrl, assetName } = req.body;
    if (!tag) {
      res.status(400).json({ error: 'tag is required' });
      return;
    }

    const appDir = path.join(os.homedir(), '.0xagent');
    const llamaDir = path.join(appDir, 'llama');
    const versionDir = path.join(llamaDir, tag);

    if (!fs.existsSync(versionDir)) {
      fs.mkdirSync(versionDir, { recursive: true });
    }

    let exePath = path.join(versionDir, 'llama-server.exe');
    if (!fs.existsSync(exePath)) {
      const altExe = path.join(versionDir, 'llama.exe');
      if (fs.existsSync(altExe)) exePath = altExe;
    }

    // Check if already installed locally
    if (fs.existsSync(exePath)) {
      const cfg = loadConfig();
      if (!cfg.local_server) cfg.local_server = {};
      cfg.local_server.exe_path = exePath;
      saveConfig(cfg);
      res.json({ exePath, message: `Версия llama.cpp ${tag} уже установлена!` });
      return;
    }

    if (!downloadUrl) {
      res.status(400).json({ error: 'downloadUrl обязателен для новой установки' });
      return;
    }

    broadcast('agent-error', `Скачивание llama.cpp (${tag})...`);
    const zipName = assetName || `llama-${tag}.zip`;
    const zipPath = path.join(versionDir, zipName);

    const downloadRes = await fetch(downloadUrl);
    if (!downloadRes.ok) {
      throw new Error(`Download failed: ${downloadRes.statusText}`);
    }

    const arrayBuf = await downloadRes.arrayBuffer();
    fs.writeFileSync(zipPath, Buffer.from(arrayBuf));

    broadcast('agent-error', `Распаковка файла llama.cpp...`);
    execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${versionDir}' -Force"`);

    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    // Look for extracted executable
    if (!fs.existsSync(exePath)) {
      const files = fs.readdirSync(versionDir);
      const foundExe = files.find(f => f.toLowerCase() === 'llama-server.exe' || f.toLowerCase() === 'llama.exe');
      if (foundExe) {
        exePath = path.join(versionDir, foundExe);
      }
    }

    const cfg = loadConfig();
    if (!cfg.local_server) cfg.local_server = {};
    cfg.local_server.exe_path = exePath;
    saveConfig(cfg);

    // Handle auto-cleanup if requested
    const { autoCleanup } = req.body;
    if (autoCleanup) {
      performCleanupOldLlama(tag);
    }

    broadcast('agent-error', `Версия llama.cpp ${tag} успешно установлена!`);
    res.json({ exePath, message: `Llama.cpp (${tag}) успешно установлен!` });
  } catch (err: any) {
    console.error('Llama install version error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper for cleaning up older llama version folders
function performCleanupOldLlama(currentKeepTag?: string): number {
  const appDir = path.join(os.homedir(), '.0xagent');
  const llamaDir = path.join(appDir, 'llama');
  if (!fs.existsSync(llamaDir)) return 0;

  const cfg = loadConfig();
  const activeExe = cfg.local_server?.exe_path || '';
  let removedCount = 0;

  const items = fs.readdirSync(llamaDir, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory()) {
      const itemTag = item.name;
      const subDir = path.join(llamaDir, itemTag);
      const subExe = path.join(subDir, 'llama-server.exe');
      const altExe = path.join(subDir, 'llama.exe');
      const exe = fs.existsSync(subExe) ? subExe : fs.existsSync(altExe) ? altExe : '';

      const isCurrentActive = Boolean(exe && activeExe.toLowerCase() === exe.toLowerCase());
      const isTargetTag = Boolean(currentKeepTag && itemTag.toLowerCase() === currentKeepTag.toLowerCase());

      if (!isCurrentActive && !isTargetTag) {
        try {
          fs.rmSync(subDir, { recursive: true, force: true });
          removedCount++;
        } catch (err) {
          console.error(`Failed to remove old llama version ${itemTag}:`, err);
        }
      }
    }
  }

  return removedCount;
}

// 4. Select installed llama.cpp version without re-downloading
app.post('/api/select-installed-llama', (req, res) => {
  try {
    const { exePath } = req.body;
    if (!exePath || !fs.existsSync(exePath)) {
      res.status(404).json({ error: 'Исполняемый файл не найден' });
      return;
    }

    const cfg = loadConfig();
    if (!cfg.local_server) cfg.local_server = {};
    cfg.local_server.exe_path = exePath;
    saveConfig(cfg);

    res.json({ exePath, message: 'Активная версия llama.cpp обновлена!' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Delete specified installed llama.cpp build
app.post('/api/delete-installed-llama', (req, res) => {
  try {
    const { tag, exePath } = req.body || {};
    if (!tag && !exePath) {
      res.status(400).json({ error: 'tag or exePath is required' });
      return;
    }

    const appDir = path.join(os.homedir(), '.0xagent');
    const llamaDir = path.join(appDir, 'llama');

    let deleted = false;
    if (tag && tag !== 'default') {
      const versionDir = path.join(llamaDir, tag);
      if (fs.existsSync(versionDir)) {
        fs.rmSync(versionDir, { recursive: true, force: true });
        deleted = true;
      }
    } else if (exePath && fs.existsSync(exePath)) {
      if (fs.statSync(exePath).isDirectory()) {
        fs.rmSync(exePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(exePath);
      }
      deleted = true;
    }

    if (!deleted) {
      res.status(404).json({ error: 'Указанная сборка не найдена' });
      return;
    }

    const cfg = loadConfig();
    const activeExe = cfg.local_server?.exe_path || '';
    if (exePath && activeExe.toLowerCase() === exePath.toLowerCase()) {
      let fallbackExe = '';
      if (fs.existsSync(llamaDir)) {
        const items = fs.readdirSync(llamaDir, { withFileTypes: true });
        for (const item of items) {
          if (item.isDirectory()) {
            const subExe = path.join(llamaDir, item.name, 'llama-server.exe');
            const altExe = path.join(llamaDir, item.name, 'llama.exe');
            if (fs.existsSync(subExe)) { fallbackExe = subExe; break; }
            if (fs.existsSync(altExe)) { fallbackExe = altExe; break; }
          }
        }
      }
      if (!cfg.local_server) cfg.local_server = {};
      cfg.local_server.exe_path = fallbackExe;
      saveConfig(cfg);
    }

    res.json({ success: true, message: `Сборка llama.cpp (${tag || 'выбранная'}) успешно удалена!` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Manual trigger to clean up old installed llama.cpp versions
app.post('/api/cleanup-old-llama', (req, res) => {
  try {
    const { keepTag } = req.body || {};
    const removedCount = performCleanupOldLlama(keepTag);
    res.json({ success: true, removedCount, message: removedCount > 0 ? `Удалено устаревших версий: ${removedCount}` : 'Устаревших версий не обнаружено' });
  } catch (err: any) {
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
    try {
      const session = loadSession(sessionId);
      const errMsg = `⚠️ **Системная ошибка выполнения Агента:**\n\`\`\`\n${err.message || err}\n\`\`\``;
      session.messages.push({
        id: uuidv4(),
        role: 'assistant',
        content: errMsg,
        timestamp: Date.now(),
      });
      session.updated_at = Date.now();
      saveSession(session);
      broadcast('agent-error', { sessionId, message: errMsg });
    } catch {}
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

server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 0xAgent Local Server running at http://0.0.0.0:${PORT}`);
  console.log(`🔌 WebSocket server listening on ws://0.0.0.0:${PORT}/ws`);
});

