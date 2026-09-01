import { spawn, ChildProcess } from 'node:child_process';
import { RuntimeAdapter, SpawnTaskOptions } from './runtimeAdapter';
import { AgentTask } from '../types';
import { taskRegistry } from '../core/taskRegistry';
import { loadConfig } from '../../config';

export class AntigravityAdapter implements RuntimeAdapter {
  private static instance: AntigravityAdapter;
  private activeProcesses: Map<string, ChildProcess> = new Map();

  private constructor() {}

  public static getInstance(): AntigravityAdapter {
    if (!AntigravityAdapter.instance) {
      AntigravityAdapter.instance = new AntigravityAdapter();
    }
    return AntigravityAdapter.instance;
  }

  public async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const config = loadConfig();
        const cliPath = config.veronica?.antigravity_cli_path || 'agy';
        const proc = spawn(cliPath, ['--version'], { shell: true });
        proc.on('error', () => resolve(false));
        proc.on('close', (code) => resolve(code === 0));
      } catch {
        resolve(false);
      }
    });
  }

  public async spawnTask(options: SpawnTaskOptions): Promise<AgentTask> {
    const task = await taskRegistry.createTask({
      project: options.project,
      skill: options.skill,
      runtime_profile: options.runtime_profile,
      autonomy_level: options.autonomy_level,
    });

    if (task.status === 'queued') {
      return task;
    }

    const config = loadConfig();
    const cliPath = config.veronica?.antigravity_cli_path || 'agy';

    // Environment variables injected for agent
    const env = {
      ...process.env,
      VERONICA_TASK_ID: task.id,
      VERONICA_TASK_TOKEN: task.task_token,
      VERONICA_PROJECT: task.project,
      VERONICA_API_URL: 'http://127.0.0.1:3001/api/veronica/cli',
    };

    // Prompt instructions with initial context instruction
    const prompt = options.custom_prompt || `Perform skill '${options.skill}' on project '${options.project}'. Start by calling '0xagent veronica context ${options.project} --task ${task.id}' to receive current status and rules.`;

    const args = [
      '--headless',
      '--prompt', prompt,
    ];

    try {
      const child = spawn(cliPath, args, {
        env,
        shell: true,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      if (child.pid) {
        this.activeProcesses.set(task.id, child);
        await taskRegistry.updateTaskStatus(task.id, 'running', { pid: child.pid });

        child.stdout?.on('data', (data) => {
          const text = data.toString().trim();
          if (text) {
            taskRegistry.recordHeartbeat(task.id, text.substring(0, 100)).catch(() => {});
          }
        });

        child.stderr?.on('data', (data) => {
          const text = data.toString().trim();
          if (text) {
            taskRegistry.logEvent({
              task_id: task.id,
              event_type: 'warning',
              timestamp: Date.now(),
              message: text.substring(0, 300),
            }).catch(() => {});
          }
        });

        child.on('close', async (code) => {
          this.activeProcesses.delete(task.id);
          const currentTask = taskRegistry.getTask(task.id);
          if (currentTask && currentTask.status === 'running') {
            const finalStatus = code === 0 ? 'completed' : 'failed';
            await taskRegistry.updateTaskStatus(task.id, finalStatus, {
              summary: code === 0 ? 'Agent finished execution cleanly' : `Agent process exited with code ${code}`,
            });
          }
        });
      }
    } catch (err: any) {
      await taskRegistry.updateTaskStatus(task.id, 'failed', {
        error_message: `Failed to spawn process: ${err?.message || err}`,
      });
    }

    return task;
  }

  public async killTask(taskId: string): Promise<boolean> {
    const child = this.activeProcesses.get(taskId);
    if (child && child.pid) {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', child.pid.toString(), '/T', '/F'], { shell: true });
        } else {
          process.kill(-child.pid, 'SIGKILL');
        }
      } catch {
        try {
          child.kill('SIGKILL');
        } catch {
          // Ignore
        }
      }
      this.activeProcesses.delete(taskId);
    }
    await taskRegistry.updateTaskStatus(taskId, 'cancelled', {
      summary: 'Task cancelled by user / watchdog',
    });
    return true;
  }
}

export const antigravityAdapter = AntigravityAdapter.getInstance();
