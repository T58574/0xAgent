import express from 'express';
import cors from 'cors';
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { v4 as uuidv4 } from 'uuid';
import { execSync, spawn, ChildProcess } from 'node:child_process';
import { WebSocketServer, WebSocket } from 'ws';
import {
  loadConfig,
  saveConfig,
  listPromptFiles,
  readPromptFile,
  writePromptFile,
  deletePromptFile,
  setActivePromptFile,
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

// System Prompts Files endpoints (~/.0xagent/prompts/)
app.get('/api/prompts', (_req, res) => {
  try {
    const files = listPromptFiles();
    res.json(files);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/prompts/:filename', (req, res) => {
  try {
    const content = readPromptFile(req.params.filename);
    res.json({ filename: req.params.filename, content });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/prompts/:filename', (req, res) => {
  try {
    const { content } = req.body;
    writePromptFile(req.params.filename, content || '');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/prompts/:filename', (req, res) => {
  try {
    deletePromptFile(req.params.filename);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/prompts-select', (req, res) => {
  try {
    const { filename } = req.body;
    const updatedCfg = setActivePromptFile(filename);
    res.json(updatedCfg);
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

// Server Health Checker (/health polling)
app.get('/api/server-health', async (req, res) => {
  try {
    const host = (req.query.host as string) || '127.0.0.1';
    const port = (req.query.port as string) || '11434';
    const response = await fetch(`http://${host}:${port}/health`, { signal: AbortSignal.timeout(1500) });
    if (response.ok) {
      const data = await response.json();
      res.json({ ok: true, status: data.status || 'ok' });
    } else {
      res.json({ ok: false, status: 'loading' });
    }
  } catch {
    res.json({ ok: false, status: 'stopped' });
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

function stopLlamaServerProcess() {
  if (activeLlamaProcess) {
    try {
      if (process.platform === 'win32' && activeLlamaProcess.pid) {
        execSync(`taskkill /F /T /PID ${activeLlamaProcess.pid}`, { stdio: 'ignore' });
      } else {
        activeLlamaProcess.kill('SIGKILL');
      }
    } catch {}
    activeLlamaProcess = null;
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

    cfg.api_url = `http://${host}:${port}/v1`;
    if (!cfg.local_server) cfg.local_server = {};
    if (targetExe) cfg.local_server.exe_path = targetExe;
    if (targetModel) cfg.local_server.model_path = targetModel;
    cfg.local_server.host = host;
    cfg.local_server.port = port;
    saveConfig(cfg);

    if (targetExe && fs.existsSync(targetExe) && targetModel && fs.existsSync(targetModel)) {
      const args: string[] = [
        '-m', targetModel,
        '--host', host,
        '--port', String(port),
      ];

      const getVal = (bodyVal: any, cfgVal: any) => bodyVal !== undefined && bodyVal !== null ? bodyVal : cfgVal;

      const ctxVal = getVal(body.ctxSize, cfg.local_server.ctx_size);
      if (ctxVal !== undefined && ctxVal !== null) args.push('-c', String(ctxVal));

      const nglVal = getVal(body.gpuLayers, cfg.local_server.gpu_layers);
      if (nglVal !== undefined && nglVal !== null) args.push('-ngl', String(nglVal));

      const threadsVal = getVal(body.threads, cfg.local_server.threads);
      if (threadsVal !== undefined && threadsVal !== null) args.push('-t', String(threadsVal));

      const batchVal = getVal(body.batchSize, cfg.local_server.batch_size);
      if (batchVal !== undefined && batchVal !== null) args.push('-b', String(batchVal));

      const ubatchVal = getVal(body.ubatchSize, cfg.local_server.ubatch_size);
      if (ubatchVal !== undefined && ubatchVal !== null) args.push('-ub', String(ubatchVal));

      const tempVal = getVal(body.temp, cfg.local_server.temp);
      if (tempVal !== undefined && tempVal !== null) args.push('--temp', String(tempVal));

      const rpVal = getVal(body.repeatPenalty, cfg.local_server.repeat_penalty);
      if (rpVal !== undefined && rpVal !== null) args.push('--repeat-penalty', String(rpVal));

      const minPVal = getVal(body.minP, cfg.local_server.min_p);
      if (minPVal !== undefined && minPVal !== null) args.push('--min-p', String(minPVal));

      const faVal = getVal(body.flashAttn, cfg.local_server.flash_attn);
      if (faVal === true) args.push('-fa');

      const mmapVal = getVal(body.mmap, cfg.local_server.mmap);
      if (mmapVal === false) args.push('--no-mmap');

      const mlockVal = getVal(body.mlock, cfg.local_server.mlock);
      if (mlockVal === true) args.push('--mlock');

      const embVal = getVal(body.embedding, cfg.local_server.embedding);
      if (embVal === true) args.push('--embedding');

      const cbVal = getVal(body.contBatching, cfg.local_server.cont_batching);
      if (cbVal === true) args.push('--cont-batching');

      // Log full launch command for diagnostics
      const cmdLine = `${path.basename(targetExe)} ${args.join(' ')}`;
      console.log(`[llama.cpp] Spawning: ${cmdLine}`);
      broadcast('llama-server-log', `[CMD] ${cmdLine}`);

      activeLlamaProcess = spawn(targetExe, args, { cwd: path.dirname(targetExe) });

      activeLlamaProcess.stdout?.on('data', (data) => {
        const str = data.toString();
        broadcast('llama-server-log', str);
      });

      activeLlamaProcess.stderr?.on('data', (data) => {
        const str = data.toString();
        broadcast('llama-server-log', str);
      });

      activeLlamaProcess.on('error', (err) => {
        console.error('[llama.cpp] Process error:', err.message);
        broadcast('llama-server-log', `[ERROR] ${err.message}`);
        broadcast('agent-error', `Ошибка сервера llama.cpp: ${err.message}`);
        activeLlamaProcess = null;
      });

      activeLlamaProcess.on('exit', (code, signal) => {
        const exitMsg = `[llama.cpp] Процесс завершён (код: ${code}, сигнал: ${signal})`;
        console.log(exitMsg);
        broadcast('llama-server-log', exitMsg);
        // Only broadcast as error if crashed (non-zero exit code)
        if (code !== null && code !== 0) {
          broadcast('agent-error', `Сервер llama.cpp аварийно завершился (код: ${code}). Проверьте логи сервера.`);
        }
        activeLlamaProcess = null;
      });
    } else {
      const missingExe = !targetExe || !fs.existsSync(targetExe);
      const missingModel = !targetModel || !fs.existsSync(targetModel);
      const details: string[] = [];
      if (missingExe) details.push(`exe_path: "${targetExe || 'не задан'}"`);
      if (missingModel) details.push(`model_path: "${targetModel || 'не задан'}"`);
      broadcast('llama-server-log', `[ERROR] Не удалось запустить: ${details.join(', ')}`);
    }

    res.json({ success: true, host, port, message: `Локальный сервер запущен на http://${host}:${port}/v1` });
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

    broadcast('agent-error', `Версия llama.cpp ${tag} успешно установлена!`);
    res.json({ exePath, message: `Llama.cpp (${tag}) успешно установлен!` });
  } catch (err: any) {
    console.error('Llama install version error:', err);
    res.status(500).json({ error: err.message });
  }
});

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
    const { downloadUrl, fileName } = req.body || {};
    if (!downloadUrl || !fileName) {
      res.status(400).json({ error: 'downloadUrl and fileName are required' });
      return;
    }

    const appDir = path.join(os.homedir(), '.0xagent');
    const modelsDir = path.join(appDir, 'models');
    if (!fs.existsSync(modelsDir)) {
      fs.mkdirSync(modelsDir, { recursive: true });
    }

    const modelPath = path.join(modelsDir, path.basename(fileName));
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
    if (!downloadRes.ok) throw new Error(`Download failed (${downloadRes.status}): ${downloadRes.statusText}`);

    const fileStream = fs.createWriteStream(modelPath);
    try {
      // @ts-ignore
      const body = downloadRes.body;
      if (body) {
        // @ts-ignore
        const nodeStream = Readable.fromWeb ? Readable.fromWeb(body as any) : body;
        // @ts-ignore
        await pipeline(nodeStream, fileStream);
      }
    } catch (streamErr) {
      fileStream.close();
      if (fs.existsSync(modelPath)) fs.unlinkSync(modelPath);
      throw streamErr;
    }

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

