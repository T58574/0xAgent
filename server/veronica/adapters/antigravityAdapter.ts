import path from 'node:path';
import fs from 'node:fs';
import { spawn, execSync, ChildProcess } from 'node:child_process';
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
import { quotaManager } from '../../agent/quotaManager';
import { AntigravityLogParser, isNetworkError } from './antigravityLogParser';
import { AntigravityWatchdog } from './antigravityWatchdog';
import { AntigravityProcessRunner } from './antigravityProcessRunner';
import { AntigravityUsage } from '../../../src/types';

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
} from './antigravityModels';

export { isNetworkError } from './antigravityLogParser';

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
  usage?: AntigravityUsage;
}

export type VeronicaStreamListener = (event: VeronicaStreamEvent) => void;

export class AntigravityAdapter implements RuntimeAdapter {
  private static instance: AntigravityAdapter;
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private activeWatchdogs: Map<string, AntigravityWatchdog> = new Map();
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
        const proc = spawn(cliPath, ['models'], {
          shell: false,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let out = '';
        let err = '';
        proc.stdout?.on('data', (d) => (out += d.toString()));
        proc.stderr?.on('data', (d) => (err += d.toString()));
        const timer = setTimeout(() => {
          try {
            if (proc.pid) {
              if (process.platform === 'win32') {
                execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: 'ignore', windowsHide: true });
              } else {
                proc.kill('SIGKILL');
              }
            }
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
        const proc = spawn(cliPath, ['--version'], {
          shell: false,
          windowsHide: true,
          stdio: 'ignore',
        });
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
    const task = options.existing_task_id
      ? (taskRegistry.getTask(options.existing_task_id) || await taskRegistry.createTask({
          project: options.project,
          skill: options.skill,
          runtime_profile: options.runtime_profile,
          autonomy_level: options.autonomy_level,
          custom_prompt: options.custom_prompt,
        }))
      : await taskRegistry.createTask({
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

    // HARD GUARD: Never spawn real OS Antigravity CLI processes or consume AI tokens during test executions
    if (process.env.NODE_ENV === 'test' || process.env.TEST_APP_DIR || process.env.NODE_TEST_CONTEXT) {
      VeronicaLogger.log('INFO', `[TEST ENVIRONMENT GUARD] Simulating Antigravity task execution without spawning OS process for task ${task.id}`);
      await taskRegistry.updateTaskStatus(task.id, 'running');
      setTimeout(async () => {
        await taskRegistry.updateTaskStatus(task.id, 'completed', {
          summary: 'Simulated task completed in test environment',
          result_json: JSON.stringify({
            conversation_id: 'test-mock-convo',
            tool_call_count: 0,
            usage: { input_tokens: 0, output_tokens: 0, thinking_tokens: 0, cache_read_tokens: 0, total_tokens: 0 },
          }),
        });
      }, 50);
      return task;
    }

    const config = loadConfig();
    const resolvedProjectPath = (await projectDiscovery.resolveProjectPath(options.project)) || process.cwd();

    const prompt = await taskPromptBuilder.buildAutonomousTaskPrompt({
      project: options.project,
      skill: options.skill,
      custom_prompt: options.custom_prompt,
      task_id: task.id,
      autonomy_level: options.autonomy_level,
      project_path: resolvedProjectPath,
    });

    const maxToolCalls = options.max_tool_calls || config.veronica?.max_task_tool_calls || 120;

    VeronicaLogger.log(
      'TASK',
      `Spawning agy task for project '${options.project}' [skill: ${options.skill}, max_tool_calls: ${maxToolCalls}]`,
      task.id
    );

    try {
      const child = AntigravityProcessRunner.launchProcess({
        options,
        task,
        resolvedProjectPath,
        prompt,
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

        let stdoutAccumulator = '';
        let lastOutputSnippet = '';
        let lineBuffer = '';
        let detectedNetworkError = '';
        let lastErrorDetails = '';
        let capturedConversationId = options.conversation_id;
        let finalResponseText = '';
        let capturedUsage: AntigravityUsage | undefined = undefined;
        let capturedDurationSeconds: number | undefined = undefined;

        const watchdog = new AntigravityWatchdog({
          taskId: task.id,
          child,
          maxToolCalls,
          inactivityTimeoutMs: 90000,
        });
        this.activeWatchdogs.set(task.id, watchdog);
        watchdog.start();

        child.stdout?.on('data', (data) => {
          watchdog.resetTimer();
          const chunkStr = data.toString();
          stdoutAccumulator += '\n' + chunkStr;
          lineBuffer += chunkStr;

          const lines = lineBuffer.split('\n');
          lineBuffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            lastOutputSnippet = trimmed.substring(0, 200);

            const parsed = AntigravityLogParser.parseLine(trimmed);
            if (parsed.isNetworkErr) {
              detectedNetworkError = parsed.errorSnippet || trimmed;
            }
            if (parsed.errorSnippet) {
              lastErrorDetails = parsed.errorSnippet;
            }

            if (parsed.isJson && parsed.parsedEvent) {
              const ev = parsed.parsedEvent;
              if (ev.conversationId) {
                capturedConversationId = ev.conversationId;
              }
              if (ev.isToolActive) {
                const toolName = ev.toolName || 'tool';
                const { count: toolCount } = watchdog.recordToolCall(toolName);
                taskRegistry
                  .recordHeartbeat(task.id, `Tool: ${toolName} (#${toolCount}/${maxToolCalls})`)
                  .catch(() => {});
              }
              if (ev.response) {
                finalResponseText = ev.response;
              }
              if (ev.usage) {
                capturedUsage = ev.usage;
              }
              if (typeof ev.durationSeconds === 'number') {
                capturedDurationSeconds = ev.durationSeconds;
              }
              if (ev.error) {
                lastErrorDetails = ev.error;
                if (isNetworkError(ev.error)) {
                  detectedNetworkError = ev.error;
                }
              }
            }

            VeronicaLogger.log('TASK', trimmed, task.id);

            this.emitStreamEvent({
              taskId: task.id,
              type: 'stdout',
              chunk: trimmed,
              timestamp: Date.now(),
            });
          }
        });

        child.stderr?.on('data', (data) => {
          watchdog.resetTimer();
          const text = data.toString().trim();
          if (text) {
            VeronicaLogger.log('WARN', text, task.id);
            if (isNetworkError(text)) {
              detectedNetworkError = text;
            }
            if (quotaManager.isQuotaExhausted(text)) {
              quotaManager.recordQuotaExhaustion({
                rawMessage: text,
                modelName: options.model,
              });
            }
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

        child.on('error', async (err) => {
          watchdog.stop();
          this.activeWatchdogs.delete(task.id);
          this.activeProcesses.delete(task.id);
          const errMsg = err?.message || String(err);
          VeronicaLogger.log('ERROR', `Process execution error on task ${task.id}: ${errMsg}`, task.id);

          const isNet = isNetworkError(errMsg);
          const failReason = isNet
            ? `Сетевой сбой при связи с сервером инференса Antigravity CLI: ${errMsg}`
            : `Ошибка запуска процесса Antigravity CLI: ${errMsg}`;

          const currentTask = taskRegistry.getTask(task.id);
          if (currentTask && currentTask.status === 'running') {
            await taskRegistry.updateTaskStatus(task.id, 'failed', {
              error_message: errMsg,
              summary: failReason,
            });

            this.emitStreamEvent({
              taskId: task.id,
              type: 'end',
              status: 'failed',
              summary: failReason,
              chunk: `[Veronica Error] ${failReason}`,
              timestamp: Date.now(),
            });

            await operationalJournal.logEntry({
              project: options.project,
              task_id: task.id,
              agent: 'Antigravity Agent',
              operation_type: options.skill,
              status: 'failed',
              summary: failReason,
            });

            const updatedTask = taskRegistry.getTask(task.id);
            if (updatedTask) {
              await notificationService.notifyTaskCrashed(updatedTask, failReason);
            }
          }
        });

        child.on('close', async (code, signal) => {
          watchdog.stop();
          this.activeWatchdogs.delete(task.id);
          this.activeProcesses.delete(task.id);

          if (lineBuffer.trim()) {
            const trimmed = lineBuffer.trim();
            const parsed = AntigravityLogParser.parseLine(trimmed);
            if (parsed.isNetworkErr) detectedNetworkError = parsed.errorSnippet || trimmed;
            if (parsed.isJson && parsed.parsedEvent) {
              const ev = parsed.parsedEvent;
              if (ev.response) finalResponseText = ev.response;
              if (ev.usage) capturedUsage = ev.usage;
              if (typeof ev.durationSeconds === 'number') capturedDurationSeconds = ev.durationSeconds;
              if (ev.error) {
                lastErrorDetails = ev.error;
                if (isNetworkError(ev.error)) detectedNetworkError = ev.error;
              }
            }
          }

          if (detectedNetworkError && (options.network_retry_count || 0) < 2) {
            const nextRetry = (options.network_retry_count || 0) + 1;
            const resumeConvoId = capturedConversationId || options.conversation_id;
            VeronicaLogger.log(
              'WARN',
              `[Antigravity Auto-Resume] Network issue detected (${detectedNetworkError}). Resuming task ${task.id} (attempt ${nextRetry}/2) in 3s...`,
              task.id
            );
            this.emitStreamEvent({
              taskId: task.id,
              type: 'status',
              status: 'running',
              chunk: `[Veronica] Перехвачен сетевой сбой связи с сервером инференса (Google AI). Автоматически возобновляю выполнение задачи (попытка ${nextRetry}/2)...`,
              timestamp: Date.now(),
            });

            notificationService.broadcastToWhitelist(
              `⚠️ <b>Сетевой сбой инференса (${options.project}):</b>\n<code>${detectedNetworkError.substring(0, 300)}</code>\n\n🔄 <i>Автоматически возобновляю задачу <code>${task.id.substring(0, 8)}</code> (попытка ${nextRetry}/2) через 3с...</i>`
            ).catch(() => {});

            setTimeout(() => {
              this.spawnTask({
                ...options,
                existing_task_id: task.id,
                conversation_id: resumeConvoId || undefined,
                continue_recent: false,
                network_retry_count: nextRetry,
              }).catch((err) => {
                VeronicaLogger.log('ERROR', `Failed to auto-resume task ${task.id}: ${err.message}`, task.id);
              });
            }, 3000);
            return;
          }

          const currentTask = taskRegistry.getTask(task.id);
          if (currentTask && currentTask.status === 'running') {
            const circuitBreakerTriggered = watchdog.isCircuitBreakerTripped();
            const toolCallCount = watchdog.getToolCallCount();
            let finalStatus: TaskStatus = code === 0 ? 'completed' : 'failed';
            let cleanSummary =
              finalResponseText ||
              lastOutputSnippet ||
              (code === 0 ? 'Agent execution finished successfully.' : `Agent process exited with code ${code}`);

            if (circuitBreakerTriggered) {
              finalStatus = 'failed';
              cleanSummary = `Предохранитель (Circuit Breaker): агент выполнил ${toolCallCount} вызовов инструментов (лимит ${maxToolCalls}). Процесс принудительно остановлен для защиты от зацикливания и экономии токенов.`;
            } else if (detectedNetworkError) {
              finalStatus = 'failed';
              cleanSummary = `Сетевая ошибка связи с сервером инференса (Google AI / Antigravity CLI): ${detectedNetworkError}`;
            } else if (lastErrorDetails && code !== 0) {
              finalStatus = 'failed';
              cleanSummary = lastErrorDetails.substring(0, 500);
            }

            if (signal === 'SIGINT' || signal === 'SIGTERM') {
              if (!circuitBreakerTriggered) {
                finalStatus = 'interrupted';
                cleanSummary = `Process was interrupted by signal ${signal}`;
              }
            }

            VeronicaLogger.log(code === 0 && !circuitBreakerTriggered && !detectedNetworkError ? 'INFO' : 'WARN', `Task finished with status '${finalStatus}' (exit code ${code})`, task.id);

            await taskRegistry.updateTaskStatus(task.id, finalStatus, {
              summary: cleanSummary,
              skip_retry: circuitBreakerTriggered || !!detectedNetworkError,
              result_json: JSON.stringify({
                conversation_id: capturedConversationId,
                tool_call_count: toolCallCount,
                duration_seconds: capturedDurationSeconds,
                usage: capturedUsage,
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
              usage: capturedUsage,
            });

            await operationalJournal.logEntry({
              project: options.project,
              task_id: task.id,
              agent: 'Antigravity Agent',
              operation_type: options.skill,
              status: finalStatus,
              summary: cleanSummary,
            });

            const updatedTask = taskRegistry.getTask(task.id);
            if (updatedTask) {
              if (finalStatus === 'completed') {
                await notificationService.notifyTaskCompleted(updatedTask);
              } else if ((finalStatus as any) === 'cancelled') {
                VeronicaLogger.log('INFO', `Task ${finalStatus}`, task.id);
              } else if (finalStatus === 'interrupted') {
                await notificationService.notifyTaskCrashed(
                  updatedTask,
                  cleanSummary || 'Процесс агента был прерван из-за обрыва соединения или перезапуска'
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
    const watchdog = this.activeWatchdogs.get(taskId);
    if (watchdog) {
      watchdog.stop();
      this.activeWatchdogs.delete(taskId);
    }
    const child = this.activeProcesses.get(taskId);
    if (child) {
      AntigravityProcessRunner.killChildProcess(child);
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
