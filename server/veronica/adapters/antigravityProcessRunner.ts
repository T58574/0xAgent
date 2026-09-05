import { spawn, ChildProcess } from 'node:child_process';
import { loadConfig } from '../../config';
import { proxyService } from '../../proxyService';
import { getSafeCliPath, resolveAntigravityModelAndEffort } from './antigravityModels';
import { SpawnTaskOptions } from './runtimeAdapter';
import { AgentTask } from '../types';

export interface CliProcessLaunchOptions {
  options: SpawnTaskOptions;
  task: AgentTask;
  resolvedProjectPath: string;
  prompt?: string;
}

export class AntigravityProcessRunner {
  public static buildProcessArgs(options: SpawnTaskOptions, resolvedProjectPath: string): string[] {
    const config = loadConfig();
    const resolved = resolveAntigravityModelAndEffort(options.model || config.veronica?.model, options.effort || config.veronica?.effort);
    const selectedAgent = options.agent || config.veronica?.agent;
    const selectedTimeout = options.print_timeout || config.veronica?.print_timeout || '15m';
    const outputFormat = options.output_format || 'stream-json';

    const args = [
      '--dangerously-skip-permissions',
      '--output-format', outputFormat,
      '--print-timeout', selectedTimeout,
      '--add-dir', resolvedProjectPath,
    ];
    if (options.project) {
      args.push('--project', options.project);
    }
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

    return args;
  }

  public static buildProcessEnv(task: AgentTask, resolvedProjectPath: string): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      VERONICA_TASK_ID: task.id,
      VERONICA_TASK_TOKEN: task.task_token,
      VERONICA_PROJECT: task.project,
      VERONICA_PROJECT_PATH: resolvedProjectPath,
      VERONICA_API_URL: 'http://127.0.0.1:3001/api/veronica/cli',
    };
    delete env.NODE_TEST_CONTEXT;
    delete env.NODE_TEST_WORKER_ID;

    const proxyUrl = proxyService.getProxyUrlFor('cloud_ai');
    if (proxyUrl) {
      env.HTTP_PROXY = proxyUrl;
      env.HTTPS_PROXY = proxyUrl;
      env.ALL_PROXY = proxyUrl;
      env.http_proxy = proxyUrl;
      env.https_proxy = proxyUrl;
      env.all_proxy = proxyUrl;
    }

    return env;
  }

  public static launchProcess(launchOpts: CliProcessLaunchOptions): ChildProcess {
    const { options, task, resolvedProjectPath, prompt } = launchOpts;
    const config = loadConfig();
    const cliPath = getSafeCliPath(config.veronica?.antigravity_cli_path);
    const args = this.buildProcessArgs(options, resolvedProjectPath);
    const env = this.buildProcessEnv(task, resolvedProjectPath);

    const child = spawn(cliPath, args, {
      cwd: resolvedProjectPath,
      env,
      shell: false,
      detached: process.platform !== 'win32',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (prompt && child.stdin) {
      child.stdin.write(prompt);
      child.stdin.end();
    }

    return child;
  }

  public static killChildProcess(child: ChildProcess): void {
    if (!child.pid) return;
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
  }
}
