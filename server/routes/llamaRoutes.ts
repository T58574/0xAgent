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

    if (!isProcessRunning) {
      return res.json({ ok: false, status: 'stopped', processRunning: false });
    }

    try {
      const response = await fetch(`http://${host}:${port}/health`, { signal: AbortSignal.timeout(5000) });
      const data: any = await response.json().catch(() => ({}));
      const isHealthy = response.ok || data.status === 'ok' || data.status === 'loading model' || data.status === 'no slot available';

      res.json({
        ok: isHealthy,
        status: data.status || 'ok',
        processRunning: true,
      });
    } catch {
      res.json({ ok: true, status: 'busy', processRunning: true });
    }
  });

  router.get('/server-slots', async (req, res) => {
    const host = (req.query.host as string) || '127.0.0.1';
    const port = (req.query.port as string) || '11434';
    const isProcessRunning = activeLlamaProcess !== null && !activeLlamaProcess.killed;
    if (!isProcessRunning) {
      return res.json({ ok: false, totalSlots: 0, activeSlots: 0 });
    }
    try {
      const response = await fetch(`http://${host}:${port}/slots`, { signal: AbortSignal.timeout(4000) });
      if (response.ok) {
        const slotsData: any[] = await response.json();
        const activeSlots = slotsData.filter((s) => s.state !== 0 && s.is_processing).length;
        res.json({ ok: true, totalSlots: slotsData.length, activeSlots });
      } else {
        res.json({ ok: true, totalSlots: 1, activeSlots: 1 });
      }
    } catch {
      res.json({ ok: true, totalSlots: 1, activeSlots: 1 });
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
          } else {
            const subdirs = fs.readdirSync(llamaDir, { withFileTypes: true });
            for (const d of subdirs) {
              if (d.isDirectory()) {
                const subExe = path.join(llamaDir, d.name, 'llama-server.exe');
                if (fs.existsSync(subExe)) {
                  targetExe = subExe;
                  break;
                }
                const altExe = path.join(llamaDir, d.name, 'llama.exe');
                if (fs.existsSync(altExe)) {
                  targetExe = altExe;
                  break;
                }
              }
            }
          }
        }
      }

      if (!targetModel || !fs.existsSync(targetModel)) {
        const searchDirs = [
          path.join(process.cwd(), 'models'),
          path.join(os.homedir(), '.0xagent', 'models'),
          ...(cfg.workspace_dir ? [path.join(cfg.workspace_dir, 'models')] : []),
        ];
        for (const sDir of searchDirs) {
          if (fs.existsSync(sDir)) {
            const files = fs.readdirSync(sDir);
            const gguf = files.find((f) => f.endsWith('.gguf') && !/mmproj|projector|clip/i.test(f));
            if (gguf) {
              targetModel = path.join(sDir, gguf);
              break;
            }
          }
        }
      }

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

      const ls = cfg.local_server || {};
      const args: string[] = ['-m', targetModel, '--host', host, '--port', String(port)];

      // Auto-detect multimodal projector (mmproj) for Vision / Audio support
      let mmprojTarget = body.mmprojPath || ls.mmproj_path;
      if (!mmprojTarget || !fs.existsSync(mmprojTarget)) {
        const candidateDirs = [
          path.dirname(targetModel),
          path.join(os.homedir(), '.0xagent', 'models'),
          path.join(process.cwd(), 'models'),
          ...(cfg.workspace_dir ? [path.join(cfg.workspace_dir, 'models')] : []),
        ];

        const modelBaseLower = path.basename(targetModel).toLowerCase();
        let bestMmproj: string | null = null;

        for (const cDir of candidateDirs) {
          if (fs.existsSync(cDir)) {
            try {
              const files = fs.readdirSync(cDir);
              const mmprojFiles = files.filter((f) => f.endsWith('.gguf') && /mmproj|projector|clip/i.test(f));
              if (mmprojFiles.length > 0) {
                // Priority: mmproj matching model family name (e.g. qwen, minicpm, llava)
                const modelTokens = modelBaseLower.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter((t) => t.length > 2);
                const matched = mmprojFiles.find((f) => {
                  const fLower = f.toLowerCase();
                  return modelTokens.some((tok) => fLower.includes(tok));
                });
                bestMmproj = path.join(cDir, matched || mmprojFiles[0]);
                break;
              }
            } catch {}
          }
        }
        if (bestMmproj && fs.existsSync(bestMmproj)) {
          mmprojTarget = bestMmproj;
        }
      }

      if (mmprojTarget && fs.existsSync(mmprojTarget)) {
        args.push('--mmproj', mmprojTarget);
        appendServerLog(`[MMPROJ] Автоматически подключен проектор зрения/аудио: ${path.basename(mmprojTarget)}`);
      }

      // Auto-detect / configure FastMTP and Speculative Decoding draft models
      let specDraftTarget = body.specDraftModel !== undefined ? body.specDraftModel : ls.spec_draft_model;
      const isDraftDisabled = specDraftTarget === 'none' || specDraftTarget === 'disabled' || specDraftTarget === false;

      if (!isDraftDisabled) {
        if (!specDraftTarget || !fs.existsSync(specDraftTarget)) {
          const candidateDirs = [
            path.dirname(targetModel),
            path.join(os.homedir(), '.0xagent', 'models'),
            path.join(process.cwd(), 'models'),
            ...(cfg.workspace_dir ? [path.join(cfg.workspace_dir, 'models')] : []),
          ];

          const modelBaseLower = path.basename(targetModel).toLowerCase();
          const isQwenModel = /qwen3|qwen-3|qwen_3|qwen 3|qwen3.8/i.test(modelBaseLower);
          let bestDraft: string | null = null;

          for (const cDir of candidateDirs) {
            if (fs.existsSync(cDir)) {
              try {
                const files = fs.readdirSync(cDir);
                const draftFiles = files.filter((f) => f.endsWith('.gguf') && /fastmtp|mtp|draft/i.test(f) && !/mmproj|projector|clip/i.test(f));
                if (draftFiles.length > 0) {
                  if (isQwenModel) {
                    const qwenDraft = draftFiles.find((f) => /qwen3.*fastmtp|fastmtp.*qwen3|fastmtp/i.test(f));
                    if (qwenDraft) {
                      bestDraft = path.join(cDir, qwenDraft);
                      break;
                    }
                  }
                  bestDraft = path.join(cDir, draftFiles[0]);
                  break;
                }
              } catch {}
            }
          }
          if (bestDraft && fs.existsSync(bestDraft)) {
            specDraftTarget = bestDraft;
          }
        }

        if (specDraftTarget && fs.existsSync(specDraftTarget)) {
          args.push('--spec-draft-model', specDraftTarget);

          const specType = body.specType || ls.spec_type || 'draft-mtp';
          args.push('--spec-type', specType);

          const specDraftNgl = body.specDraftNgl !== undefined && body.specDraftNgl !== null ? body.specDraftNgl : (ls.spec_draft_ngl !== undefined && ls.spec_draft_ngl !== null ? ls.spec_draft_ngl : 'all');
          if (specDraftNgl !== undefined && specDraftNgl !== null) {
            args.push('--spec-draft-ngl', String(specDraftNgl));
          }

          const specDraftNMax = body.specDraftNMax !== undefined && body.specDraftNMax !== null ? body.specDraftNMax : (ls.spec_draft_n_max !== undefined && ls.spec_draft_n_max !== null ? ls.spec_draft_n_max : 3);
          if (specDraftNMax !== undefined && specDraftNMax !== null) {
            args.push('--spec-draft-n-max', String(specDraftNMax));
          }

          const specDraftPMin = body.specDraftPMin !== undefined && body.specDraftPMin !== null ? body.specDraftPMin : (ls.spec_draft_p_min !== undefined && ls.spec_draft_p_min !== null ? ls.spec_draft_p_min : 0);
          if (specDraftPMin !== undefined && specDraftPMin !== null) {
            args.push('--spec-draft-p-min', String(specDraftPMin));
          }

          appendServerLog(`[FASTMTP] Автоматически подключен Speculative MTP сайдкар: ${path.basename(specDraftTarget)} (тип: ${specType}, n-max: ${specDraftNMax}, ngl: ${specDraftNgl})`);
        }
      }

      const modelNameLower = path.basename(targetModel).toLowerCase();
      const isQwen3 = /qwen3|qwen-3|qwen_3|qwen 3|qwen3.8/i.test(modelNameLower);

      // Jinja and Reasoning template flags for Qwen 3.8 / local reasoning models
      const jinja = body.jinja !== undefined ? body.jinja : ls.jinja;
      if (jinja || (jinja === undefined && isQwen3)) {
        args.push('--jinja');
      }

      const reasoningPreserve = body.reasoningPreserve !== undefined ? body.reasoningPreserve : ls.reasoning_preserve;
      if (reasoningPreserve || (reasoningPreserve === undefined && isQwen3)) {
        args.push('--reasoning-preserve');
      }

      const reasoningFormat = body.reasoningFormat || ls.reasoning_format || (isQwen3 ? 'deepseek' : null);
      if (reasoningFormat) {
        args.push('--reasoning-format', reasoningFormat);
      }

      const reasoningEffort = body.reasoningEffort || ls.reasoning_effort || (isQwen3 ? 'xhigh' : null);
      if (reasoningEffort && reasoningEffort !== 'off' && reasoningEffort !== 'auto') {
        args.push('--reasoning', 'on', '--reasoning-effort', reasoningEffort);
      }

      const ctxSize = body.ctxSize !== undefined ? body.ctxSize : ls.ctx_size;
      if (ctxSize) args.push('-c', String(ctxSize));

      const gpuLayers = body.gpuLayers !== undefined ? body.gpuLayers : ls.gpu_layers;
      if (gpuLayers !== undefined && gpuLayers !== null) args.push('-ngl', String(gpuLayers));

      const threads = body.threads !== undefined ? body.threads : ls.threads;
      if (threads !== undefined && threads !== null && Number(threads) > 0) {
        args.push('-t', String(threads));
      }

      const batchSize = body.batchSize !== undefined ? body.batchSize : ls.batch_size;
      if (batchSize) args.push('-b', String(batchSize));

      const ubatchSize = body.ubatchSize !== undefined ? body.ubatchSize : ls.ubatch_size;
      if (ubatchSize) args.push('-ub', String(ubatchSize));

      const temp = body.temp !== undefined ? body.temp : ls.temp;
      if (temp !== undefined && temp !== null) args.push('--temp', String(temp));

      const repeatPenalty = body.repeatPenalty !== undefined ? body.repeatPenalty : ls.repeat_penalty;
      if (repeatPenalty !== undefined && repeatPenalty !== null) args.push('--repeat-penalty', String(repeatPenalty));

      const minP = body.minP !== undefined ? body.minP : ls.min_p;
      if (minP !== undefined && minP !== null && Number(minP) > 0) args.push('--min-p', String(minP));

      const topK = body.topK !== undefined ? body.topK : ls.top_k;
      if (topK !== undefined && topK !== null) {
        const tk = Math.round(Number(topK));
        if (tk >= 1) args.push('--top-k', String(tk));
      }

      const topP = body.topP !== undefined ? body.topP : ls.top_p;
      if (topP !== undefined && topP !== null && Number(topP) < 1 && Number(topP) > 0) args.push('--top-p', String(topP));

      const flashAttn = body.flashAttn !== undefined ? body.flashAttn : ls.flash_attn;
      if (flashAttn) args.push('-fa', 'on');

      const mmap = body.mmap !== undefined ? body.mmap : ls.mmap;
      if (mmap === false) args.push('--no-mmap');

      const mlock = body.mlock !== undefined ? body.mlock : ls.mlock;
      if (mlock === true) args.push('--mlock');

      const cacheReuse = body.cacheReuse !== undefined ? body.cacheReuse : ls.cache_reuse;
      if (cacheReuse !== undefined && cacheReuse !== null && Number(cacheReuse) > 0) args.push('--cache-reuse', String(cacheReuse));

      const slotSavePath = body.slotSavePath !== undefined ? body.slotSavePath : ls.slot_save_path;
      if (slotSavePath && typeof slotSavePath === 'string' && slotSavePath.trim()) args.push('--slot-save-path', slotSavePath.trim());

      const embedding = body.embedding !== undefined ? body.embedding : ls.embedding;
      if (embedding) args.push('--embedding');

      const parallelSlots = body.parallelSlots !== undefined ? body.parallelSlots : ls.parallel_slots;
      const nSlots = (parallelSlots !== undefined && parallelSlots !== null && Number(parallelSlots) >= 1) ? Number(parallelSlots) : 1;
      args.push('-np', String(nSlots));

      const customArgs = body.customArgs !== undefined ? body.customArgs : ls.custom_args;
      if (customArgs && typeof customArgs === 'string' && customArgs.trim()) {
        const extra = customArgs.trim().split(/\s+/).filter(Boolean);
        args.push(...extra);
      }

      const launchTimestamp = Date.now();
      isIntentionalStop = false;
      lastLaunchParams = { targetExe, args, host, port };

      appendServerLog(`[CMD] ${path.basename(targetExe)} ${args.join(' ')}`);
      activeLlamaProcess = spawn(targetExe, args, { cwd: path.dirname(targetExe) });

      broadcast('llama-server-status', { status: 'running', pid: activeLlamaProcess.pid, host, port });

      const handleLogData = (data: Buffer) => {
        const cleanStr = stripAnsiCodes(data.toString()).trim();
        if (cleanStr) {
          appendServerLog(cleanStr);
          if (cleanStr.includes('expected   5120, 248320, got   5120,  32768') || cleanStr.includes('expected 5120, 248320, got 5120, 32768')) {
            appendServerLog('[FASTMTP DIAGNOSTIC] Сайдкар FastMTP требует пропатченный бинарник llama.cpp (HauhauCS-FastMTP-llama.cpp.patch). Исполняемый файл ожидает полный словарь Qwen 3.8.');
          }
        }
      };

      activeLlamaProcess.stdout?.on('data', handleLogData);
      activeLlamaProcess.stderr?.on('data', handleLogData);

      activeLlamaProcess.on('exit', (code, signal) => {
        const exitMsg = `[llama.cpp] Процесс завершён (код: ${code}, сигнал: ${signal})`;
        appendServerLog(exitMsg);

        const runtimeMs = Date.now() - launchTimestamp;
        if (!isIntentionalStop && lastLaunchParams && runtimeMs > 6000) {
          appendServerLog(`[WATCHDOG] WARNING: Process crashed after ${Math.round(runtimeMs / 1000)}s. Auto-recovering...`);
          broadcast('llama-server-status', { status: 'recovering' });
          activeLlamaProcess = null;
        } else {
          if (!isIntentionalStop && runtimeMs <= 6000) {
            appendServerLog(`[WATCHDOG] Сервер упал при инициализации модели (${(runtimeMs / 1000).toFixed(1)} с). Авто-перезапуск остановлен.`);
          }
          broadcast('llama-server-status', { status: 'stopped', code, signal });
          activeLlamaProcess = null;
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
