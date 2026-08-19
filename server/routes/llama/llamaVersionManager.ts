import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { loadConfig, saveConfig } from '../../config';

export function performCleanupOldLlama(currentKeepTag?: string): number {
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

export function getInstalledLlamaVersions(activeExe: string): { tag: string; exePath: string; isCurrent: boolean }[] {
  const appDir = path.join(os.homedir(), '.0xagent');
  const llamaDir = path.join(appDir, 'llama');
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
        const targetExe = fs.existsSync(exePath) ? exePath : fs.existsSync(altExePath) ? altExePath : '';

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
  return installed;
}

export function deleteInstalledLlama(tag?: string, exePath?: string): boolean {
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

  if (deleted) {
    const cfg = loadConfig();
    const activeExe = cfg.local_server?.exe_path || '';
    if (exePath && activeExe.toLowerCase() === exePath.toLowerCase()) {
      const versions = getInstalledLlamaVersions('');
      const fallbackExe = versions[0]?.exePath || '';
      if (!cfg.local_server) cfg.local_server = {};
      cfg.local_server.exe_path = fallbackExe;
      saveConfig(cfg);
    }
  }

  return deleted;
}

export async function downloadAndExtractLlamaVersion(options: {
  tag: string;
  downloadUrl?: string;
  assetName?: string;
  autoCleanup?: boolean;
  onProgress?: (msg: string) => void;
}): Promise<{ exePath: string; message: string }> {
  const { tag, downloadUrl, assetName, autoCleanup, onProgress } = options;
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
    return { exePath, message: `Версия llama.cpp ${tag} уже установлена!` };
  }

  if (!downloadUrl) {
    throw new Error('downloadUrl обязателен для новой установки');
  }

  onProgress?.(`Скачивание llama.cpp (${tag})...`);
  const zipName = assetName || `llama-${tag}.zip`;
  const zipPath = path.join(versionDir, zipName);

  const downloadRes = await fetch(downloadUrl);
  if (!downloadRes.ok) {
    throw new Error(`Download failed: ${downloadRes.statusText}`);
  }

  const arrayBuf = await downloadRes.arrayBuffer();
  await fs.promises.writeFile(zipPath, Buffer.from(arrayBuf));

  onProgress?.(`Распаковка файла llama.cpp...`);
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
    const foundExe = files.find((f) => f.toLowerCase() === 'llama-server.exe' || f.toLowerCase() === 'llama.exe');
    if (foundExe) {
      exePath = path.join(versionDir, foundExe);
    }
  }

  const cfg = loadConfig();
  if (!cfg.local_server) cfg.local_server = {};
  cfg.local_server.exe_path = exePath;
  saveConfig(cfg);

  if (autoCleanup) {
    performCleanupOldLlama(tag);
  }

  onProgress?.(`Версия llama.cpp ${tag} успешно установлена!`);
  return { exePath, message: `Llama.cpp (${tag}) успешно установлен!` };
}
