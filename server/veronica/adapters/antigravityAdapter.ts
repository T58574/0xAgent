import { spawn, ChildProcess } from 'node:child_process';
import { RuntimeAdapter, SpawnTaskOptions } from './runtimeAdapter';
import { AgentTask, TaskStatus } from '../types';
import { taskRegistry } from '../core/taskRegistry';
import { loadConfig } from '../../config';
import { VeronicaLogger } from '../core/logger';
import { projectDiscovery } from '../core/projectDiscovery';
import { projectDocManager } from '../core/projectDocManager';
import { notificationService } from '../telegram/notificationService';

export interface AntigravityModelInfo {
  slug: string;
  name: string;
  description?: string;
  effort?: string;
}

export interface AntigravityAgentInfo {
  slug: string;
  name: string;
  description?: string;
}

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

  public getAvailableAntigravityModels(): AntigravityModelInfo[] {
    return [
      { slug: 'gemini-3.7-flash-high', name: 'Gemini 3.7 Flash (High Reasoning)', effort: 'high' },
      { slug: 'gemini-3.7-flash-medium', name: 'Gemini 3.7 Flash (Medium Reasoning)', effort: 'medium' },
      { slug: 'gemini-3.6-flash-high', name: 'Gemini 3.6 Flash (High Reasoning)', effort: 'high' },
      { slug: 'gemini-3.6-flash-medium', name: 'Gemini 3.6 Flash (Medium Reasoning)', effort: 'medium' },
      { slug: 'gemini-3.5-flash-medium', name: 'Gemini 3.5 Flash (Medium Reasoning)', effort: 'medium' },
      { slug: 'gemini-3.1-pro-high', name: 'Gemini 3.1 Pro (High Reasoning)', effort: 'high' },
      { slug: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (Thinking)', effort: 'high' },
      { slug: 'inherit', name: 'Default Antigravity Inherited Model', effort: 'auto' },
    ];
  }

  public getAvailableAntigravityAgents(): AntigravityAgentInfo[] {
    return [
      { slug: 'default', name: 'Default General Agent', description: 'Universal autonomous problem solver' },
      { slug: 'critic', name: 'Staff Architect & Critic', description: 'Adversarial peer critic for rigorous technical design review' },
      { slug: 'research', name: 'Codebase & Web Researcher', description: 'Read-only exploratory deep research agent' },
      { slug: 'layout-qa-accessibility', name: 'Layout QA & Accessibility', description: 'Pixel-level spacing and WCAG accessibility review' },
      { slug: 'ux-psychology-designer', name: 'UX Psychology Designer', description: 'Cognitive laws, Gestalt, Miller & Hick law audits' },
      { slug: 'multi-agent-orchestrator', name: 'Multi-Agent Orchestrator', description: 'Codebase audit & parallel subagent delegator' },
    ];
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

    const selectedModel = options.model || config.veronica?.model;
    const selectedEffort = options.effort || config.veronica?.effort;
    const selectedAgent = options.agent || config.veronica?.agent;
    const selectedTimeout = options.print_timeout || config.veronica?.print_timeout || '15m';
    const outputFormat = options.output_format || 'text';

    const args = [
      '--print', prompt,
      '--dangerously-skip-permissions',
      '--output-format', outputFormat,
      '--print-timeout', selectedTimeout,
      '--add-dir', resolvedProjectPath,
    ];

    if (selectedModel && selectedModel !== 'auto' && selectedModel !== 'inherit' && selectedModel !== 'local') {
      args.push('--model', selectedModel);
    }
    if (selectedEffort && selectedEffort !== 'auto') {
      args.push('--effort', selectedEffort);
    }
    if (selectedAgent && selectedAgent !== 'default' && selectedAgent !== 'none') {
      args.push('--agent', selectedAgent);
    }
    if (options.conversation_id) {
      args.push('--conversation', options.conversation_id);
    }
    if (options.continue_recent) {
      args.push('--continue');
    }

    VeronicaLogger.log(
      'TASK',
      `Spawning agy task for project '${options.project}' [model: ${selectedModel || 'default'}, effort: ${selectedEffort || 'default'}, agent: ${selectedAgent || 'default'}, timeout: ${selectedTimeout}]`,
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
            lastOutputSnippet = text.substring(0, 200);
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

        child.on('close', async (code, signal) => {
          this.activeProcesses.delete(task.id);
          const currentTask = taskRegistry.getTask(task.id);
          if (currentTask && currentTask.status === 'running') {
            let finalStatus: TaskStatus = code === 0 ? 'completed' : 'failed';
            let cleanSummary =
              lastOutputSnippet ||
              (code === 0 ? 'Agent execution finished successfully.' : `Agent process exited with code ${code}`);

            // Antigravity Terminal Status parsing (SUCCESS, ERROR, CANCELED, INTERRUPTED, INVALID, WAITING, RUNNING)
            try {
              const trimmed = stdoutAccumulator.trim();
              if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                const parsed = JSON.parse(trimmed);
                if (parsed.status) {
                  const s = String(parsed.status).toUpperCase();
                  if (s === 'SUCCESS') finalStatus = 'completed';
                  else if (s === 'ERROR') finalStatus = 'failed';
                  else if (s === 'CANCELED') finalStatus = 'cancelled';
                  else if (s === 'INTERRUPTED') finalStatus = 'interrupted';
                  else if (s === 'INVALID') finalStatus = 'invalid';
                  else if (s === 'WAITING') finalStatus = 'waiting';
                  else if (s === 'RUNNING') finalStatus = 'running';

                  if (parsed.response || parsed.summary || parsed.output) {
                    cleanSummary = String(parsed.response || parsed.summary || parsed.output).substring(0, 500);
                  }
                }
              }
            } catch {}

            if (signal === 'SIGINT' || signal === 'SIGTERM') {
              finalStatus = 'interrupted';
              cleanSummary = `Process was interrupted by signal ${signal}`;
            }

            VeronicaLogger.log(code === 0 ? 'INFO' : 'WARN', `Task finished with status '${finalStatus}' (exit code ${code})`, task.id);

            await taskRegistry.updateTaskStatus(task.id, finalStatus, {
              summary: cleanSummary,
              result_json: stdoutAccumulator.length > 0 ? stdoutAccumulator.substring(0, 10000) : undefined,
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
              } else if (finalStatus === 'interrupted' || finalStatus === 'cancelled') {
                VeronicaLogger.log('INFO', `Task ${finalStatus}`, task.id);
              } else {
                await notificationService.notifyTaskCrashed(updatedTask, cleanSummary);
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
