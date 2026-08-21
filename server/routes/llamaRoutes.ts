import { Router } from 'express';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { execSync, spawn, ChildProcess } from 'node:child_process';
import { loadConfig, saveConfig } from '../config';
import { resolveTargetExe, resolveTargetModel, buildLlamaServerArgs } from './llama/llamaArgsBuilder';
import { performCleanupOldLlama, getInstalledLlamaVersions, deleteInstalledLlama, downloadAndExtractLlamaVersion } from './llama/llamaVersionManager';
import { fetchLlamaReleases } from './llama/llamaReleases';

export type BroadcastFn = (event: string, payload: any) => void;

let activeLlamaProcess: ChildProcess | null = null;
let isIntentionalStop = false;
let lastLaunchParams: any = null;

const serverLogsBuffer: string[] = [];
const LLAMA_LOG_DIR = path.join(os.homedir(), '.0xagent', 'logs');
const LLAMA_LOG_FILE = path.join(LLAMA_LOG_DIR, 'llama-server.log');

if (!fs.existsSync(LLAMA_LOG_DIR)) {
  try { fs.mkdirSync(LLAMA_LOG_DIR, { recursive: true }); } catch {}
}

export function purgeGpuVramAndProcesses(broadcast?: BroadcastFn): { success: boolean; message: string; killedCount: number } {
  isIntentionalStop = true;
  stopLlamaServerProcess(broadcast);

  let killedCount = 0;
  if (process.platform === 'win32') {
    const targets = ['llama-server.exe', 'llama.exe', 'llama-bench.exe'];
    for (const target of targets) {
      try {
        execSync(`taskkill /F /T /IM ${target}`, { stdio: 'ignore' });
        killedCount++;
      } catch {}
    }
  } else {
    try {
      execSync('killall -9 llama-server llama 2>/dev/null', { stdio: 'ignore' });
      killedCount++;
    } catch {}
  }

  killProcessOnPort(11434);
  killProcessOnPort(8080);

  if (broadcast) {
    broadcast('llama-server-status', { status: 'stopped' });
  }

  return { success: true, message: 'GPU VRAM очищена, процессы llama-server принудительно остановлены.', killedCount };
}

export function stopLlamaServerProcess(broadcast?: BroadcastFn) {
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
    if (broadcast) broadcast('llama-server-status', { status: 'stopped' });
  }
}

function stripAnsiCodes(str: string): string {
  return str.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '').replace(/\r/g, '');
}

function killProcessOnPort(port: number): void {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr ":${port}" | findstr "LISTENING"`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      const pids = new Set<string>();
      for (const line of output.split(/\r?\n/).filter(Boolean)) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') pids.add(pid);
      }
      for (const pid of pids) {
        try { execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' }); } catch {}
      }
    }
  } catch {}
}

export function createLlamaRouter(broadcast: BroadcastFn): Router {
  const router = Router();

  function appendServerLog(msg: string): void {
    if (!msg) return;
    const timeStr = new Date().toLocaleTimeString();
    const formatted = msg.startsWith('[') ? msg : `[${timeStr}] ${msg}`;
    serverLogsBuffer.push(formatted);
    if (serverLogsBuffer.length > 1000) serverLogsBuffer.shift();
    broadcast('llama-server-log', formatted);
    fs.appendFile(LLAMA_LOG_FILE, `${formatted}\n`, 'utf-8', () => {});
  }

  router.get('/server-logs', (_req, res) => {
    res.json({ logs: serverLogsBuffer, logFilePath: LLAMA_LOG_FILE, running: activeLlamaProcess !== null && !activeLlamaProcess.killed });
  });

  router.get('/server-health', async (req, res) => {
    const cfg = loadConfig();
    const host = (req.query.host as string) || cfg.local_server?.host || '127.0.0.1';
    const port = (req.query.port as string) || cfg.local_server?.port || 11434;
    const processRunning = activeLlamaProcess !== null && !activeLlamaProcess.killed;

    try {
      const response = await fetch(`http://${host}:${port}/health`, { signal: AbortSignal.timeout(4000) });
      const data: any = await response.json().catch(() => ({}));
      const isHealthy = response.ok || data.status === 'ok' || data.status === 'loading model' || data.status === 'no slot available';
      res.json({ ok: isHealthy, status: data.status || 'ok', processRunning: true });
    } catch {
      if (!processRunning) {
        res.json({ ok: false, status: 'stopped', processRunning: false });
      } else {
        res.json({ ok: true, status: 'loading model', processRunning: true });
      }
    }
  });

  router.get('/server-slots', async (req, res) => {
    const host = (req.query.host as string) || '127.0.0.1';
    const port = (req.query.port as string) || '11434';
    if (!activeLlamaProcess || activeLlamaProcess.killed) return res.json({ ok: false, totalSlots: 0, activeSlots: 0 });
    try {
      const response = await fetch(`http://${host}:${port}/slots`, { signal: AbortSignal.timeout(4000) });
      if (response.ok) {
        const slotsData: any[] = await response.json();
        res.json({ ok: true, totalSlots: slotsData.length, activeSlots: slotsData.filter((s) => s.state !== 0 && s.is_processing).length });
      } else {
        res.json({ ok: true, totalSlots: 1, activeSlots: 1 });
      }
    } catch {
      res.json({ ok: true, totalSlots: 1, activeSlots: 1 });
    }
  });

  router.get('/llama-releases', async (req, res) => {
    try {
      const formatted = await fetchLlamaReleases(req.query.refresh === 'true');
      res.json(formatted);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/server-status', (_req, res) => {
    const cfg = loadConfig();
    const host = cfg.local_server?.host || '127.0.0.1';
    const port = cfg.local_server?.port || 11434;
    const isRunning = activeLlamaProcess !== null && !activeLlamaProcess.killed;
    const modelPath = cfg.local_server?.model_path || null;
    let modelName: string | null = null;
    if (modelPath) {
      modelName = path.basename(modelPath).replace(/\.gguf$/i, '').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
    }
    res.json({ running: isRunning, host, port, modelPath, modelName });
  });

  router.post('/start-local-server', (req, res) => {
    try {
      purgeGpuVramAndProcesses(broadcast);
      const cfg = loadConfig();
      const body = req.body || {};
      const host = body.host || cfg.local_server?.host || '127.0.0.1';
      const port = body.port || cfg.local_server?.port || 11434;

      killProcessOnPort(port);
      const targetExe = resolveTargetExe(body.exePath, cfg.local_server?.exe_path);
      const targetModel = resolveTargetModel(body.modelPath, cfg.local_server?.model_path, cfg.workspace_dir);

      if (!targetExe || !targetModel || !fs.existsSync(targetExe) || !fs.existsSync(targetModel)) {
        const errorMsg = `Исполняемый файл llama-server.exe (${targetExe || 'не указан'}) или модель GGUF (${targetModel || 'не указана'}) не найдены.`;
        appendServerLog(`[ERROR] ${errorMsg}`);
        broadcast('llama-server-status', { status: 'stopped', error: errorMsg });
        res.status(400).json({ success: false, error: errorMsg });
        return;
      }

      cfg.api_url = `http://${host}:${port}/v1`;
      if (!cfg.local_server) cfg.local_server = {};
      cfg.local_server.exe_path = targetExe;
      cfg.local_server.model_path = targetModel;
      saveConfig(cfg);

      const { args } = buildLlamaServerArgs({ targetModel, host, port, body, localServerConfig: cfg.local_server, workspaceDir: cfg.workspace_dir, onLog: appendServerLog });
      const launchTimestamp = Date.now();
      isIntentionalStop = false;
      lastLaunchParams = { targetExe, args, host, port };

      appendServerLog(`[CMD] ${path.basename(targetExe)} ${args.join(' ')}`);
      const spawnedProc = spawn(targetExe, args, { cwd: path.dirname(targetExe) });
      activeLlamaProcess = spawnedProc;
      broadcast('llama-server-status', { status: 'running', pid: spawnedProc.pid, host, port });

      const handleLogData = (data: Buffer) => {
        const cleanStr = stripAnsiCodes(data.toString()).trim();
        if (cleanStr) appendServerLog(cleanStr);
      };

      spawnedProc.stdout?.on('data', handleLogData);
      spawnedProc.stderr?.on('data', handleLogData);

      spawnedProc.on('exit', (code, signal) => {
        appendServerLog(`[llama.cpp] Процесс завершён (код: ${code}, сигнал: ${signal})`);
        const runtimeMs = Date.now() - launchTimestamp;

        if (activeLlamaProcess === spawnedProc) {
          activeLlamaProcess = null;
        }

        if (!isIntentionalStop && lastLaunchParams && runtimeMs > 6000) {
          appendServerLog(`[WATCHDOG] WARNING: Process crashed after ${Math.round(runtimeMs / 1000)}s. Auto-recovering...`);
          broadcast('llama-server-status', { status: 'recovering' });
        } else {
          if (!isIntentionalStop && runtimeMs <= 6000) {
            appendServerLog(`[WATCHDOG] Сервер упал при инициализации модели (${(runtimeMs / 1000).toFixed(1)} с). Авто-перезапуск остановлен.`);
          }
          broadcast('llama-server-status', { status: 'stopped', code, signal });
          lastLaunchParams = null;
        }
      });

      res.json({ success: true, host, port, pid: activeLlamaProcess.pid, message: `Сервер запущен на http://${host}:${port}/v1` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/stop-local-server', (_req, res) => {
    stopLlamaServerProcess(broadcast);
    res.json({ success: true, message: 'Локальный сервер остановлен' });
  });

  router.post('/purge-vram', (_req, res) => {
    const result = purgeGpuVramAndProcesses(broadcast);
    res.json(result);
  });

  router.get('/installed-llama-versions', (_req, res) => {
    try {
      const cfg = loadConfig();
      res.json(getInstalledLlamaVersions(cfg.local_server?.exe_path || ''));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/install-llama-version', async (req, res) => {
    try {
      const { tag, downloadUrl, assetName, autoCleanup } = req.body || {};
      if (!tag) {
        res.status(400).json({ error: 'tag is required' });
        return;
      }
      const result = await downloadAndExtractLlamaVersion({ tag, downloadUrl, assetName, autoCleanup, onProgress: (msg) => broadcast('agent-error', msg) });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/select-installed-llama', (req, res) => {
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

  router.post('/delete-installed-llama', (req, res) => {
    try {
      const { tag, exePath } = req.body || {};
      if (!tag && !exePath) {
        res.status(400).json({ error: 'tag or exePath is required' });
        return;
      }
      const deleted = deleteInstalledLlama(tag, exePath);
      if (!deleted) {
        res.status(404).json({ error: 'Указанная сборка не найдена' });
        return;
      }
      res.json({ success: true, message: `Сборка llama.cpp (${tag || 'выбранная'}) успешно удалена!` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/cleanup-old-llama', (req, res) => {
    try {
      const { keepTag } = req.body || {};
      const removedCount = performCleanupOldLlama(keepTag);
      res.json({ success: true, removedCount, message: removedCount > 0 ? `Удалено устаревших версий: ${removedCount}` : 'Устаревших версий не обнаружено' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
