import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { spawn, ChildProcess } from 'node:child_process';
import { RuntimeAdapter, SpawnTaskOptions } from './runtimeAdapter';
import { AgentTask, TaskStatus } from '../types';
import { taskRegistry } from '../core/taskRegistry';
import { loadConfig } from '../../config';
import { VeronicaLogger } from '../core/logger';
import { projectDiscovery } from '../core/projectDiscovery';
import { taskPromptBuilder } from '../core/taskPromptBuilder';
import { operationalJournal } from '../core/operationalJournal';
import { notificationService } from '../telegram/notificationService';

export interface AntigravityModelInfo {
  slug: string;
  name: string;
  description?: string;
  effort?: string;
  supportedEfforts?: ('low' | 'medium' | 'high')[];
  defaultEffort?: 'low' | 'medium' | 'high';
}

export function getSafeCliPath(customPath?: string | null): string {
  if (customPath && customPath !== 'agy') return customPath;
  if (process.platform === 'win32') {
    const localAgy = path.join(os.homedir(), 'AppData', 'Local', 'agy', 'bin', 'agy.exe');
    if (fs.existsSync(localAgy)) return localAgy;
  }
  return 'agy';
}

export function isAntigravityModel(rawModel?: string | null, activePersonaId?: string | null): boolean {
  if (activePersonaId === 'veronica') return true;
  if (!rawModel) return false;
  const selectedModel = rawModel.toLowerCase().trim();
  if (selectedModel.startsWith('local:') || selectedModel.endsWith('.gguf')) {
    return false;
  }
  return (
    selectedModel.startsWith('gemini-') ||
    selectedModel.startsWith('claude-') ||
    selectedModel.startsWith('gpt-') ||
    selectedModel.startsWith('deepseek-') ||
    selectedModel.startsWith('antigravity') ||
    selectedModel === 'inherit' ||
    selectedModel === 'auto' ||
    selectedModel === 'agy'
  );
}

export function resolveAntigravityModelAndEffort(rawModel?: string | null, rawEffort?: string | null): {
  model?: string;
  effort?: string;
} {
  if (!rawModel || rawModel === 'inherit' || rawModel === 'auto' || rawModel === 'agy' || rawModel === 'antigravity') {
    return { model: undefined, effort: undefined };
  }

  const clean = rawModel.toLowerCase().trim().replace(/^antigravity:/, '');

  // 1. Claude and GPT-OSS models NEVER support --effort flag
  if (
    clean.startsWith('claude-') ||
    clean.includes('claude') ||
    clean.startsWith('gpt-oss') ||
    clean.includes('gpt-oss')
  ) {
    if (clean.includes('opus')) {
      return { model: 'claude-opus-4-6-thinking', effort: undefined };
    }
    if (clean.includes('sonnet')) {
      return { model: 'claude-sonnet-4-6', effort: undefined };
    }
    if (clean.includes('gpt-oss')) {
      return { model: 'gpt-oss-120b-medium', effort: undefined };
    }
    return { model: clean, effort: undefined };
  }

  // 2. Direct slug format with effort encoded
  if (['gemini-3.7-flash-high', 'gemini-3.7-flash-medium', 'gemini-3.7-flash-low'].includes(clean)) {
    return { model: clean, effort: undefined };
  }
  if (['gemini-3.6-flash-high', 'gemini-3.6-flash-medium', 'gemini-3.6-flash-low'].includes(clean)) {
    return { model: clean, effort: undefined };
  }
  if (['gemini-3.1-pro-high', 'gemini-3.1-pro-low'].includes(clean)) {
    return { model: clean, effort: undefined };
  }

  // 3. Base model with effort parameter
  let effort = rawEffort && rawEffort !== 'auto' && rawEffort !== 'off' ? rawEffort.toLowerCase() : 'low';

  if (clean.includes('3.7') && clean.includes('flash')) {
    if (!['low', 'medium', 'high'].includes(effort)) effort = 'low';
    return { model: `gemini-3.7-flash-${effort}`, effort: undefined };
  }

  if (clean.includes('3.6') && clean.includes('flash')) {
    if (!['low', 'medium', 'high'].includes(effort)) effort = 'low';
    return { model: `gemini-3.6-flash-${effort}`, effort: undefined };
  }

  if (clean.includes('3.1') && clean.includes('pro')) {
    if (effort === 'medium' || !['low', 'high'].includes(effort)) effort = 'low';
    return { model: `gemini-3.1-pro-${effort}`, effort: undefined };
  }

  return { model: clean, effort: undefined };
}

export interface AntigravityAgentInfo {
  slug: string;
  name: string;
  description?: string;
}

export interface VeronicaStreamEvent {
  taskId: string;
  type: 'stdout' | 'stderr' | 'status' | 'heartbeat' | 'end';
  chunk?: string;
  status?: TaskStatus;
  timestamp: number;
  summary?: string;
  metadata?: any;
}

export type VeronicaStreamListener = (event: VeronicaStreamEvent) => void;

export class AntigravityAdapter implements RuntimeAdapter {
  private static instance: AntigravityAdapter;
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private taskStreamBuffers: Map<string, VeronicaStreamEvent[]> = new Map();
  private streamListeners: Set<VeronicaStreamListener> = new Set();
  private externalBroadcaster: ((event: string, payload: any) => void) | null = null;

  private constructor() {}

  public static getInstance(): AntigravityAdapter {
    if (!AntigravityAdapter.instance) {
      AntigravityAdapter.instance = new AntigravityAdapter();
    }
    return AntigravityAdapter.instance;
  }

  public setBroadcaster(broadcaster: (event: string, payload: any) => void): void {
    this.externalBroadcaster = broadcaster;
  }

  public subscribeTaskStream(taskId: string, listener: VeronicaStreamListener): () => void {
    const wrappedListener: VeronicaStreamListener = (event) => {
      if (event.taskId === taskId) {
        listener(event);
      }
    };
    this.streamListeners.add(wrappedListener);
    return () => {
      this.streamListeners.delete(wrappedListener);
    };
  }

  public getTaskStreamBuffer(taskId: string): VeronicaStreamEvent[] {
    return this.taskStreamBuffers.get(taskId) || [];
  }

  public emitStreamEvent(event: VeronicaStreamEvent): void {
    const buffer = this.taskStreamBuffers.get(event.taskId) || [];
    buffer.push(event);
    if (buffer.length > 500) {
      buffer.shift();
    }
    this.taskStreamBuffers.set(event.taskId, buffer);

    for (const listener of this.streamListeners) {
      try {
        listener(event);
      } catch (lErr) {
        console.warn('[Veronica Stream Listener Error]', lErr);
      }
    }

    if (this.externalBroadcaster) {
      try {
        this.externalBroadcaster('veronica-stream-chunk', event);
        if (event.type === 'status' || event.type === 'end') {
          this.externalBroadcaster('veronica-task-status', {
            taskId: event.taskId,
            status: event.status,
            summary: event.summary,
            timestamp: event.timestamp,
          });
        }
      } catch (bErr) {
        console.warn('[Veronica Broadcaster Error]', bErr);
      }
    }
  }

  public async testCliAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const config = loadConfig();
        const cliPath = getSafeCliPath(config.veronica?.antigravity_cli_path);
        const proc = spawn(cliPath, ['--version'], { shell: false });
        proc.on('error', () => resolve(false));
        proc.on('close', (code) => resolve(code === 0));
      } catch {
        resolve(false);
      }
    });
  }

  public async isAvailable(): Promise<boolean> {
    return this.testCliAvailability();
  }

  public getAvailableAntigravityModels(): AntigravityModelInfo[] {
    return [
      {
        slug: 'gemini-3.7-flash',
        name: 'Gemini 3.7 Flash',
        effort: 'low',
        supportedEfforts: ['low', 'medium', 'high'],
        defaultEffort: 'low',
      },
      {
        slug: 'gemini-3.6-flash',
        name: 'Gemini 3.6 Flash',
        effort: 'low',
        supportedEfforts: ['low', 'medium', 'high'],
        defaultEffort: 'low',
      },
      {
        slug: 'gemini-3.1-pro',
        name: 'Gemini 3.1 Pro',
        effort: 'low',
        supportedEfforts: ['low', 'high'],
        defaultEffort: 'low',
      },
      {
        slug: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6 (Thinking)',
        effort: undefined,
        supportedEfforts: [],
      },
      {
        slug: 'claude-opus-4-6-thinking',
        name: 'Claude Opus 4.6 (Thinking)',
        effort: undefined,
        supportedEfforts: [],
      },
      {
        slug: 'gpt-oss-120b-medium',
        name: 'GPT-OSS 120B (Medium)',
        effort: undefined,
        supportedEfforts: [],
      },
      {
        slug: 'inherit',
        name: 'Default Antigravity Inherited Model',
        effort: undefined,
        supportedEfforts: [],
      },
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
    const cliPath = getSafeCliPath(config.veronica?.antigravity_cli_path);

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

    // Construct structured autonomous prompt using TaskPromptBuilder
    const prompt = await taskPromptBuilder.buildAutonomousTaskPrompt({
      project: options.project,
      skill: options.skill,
      custom_prompt: options.custom_prompt,
      task_id: task.id,
      autonomy_level: options.autonomy_level,
      project_path: resolvedProjectPath,
    });

    const resolved = resolveAntigravityModelAndEffort(options.model || config.veronica?.model, options.effort || config.veronica?.effort);
    const selectedAgent = options.agent || config.veronica?.agent;
    const selectedTimeout = options.print_timeout || config.veronica?.print_timeout || '15m';
    const outputFormat = options.output_format || 'text';

    const args = [
      '--dangerously-skip-permissions',
      '--output-format', outputFormat,
      '--print-timeout', selectedTimeout,
      '--add-dir', resolvedProjectPath,
    ];

    if (resolved.model) {
      args.push('--model', resolved.model);
    }
    if (resolved.effort) {
      args.push('--effort', resolved.effort);
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
      `Spawning agy task for project '${options.project}' [model: ${resolved.model || 'default'}, agent: ${selectedAgent || 'default'}, timeout: ${selectedTimeout}]`,
      task.id
    );

    try {
      const child = spawn(cliPath, args, {
        cwd: resolvedProjectPath,
        env,
        shell: false,
        detached: process.platform !== 'win32',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      if (child.pid) {
        this.activeProcesses.set(task.id, child);
        await taskRegistry.updateTaskStatus(task.id, 'running', { pid: child.pid });

        this.emitStreamEvent({
          taskId: task.id,
          type: 'status',
          status: 'running',
          chunk: `[Veronica] Process spawned (PID: ${child.pid}). Executing skill '${options.skill}' on '${options.project}'...`,
          timestamp: Date.now(),
        });

        // Stream prompt to stdin to avoid Windows CLI quoting and length issues
        if (prompt) {
          child.stdin?.write(prompt);
          child.stdin?.end();
        }

        let stdoutAccumulator = '';
        let lastOutputSnippet = '';

        child.stdout?.on('data', (data) => {
          const text = data.toString().trim();
          if (text) {
            stdoutAccumulator += '\n' + text;
            lastOutputSnippet = text.substring(0, 200);
            VeronicaLogger.log('TASK', text, task.id);
            taskRegistry.recordHeartbeat(task.id, text.substring(0, 100)).catch(() => {});

            this.emitStreamEvent({
              taskId: task.id,
              type: 'stdout',
              chunk: text,
              timestamp: Date.now(),
            });
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

            this.emitStreamEvent({
              taskId: task.id,
              type: 'stderr',
              chunk: text,
              timestamp: Date.now(),
            });
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

            // Antigravity Terminal Status & Conversation ID parsing (SUCCESS, ERROR, CANCELED, INTERRUPTED, INVALID, WAITING, RUNNING)
            let capturedConversationId = options.conversation_id;
            try {
              const lines = stdoutAccumulator.split('\n');
              for (const line of lines) {
                const lTrim = line.trim();
                if (lTrim.startsWith('{') && lTrim.endsWith('}')) {
                  try {
                    const parsed = JSON.parse(lTrim);
                    if (parsed.event === 'init' && parsed.conversation_id) {
                      capturedConversationId = parsed.conversation_id;
                    } else if (parsed.conversation_id) {
                      capturedConversationId = parsed.conversation_id;
                    }
                    if (parsed.result?.conversation_id) {
                      capturedConversationId = parsed.result.conversation_id;
                    }
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
                    } else if (parsed.result?.status) {
                      const s = String(parsed.result.status).toUpperCase();
                      if (s === 'SUCCESS') finalStatus = 'completed';
                      else if (s === 'ERROR') finalStatus = 'failed';
                      if (parsed.result.response || parsed.result.summary) {
                        cleanSummary = String(parsed.result.response || parsed.result.summary).substring(0, 500);
                      }
                    }
                  } catch {}
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
              result_json: JSON.stringify({
                conversation_id: capturedConversationId,
                raw: stdoutAccumulator.length > 0 ? stdoutAccumulator.substring(0, 10000) : undefined,
              }),
            });

            this.emitStreamEvent({
              taskId: task.id,
              type: 'end',
              status: finalStatus,
              summary: cleanSummary,
              chunk: `[Veronica] Task finished with status: ${finalStatus}`,
              timestamp: Date.now(),
            });

            // Log to Operational Journal
            await operationalJournal.logEntry({
              project: options.project,
              task_id: task.id,
              agent: 'Antigravity Agent',
              operation_type: options.skill,
              status: finalStatus,
              summary: cleanSummary,
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
      await operationalJournal.logEntry({
        project: options.project,
        task_id: task.id,
        agent: 'Antigravity Agent',
        operation_type: options.skill,
        status: 'failed',
        summary: `Failed to spawn process: ${err?.message || err}`,
        important: true,
      });
      this.emitStreamEvent({
        taskId: task.id,
        type: 'end',
        status: 'failed',
        summary: `Failed to spawn process: ${err?.message || err}`,
        chunk: `[Veronica] Error: Failed to spawn process: ${err?.message || err}`,
        timestamp: Date.now(),
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
    this.emitStreamEvent({
      taskId,
      type: 'end',
      status: 'cancelled',
      summary: 'Task cancelled by user / watchdog',
      chunk: '[Veronica] Task cancelled by user / watchdog.',
      timestamp: Date.now(),
    });
    return true;
  }
}

export const antigravityAdapter = AntigravityAdapter.getInstance();
