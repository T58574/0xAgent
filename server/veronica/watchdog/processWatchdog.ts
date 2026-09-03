import { spawn } from 'node:child_process';
import { taskRegistry } from '../core/taskRegistry';
import { notificationService } from '../telegram/notificationService';
import { loadConfig } from '../../config';

export class ProcessWatchdog {
  private static instance: ProcessWatchdog;
  private intervalTimer: NodeJS.Timeout | null = null;
  private isChecking = false;

  private constructor() {}

  public static getInstance(): ProcessWatchdog {
    if (!ProcessWatchdog.instance) {
      ProcessWatchdog.instance = new ProcessWatchdog();
    }
    return ProcessWatchdog.instance;
  }

  public start(intervalSec: number = 15): void {
    if (this.intervalTimer) return;
    this.intervalTimer = setInterval(() => this.checkHealth(), intervalSec * 1000);
  }

  public stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  public async checkHealth(): Promise<void> {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      const config = loadConfig();
      const defaultTimeoutSec = config.veronica?.default_heartbeat_timeout_sec || 300;
      const timeoutMs = defaultTimeoutSec * 1000;
      const now = Date.now();

      const activeTasks = taskRegistry.getActiveTasks();

      for (const task of activeTasks) {
        // Skip queued or waiting tasks (they do not emit heartbeats while waiting)
        if (task.status !== 'running') {
          continue;
        }

        // 1. Check PID liveness
        if (task.pid) {
          const isAlive = this.isPidAlive(task.pid);
          if (!isAlive) {
            console.warn(`[Watchdog] Task ${task.id} PID ${task.pid} is no longer alive in OS. Marking as crashed.`);
            await taskRegistry.updateTaskStatus(task.id, 'crashed', {
              summary: 'Process died unexpectedly in OS',
            });
            await notificationService.notifyTaskCrashed(task, 'Process disappeared from OS process table');
            continue;
          }
        }

        // 2. Check Heartbeat timeout
        const lastHeartbeat = task.last_heartbeat || task.started_at;
        if (now - lastHeartbeat > timeoutMs) {
          console.warn(`[Watchdog] Task ${task.id} exceeded heartbeat timeout (${defaultTimeoutSec}s). Killing process.`);
          if (task.pid) {
            this.treeKill(task.pid);
          }
          await taskRegistry.updateTaskStatus(task.id, 'timeout', {
            summary: `Heartbeat timeout exceeded (${defaultTimeoutSec}s inactivity)`,
          });
          await notificationService.notifyTaskTimeout(task, defaultTimeoutSec);
        }
      }
    } catch (err) {
      console.error('[Watchdog] Error checking health:', err);
    } finally {
      this.isChecking = false;
    }
  }

  private isPidAlive(pid: number): boolean {
    try {
      return process.kill(pid, 0);
    } catch (err: any) {
      return err.code === 'EPERM'; // EPERM means process exists but we lack permission to signal it
    }
  }

  private treeKill(pid: number): void {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', pid.toString(), '/T', '/F'], { shell: true });
      } else {
        process.kill(-pid, 'SIGKILL');
      }
    } catch {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // Ignore
      }
    }
  }
}

export const processWatchdog = ProcessWatchdog.getInstance();
