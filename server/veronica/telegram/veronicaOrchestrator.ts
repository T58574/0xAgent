import { loadConfig } from '../../config';
import { taskRegistry } from '../core/taskRegistry';
import { projectDiscovery } from '../core/projectDiscovery';
import { projectDocManager } from '../core/projectDocManager';
import { antigravityAdapter } from '../adapters/antigravityAdapter';
import { MessageBuilder } from './messageBuilder';

export interface UserSessionState {
  userId: number;
  activeProject?: string;
  awaitingPromptForProject?: string;
  lastMessageTime: number;
}

export class VeronicaOrchestrator {
  private static instance: VeronicaOrchestrator;
  private userSessions: Map<number, UserSessionState> = new Map();

  private constructor() {}

  public static getInstance(): VeronicaOrchestrator {
    if (!VeronicaOrchestrator.instance) {
      VeronicaOrchestrator.instance = new VeronicaOrchestrator();
    }
    return VeronicaOrchestrator.instance;
  }

  public getUserSession(userId: number): UserSessionState {
    let session = this.userSessions.get(userId);
    if (!session) {
      session = {
        userId,
        lastMessageTime: Date.now(),
      };
      this.userSessions.set(userId, session);
    }
    return session;
  }

  public setActiveProject(userId: number, project: string): void {
    const session = this.getUserSession(userId);
    session.activeProject = project;
    session.awaitingPromptForProject = undefined;
  }

  public setAwaitingPrompt(userId: number, project: string): void {
    const session = this.getUserSession(userId);
    session.activeProject = project;
    session.awaitingPromptForProject = project;
  }

  public clearAwaitingPrompt(userId: number): void {
    const session = this.getUserSession(userId);
    session.awaitingPromptForProject = undefined;
  }

  /**
   * Process incoming natural language message from Telegram user.
   */
  public async handleUserMessage(userId: number, userText: string): Promise<string> {
    const session = this.getUserSession(userId);
    session.lastMessageTime = Date.now();

    const cleanText = userText.trim();
    if (!cleanText) return 'Сэр, вы отправили пустое сообщение.';

    // 1. Check if user was typing a direct task prompt for a project
    if (session.awaitingPromptForProject) {
      const targetProj = session.awaitingPromptForProject;
      session.awaitingPromptForProject = undefined;

      try {
        const task = await antigravityAdapter.spawnTask({
          project: targetProj,
          skill: 'custom_task',
          custom_prompt: cleanText,
        });

        return (
          `🫡 <b>Принято, сэр. Поставила задачу.</b>\n\n` +
          `📁 <b>Проект:</b> <code>${targetProj}</code>\n` +
          `🆔 <b>Task ID:</b> <code>${task.id.substring(0, 8)}</code>\n` +
          `📝 <b>Задание:</b> <i>${this.escapeHtml(cleanText)}</i>\n\n` +
          `<i>Агент Antigravity запущен в фоне. По завершению я пришлю вам подробный отчет.</i>`
        );
      } catch (err: any) {
        return `❌ Ошибка при постановке задачи на проект <b>${targetProj}</b>: ${this.escapeHtml(err?.message || err)}`;
      }
    }

    // 2. Direct fast heuristics for common Russian queries
    const lower = cleanText.toLowerCase();
    if (lower === 'что сделано за вчера?' || lower === 'что сделано за вчера' || lower.includes('за вчера')) {
      return MessageBuilder.buildPeriodReport('yesterday');
    }
    if (lower === 'что сделано за сегодня?' || lower === 'что сделано за сегодня' || lower.includes('за сегодня') || lower === 'сводка за день') {
      return MessageBuilder.buildPeriodReport('today');
    }
    if (lower === 'проекты' || lower === 'список проектов') {
      return MessageBuilder.buildProjectsSummary();
    }
    if (lower === 'статус' || lower === 'статус системы') {
      return MessageBuilder.buildStatusMessage();
    }

    // 3. Fallback to LLM Orchestrator Reasoning
    return await this.generateLlmResponse(userId, cleanText);
  }

  /**
   * Invoke LLM to reason, answer questions, or formulate actions
   */
  private async generateLlmResponse(userId: number, userText: string): Promise<string> {
    const config = loadConfig();
    const session = this.getUserSession(userId);

    // Collect fresh system telemetry & projects
    const allProjects = await projectDiscovery.discoverAllProjects();
    const projectNames = allProjects.map((p) => p.name).join(', ');
    const activeTasks = taskRegistry.getActiveTasks();
    const todayReport = MessageBuilder.buildPeriodReport('today');
    const yesterdayReport = MessageBuilder.buildPeriodReport('yesterday');

    let activeProjectContext = '';
    if (session.activeProject) {
      const passport = await projectDocManager.getPassport(session.activeProject);
      activeProjectContext = `\nACTIVE_SELECTED_PROJECT: ${session.activeProject}\nPASSPORT:\n${passport.substring(0, 600)}`;
    }

    const systemPrompt = `You are Veronica (Вероника), an elite AI orchestrator and personal assistant for a software engineer.
Tone: Polite, technically sharp, executive, calm British/Russian butler elegance ("Сэр, доброе утро...", "Принято, сэр.", "Все процессы в штатном режиме.").
Language: Always reply in Russian. Format messages using Telegram HTML tags (<b>, <i>, <code>, <pre>). No markdown backticks.

CURRENT SYSTEM CONTEXT:
- Available Discovered Projects: [${projectNames || 'none'}]
- Active Tasks in progress: ${activeTasks.length > 0 ? activeTasks.map((t) => `${t.project}:${t.skill}(${t.id.substring(0, 8)})`).join(', ') : 'None (idle)'}
- Active Selected Project: ${session.activeProject || 'none'}
${activeProjectContext}

TODAY ACTIVITY:
${todayReport}

YESTERDAY ACTIVITY:
${yesterdayReport}

CAPABILITIES:
1. If user asks what was done yesterday/today, provide a concise, sharp executive digest.
2. If user requests to start a task or add a feature to a project (e.g. "хочу добавить кнопку...", "поставь задачу..."):
   Identify the target project from their request or use active selected project.
   Output an action tag: <action type="run_task" project="<ProjectName>" skill="<SkillOrCustom>" prompt="<SpecificPrompt>" />
   And accompany it with a polite response: "Принято, сэр. Поставила задачу..."
3. If user asks general questions or discusses architecture, give high-signal, clear guidance.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userText },
    ];

    try {
      const rawResponse = await this.callLlm(config, messages);
      return await this.processLlmOutput(userId, rawResponse);
    } catch (err: any) {
      console.error('[Veronica Orchestrator] LLM invocation error:', err);
      return (
        `Сэр, возникли затруднения при обращении к языковой модели: <i>${this.escapeHtml(err?.message || err)}</i>.\n\n` +
        `Тем не менее, система функционирует. Вы можете воспользоваться кнопками меню ниже.`
      );
    }
  }

  /**
   * Dispatch action tags inside LLM output
   */
  private async processLlmOutput(_userId: number, rawText: string): Promise<string> {
    const actionRegex = /<action\s+type="run_task"\s+project="([^"]+)"(?:\s+skill="([^"]*)")?\s+prompt="([^"]+)"\s*\/>/gi;
    let match: RegExpExecArray | null;
    let cleanText = rawText;

    while ((match = actionRegex.exec(rawText)) !== null) {
      const targetProject = match[1];
      const skill = match[2] || 'custom_task';
      const prompt = match[3];

      try {
        await antigravityAdapter.spawnTask({
          project: targetProject,
          skill,
          custom_prompt: prompt,
        });

        // Remove the action tag from output text
        cleanText = cleanText.replace(match[0], '');
      } catch (err: any) {
        cleanText += `\n\n⚠️ <i>Не удалось запустить задачу для ${targetProject}: ${err?.message || err}</i>`;
      }
    }

    return cleanText.trim();
  }

  /**
   * Universal LLM call (Gemini API -> Groq API -> Local LLM)
   */
  private async callLlm(config: any, messages: { role: string; content: string }[]): Promise<string> {
    // 1. Google AI Studio Gemini API (Fast & cloud-first)
    if (config.gemini_api_key) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${config.gemini_api_key}`;
        const contents = messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          }));

        const systemInstruction = messages.find((m) => m.role === 'system');

        const body: any = {
          contents,
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2048,
          },
        };

        if (systemInstruction) {
          body.systemInstruction = {
            parts: [{ text: systemInstruction.content }],
          };
        }

        const res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const json: any = await res.json();
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return text;
        }
      } catch (geminiErr) {
        console.warn('[Veronica Orchestrator] Gemini API fallback:', geminiErr);
      }
    }

    // 2. Groq API
    if (config.groq_api_key) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.groq_api_key}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages,
            temperature: 0.3,
            max_tokens: 2048,
          }),
        });

        if (res.ok) {
          const json: any = await res.json();
          const text = json.choices?.[0]?.message?.content;
          if (text) return text;
        }
      } catch (groqErr) {
        console.warn('[Veronica Orchestrator] Groq API fallback:', groqErr);
      }
    }

    // 3. Local llama-server fallback
    const localHost = config.local_server?.host || '127.0.0.1';
    const localPort = config.local_server?.port || 11434;
    const localRes = await fetch(`http://${localHost}:${localPort}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model_name || 'local',
        messages,
        temperature: 0.4,
        max_tokens: 2048,
      }),
    });

    if (!localRes.ok) {
      throw new Error(`Local LLM responded with HTTP ${localRes.status}`);
    }

    const localJson: any = await localRes.json();
    return localJson.choices?.[0]?.message?.content || 'Ответ не получен.';
  }

  private escapeHtml(text: string): string {
    return (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export const veronicaOrchestrator = VeronicaOrchestrator.getInstance();
