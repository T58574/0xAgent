import { v4 as uuidv4 } from 'uuid';
import { AppConfig, SubagentInfo } from '../../src/types';

class SubagentOrchestrator {
  private subagents = new Map<string, SubagentInfo>();
  private abortControllers = new Map<string, AbortController>();
  private messageHistories = new Map<string, { role: string; content: string }[]>();

  public async spawnSubagent(
    parentId: string,
    role: string,
    goal: string,
    config: AppConfig,
    broadcast?: (event: string, payload: any) => void
  ): Promise<SubagentInfo> {
    const id = `sub_${Date.now()}_${uuidv4().substring(0, 6)}`;
    const info: SubagentInfo = {
      id,
      parentId,
      role,
      goal,
      status: 'running',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.subagents.set(id, info);
    const abortCtrl = new AbortController();
    this.abortControllers.set(id, abortCtrl);

    const initialHistory = [
      {
        role: 'system',
        content: `You are a specialized autonomous sub-agent with role: "${role}". Your parent agent assigned you this specific goal:\n${goal}\n\nDeliver thorough, accurate results. When complete, present your synthesized findings.`,
      },
      {
        role: 'user',
        content: `Goal: ${goal}\nExecute your delegated role and report findings.`,
      },
    ];
    this.messageHistories.set(id, initialHistory);

    if (broadcast) {
      broadcast('subagent-state-changed', info);
    }

    // Run execution asynchronously
    this.executeSubagentTurn(id, config, broadcast).catch((err) => {
      console.error(`Subagent [${id}] turn execution failed:`, err);
    });

    return info;
  }

  private async executeSubagentTurn(
    id: string,
    config: AppConfig,
    broadcast?: (event: string, payload: any) => void
  ): Promise<string> {
    const info = this.subagents.get(id);
    const history = this.messageHistories.get(id);
    const abortCtrl = this.abortControllers.get(id);

    if (!info || !history) return '';

    try {
      const endpoint = `${config.api_url.replace(/\/$/, '')}/chat/completions`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model_name,
          messages: history,
          temperature: 0.2,
          max_tokens: 4096,
        }),
        signal: abortCtrl?.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as any;
      const responseText = data.choices?.[0]?.message?.content || 'Subagent returned no content.';

      history.push({ role: 'assistant', content: responseText });
      info.lastReport = responseText;
      info.status = 'completed';
      info.updatedAt = Date.now();

      if (broadcast) {
        broadcast('subagent-state-changed', info);
      }

      return responseText;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        info.status = 'interrupted';
      } else {
        info.status = 'error';
        info.lastReport = `Error: ${err.message || err}`;
      }
      info.updatedAt = Date.now();

      if (broadcast) {
        broadcast('subagent-state-changed', info);
      }
      return info.lastReport || 'Error';
    }
  }

  public async sendMessage(
    subagentId: string,
    message: string,
    config: AppConfig,
    broadcast?: (event: string, payload: any) => void
  ): Promise<string> {
    const info = this.subagents.get(subagentId);
    const history = this.messageHistories.get(subagentId);

    if (!info || !history) {
      throw new Error(`Subagent '${subagentId}' not found.`);
    }

    if (info.status === 'running') {
      throw new Error(`Subagent '${subagentId}' is currently busy executing a turn.`);
    }

    info.status = 'running';
    info.updatedAt = Date.now();
    history.push({ role: 'user', content: message });

    if (broadcast) {
      broadcast('subagent-state-changed', info);
    }

    return await this.executeSubagentTurn(subagentId, config, broadcast);
  }

  public interruptSubagent(subagentId: string, broadcast?: (event: string, payload: any) => void): boolean {
    const info = this.subagents.get(subagentId);
    const abortCtrl = this.abortControllers.get(subagentId);

    if (!info) return false;

    if (abortCtrl) {
      abortCtrl.abort();
    }

    info.status = 'interrupted';
    info.updatedAt = Date.now();

    if (broadcast) {
      broadcast('subagent-state-changed', info);
    }

    return true;
  }

  public listSubagents(parentId?: string): SubagentInfo[] {
    const all = Array.from(this.subagents.values());
    if (parentId) {
      return all.filter((s) => s.parentId === parentId);
    }
    return all;
  }

  public getSubagent(subagentId: string): SubagentInfo | undefined {
    return this.subagents.get(subagentId);
  }
}

export const subagentOrchestrator = new SubagentOrchestrator();
