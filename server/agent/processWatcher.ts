import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import { logger } from '../logger';
import { proactiveCompanion } from './proactiveCompanion';

const execAsync = promisify(exec);

export type UserActivityState = 'coding' | 'gaming' | 'browsing' | 'idle';

export interface ProcessScanResult {
  state: UserActivityState;
  detectedApp: string;
  gameDurationMinutes: number;
  lastScanTimestamp: number;
}

const GAME_PROCESSES = [
  'steam', 'dota2', 'cs2', 'csgo', 'cyberpunk2077', 'gta5', 'minecraft',
  'valorant', 'genshinimpact', 'starrail', 'epicgameslauncher', 'tlauncher',
  'league of legends', 'overwatch', 'apex', 'witcher3', 'eldenring'
];

const DEV_PROCESSES = [
  'code', 'cursor', 'devenv', 'windowsterminal', 'powershell', 'cmd', 'git'
];

const BROWSER_PROCESSES = [
  'chrome', 'msedge', 'firefox', 'brave', 'opera', 'yandex'
];

export class ProcessWatcher {
  private scanInterval: NodeJS.Timeout | null = null;
  private currentState: UserActivityState = 'idle';
  private currentDetectedApp = '';
  private stateStartTime = Date.now();
  private lastSparkGeneratedTime = 0;

  constructor() {
    if (process.env.NODE_ENV !== 'test') {
      this.startScanner();
    }
  }

  public startScanner(intervalMs = 60000) {
    if (this.scanInterval) clearInterval(this.scanInterval);
    // Initial scan after 5 seconds
    setTimeout(() => this.performScan().catch(() => {}), 5000);
    this.scanInterval = setInterval(() => this.performScan().catch(() => {}), intervalMs);
  }

  public stopScanner() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  }

  public getStatus(): ProcessScanResult {
    const durationMinutes = Math.floor((Date.now() - this.stateStartTime) / 60000);
    return {
      state: this.currentState,
      detectedApp: this.currentDetectedApp,
      gameDurationMinutes: this.currentState === 'gaming' ? durationMinutes : 0,
      lastScanTimestamp: Date.now(),
    };
  }

  public async performScan(): Promise<ProcessScanResult> {
    if (process.env.NODE_ENV === 'test') {
      this.currentState = 'coding';
      this.currentDetectedApp = 'code';
      return this.getStatus();
    }

    if (os.platform() !== 'win32') {
      return this.getStatus();
    }

    try {
      // Non-blocking PowerShell process query with MainWindowTitle
      const { stdout } = await execAsync(
        'powershell -NoProfile -NonInteractive -Command "Get-Process | Where-Object {$_.MainWindowTitle -ne \'\'} | Select-Object ProcessName | ConvertTo-Json"',
        { timeout: 8000 }
      );

      if (!stdout || !stdout.trim()) {
        return this.getStatus();
      }

      let processes: Array<{ ProcessName: string }> = [];
      try {
        const parsed = JSON.parse(stdout.trim());
        processes = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        processes = [];
      }

      const procNames = processes
        .map((p) => (p.ProcessName || '').toLowerCase())
        .filter(Boolean);

      let detectedState: UserActivityState = 'idle';
      let detectedApp = '';

      // Check gaming processes
      for (const p of procNames) {
        if (GAME_PROCESSES.some((g) => p.includes(g))) {
          detectedState = 'gaming';
          detectedApp = p;
          break;
        }
      }

      // If not gaming, check dev processes
      if (detectedState === 'idle') {
        for (const p of procNames) {
          if (DEV_PROCESSES.some((d) => p.includes(d))) {
            detectedState = 'coding';
            detectedApp = p;
            break;
          }
        }
      }

      // If not dev, check browser
      if (detectedState === 'idle') {
        for (const p of procNames) {
          if (BROWSER_PROCESSES.some((b) => p.includes(b))) {
            detectedState = 'browsing';
            detectedApp = p;
            break;
          }
        }
      }

      const now = Date.now();
      if (detectedState !== this.currentState) {
        this.currentState = detectedState;
        this.currentDetectedApp = detectedApp;
        this.stateStartTime = now;
      }

      const durationMinutes = Math.floor((now - this.stateStartTime) / 60000);

      // If user in Gaming / Browsing mode for > 35 minutes and no spark was generated recently (> 30 mins)
      if (
        (detectedState === 'gaming' || detectedState === 'browsing') &&
        durationMinutes >= 35 &&
        now - this.lastSparkGeneratedTime > 30 * 60 * 1000
      ) {
        this.lastSparkGeneratedTime = now;
        logger.info('ProcessWatcher', `User in ${detectedState} mode for ${durationMinutes}m. Proposing proactive momentum spark.`);

        proactiveCompanion.createSparkProposal({
          title: `Импульс продуктивности (${detectedState === 'gaming' ? 'Катка' : 'Сёрфинг'} ${durationMinutes} мин)`,
          category: 'friendly_checkin',
          description: `Пока вы отдыхаете, я проверил состояние проекта. Сделаем 1 быстрый микро-шаг на пару минут?`,
          suggestedAction: `Запустить аудит и тесты в ветке dev`,
          voicePhrase: `Сэр, пока вы отдыхаете, я подготовил короткую задачу. Один клик — и готово.`,
        }).catch(() => {});
      }

      return this.getStatus();
    } catch (err: any) {
      logger.warn('ProcessWatcher', `Process scan warning: ${err?.message || err}`);
      return this.getStatus();
    }
  }
}

export const processWatcher = new ProcessWatcher();
