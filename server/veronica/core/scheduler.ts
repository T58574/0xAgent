import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getVeronicaDb, getVeronicaDataDir } from '../db/veronicaDb';
import { writeQueue } from '../db/writeQueue';
import { antigravityAdapter } from '../adapters/antigravityAdapter';
import { CronJobRecord } from '../types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  public async executeJob(job: any, now: number): Promise<void> {
    const nextIntervalMs = this.parseSimpleSchedule(job.schedule);
    const nextRun = now + nextIntervalMs;

    await writeQueue.enqueue(() => {
      const db = getVeronicaDb();
      db.prepare('UPDATE cron_jobs SET last_run = ?, next_run = ? WHERE id = ?').run(now, nextRun, job.id);
    });

    // Guard: prevent overlapping executions if project already has an active or queued task
    const db = getVeronicaDb();
    const existingTask = db.prepare(
      "SELECT id FROM agent_tasks WHERE project = ? AND status IN ('running', 'queued') LIMIT 1"
    ).get(job.project);

    if (existingTask) {
      console.log(`[Veronica Scheduler] [SKIP] Cron job ${job.id} (${job.project}) skipped - project already has an active or queued task.`);
      return;
    }

    // Direct ТЗ formulated by Veronica without generic markdown skill template bindings
    const taskPrompt = job.custom_prompt || job.skill_file || `Периодическое регламентное задание для проекта ${job.project}`;

    // Launch task via Antigravity Adapter
    try {
      await antigravityAdapter.spawnTask({
        project: job.project,
        skill: job.skill || 'custom_task',
        custom_prompt: taskPrompt,
      });
    } catch (err) {
      console.error(`[Veronica Scheduler] Failed to spawn task for job ${job.id}:`, err);
    }
  }

  public listSkills(): { name: string; path: string; description?: string }[] {
    const skillsDir = path.join(__dirname, '..', 'skills');
    const userSkillsDir = path.join(getVeronicaDataDir(), 'skills');
    const results: { name: string; path: string; description?: string }[] = [];

    const scanDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir);
      for (const f of files) {
        if (f.endsWith('.md')) {
          const name = f.replace('.md', '');
          const fullPath = path.join(dir, f);
          const content = fs.readFileSync(fullPath, 'utf-8');
          const firstLine = content.split('\n')[0].replace(/^#+\s*/, '') || name;
          results.push({ name, path: fullPath, description: firstLine });
        }
      }
    };

    scanDir(skillsDir);
    scanDir(userSkillsDir);
    return results;
  }

  public getSkillContent(skillName: string): string | null {
    const fileName = skillName.endsWith('.md') ? skillName : `${skillName}.md`;
    const userPath = path.join(getVeronicaDataDir(), 'skills', fileName);
    if (fs.existsSync(userPath)) {
      return fs.readFileSync(userPath, 'utf-8');
    }

    const defaultPath = path.join(__dirname, '..', 'skills', fileName);
    if (fs.existsSync(defaultPath)) {
      return fs.readFileSync(defaultPath, 'utf-8');
    }

    return null;
  }

  public listCronJobs(): CronJobRecord[] {
    const db = getVeronicaDb();
    const rows = db.prepare('SELECT * FROM cron_jobs ORDER BY id ASC').all() as any[];
    return rows.map((r) => ({
      ...r,
      enabled: Boolean(r.enabled),
    }));
  }

  public async addCronJob(job: CronJobRecord): Promise<void> {
    await writeQueue.enqueue(() => {
      const db = getVeronicaDb();
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO cron_jobs (id, project, skill, schedule, enabled, skill_file, custom_prompt, next_run)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const nextRun = Date.now() + this.parseSimpleSchedule(job.schedule);
      stmt.run(
        job.id,
        job.project,
        job.skill || 'custom_task',
        job.schedule,
        job.enabled ? 1 : 0,
        job.skill_file || null,
        job.custom_prompt || null,
        nextRun
      );
    });
  }

  public async deleteCronJob(id: string): Promise<void> {
    await writeQueue.enqueue(() => {
      const db = getVeronicaDb();
      db.prepare('DELETE FROM cron_jobs WHERE id = ?').run(id);
    });
  }

  public parseSimpleSchedule(schedule: string): number {
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
