import { Router } from 'express';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { execSync, spawn, execFile, ChildProcess } from 'node:child_process';
import { loadConfig, saveConfig } from '../config';

export type BroadcastFn = (event: string, payload: any) => void;

let activeLlamaProcess: ChildProcess | null = null;
let isIntentionalStop = false;
let lastLaunchParams: any = null;

const serverLogsBuffer: string[] = [];
const LLAMA_LOG_DIR = path.join(os.homedir(), '.0xagent', 'logs');
const LLAMA_LOG_FILE = path.join(LLAMA_LOG_DIR, 'llama-server.log');

if (!fs.existsSync(LLAMA_LOG_DIR)) {
  try {
    fs.mkdirSync(LLAMA_LOG_DIR, { recursive: true });
  } catch {}
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
    if (broadcast) {
      broadcast('llama-server-status', { status: 'stopped' });
    }
  }
}

function stripAnsiCodes(str: string): string {
  return str.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '').replace(/\r/g, '');
}

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
        } catch {}
      }
    }
  } catch {}
}

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

let cachedLlamaReleases: any[] | null = null;
let lastLlamaFetchTime: number = 0;
const LLAMA_RELEASES_TTL_MS = 15 * 60 * 1000;

export function createLlamaRouter(broadcast: BroadcastFn): Router {
  const router = Router();

  function appendServerLog(msg: string): void {
    if (!msg) return;
    const timeStr = new Date().toLocaleTimeString();
    const formatted = msg.startsWith('[') ? msg : `[${timeStr}] ${msg}`;

    serverLogsBuffer.push(formatted);
    if (serverLogsBuffer.length > 1000) {
      serverLogsBuffer.shift();
    }

    broadcast('llama-server-log', formatted);

    fs.appendFile(LLAMA_LOG_FILE, `${formatted}\n`, 'utf-8', () => {});
  }

  router.get('/server-logs', (_req, res) => {
    const isRunning = activeLlamaProcess !== null && !activeLlamaProcess.killed;
    res.json({
      logs: serverLogsBuffer,
      logFilePath: LLAMA_LOG_FILE,
      running: isRunning,
    });
  });

  router.get('/server-health', async (req, res) => {
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
      res.json({ ok: isProcessRunning, status: isProcessRunning ? 'loading' : 'stopped', processRunning: isProcessRunning });
    }
  });

  router.get('/server-slots', async (req, res) => {
    const host = (req.query.host as string) || '127.0.0.1';
    const port = (req.query.port as string) || '11434';
    try {
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

  router.get('/llama-releases', async (req, res) => {
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
      if (cachedLlamaReleases) {
        res.json(cachedLlamaReleases);
      } else {
        res.status(500).json({ error: err.message });
      }
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
      const baseName = path.basename(modelPath).replace(/\.gguf$/i, '');
      modelName = baseName
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();
    }
    res.json({ running: isRunning, host, port, modelPath, modelName });
  });

  router.post('/start-local-server', (req, res) => {
    try {
      stopLlamaServerProcess(broadcast);
      const cfg = loadConfig();
      const body = req.body || {};
      
      const host = body.host || cfg.local_server?.host || '127.0.0.1';
      const port = body.port || cfg.local_server?.port || 11434;

      killProcessOnPort(port);
      let targetExe = body.exePath || cfg.local_server?.exe_path || '';
      let targetModel = body.modelPath || cfg.local_server?.model_path || '';

      if (!targetExe || !fs.existsSync(targetExe)) {
        const llamaDir = path.join(os.homedir(), '.0xagent', 'llama');
        if (fs.existsSync(llamaDir)) {
          const rootExe = path.join(llamaDir, 'llama-server.exe');
          if (fs.existsSync(rootExe)) {
            targetExe = rootExe;
          }
        }
      }

      if (!targetModel || !fs.existsSync(targetModel)) {
        const modelsDir = path.join(os.homedir(), '.0xagent', 'models');
        if (fs.existsSync(modelsDir)) {
          const files = fs.readdirSync(modelsDir);
          const gguf = files.find((f) => f.endsWith('.gguf'));
          if (gguf) targetModel = path.join(modelsDir, gguf);
        }
      }

      if (!targetExe || !targetModel || !fs.existsSync(targetExe) || !fs.existsSync(targetModel)) {
        const errorMsg = 'Исполняемый файл llama-server.exe или модель GGUF не найдены.';
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

      const args: string[] = ['-m', targetModel, '--host', host, '--port', String(port)];

      isIntentionalStop = false;
      lastLaunchParams = { targetExe, args, host, port };

      appendServerLog(`[CMD] ${path.basename(targetExe)} ${args.join(' ')}`);
      activeLlamaProcess = spawn(targetExe, args, { cwd: path.dirname(targetExe) });

      broadcast('llama-server-status', { status: 'running', pid: activeLlamaProcess.pid, host, port });

      const handleLogData = (data: Buffer) => {
        const cleanStr = stripAnsiCodes(data.toString()).trim();
        if (cleanStr) appendServerLog(cleanStr);
      };

      activeLlamaProcess.stdout?.on('data', handleLogData);
      activeLlamaProcess.stderr?.on('data', handleLogData);

      activeLlamaProcess.on('exit', (code, signal) => {
        const exitMsg = `[llama.cpp] Процесс завершён (код: ${code}, сигнал: ${signal})`;
        appendServerLog(exitMsg);

        if (!isIntentionalStop && lastLaunchParams) {
          appendServerLog(`[WATCHDOG 🛡️] WARNING: Process crashed (code ${code}). Auto-recovering...`);
          broadcast('llama-server-status', { status: 'recovering' });
          activeLlamaProcess = null;
        } else {
          broadcast('llama-server-status', { status: 'stopped', code, signal });
          activeLlamaProcess = null;
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

  router.get('/installed-llama-versions', (_req, res) => {
    try {
      const appDir = path.join(os.homedir(), '.0xagent');
      const llamaDir = path.join(appDir, 'llama');
      const cfg = loadConfig();
      const activeExe = cfg.local_server?.exe_path || '';
      const installed: { tag: string; exePath: string; isCurrent: boolean }[] = [];

      if (fs.existsSync(llamaDir)) {
        const items = fs.readdirSync(llamaDir, { withFileTypes: true });

        const rootExe = path.join(llamaDir, 'llama-server.exe');
        if (fs.existsSync(rootExe)) {
          installed.push({
            tag: 'default',
            exePath: rootExe,
            isCurrent: activeExe.toLowerCase() === rootExe.toLowerCase(),
          });
        }

        for (const item of items) {
          if (item.isDirectory()) {
            const subDir = path.join(llamaDir, item.name);
            const exePath = path.join(subDir, 'llama-server.exe');
            const altExePath = path.join(subDir, 'llama.exe');
            let targetExe = fs.existsSync(exePath) ? exePath : fs.existsSync(altExePath) ? altExePath : '';

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

  router.post('/install-llama-version', async (req, res) => {
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
      await fs.promises.writeFile(zipPath, Buffer.from(arrayBuf));

      broadcast('agent-error', `Распаковка файла llama.cpp...`);
      await new Promise<void>((resolve, reject) => {
        execFile(
          'powershell',
          ['-NoProfile', '-Command', `Expand-Archive -Path '${zipPath}' -DestinationPath '${versionDir}' -Force`],
          (err: any) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      if (fs.existsSync(zipPath)) {
        await fs.promises.unlink(zipPath);
      }

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
