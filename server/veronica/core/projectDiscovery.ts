import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getMemoryDb } from '../../memoryDb';
import { getVeronicaDb } from '../db/veronicaDb';
import { writeQueue } from '../db/writeQueue';
import { extractGitRemote, computeProjectFingerprint } from '../../projectService';

export interface DiscoveredProject {
  id: string;
  name: string;
  path: string;
  gitRemote: string | null;
  autonomyLevel: string;
  lastSeenAt: number;
  source: 'dev_folder' | 'workspace' | 'db';
}

export class ProjectDiscovery {
  private static instance: ProjectDiscovery;
  private devFolders: string[] = [];

  private constructor() {
    this.initDefaultSearchPaths();
  }

  public static getInstance(): ProjectDiscovery {
    if (!ProjectDiscovery.instance) {
      ProjectDiscovery.instance = new ProjectDiscovery();
    }
    return ProjectDiscovery.instance;
  }

  private initDefaultSearchPaths(): void {
    const userHome = os.homedir();
    const primaryDevPath = path.join(userHome, 'Documents', 'dev');
    const fallbackWorkspacePath = path.join(userHome, '.0xagent', 'workspaces', 'veronica');

    if (fs.existsSync(primaryDevPath)) {
      this.devFolders = [primaryDevPath];
    } else {
      if (!fs.existsSync(fallbackWorkspacePath)) {
        try {
          fs.mkdirSync(fallbackWorkspacePath, { recursive: true });
        } catch {}
      }
      this.devFolders = [fallbackWorkspacePath];
    }
  }

  public getSearchPaths(): string[] {
    return [...this.devFolders];
  }

  public addSearchPath(dirPath: string): boolean {
    const resolved = path.resolve(dirPath);
    if (fs.existsSync(resolved) && !this.devFolders.includes(resolved)) {
      this.devFolders.push(resolved);
      return true;
    }
    return false;
  }

  public removeSearchPath(dirPath: string): boolean {
    const resolved = path.resolve(dirPath);
    const idx = this.devFolders.indexOf(resolved);
    if (idx !== -1) {
      this.devFolders.splice(idx, 1);
      return true;
    }
    return false;
  }

  /**
   * Scan filesystem and database to discover all available projects dynamically.
   */
  public async discoverAllProjects(): Promise<DiscoveredProject[]> {
    const projectsMap = new Map<string, DiscoveredProject>();

    // 1. Scan configured dev folders
    for (const rootDir of this.devFolders) {
      if (!fs.existsSync(rootDir)) continue;
      try {
        const entries = fs.readdirSync(rootDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;

          const projectPath = path.join(rootDir, entry.name);
          const projectName = entry.name;
          const gitRemote = extractGitRemote(projectPath);
          const fingerprint = computeProjectFingerprint(projectPath, gitRemote);
          const projectId = `proj_${fingerprint.substring(0, 10)}`;

          projectsMap.set(projectName.toLowerCase(), {
            id: projectId,
            name: projectName,
            path: projectPath,
            gitRemote,
            autonomyLevel: 'L2',
            lastSeenAt: Date.now(),
            source: rootDir.includes('workspaces') ? 'workspace' : 'dev_folder',
          });
        }
      } catch (err) {
        console.warn(`[ProjectDiscovery] Failed to scan dir ${rootDir}:`, err);
      }
    }

    // 2. Fetch projects from 0xAgent memory.db
    try {
      const memoryDb = getMemoryDb();
      const dbProjects = memoryDb.prepare('SELECT * FROM projects WHERE status != ?').all('archived') as any[];
      for (const p of dbProjects) {
        const name = p.name || path.basename(p.workspace_dir || p.repo_root || '');
        if (!name) continue;

        const pPath = p.workspace_dir || p.repo_root;
        const exists = pPath && fs.existsSync(pPath);
        const key = name.toLowerCase();

        // Avoid adding subdirectories or single files as projects
        if (!projectsMap.has(key) && exists && fs.statSync(pPath).isDirectory()) {
          projectsMap.set(key, {
            id: p.id,
            name,
            path: pPath,
            gitRemote: p.git_remote || null,
            autonomyLevel: 'L2',
            lastSeenAt: Date.now(),
            source: 'db',
          });
        }
      }
    } catch {}

    // 3. Sync discovered projects into Veronica database table `projects` and prune stale ones
    const discoveredList = Array.from(projectsMap.values());
    await this.syncToVeronicaDb(discoveredList);

    return discoveredList;
  }

  private async syncToVeronicaDb(projects: DiscoveredProject[]): Promise<void> {
    await writeQueue.enqueue(() => {
      try {
        const db = getVeronicaDb();
        const upsertStmt = db.prepare(`
          INSERT INTO projects (name, autonomy_level, settings_json, created_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(name) DO UPDATE SET
            settings_json = excluded.settings_json
        `);

        for (const p of projects) {
          const settings = JSON.stringify({
            id: p.id,
            path: p.path,
            gitRemote: p.gitRemote,
            source: p.source,
          });
          upsertStmt.run(p.name, p.autonomyLevel, settings, Date.now());
        }

        // Clean up stale projects in DB that no longer exist on disk
        const currentNames = new Set(projects.map((p) => p.name));
        const allDbProjects = db.prepare('SELECT name FROM projects').all() as any[];
        const deleteStmt = db.prepare('DELETE FROM projects WHERE name = ?');

        for (const row of allDbProjects) {
          if (!currentNames.has(row.name)) {
            deleteStmt.run(row.name);
          }
        }
      } catch (err) {
        console.error('[ProjectDiscovery] Sync to veronica.db error:', err);
      }
    });
  }

  /**
   * Resolve filesystem path for a project name.
   */
  public async resolveProjectPath(projectName: string): Promise<string | null> {
    const projects = await this.discoverAllProjects();
    const cleanName = projectName.trim().toLowerCase();

    // 1. Exact match
    const exact = projects.find((p) => p.name.toLowerCase() === cleanName);
    if (exact && fs.existsSync(exact.path)) return exact.path;

    // 2. Partial match
    const partial = projects.find((p) => p.name.toLowerCase().includes(cleanName));
    if (partial && fs.existsSync(partial.path)) return partial.path;

    // 3. Direct path check if projectName is already a directory path
    if (fs.existsSync(projectName)) {
      return path.resolve(projectName);
    }

    return null;
  }
}

export const projectDiscovery = ProjectDiscovery.getInstance();
