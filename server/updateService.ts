import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec, execSync } from 'node:child_process';
import { promisify } from 'node:util';
import https from 'node:https';
import { SystemVersionInfo, UpdateCheckResult, UpdateApplyResult, UpdateApplyProgress } from '../src/types';

const execAsync = promisify(exec);

const PROJECT_ROOT = path.resolve(process.cwd());
const USER_HOME = os.homedir();
const OX_DIR = path.join(USER_HOME, '.0xagent');
const DB_PATH = path.join(OX_DIR, 'memory.db');

export function parseSemver(v: string): [number, number, number] {
  const clean = v.replace(/^v/, '').trim();
  const parts = clean.split('.').map((p) => parseInt(p, 10) || 0);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

export function compareSemver(current: string, latest: string): number {
  const [cMaj, cMin, cPat] = parseSemver(current);
  const [lMaj, lMin, lPat] = parseSemver(latest);

  if (lMaj > cMaj) return 1;
  if (lMaj < cMaj) return -1;
  if (lMin > cMin) return 1;
  if (lMin < cMin) return -1;
  if (lPat > cPat) return 1;
  if (lPat < cPat) return -1;
  return 0;
}

export class UpdateService {
  private cachedCheck: UpdateCheckResult | null = null;
  private lastCheckedTimestamp = 0;
  private readonly CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
  private isUpdating = false;

  public getSystemVersion(): SystemVersionInfo {
    let version = '0.1.0';
    try {
      const pkgPath = path.join(PROJECT_ROOT, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.version) version = pkg.version;
      }
    } catch {}

    let gitCommit: string | undefined;
    let gitBranch: string | undefined;

    try {
      gitCommit = execSync('git rev-parse --short HEAD', { cwd: PROJECT_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: PROJECT_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {}

    return {
      version,
      gitCommit,
      gitBranch,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    };
  }

  private fetchJson(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': '0xAgent-UpdateService/1.0',
          Accept: 'application/vnd.github.v3+json',
        },
        timeout: 6000,
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (err) {
              reject(err);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 100)}`));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Connection timed out'));
      });
      req.end();
    });
  }

  public async checkForUpdates(force = false): Promise<UpdateCheckResult> {
    const now = Date.now();
    if (!force && this.cachedCheck && now - this.lastCheckedTimestamp < this.CACHE_TTL_MS) {
      return this.cachedCheck;
    }

    const currentInfo = this.getSystemVersion();
    const currentVersion = currentInfo.version;

    try {
      // 1. Try fetching official GitHub release
      try {
        const release = await this.fetchJson('https://api.github.com/repos/T58574/0xAgent/releases/latest');
        const rawTag = release.tag_name || release.name || '';
        const cleanLatest = rawTag.replace(/^v/, '').trim() || currentVersion;
        const hasUpdate = compareSemver(currentVersion, cleanLatest) > 0;

        const result: UpdateCheckResult = {
          currentVersion,
          latestVersion: cleanLatest,
          hasUpdate,
          releaseName: release.name || `Release ${rawTag}`,
          releaseNotes: release.body || 'Performance improvements and stability fixes.',
          releaseUrl: release.html_url || 'https://github.com/T58574/0xAgent/releases',
          publishedAt: release.published_at || new Date().toISOString(),
          channel: 'stable',
          lastChecked: now,
        };

        this.cachedCheck = result;
        this.lastCheckedTimestamp = now;
        return result;
      } catch {
        // Fallback: Check raw package.json on main branch
        const rawPkg = await this.fetchJson('https://raw.githubusercontent.com/T58574/0xAgent/main/package.json');
        const remoteVersion = (rawPkg && rawPkg.version) ? rawPkg.version : currentVersion;
        const hasUpdate = compareSemver(currentVersion, remoteVersion) > 0;

        const fallbackResult: UpdateCheckResult = {
          currentVersion,
          latestVersion: remoteVersion,
          hasUpdate,
          releaseName: `v${remoteVersion}`,
          releaseNotes: 'Continuous update from main branch.',
          releaseUrl: 'https://github.com/T58574/0xAgent',
          publishedAt: new Date().toISOString(),
          channel: 'stable',
          lastChecked: now,
        };

        this.cachedCheck = fallbackResult;
        this.lastCheckedTimestamp = now;
        return fallbackResult;
      }
    } catch (err: any) {
      const errResult: UpdateCheckResult = {
        currentVersion,
        latestVersion: currentVersion,
        hasUpdate: false,
        releaseNotes: `Unable to check updates: ${err.message}`,
        lastChecked: now,
      };
      return errResult;
    }
  }

  public async applyUpdate(onProgress?: (p: UpdateApplyProgress) => void): Promise<UpdateApplyResult> {
    if (this.isUpdating) {
      throw new Error('An update is already in progress');
    }

    this.isUpdating = true;
    const initialVersion = this.getSystemVersion().version;
    let backupPath: string | undefined;

    const report = (stage: UpdateApplyProgress['stage'], message: string, progressPercent: number, error?: string) => {
      if (onProgress) {
        onProgress({ stage, message, progressPercent, error });
      }
    };

    try {
      // 1. Backup SQLite memory DB
      report('backup', 'Backing up memory database...', 10);
      if (fs.existsSync(DB_PATH)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        backupPath = path.join(OX_DIR, `memory.db.bak_${timestamp}`);
        fs.copyFileSync(DB_PATH, backupPath);
      }

      // 2. Stash local changes to prevent merge conflicts
      report('stash', 'Stashing local changes...', 25);
      try {
        await execAsync('git stash save "Auto-stash before 0xAgent update"', { cwd: PROJECT_ROOT });
      } catch {}

      // 3. Pull latest changes
      report('pull', 'Pulling latest release from GitHub...', 45);
      try {
        await execAsync('git fetch origin main', { cwd: PROJECT_ROOT });
        await execAsync('git pull --rebase origin main', { cwd: PROJECT_ROOT });
      } catch {
        // Fallback to merge pull
        await execAsync('git pull origin main', { cwd: PROJECT_ROOT });
      }

      // 4. Install dependencies
      report('install', 'Installing dependencies (npm install)...', 65);
      await execAsync('npm install --no-audit --no-fund', { cwd: PROJECT_ROOT });

      // 5. Rebuild client
      report('build', 'Compiling production client...', 85);
      await execAsync('npm run build', { cwd: PROJECT_ROOT });

      // Rebuild native launcher on Windows if script exists
      if (process.platform === 'win32') {
        const buildPs1 = path.join(PROJECT_ROOT, 'scripts', 'build-launcher.ps1');
        if (fs.existsSync(buildPs1)) {
          try {
            await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${buildPs1}"`, { cwd: PROJECT_ROOT });
          } catch {}
        }
      }

      const newVersion = this.getSystemVersion().version;
      this.cachedCheck = null; // Invalidate cache

      report('done', 'Update completed successfully!', 100);

      this.isUpdating = false;
      return {
        success: true,
        message: `Successfully updated from v${initialVersion} to v${newVersion}`,
        previousVersion: initialVersion,
        newVersion,
        backupPath,
        restarted: false,
      };
    } catch (err: any) {
      this.isUpdating = false;
      report('error', `Update failed: ${err.message}`, 0, err.message);
      return {
        success: false,
        message: err.message,
        previousVersion: initialVersion,
        newVersion: initialVersion,
        backupPath,
      };
    }
  }
}

export const updateService = new UpdateService();
