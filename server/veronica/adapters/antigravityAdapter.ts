import { spawn, ChildProcess } from 'node:child_process';
import { RuntimeAdapter, SpawnTaskOptions } from './runtimeAdapter';
import { AgentTask } from '../types';
import { taskRegistry } from '../core/taskRegistry';
import { loadConfig } from '../../config';
import { VeronicaLogger } from '../core/logger';
import { projectDiscovery } from '../core/projectDiscovery';
import { projectDocManager } from '../core/projectDocManager';
import { notificationService } from '../telegram/notificationService';

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
      custom_prompt: options.custom_prompt,
    });

    if (task.status === 'queued') {
      VeronicaLogger.log('INFO', `Task queued for project ${options.project} (locked by another task)`, task.id);
      return task;
    }

    const config = loadConfig();
    const cliPath = config.veronica?.antigravity_cli_path || 'agy';

    // Resolve target project directory
    const resolvedProjectPath = (await projectDiscovery.resolveProjectPath(options.project)) || process.cwd();

    // Environment variables injected for agent
    const env = {
      ...process.env,
      VERONICA_TASK_ID: task.id,
      VERONICA_TASK_TOKEN: task.task_token,
      VERONICA_PROJECT: task.project,
      VERONICA_PROJECT_PATH: resolvedProjectPath,
      VERONICA_API_URL: 'http://127.0.0.1:3001/api/veronica/cli',
    };

    // Construct prompt
    let prompt = options.custom_prompt;
    if (!prompt) {
      prompt = `Perform skill '${options.skill}' on project '${options.project}'. Context: call '0xagent veronica context ${options.project} --task ${task.id}' to receive current status and rules. When done, call '0xagent veronica report --task ${task.id} --status completed --summary "<summary>"'`;
    }

    const args = [
      '--print', prompt,
      '--dangerously-skip-permissions',
      '--output-format', 'text',
      '--add-dir', resolvedProjectPath,
    ];

    VeronicaLogger.log(
      'TASK',
      `Spawning agy task for project '${options.project}' in '${resolvedProjectPath}' with skill '${options.skill}'`,
      task.id
    );

    try {
      const child = spawn(cliPath, args, {
        cwd: resolvedProjectPath,
        env,
        shell: true,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      if (child.pid) {
        this.activeProcesses.set(task.id, child);
        await taskRegistry.updateTaskStatus(task.id, 'running', { pid: child.pid });

        let stdoutAccumulator = '';
        let lastOutputSnippet = '';

        child.stdout?.on('data', (data) => {
          const text = data.toString().trim();
          if (text) {
            stdoutAccumulator += '\n' + text;
            lastOutputSnippet = text.substring(0, 150);
            VeronicaLogger.log('TASK', text, task.id);
            taskRegistry.recordHeartbeat(task.id, text.substring(0, 100)).catch(() => {});
          }
        });

        child.stderr?.on('data', (data) => {
          const text = data.toString().trim();
          if (text) {
            VeronicaLogger.log('WARN', text, task.id);
            taskRegistry
              .logEvent({
                task_id: task.id,
                event_type: 'warning',
                timestamp: Date.now(),
                message: text.substring(0, 300),
              })
              .catch(() => {});
          }
        });

        child.on('close', async (code) => {
          this.activeProcesses.delete(task.id);
          const currentTask = taskRegistry.getTask(task.id);
          if (currentTask && currentTask.status === 'running') {
            const finalStatus = code === 0 ? 'completed' : 'failed';
            const cleanSummary =
              code === 0
                ? lastOutputSnippet || 'Agent execution finished successfully.'
                : `Agent process exited with code ${code}`;

            VeronicaLogger.log(code === 0 ? 'INFO' : 'ERROR', `Task finished with exit code ${code}`, task.id);

            await taskRegistry.updateTaskStatus(task.id, finalStatus, {
              summary: cleanSummary,
            });

            // Log to project changelog
            await projectDocManager.appendChangelog(options.project, {
              author: 'Veronica Antigravity Agent',
              taskId: task.id,
              action: `Task [${options.skill}] ${finalStatus}`,
              details: cleanSummary,
            });

            // Trigger notification
            const updatedTask = taskRegistry.getTask(task.id);
            if (updatedTask) {
              if (finalStatus === 'completed') {
                await notificationService.notifyTaskCompleted(updatedTask);
              } else {
                await notificationService.notifyTaskCrashed(updatedTask, `Exited with code ${code}`);
              }
            }
          }
        });
      }
    } catch (err: any) {
      VeronicaLogger.log('ERROR', `Failed to spawn agy process: ${err?.message || err}`, task.id);
      await taskRegistry.updateTaskStatus(task.id, 'failed', {
        error_message: `Failed to spawn process: ${err?.message || err}`,
      });
      const failedTask = taskRegistry.getTask(task.id);
      if (failedTask) {
        await notificationService.notifyTaskCrashed(failedTask, err?.message || 'Failed to spawn');
      }
    }

    return task;
  }

  public async killTask(taskId: string): Promise<boolean> {
    VeronicaLogger.log('WARN', `Killing task ${taskId}`, taskId);
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
