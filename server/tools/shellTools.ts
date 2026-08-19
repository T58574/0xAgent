import path from 'node:path';
import { execSync, spawn } from 'node:child_process';

export function executeShellCommand(workspaceDir: string | null | undefined, command: string): Promise<string> {
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
    const shell = isWindows ? 'powershell.exe' : '/bin/bash';
    const shellArgs = isWindows ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command] : ['-c', command];

    let stdout = '';
    let stderr = '';
    let isTimedOut = false;

    const child = spawn(shell, shellArgs, {
      cwd: normalizedRoot,
      env: { ...process.env },
    });

    const timeoutTimer = setTimeout(() => {
      isTimedOut = true;
      try {
        if (isWindows && child.pid) {
          execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' });
        } else {
          child.kill('SIGKILL');
        }
      } catch {}

      const partialOutput = (stdout + (stderr ? `\n--- STDERR ---\n${stderr}` : '')).trim();
      resolve(
        `[INFO] Error: Команда превысила 30-секундный лимит и была принудительно остановлена.\n` +
        `Полученный вывод до останова:\n${partialOutput || '(Вывод отсутствует)'}\n`
      );
    }, 30000);

    child.stdout?.on('data', (data) => { stdout += data.toString(); });
    child.stderr?.on('data', (data) => { stderr += data.toString(); });

    child.on('error', (err) => {
      clearTimeout(timeoutTimer);
      if (!isTimedOut) {
        resolve(`Error launching process: ${err.message}`);
      }
    });

    child.on('close', (code) => {
      clearTimeout(timeoutTimer);
      if (isTimedOut) return;

      let result = '';
      if (stdout && stdout.trim().length > 0) {
        result += stdout;
      }
      if (stderr && stderr.trim().length > 0) {
        if (result.length > 0) result += '\n--- STDERR ---\n';
        result += stderr;
      }
      if (result.length === 0) {
        result = code === 0 ? 'Command executed successfully with no output.' : `Command exited with code ${code}.`;
      }
      resolve(result);
    });
  });
}

export const executeCommand = executeShellCommand;
