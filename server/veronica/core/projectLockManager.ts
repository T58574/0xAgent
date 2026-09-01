import fs from 'node:fs';
import path from 'node:path';

export class ProjectLockManager {
  private static instance: ProjectLockManager;
  // Map of project name -> active task ID
  private activeLocks: Map<string, string> = new Map();

  private constructor() {}

  public static getInstance(): ProjectLockManager {
    if (!ProjectLockManager.instance) {
      ProjectLockManager.instance = new ProjectLockManager();
    }
    return ProjectLockManager.instance;
  }

  /**
   * Attempt to acquire lock for a project
   * Returns true if lock acquired, false if project is busy
   */
  public acquireLock(projectName: string, taskId: string): boolean {
    const existing = this.activeLocks.get(projectName);
    if (existing && existing !== taskId) {
      return false;
    }
    this.activeLocks.set(projectName, taskId);
    return true;
  }

  /**
   * Release lock for a project
   */
  public releaseLock(projectName: string, taskId?: string): void {
    const current = this.activeLocks.get(projectName);
    if (!taskId || current === taskId) {
      this.activeLocks.delete(projectName);
    }
  }

  /**
   * Check if project is currently locked
   */
  public isLocked(projectName: string): boolean {
    return this.activeLocks.has(projectName);
  }

  /**
   * Get the active task ID for a locked project
   */
  public getActiveTask(projectName: string): string | undefined {
    return this.activeLocks.get(projectName);
  }

  /**
   * Pre-flight git index.lock cleaner to prevent git lockup
   */
  public sanitizeGitLock(projectPath: string, maxAgeMs: number = 60000): boolean {
    try {
      const gitLockPath = path.join(projectPath, '.git', 'index.lock');
      if (fs.existsSync(gitLockPath)) {
        const stat = fs.statSync(gitLockPath);
        if (Date.now() - stat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(gitLockPath);
          return true;
        }
      }
    } catch {
      // Ignore
    }
    return false;
  }
}

export const projectLockManager = ProjectLockManager.getInstance();
