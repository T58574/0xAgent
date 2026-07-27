import { Router } from 'express';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { execSync, spawn, ChildProcess } from 'node:child_process';
import { loadConfig, saveConfig } from '../config';

type BroadcastFn = (event: string, payload: any) => void;

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
  // eslint-disable-next-line no-control-regex
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
          console.log(`[llama.cpp] Killed orphaned process PID ${pid} on port ${port}`);
        } catch {}
      }
    }
  } catch {
    // No process found on port — safe to proceed
  }
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

// GitHub Releases TTL Cache
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

    try {
      fs.appendFileSync(LLAMA_LOG_FILE, `${formatted}\n`, 'utf-8');
    } catch {}
  }

  router.get('/server-logs', (_req, res) => {
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

  router.get('/server-health', async (req, res) => {
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

  router.get('/server-slots', async (req, res) => {
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
      console.error('Failed to fetch llama releases:', err);
      if (cachedLlamaReleases) {
        res.json(cachedLlamaReleases);
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  router.get('/server-status', (_req, res) => {
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
        appendServerLog(`[ERROR] ${errorMsg}`);
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

      const npVal = getVal(body.parallelSlots, cfg.local_server?.parallel_slots ?? 2);
      if (typeof npVal === 'number' && npVal > 0) args.push('--parallel', String(npVal));

      const crVal = getVal(body.cacheReuse, cfg.local_server?.cache_reuse ?? 256);
      if (typeof crVal === 'number' && crVal > 0) args.push('--cache-reuse', String(crVal));

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

      const extraCustomArgs = getVal(body.customArgs, cfg.local_server?.custom_args);
      if (extraCustomArgs && typeof extraCustomArgs === 'string' && extraCustomArgs.trim()) {
        const tokens = extraCustomArgs.trim().split(/\s+/).filter(Boolean);
        args.push(...tokens);
      }

      isIntentionalStop = false;
      lastLaunchParams = { targetExe, args, host, port };

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
          return;
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

  router.post('/stop-local-server', (_req, res) => {
    try {
      stopLlamaServerProcess(broadcast);
      res.json({ success: true, message: 'Локальный сервер остановлен' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
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
      fs.writeFileSync(zipPath, Buffer.from(arrayBuf));

      broadcast('agent-error', `Распаковка файла llama.cpp...`);
      execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${versionDir}' -Force"`);

      if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
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
