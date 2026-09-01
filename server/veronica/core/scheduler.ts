import { getVeronicaDb } from '../db/veronicaDb';
import { writeQueue } from '../db/writeQueue';
import { antigravityAdapter } from '../adapters/antigravityAdapter';

export class VeronicaScheduler {
  private static instance: VeronicaScheduler;
  private intervalTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  private constructor() {}

  public static getInstance(): VeronicaScheduler {
    if (!VeronicaScheduler.instance) {
      VeronicaScheduler.instance = new VeronicaScheduler();
    }
    return VeronicaScheduler.instance;
  }

  public start(intervalMs: number = 10000): void {
    if (this.intervalTimer) return;
    this.intervalTimer = setInterval(() => this.tick(), intervalMs);
  }

  public stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  public async tick(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const db = getVeronicaDb();
      const now = Date.now();
      const stmt = db.prepare('SELECT * FROM cron_jobs WHERE enabled = 1');
      const jobs = stmt.all() as any[];

      for (const job of jobs) {
        if (!job.next_run || job.next_run <= now) {
          await this.executeJob(job, now);
        }
      }
    } catch (err) {
      console.error('[Veronica Scheduler] Error during tick:', err);
    } finally {
      this.isRunning = false;
    }
  }

  private async executeJob(job: any, now: number): Promise<void> {
    const nextIntervalMs = this.parseSimpleSchedule(job.schedule);
    const nextRun = now + nextIntervalMs;

    await writeQueue.enqueue(() => {
      const db = getVeronicaDb();
      db.prepare('UPDATE cron_jobs SET last_run = ?, next_run = ? WHERE id = ?').run(now, nextRun, job.id);
    });

    // Launch task via Antigravity Adapter
    try {
      await antigravityAdapter.spawnTask({
        project: job.project,
        skill: job.skill,
      });
    } catch (err) {
      console.error(`[Veronica Scheduler] Failed to spawn task for job ${job.id}:`, err);
    }
  }

  /**
   * Simple schedule parser (e.g. '@hourly', '@daily', 'every_15m', or number of minutes)
   */
  private parseSimpleSchedule(schedule: string): number {
    if (schedule === '@hourly' || schedule === 'hourly') return 60 * 60 * 1000;
    if (schedule === '@daily' || schedule === 'daily') return 24 * 60 * 60 * 1000;
    if (schedule.startsWith('every_')) {
      const mins = parseInt(schedule.replace('every_', '').replace('m', ''), 10);
      if (!isNaN(mins) && mins > 0) return mins * 60 * 1000;
    }
    // Default fallback: 1 hour
    return 60 * 60 * 1000;
  }
}

export const veronicaScheduler = VeronicaScheduler.getInstance();
