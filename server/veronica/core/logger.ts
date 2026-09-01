import fs from 'node:fs';
import path from 'node:path';
import { getVeronicaDataDir } from '../db/veronicaDb';

const MAX_LOG_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_BACKUP_LOGS = 5;

export class VeronicaLogger {
  private static logsDir: string = '';

  private static getLogsDir(): string {
    if (!this.logsDir) {
      this.logsDir = path.join(getVeronicaDataDir(), 'logs');
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }
    }
    return this.logsDir;
  }

  public static getTaskLogPath(taskId: string): string {
    return path.join(this.getLogsDir(), `task-${taskId.substring(0, 8)}.log`);
  }

  public static getMainLogPath(): string {
    return path.join(this.getLogsDir(), 'veronica.log');
  }

  public static log(level: 'INFO' | 'WARN' | 'ERROR' | 'TASK' | 'WATCHDOG', message: string, taskId?: string): void {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${level}]${taskId ? ` [${taskId.substring(0, 8)}]` : ''} ${message}\n`;

    // 1. Write to main veronica.log
    this.appendWithRotation(this.getMainLogPath(), line);

    // 2. If taskId provided, also write to task-specific log
    if (taskId) {
      try {
        fs.appendFileSync(this.getTaskLogPath(taskId), line, 'utf-8');
      } catch {
        // Ignore task log write error
      }
    }
  }

  private static appendWithRotation(filePath: string, line: string): void {
    try {
      this.rotateIfNeeded(filePath);
      fs.appendFileSync(filePath, line, 'utf-8');
    } catch {
      // Ignore main log write error
    }
  }

  private static rotateIfNeeded(filePath: string): void {
    try {
      if (!fs.existsSync(filePath)) return;
      const stat = fs.statSync(filePath);
      if (stat.size < MAX_LOG_SIZE_BYTES) return;

      // Rotate: shift existing .4 -> .5, .3 -> .4, etc.
      for (let i = MAX_BACKUP_LOGS - 1; i >= 1; i--) {
        const src = `${filePath}.${i}`;
        const dest = `${filePath}.${i + 1}`;
        if (fs.existsSync(src)) {
          if (i === MAX_BACKUP_LOGS - 1) {
            fs.unlinkSync(src);
          } else {
            fs.renameSync(src, dest);
          }
        }
      }

      const firstBackup = `${filePath}.1`;
      fs.renameSync(filePath, firstBackup);
    } catch {
      // Ignore rotation error
    }
  }
}
