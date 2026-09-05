import path from 'node:path';
import fs from 'node:fs';
import { execSync, spawn } from 'node:child_process';
import { StreamingOutputCollector } from '../agent/outputSpiller';

function resolveShellBinary(): { shell: string; shellArgs: string[] } {
  const isWindows = process.platform === 'win32';
  if (!isWindows) {
    return { shell: '/bin/bash', shellArgs: ['-c'] };
  }

  const systemRoot = process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows';
  const defaultPwsh = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  if (fs.existsSync(defaultPwsh)) {
    return {
      shell: defaultPwsh,
      shellArgs: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command'],
    };
  }

  const pwsh7 = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';
  if (fs.existsSync(pwsh7)) {
    return {
      shell: pwsh7,
      shellArgs: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command'],
    };
  }

  const cmdExe = process.env.ComSpec || path.join(systemRoot, 'System32', 'cmd.exe');
  if (fs.existsSync(cmdExe)) {
    return {
      shell: cmdExe,
      shellArgs: ['/d', '/s', '/c'],
    };
  }

  return {
    shell: 'powershell.exe',
    shellArgs: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command'],
  };
}

function getSanitizedEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  if (process.platform === 'win32') {
    const systemRoot = env.SystemRoot || env.WINDIR || 'C:\\Windows';
    const pwshDir = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0');
    const sys32Dir = path.join(systemRoot, 'System32');
    const existingPath = env.PATH || env.Path || '';
    if (!existingPath.toLowerCase().includes('windowspowershell')) {
      env.PATH = `${pwshDir};${sys32Dir};${existingPath}`;
      env.Path = env.PATH;
    }
  }
  return env;
}

export function executeShellCommand(
  workspaceDir: string | null | undefined,
  command: string,
  timeoutMs: number = 120000
): Promise<string> {
  const root = workspaceDir && workspaceDir.trim().length > 0 ? workspaceDir : process.cwd();
  const normalizedRoot = path.normalize(path.resolve(root));

  // Destructive pattern safety blocker
  const forbiddenPatterns = [
    /\bdel\s+\/s\s+\/q\s+[c-z]:\\/i,
    /\bformat\s+[c-z]:/i,
    /\brmdir\s+\/s\s+\/q\s+[c-z]:\\/i,
    /\brm\s+-rf\s+\/\b/i,
    /system32/i,
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(command)) {
      return Promise.resolve(`[SYSTEM BLOCKED]: Execution rejected. Command contains potentially destructive or protected system target.`);
    }
  }

  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const { shell, shellArgs } = resolveShellBinary();
    const fullArgs = [...shellArgs, command];

    const stdoutCollector = new StreamingOutputCollector('shell_stdout', 10 * 1024);
    const stderrCollector = new StreamingOutputCollector('shell_stderr', 10 * 1024);
    let isTimedOut = false;

    const child = spawn(shell, fullArgs, {
      cwd: normalizedRoot,
      env: getSanitizedEnv(),
      windowsHide: true,
    });

    const effectiveTimeout = Math.min(600000, Math.max(5000, timeoutMs));

    const timeoutTimer = setTimeout(async () => {
      isTimedOut = true;
      try {
        if (isWindows && child.pid) {
          execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' });
        } else {
          child.kill('SIGKILL');
        }
      } catch {}

      const stdoutRes = await stdoutCollector.finalize();
      const stderrRes = await stderrCollector.finalize();
      const partialOutput = (stdoutRes.output + (stderrRes.output ? `\n--- STDERR ---\n${stderrRes.output}` : '')).trim();
      const timeoutSec = Math.round(effectiveTimeout / 1000);
      resolve(
        `[INFO] Error: Команда превысила ${timeoutSec}-секундный лимит и была принудительно остановлена.\n` +
        `Полученный вывод до останова:\n${partialOutput || '(Вывод отсутствует)'}\n`
      );
    }, effectiveTimeout);

    child.stdout?.on('data', (data) => { stdoutCollector.append(data); });
    child.stderr?.on('data', (data) => { stderrCollector.append(data); });

    child.on('error', (err) => {
      clearTimeout(timeoutTimer);
      if (!isTimedOut) {
        resolve(`Error launching process: ${err.message}`);
      }
    });

    child.on('close', async (code) => {
      clearTimeout(timeoutTimer);
      if (isTimedOut) return;

      const stdoutRes = await stdoutCollector.finalize();
      const stderrRes = await stderrCollector.finalize();

      let result = '';
      if (stdoutRes.output && stdoutRes.output.trim().length > 0) {
        result += stdoutRes.output;
      }
      if (stderrRes.output && stderrRes.output.trim().length > 0) {
        if (result.length > 0) result += '\n--- STDERR ---\n';
        result += stderrRes.output;
      }
      if (result.length === 0) {
        result = code === 0 ? 'Command executed successfully with no output.' : `Command exited with code ${code}.`;
      }
      resolve(result);
    });
  });
}

export const executeCommand = executeShellCommand;
