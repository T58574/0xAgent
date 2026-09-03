import fs from 'node:fs';
import path from 'node:path';

export class ProjectLockManager {
  private static instance: ProjectLockManager;
  // Map of project name -> active task ID
  private activeLocks: Map<string, string> = new Map();
  // Single active task running globally across the entire system (Concurrency = 1)
  private activeGlobalTaskId: string | null = null;

  private constructor() {}

  public static getInstance(): ProjectLockManager {
    if (!ProjectLockManager.instance) {
      ProjectLockManager.instance = new ProjectLockManager();
    }
    return ProjectLockManager.instance;
  }

  /**
   * Check if the system is currently executing any task globally
   */
  public isGlobalLocked(): boolean {
    return this.activeGlobalTaskId !== null;
  }

  /**
   * Get the globally active running task ID
   */
  public getActiveGlobalTask(): string | null {
    return this.activeGlobalTaskId;
  }

  /**
   * Attempt to acquire global lock for a task on a project
   * Returns true if acquired (system was idle), false if any task is already running
   */
  public acquireGlobalLock(taskId: string, projectName: string): boolean {
    if (this.activeGlobalTaskId && this.activeGlobalTaskId !== taskId) {
      return false;
    }
    const existingProjTask = this.activeLocks.get(projectName);
    if (existingProjTask && existingProjTask !== taskId) {
      return false;
    }
    this.activeGlobalTaskId = taskId;
    this.activeLocks.set(projectName, taskId);
    return true;
  }

  /**
   * Release global and project lock
   */
  public releaseGlobalLock(taskId?: string): void {
    if (!taskId || this.activeGlobalTaskId === taskId) {
      this.activeGlobalTaskId = null;
    }
    if (taskId) {
      for (const [proj, id] of this.activeLocks.entries()) {
        if (id === taskId) {
          this.activeLocks.delete(proj);
        }
      }
    } else {
      this.activeLocks.clear();
    }
  }

  /**
   * Attempt to acquire lock for a project (enforcing global concurrency = 1)
   */
  public acquireLock(projectName: string, taskId: string): boolean {
    return this.acquireGlobalLock(taskId, projectName);
  }

  /**
   * Release lock for a project
   */
  public releaseLock(projectName: string, taskId?: string): void {
    const current = this.activeLocks.get(projectName);
    if (!taskId || current === taskId) {
      this.activeLocks.delete(projectName);
    }
    if (!taskId || this.activeGlobalTaskId === taskId) {
      this.activeGlobalTaskId = null;
    }
  }

  /**
   * Check if project or system is currently locked
   */
  public isLocked(projectName?: string): boolean {
    if (this.activeGlobalTaskId !== null) return true;
    if (projectName) return this.activeLocks.has(projectName);
    return false;
  }

  /**
   * Get the active task ID
   */
  public getActiveTask(projectName?: string): string | undefined {
    if (projectName) {
      return this.activeLocks.get(projectName) || (this.activeGlobalTaskId || undefined);
    }
    return this.activeGlobalTaskId || undefined;
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
