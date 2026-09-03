import path from 'node:path';
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
import { getVeronicaDataDir } from '../db/veronicaDb';
import { proxyService } from '../../proxyService';

// Re-export Model info, defaults, resolution & CLI path from modular antigravityModels
export type { AntigravityModelInfo } from './antigravityModels';
export {
  DEFAULT_ANTIGRAVITY_MODELS,
  parseAgyModelsOutput,
  getSafeCliPath,
  isAntigravityModel,
  resolveAntigravityModelAndEffort,
} from './antigravityModels';
import {
  type AntigravityModelInfo,
  DEFAULT_ANTIGRAVITY_MODELS,
  parseAgyModelsOutput,
  getSafeCliPath,
  resolveAntigravityModelAndEffort,
} from './antigravityModels';


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

  private cachedModels: AntigravityModelInfo[] | null = null;
  private cachedRawModels: { slug: string; name: string }[] | null = null;
  private lastCacheTimestamp: number = 0;
  private isFetchingModels: boolean = false;
  public static readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000;

  private constructor() {}

  public static getInstance(): AntigravityAdapter {
    if (!AntigravityAdapter.instance) {
      AntigravityAdapter.instance = new AntigravityAdapter();
    }
    return AntigravityAdapter.instance;
  }

  private getCacheFilePath(): string {
    return path.join(getVeronicaDataDir(), 'agy_models_cache.json');
  }

  private loadCacheFromDisk(): boolean {
    try {
      const cachePath = this.getCacheFilePath();
      if (fs.existsSync(cachePath)) {
        const raw = fs.readFileSync(cachePath, 'utf-8');
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.models) && typeof data.timestamp === 'number') {
          this.cachedModels = data.models;
          this.cachedRawModels = data.rawModels || [];
          this.lastCacheTimestamp = data.timestamp;
          return true;
        }
      }
    } catch (err) {
      console.warn('[AntigravityAdapter] Failed to load models cache from disk:', err);
    }
    return false;
  }

  private saveCacheToDisk(): void {
    try {
      const cachePath = this.getCacheFilePath();
      const payload = {
        timestamp: this.lastCacheTimestamp,
        models: this.cachedModels,
        rawModels: this.cachedRawModels,
      };
      fs.writeFileSync(cachePath, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[AntigravityAdapter] Failed to save models cache to disk:', err);
    }
  }

  public async fetchAvailableModels(force: boolean = false): Promise<AntigravityModelInfo[]> {
    const now = Date.now();
    if (!force && this.cachedModels && now - this.lastCacheTimestamp < AntigravityAdapter.CACHE_TTL_MS) {
      return this.cachedModels;
    }

    if (this.isFetchingModels) {
      return this.cachedModels || DEFAULT_ANTIGRAVITY_MODELS;
    }

    this.isFetchingModels = true;
    try {
      const config = loadConfig();
      const cliPath = getSafeCliPath(config.veronica?.antigravity_cli_path);

      const stdout = await new Promise<string>((resolve, reject) => {
        const proc = spawn(cliPath, ['models'], { shell: false });
        let out = '';
        let err = '';
        proc.stdout?.on('data', (d) => (out += d.toString()));
        proc.stderr?.on('data', (d) => (err += d.toString()));
        const timer = setTimeout(() => {
          try {
            proc.kill();
          } catch {}
          reject(new Error('agy models timed out after 10s'));
        }, 10000);
        proc.on('close', (code) => {
          clearTimeout(timer);
          if (code === 0 && out.trim()) {
            resolve(out.trim());
          } else {
            reject(new Error(`agy models failed with code ${code}: ${err || out}`));
          }
        });
        proc.on('error', (e) => {
          clearTimeout(timer);
          reject(e);
        });
      });

      const parsed = parseAgyModelsOutput(stdout);
      if (parsed.models.length > 0) {
        this.cachedModels = parsed.models;
        this.cachedRawModels = parsed.rawModels;
        this.lastCacheTimestamp = Date.now();
        this.saveCacheToDisk();
        return this.cachedModels;
      }
    } catch (err: any) {
      console.warn('[AntigravityAdapter] Failed to fetch live models from agy CLI:', err?.message || err);
    } finally {
      this.isFetchingModels = false;
    }

    if (!this.cachedModels) {
      this.loadCacheFromDisk();
    }
    return this.cachedModels || DEFAULT_ANTIGRAVITY_MODELS;
  }

  public getAvailableAntigravityModels(): AntigravityModelInfo[] {
    if (!this.cachedModels) {
      this.loadCacheFromDisk();
    }
    const now = Date.now();
    if (!this.cachedModels || now - this.lastCacheTimestamp >= AntigravityAdapter.CACHE_TTL_MS) {
      this.fetchAvailableModels(false).catch(() => {});
    }
    return this.cachedModels || DEFAULT_ANTIGRAVITY_MODELS;
  }

  public getAvailableRawAntigravityModels(): { slug: string; name: string }[] {
    if (!this.cachedRawModels || this.cachedRawModels.length === 0) {
      this.getAvailableAntigravityModels();
    }
    if (this.cachedRawModels && this.cachedRawModels.length > 0) {
      return this.cachedRawModels;
    }
    const models = this.getAvailableAntigravityModels();
    return models.map((m) => ({ slug: m.slug, name: m.name }));
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
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      VERONICA_TASK_ID: task.id,
      VERONICA_TASK_TOKEN: task.task_token,
      VERONICA_PROJECT: task.project,
      VERONICA_PROJECT_PATH: resolvedProjectPath,
      VERONICA_API_URL: 'http://127.0.0.1:3001/api/veronica/cli',
    };

    const proxyUrl = proxyService.getProxyUrlFor('cloud_ai');
    if (proxyUrl) {
      env.HTTP_PROXY = proxyUrl;
      env.HTTPS_PROXY = proxyUrl;
      env.ALL_PROXY = proxyUrl;
      env.http_proxy = proxyUrl;
      env.https_proxy = proxyUrl;
      env.all_proxy = proxyUrl;
    }

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
              } else if (finalStatus === 'cancelled') {
                VeronicaLogger.log('INFO', `Task ${finalStatus}`, task.id);
              } else if (finalStatus === 'interrupted') {
                await notificationService.notifyTaskCrashed(
                  updatedTask,
                  'Процесс агента был прерван из-за обрыва соединения или перезапуска'
                );
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
