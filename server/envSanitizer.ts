import path from 'node:path';
import fs from 'node:fs';

export interface EnvHealthReport {
  healed: boolean;
  injectedPaths: string[];
  systemPowerShell: string | null;
  pythonExecutable: string | null;
}

/**
 * Self-Healing Environment Engine for 0xAgent.
 * Inspects process.env on server boot, verifies existence of crucial system binaries,
 * and repairs stripped/corrupted PATH variables automatically to prevent ENOENT crashes.
 */
export function ensureEnvironmentHealth(): EnvHealthReport {
  const isWindows = process.platform === 'win32';
  const injectedPaths: string[] = [];
  let healed = false;
  let systemPowerShell: string | null = null;
  let pythonExecutable: string | null = null;

  if (isWindows) {
    const env = process.env;
    const systemRoot = env.SystemRoot || env.WINDIR || 'C:\\Windows';
    const pwsh1 = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0');
    const sys32 = path.join(systemRoot, 'System32');
    const wbem = path.join(systemRoot, 'System32', 'Wbem');
    const userProfile = env.USERPROFILE || 'C:\\Users\\user';

    const candidatePaths = [
      pwsh1,
      sys32,
      wbem,
      'C:\\Program Files\\PowerShell\\7',
      'C:\\Python314',
      'C:\\Python314\\Scripts',
      path.join(userProfile, 'AppData', 'Local', 'Programs', 'Python', 'Launcher'),
      path.join(userProfile, 'AppData', 'Roaming', 'npm'),
      'C:\\Program Files\\nodejs',
      'C:\\Program Files\\Git\\cmd',
    ];

    const currentPathRaw = env.PATH || env.Path || '';
    const currentPathsNormalized = new Set(
      currentPathRaw
        .split(';')
        .filter(Boolean)
        .map((p) => path.normalize(p).toLowerCase().replace(/\\+$/, ''))
    );

    const toInject: string[] = [];
    for (const dir of candidatePaths) {
      if (fs.existsSync(dir)) {
        const norm = path.normalize(dir).toLowerCase().replace(/\\+$/, '');
        if (!currentPathsNormalized.has(norm)) {
          toInject.push(dir);
          injectedPaths.push(dir);
        }
      }
    }

    if (toInject.length > 0) {
      const updatedPath = `${toInject.join(';')};${currentPathRaw}`;
      env.PATH = updatedPath;
      env.Path = updatedPath;
      healed = true;
    }

    // Verify PowerShell executable
    const pwshExe = path.join(pwsh1, 'powershell.exe');
    if (fs.existsSync(pwshExe)) {
      systemPowerShell = pwshExe;
    }

    // Verify Python executable
    const pythonCandidates = [
      'C:\\Python314\\python.exe',
      path.join(userProfile, 'AppData', 'Local', 'Programs', 'Python', 'Launcher', 'py.exe'),
    ];
    for (const py of pythonCandidates) {
      if (fs.existsSync(py)) {
        pythonExecutable = py;
        break;
      }
    }
  }

  return {
    healed,
    injectedPaths,
    systemPowerShell,
    pythonExecutable,
  };
}
