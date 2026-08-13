import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { JulesSessionInfo, JulesSource } from '../src/types';
import { logger } from './logger';
import { loadConfig } from './config';

const JULES_BASE_URL = 'https://jules.googleapis.com/v1alpha';
const JULES_DATA_FILE = path.join(os.homedir(), '.0xagent', 'data', 'jules_sessions.json');

export class JulesService {
  private activeSessions: Map<string, JulesSessionInfo> = new Map();
  private pollInterval: NodeJS.Timeout | null = null;
  private wsBroadcaster: ((event: string, data: any) => void) | null = null;

  constructor() {
    this.loadSessionsFromDisk().then(() => {
      this.startPolling();
    });
  }

  private async loadSessionsFromDisk() {
    try {
      if (fs.existsSync(JULES_DATA_FILE)) {
        const raw = await fs.promises.readFile(JULES_DATA_FILE, 'utf-8');
        const list: JulesSessionInfo[] = JSON.parse(raw);
        for (const s of list) {
          if (s && s.id) {
            this.activeSessions.set(s.id, s);
          }
        }
        logger.info('JulesService', `Loaded ${this.activeSessions.size} Jules sessions from disk`);
      }
    } catch (err: any) {
      logger.error('JulesService', `Failed to load sessions from disk: ${err.message}`);
    }
  }

  private async saveSessionsToDisk() {
    try {
      const dir = path.dirname(JULES_DATA_FILE);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }
      const list = Array.from(this.activeSessions.values());
      await fs.promises.writeFile(JULES_DATA_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err: any) {
      logger.error('JulesService', `Failed to save sessions to disk: ${err.message}`);
    }
  }

  public setWsBroadcaster(broadcaster: (event: string, data: any) => void) {
    this.wsBroadcaster = broadcaster;
  }

  private getApiKey(): string {
    const config = loadConfig();
    if (!config.jules_api_key) {
      throw new Error('Jules API key is not configured in Settings.');
    }
    return config.jules_api_key;
  }

  private getHeaders(apiKey?: string): Record<string, string> {
    const key = apiKey || this.getApiKey();
    return {
      'Content-Type': 'application/json',
      'x-goog-api-key': key,
    };
  }

  public async listSources(customApiKey?: string): Promise<JulesSource[]> {
    try {
      const headers = this.getHeaders(customApiKey);
      const res = await fetch(`${JULES_BASE_URL}/sources`, { headers });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Jules API error (${res.status}): ${errText}`);
      }
      const data = await res.json();
      return (data.sources || []).map((s: any) => ({
        name: s.name,
        id: s.id,
        githubRepo: s.githubRepo,
      }));
    } catch (err: any) {
      logger.error('JulesService', `Failed to list sources: ${err.message}`);
      throw err;
    }
  }

  public async createSession(options: {
    prompt: string;
    source: string;
    startingBranch?: string;
    autoCreatePR?: boolean;
    requirePlanApproval?: boolean;
    title?: string;
  }): Promise<JulesSessionInfo> {
    try {
      const headers = this.getHeaders();
      const body: any = {
        prompt: options.prompt,
        sourceContext: {
          source: options.source.startsWith('sources/') ? options.source : `sources/${options.source}`,
          githubRepoContext: {
            startingBranch: options.startingBranch || 'main',
          },
        },
        title: options.title || options.prompt.slice(0, 40),
      };

      if (options.autoCreatePR !== false) {
        body.automationMode = 'AUTO_CREATE_PR';
      }

      if (options.requirePlanApproval) {
        body.requirePlanApproval = true;
      }

      const res = await fetch(`${JULES_BASE_URL}/sessions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Jules API error (${res.status}): ${errText}`);
      }

      const raw = await res.json();
      const sessionId = raw.id || (raw.name ? raw.name.split('/').pop() : Date.now().toString());

      const sessionInfo: JulesSessionInfo = {
        name: raw.name || `sessions/${sessionId}`,
        id: sessionId,
        title: raw.title || options.title || 'Jules Task',
        prompt: options.prompt,
        status: options.requirePlanApproval ? 'WAITING_PLAN_APPROVAL' : 'EXECUTING',
        sourceContext: raw.sourceContext,
        outputs: raw.outputs || [],
        requirePlanApproval: options.requirePlanApproval,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      this.activeSessions.set(sessionId, sessionInfo);
      this.saveSessionsToDisk();
      this.broadcast('jules_session_created', sessionInfo);
      return sessionInfo;
    } catch (err: any) {
      logger.error('JulesService', `Failed to create session: ${err.message}`);
      throw err;
    }
  }

  public async getSession(sessionId: string): Promise<JulesSessionInfo> {
    try {
      const headers = this.getHeaders();
      const cleanId = sessionId.replace('sessions/', '');
      const res = await fetch(`${JULES_BASE_URL}/sessions/${cleanId}`, { headers });
      
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Jules API error (${res.status}): ${errText}`);
      }

      const raw = await res.json();
      const existing = this.activeSessions.get(cleanId);
      
      let status: JulesSessionInfo['status'] = 'EXECUTING';
      if (raw.outputs && raw.outputs.some((o: any) => o.pullRequest)) {
        status = 'PR_CREATED';
      } else if (raw.requirePlanApproval && !raw.planApproved) {
        status = 'WAITING_PLAN_APPROVAL';
      }

      const updated: JulesSessionInfo = {
        name: raw.name || `sessions/${cleanId}`,
        id: cleanId,
        title: raw.title || existing?.title || 'Jules Task',
        prompt: raw.prompt || existing?.prompt || '',
        status,
        sourceContext: raw.sourceContext || existing?.sourceContext,
        outputs: raw.outputs || [],
        requirePlanApproval: raw.requirePlanApproval,
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
        lastMessage: raw.lastMessage || existing?.lastMessage,
      };

      this.activeSessions.set(cleanId, updated);
      this.saveSessionsToDisk();
      return updated;
    } catch (err: any) {
      logger.error('JulesService', `Failed to get session ${sessionId}: ${err.message}`);
      throw err;
    }
  }

  public async approvePlan(sessionId: string): Promise<boolean> {
    try {
      const headers = this.getHeaders();
      const cleanId = sessionId.replace('sessions/', '');
      const res = await fetch(`${JULES_BASE_URL}/sessions/${cleanId}:approvePlan`, {
        method: 'POST',
        headers,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Jules API approvePlan error (${res.status}): ${errText}`);
      }

      const session = this.activeSessions.get(cleanId);
      if (session) {
        session.status = 'EXECUTING';
        session.updatedAt = Date.now();
        this.saveSessionsToDisk();
        this.broadcast('jules_session_updated', session);
      }
      return true;
    } catch (err: any) {
      logger.error('JulesService', `Failed to approve plan for ${sessionId}: ${err.message}`);
      throw err;
    }
  }

  public async sendMessage(sessionId: string, prompt: string): Promise<boolean> {
    try {
      const headers = this.getHeaders();
      const cleanId = sessionId.replace('sessions/', '');
      const res = await fetch(`${JULES_BASE_URL}/sessions/${cleanId}:sendMessage`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Jules API sendMessage error (${res.status}): ${errText}`);
      }

      const session = this.activeSessions.get(cleanId);
      if (session) {
        session.lastMessage = prompt;
        session.updatedAt = Date.now();
        this.saveSessionsToDisk();
        this.broadcast('jules_session_updated', session);
      }
      return true;
    } catch (err: any) {
      logger.error('JulesService', `Failed to send message for ${sessionId}: ${err.message}`);
      throw err;
    }
  }

  public getCachedSessions(): JulesSessionInfo[] {
    return Array.from(this.activeSessions.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  private startPolling() {
    this.pollInterval = setInterval(async () => {
      const config = loadConfig();
      if (!config.jules_api_key) return;

      for (const [id, session] of this.activeSessions.entries()) {
        if (session.status === 'PR_CREATED' || session.status === 'COMPLETED' || session.status === 'FAILED') {
          continue;
        }
        try {
          const fresh = await this.getSession(id);
          this.broadcast('jules_session_updated', fresh);
        } catch {
          // Ignore transient network errors during background polling
        }
      }
    }, 20000);
  }

  public stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private broadcast(event: string, data: any) {
    if (this.wsBroadcaster) {
      try {
        this.wsBroadcaster(event, data);
      } catch (err) {
        logger.error('JulesService', `WS broadcast failed: ${err}`);
      }
    }
  }
}

export const julesService = new JulesService();
