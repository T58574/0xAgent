import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const LOG_DIR = path.join(os.homedir(), '.0xagent', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'agent.log');
const MAX_LOG_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB auto-rotation

function ensureLogDir(): void {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch {}
}

async function writeToLogFile(level: string, component: string, message: string, extra?: any): Promise<void> {
  ensureLogDir();
  const timestamp = new Date().toISOString();
  let logLine = `[${timestamp}] [${level.toUpperCase()}] [${component}] ${message}`;
  if (extra !== undefined) {
    if (typeof extra === 'object') {
      try {
        logLine += ` ${JSON.stringify(extra)}`;
      } catch {
        logLine += ` [Object]`;
      }
    } else {
      logLine += ` ${extra}`;
    }
  }
  logLine += '\n';

  try {
    if (fs.existsSync(LOG_FILE)) {
      const stats = await fs.promises.stat(LOG_FILE);
      if (stats.size > MAX_LOG_SIZE_BYTES) {
        const backupFile = path.join(LOG_DIR, 'agent.old.log');
        if (fs.existsSync(backupFile)) {
          await fs.promises.unlink(backupFile).catch(() => {});
        }
        await fs.promises.rename(LOG_FILE, backupFile).catch(() => {});
      }
    }
    await fs.promises.appendFile(LOG_FILE, logLine, 'utf-8');
  } catch {
    // Fail silently on disk log error to not block event loop
  }
}

export const logger = {
  info(component: string, message: string, extra?: any) {
    console.log(`[${component}] ${message}`);
    writeToLogFile('INFO', component, message, extra);
  },
  warn(component: string, message: string, extra?: any) {
    console.warn(`[${component}] ⚠️ ${message}`);
    writeToLogFile('WARN', component, message, extra);
  },
  error(component: string, message: string, extra?: any) {
    console.error(`[${component}] ❌ ${message}`);
    writeToLogFile('ERROR', component, message, extra);
  },
};
