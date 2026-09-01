import fs from 'node:fs';
import path from 'node:path';
import { getVeronicaDataDir } from '../db/veronicaDb';
import { projectDiscovery } from './projectDiscovery';

export interface ProjectMetrics {
  version?: string;
  conversion?: string | number;
  test_coverage?: string | number;
  active_features?: string[];
  custom?: Record<string, any>;
  last_updated?: number;
}

export class ProjectDocManager {
  private static instance: ProjectDocManager;

  private constructor() {}

  public static getInstance(): ProjectDocManager {
    if (!ProjectDocManager.instance) {
      ProjectDocManager.instance = new ProjectDocManager();
    }
    return ProjectDocManager.instance;
  }

  private sanitizeProjectName(project: string): string {
    return (project || 'default').replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  }

  public getProjectDir(project: string): string {
    const sanitized = this.sanitizeProjectName(project);
    const projDir = path.join(getVeronicaDataDir(), 'projects', sanitized);
    if (!fs.existsSync(projDir)) {
      fs.mkdirSync(projDir, { recursive: true });
    }
    return projDir;
  }

  /**
   * Get or initialize PASSPORT.md for project
   */
  public async getPassport(project: string): Promise<string> {
    const dir = this.getProjectDir(project);
    const passportFile = path.join(dir, 'PASSPORT.md');

    if (fs.existsSync(passportFile)) {
      return fs.readFileSync(passportFile, 'utf-8');
    }

    // Generate initial default template
    const resolvedPath = (await projectDiscovery.resolveProjectPath(project)) || 'unknown';
    const template = [
      `# Project Passport: ${project}`,
      ``,
      `**Location**: \`${resolvedPath}\``,
      `**Created**: ${new Date().toISOString().split('T')[0]}`,
      `**Status**: Active`,
      ``,
      `## 🎯 Overview & Objectives`,
      `- Core purpose of the project.`,
      `- Key active objectives and roadmap milestones.`,
      ``,
      `## 🛠 Tech Stack & Architecture`,
      `- Languages / Frameworks / Tools`,
      ``,
      `## 📈 Key Metrics & Results`,
      `- Conversion / Performance / Reliability indicators`,
      ``,
      `## 📜 Guidelines for Autonomous Agents`,
      `- Follow atomic commits.`,
      `- Run tests before reporting completion.`,
      `- Keep documentation in sync.`,
    ].join('\n');

    fs.writeFileSync(passportFile, template, 'utf-8');
    return template;
  }

  /**
   * Save or update PASSPORT.md
   */
  public async savePassport(project: string, content: string): Promise<void> {
    const dir = this.getProjectDir(project);
    const passportFile = path.join(dir, 'PASSPORT.md');
    fs.writeFileSync(passportFile, content, 'utf-8');
  }

  /**
   * Append an entry to CHANGELOG.md
   */
  public async appendChangelog(
    project: string,
    entry: {
      author?: string;
      taskId?: string;
      action: string;
      details?: string;
    }
  ): Promise<void> {
    const dir = this.getProjectDir(project);
    const logFile = path.join(dir, 'CHANGELOG.md');
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const author = entry.author || 'Agent';
    const taskIdStr = entry.taskId ? ` [task:${entry.taskId.substring(0, 8)}]` : '';

    const line = `\n### [${timestamp}]${taskIdStr} ${entry.action} (${author})\n${entry.details ? entry.details.trim() + '\n' : ''}`;

    if (!fs.existsSync(logFile)) {
      fs.writeFileSync(logFile, `# Changelog & History: ${project}\n`, 'utf-8');
    }
    fs.appendFileSync(logFile, line, 'utf-8');
  }

  /**
   * Get recent entries from CHANGELOG.md
   */
  public async getChangelog(project: string, limitLines: number = 30): Promise<string> {
    const dir = this.getProjectDir(project);
    const logFile = path.join(dir, 'CHANGELOG.md');
    if (!fs.existsSync(logFile)) return 'No changelog entries yet.';
    const content = fs.readFileSync(logFile, 'utf-8');
    const lines = content.split('\n');
    return lines.slice(-limitLines).join('\n');
  }

  /**
   * Get structured metrics
   */
  public getMetrics(project: string): ProjectMetrics {
    const dir = this.getProjectDir(project);
    const metricsFile = path.join(dir, 'METRICS.json');
    if (fs.existsSync(metricsFile)) {
      try {
        return JSON.parse(fs.readFileSync(metricsFile, 'utf-8'));
      } catch {}
    }
    return {};
  }

  /**
   * Update structured metrics
   */
  public updateMetrics(project: string, updates: Partial<ProjectMetrics>): ProjectMetrics {
    const dir = this.getProjectDir(project);
    const metricsFile = path.join(dir, 'METRICS.json');
    const current = this.getMetrics(project);
    const updated: ProjectMetrics = {
      ...current,
      ...updates,
      custom: { ...(current.custom || {}), ...(updates.custom || {}) },
      last_updated: Date.now(),
    };
    fs.writeFileSync(metricsFile, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  }

  /**
   * Get consolidated high-level overview string for Veronica & Telegram
   */
  public async getConsolidatedOverview(project: string): Promise<string> {
    const passport = await this.getPassport(project);
    const metrics = this.getMetrics(project);
    const lines: string[] = [];

    // Extract first 10 meaningful lines from passport
    const passportPreview = passport
      .split('\n')
      .filter((l) => l.trim() && !l.startsWith('#'))
      .slice(0, 5)
      .join(' | ');

    lines.push(`PASSPORT:${passportPreview || 'ready'}`);
    if (metrics.conversion) lines.push(`CONVERSION:${metrics.conversion}`);
    if (metrics.version) lines.push(`VERSION:${metrics.version}`);

    return lines.join(' | ');
  }
}

export const projectDocManager = ProjectDocManager.getInstance();
