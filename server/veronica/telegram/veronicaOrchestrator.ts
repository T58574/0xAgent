import { loadConfig } from '../../config';
import { taskRegistry } from '../core/taskRegistry';
import { projectDiscovery } from '../core/projectDiscovery';
import { projectDocManager } from '../core/projectDocManager';
import { antigravityAdapter } from '../adapters/antigravityAdapter';
import { MessageBuilder } from './messageBuilder';
import { getUserMemories } from '../../memory';
import { sessionStateManager, UserSessionState } from './sessionStateManager';
import { taskActionDispatcher } from './taskActionDispatcher';
import { inferenceGateway } from './inferenceGateway';

export type { DialogMessage, UserSessionState } from './sessionStateManager';

export class VeronicaOrchestrator {
  private static instance: VeronicaOrchestrator;

  private constructor() {}

  public static getInstance(): VeronicaOrchestrator {
    if (!VeronicaOrchestrator.instance) {
      VeronicaOrchestrator.instance = new VeronicaOrchestrator();
    }
    return VeronicaOrchestrator.instance;
  }

  public getUserProfileContext(): { userName: string; memoryContext: string } {
    try {
      const memories = getUserMemories();
      const preferredNameMem = memories.find((m) => m.key === 'preferred_name');
      const userName = (preferredNameMem?.value || '').trim();

      const contextLines = memories
        .filter((m) => m.value && m.key !== 'preferred_name')
        .map((m) => `- [${m.category || 'memory'}] ${m.key}: ${m.value}`);

      const memoryContext = contextLines.length > 0 ? contextLines.join('\n') : '';
      return { userName, memoryContext };
    } catch {
      return { userName: '', memoryContext: '' };
    }
  }

  public persistSessionMeta(session: UserSessionState): void {
    sessionStateManager.persistSessionMeta(session);
  }

  public getUserSession(userId: number): UserSessionState {
    return sessionStateManager.getUserSession(userId);
  }

  public resetSession(userId: number): void {
    sessionStateManager.resetSession(userId);
  }

  public setActiveProject(userId: number, project: string): void {
    sessionStateManager.setActiveProject(userId, project);
  }

  public setAwaitingPrompt(userId: number, project: string): void {
    sessionStateManager.setAwaitingPrompt(userId, project);
  }

  public clearAwaitingPrompt(userId: number): void {
    sessionStateManager.clearAwaitingPrompt(userId);
  }

  public persistMessage(userId: number, role: 'user' | 'assistant' | 'system', content: string): void {
    sessionStateManager.persistMessage(userId, role, content);
  }

  /**
   * Smart project resolution from candidate string or full query text
   */
  public async resolveTargetProject(
    candidate?: string,
    queryText?: string,
    fallbackActiveProject?: string
  ): Promise<string | null> {
    const allProjects = await projectDiscovery.discoverAllProjects();
    if (allProjects.length === 0) return null;

    // 1. Check exact candidate match
    if (candidate) {
      const exact = allProjects.find((p) => p.name.toLowerCase() === candidate.trim().toLowerCase());
      if (exact) return exact.name;
    }

    // 2. Check candidate substring / fuzzy match
    if (candidate) {
      const candNorm = candidate.trim().toLowerCase();
      const subMatch = allProjects.find(
        (p) => p.name.toLowerCase().includes(candNorm) || candNorm.includes(p.name.toLowerCase())
      );
      if (subMatch) return subMatch.name;
    }

    // 3. Scan queryText for known project names
    if (queryText) {
      const textNorm = queryText.toLowerCase();
      for (const p of allProjects) {
        if (textNorm.includes(p.name.toLowerCase())) {
          return p.name;
        }
      }
    }

    // 4. Fallback to active project if selected
    if (fallbackActiveProject && allProjects.some((p) => p.name === fallbackActiveProject)) {
      return fallbackActiveProject;
    }

    // 5. If only 1 project exists in entire system, default to it
    if (allProjects.length === 1) {
      return allProjects[0].name;
    }

    return null;
  }

  /**
   * Process incoming natural language message from Telegram user.
   */
  public async handleUserMessage(userId: number, userText: string, imagePath?: string): Promise<string> {
    const session = this.getUserSession(userId);
    session.lastMessageTime = Date.now();

    const cleanText = userText.trim();
    if (!cleanText && !imagePath) return 'Сэр, вы отправили пустое сообщение.';

    // Record user message into session history
    this.persistMessage(userId, 'user', cleanText || '🖼️ [Изображение]');

    const { userName } = this.getUserProfileContext();
    const nameSuffix = userName ? `, ${userName}` : '';

    // 1. Check if user was typing a direct task prompt for an active project
    if (session.awaitingPromptForProject) {
      const targetProj = session.awaitingPromptForProject;
      session.awaitingPromptForProject = undefined;

      try {
        const task = await antigravityAdapter.spawnTask({
          project: targetProj,
          skill: 'custom_task',
          custom_prompt: cleanText,
        });

        session.lastTaskId = task.id;
        session.lastTaskProject = targetProj;
        session.lastTaskSummary = cleanText;

        const reply =
          `🫡 <b>Принято${nameSuffix}. Поставила задачу.</b>\n\n` +
          `📁 <b>Проект:</b> <code>${targetProj}</code>\n` +
          `🆔 <b>Task ID:</b> <code>${task.id.substring(0, 8)}</code>\n` +
          `📝 <b>Задание:</b> <i>${this.escapeHtml(cleanText)}</i>\n\n` +
          `<i>Агент Antigravity запущен с паспортом проекта и регламентом CLI. По завершению я пришлю подробный отчет.</i>`;

        this.persistMessage(userId, 'assistant', reply);
        return reply;
      } catch (err: any) {
        const errReply = `❌ Ошибка при постановке задачи на проект <b>${targetProj}</b>: ${this.escapeHtml(
          err?.message || err
        )}`;
        this.persistMessage(userId, 'assistant', errReply);
        return errReply;
      }
    }

    // 2. High-speed local heuristic matching (Strip leading bot addressing)
    let stripped = cleanText.replace(/^(?:вероника|ника|бот|ассистент)[\s,!:—-]+/i, '').trim();
    if (!stripped) stripped = cleanText;
    const lower = stripped.toLowerCase();

    // Session reset shortcuts
    if (lower === '/reset' || lower === '/new' || lower === '/clear' || lower === 'новая сессия' || lower === 'сброс') {
      this.resetSession(userId);
      const reply = `🔄 <b>Контекст диалога сброшен.</b> Начнем с чистого листа${nameSuffix}. Чем могу помочь?`;
      this.persistMessage(userId, 'assistant', reply);
      return reply;
    }

    // Greetings
    if (/^(привет|здравствуй|здравствуйте|добрый день|доброе утро|добрый вечер|ку|хай|салют|hello|hi)[!.]*$/i.test(lower)) {
      const projects = await projectDiscovery.discoverAllProjects();
      const activeTasks = taskRegistry.getActiveTasks();
      const reply =
        `👋 <b>Привет${nameSuffix}!</b>\n\n` +
        `Все системы на связи. В каталоге проектов: <b>${projects.length}</b>, активных задач в работе: <b>${activeTasks.length}</b>.\n\n` +
        `💡 <i>Нажмите «📁 Проекты» для списка или скажите мне, что нужно сделать.</i>`;
      this.persistMessage(userId, 'assistant', reply);
      return reply;
    }

    // Period reports
    if (lower === 'что сделано за вчера?' || lower === 'что сделано за вчера' || lower.includes('за вчера')) {
      const reply = MessageBuilder.buildPeriodReport('yesterday');
      this.persistMessage(userId, 'assistant', reply);
      return reply;
    }
    if (lower === 'что сделано за сегодня?' || lower === 'что сделано за сегодня' || lower.includes('за сегодня') || lower === 'сводка за день') {
      const reply = MessageBuilder.buildPeriodReport('today');
      this.persistMessage(userId, 'assistant', reply);
      return reply;
    }
    if (lower === 'проекты' || lower === 'список проектов' || lower === 'покажи проекты') {
      const reply = await MessageBuilder.buildProjectsSummary();
      this.persistMessage(userId, 'assistant', reply);
      return reply;
    }
    if (lower === 'статус' || lower === 'статус системы' || lower === 'как дела') {
      const reply = MessageBuilder.buildStatusMessage();
      this.persistMessage(userId, 'assistant', reply);
      return reply;
    }

    // Direct Task placement heuristic: "поставь задачу на проект X: ..." or "добавь в проект X ..."
    const taskMatch = lower.match(
      /(?:поставь задачу|запусти задачу|сделай задачу|выполни задачу|добавь|создай)\s+(?:на|в|для)?\s*(?:проект|проекте)?\s*([a-zA-Z0-9_\-]+)[:\s]+(.+)/i
    );
    if (taskMatch) {
      const candidateProj = taskMatch[1].trim();
      const taskPrompt = taskMatch[2].trim();
      const targetProject = await this.resolveTargetProject(candidateProj, cleanText, session.activeProject);

      if (targetProject) {
        try {
          const task = await antigravityAdapter.spawnTask({
            project: targetProject,
            skill: 'custom_task',
            custom_prompt: taskPrompt,
          });

          session.lastTaskId = task.id;
          session.lastTaskProject = targetProject;
          session.lastTaskSummary = taskPrompt;

          const reply =
            `🫡 <b>Принято${nameSuffix}. Поставила задачу.</b>\n\n` +
            `📁 <b>Проект:</b> <code>${targetProject}</code>\n` +
            `🆔 <b>Task ID:</b> <code>${task.id.substring(0, 8)}</code>\n` +
            `📝 <b>Задание:</b> <i>${this.escapeHtml(taskPrompt)}</i>\n\n` +
            `<i>Агент Antigravity запущен с паспортом проекта и регламентом CLI.</i>`;

          this.persistMessage(userId, 'assistant', reply);
          return reply;
        } catch (err: any) {
          const errReply = `❌ Не удалось создать задачу: ${this.escapeHtml(err?.message || err)}`;
          this.persistMessage(userId, 'assistant', errReply);
          return errReply;
        }
      }
    }

    // 3. Multi-turn LLM Orchestrator Reasoning across the 2 backends
    const response = await this.generateLlmResponse(userId, cleanText, imagePath);
    this.persistMessage(userId, 'assistant', response);
    return response;
  }

  /**
   * Invoke LLM with multi-turn conversation memory and dynamic orchestrator prompt
   */
  private async generateLlmResponse(userId: number, userText: string, imagePath?: string): Promise<string> {
    const config = loadConfig();
    const session = this.getUserSession(userId);

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

    const lastTaskContext = session.lastTaskId
      ? `\nLAST_SPAWNED_TASK: id=${session.lastTaskId.substring(0, 8)} project=${session.lastTaskProject || 'unknown'} summary="${session.lastTaskSummary || 'none'}"`
      : '';

    const { userName, memoryContext } = this.getUserProfileContext();

    const identityBlock = userName
      ? `USER IDENTITY (FROM MEMORY ENGINE): The user's preferred name is "${userName}". Address the user naturally by this preferred name.`
      : `USER IDENTITY: Preferred name is not set in memory. Address the user naturally without assumptions.`;

    const memoryBlock = memoryContext
      ? `\nUSER KNOWLEDGE & PREFERENCES (FROM MEMORY ENGINE):\n${memoryContext}\n`
      : '';

    const systemPrompt = `You are Veronica (Вероника), an alive, highly intelligent, warm, technically sharp personal AI companion and engineering supervisor.
${identityBlock}
${memoryBlock}
Tone: Direct, warm, concise, witty, highly competent. Never use robotic bureaucratic boilerplate, stiffness, or canned templates. Speak naturally like a close trusted partner in engineering and life.
Language: Always reply in Russian. Format messages using modern, rich Telegram-compatible Markdown (bold **text**, italic *text*, \`inline code\`, \`\`\`code blocks\`\`\`, > blockquotes, tables, bullet points).

CURRENT SYSTEM CONTEXT:
- Discovered Projects: [${projectNames || 'none'}]
- Active Selected Project: ${session.activeProject || 'none'}
- Active Running Tasks: ${
      activeTasks.length > 0
        ? activeTasks.map((t) => `${t.project}:${t.skill}(${t.id.substring(0, 8)})`).join(', ')
        : 'None (idle)'
    }
${activeProjectContext}
${lastTaskContext}

TODAY ACTIVITY:
${todayReport}

YESTERDAY ACTIVITY:
${yesterdayReport}

ORCHESTRATION INSTRUCTIONS:
1. Multi-turn Dialog Continuity: You remember previous messages and context. If the user asks to clarify, refine, or follow up on a previous task or answer, maintain full conversational continuity.
2. Task Formulation & Action Tags (Zero Generic Skills):
   - You MUST formulate the COMPLETE, DETAILED technical specification (ТЗ) yourself. Do NOT bind to rigid, generic markdown skill templates. You are the senior architect: write the concrete instructions and requirements in the \`prompt\` attribute.
   - Immediate execution:
     <action type="run_task" project="<ProjectName>" prompt="<FullTechnicalSpecificationAndInstructions>" />
   - Recurring/Periodic automated execution (e.g. daily, hourly, every_30m):
     <action type="schedule_task" project="<ProjectName>" schedule="daily|hourly|every_30m" prompt="<FullTechnicalSpecificationAndInstructions>" />
   - If the user is asking to refine or continue the previous task:
     <action type="continue_task" task_id="${session.lastTaskId || ''}" prompt="<RefinementInstructions>" />
   - Accompany action tags with a natural concise response ("Принято${userName ? `, ${userName}` : ''}. Запустила задачу для проекта X...").
3. Ambiguous Project Names:
   - If the user mentions a project informally (e.g. "логистика"), match it against discovered projects.
   - If completely ambiguous and multiple projects exist, ask the user to specify which project.
4. Executive Summaries: If asked what was done, give a sharp, bulleted summary from recent activity.`;

    const conversationPayload: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ];

    const historySlice = session.messages.slice(0, -1);
    for (const msg of historySlice) {
      conversationPayload.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      });
    }

    conversationPayload.push({ role: 'user', content: userText });

    try {
      const rawResponse = await inferenceGateway.callLlm(config, conversationPayload, systemPrompt, userText, session, imagePath);
      return await taskActionDispatcher.dispatchActionTags(session, rawResponse, this.resolveTargetProject.bind(this));
    } catch (err: any) {
      const errDetail = err?.cause?.message || err?.cause?.code || err?.message || String(err);
      console.warn('[Veronica Orchestrator] All LLM backends exhausted:', errDetail);

      return inferenceGateway.formatLlmErrorResponse(err, userText, session);
    }
  }

  /**
   * Structure voice thought dump transcript into structured JSON (title, summary, action_points, tags, project)
   */
  public async structureVoiceThought(transcript: string): Promise<{
    title: string;
    summary: string;
    action_points: string[];
    tags: string[];
    project?: string | null;
  } | null> {
    const config = loadConfig();
    const allProjects = await projectDiscovery.discoverAllProjects();
    const projectNames = allProjects.map((p) => p.name).join(', ');

    const systemPrompt = `You are Veronica (Вероника), an elite executive assistant and software architect.
A user recorded a voice message (thought dump / голосовой сброс мыслей).
Your task is to analyze the raw speech transcript, extract key insights, formulate concrete action points, and detect relevant project tags.

KNOWN PROJECTS: [${projectNames || 'none'}]

Instructions:
1. Title: Short, punchy, informative headline in Russian (max 60 chars).
2. Summary: Clear 1-3 sentence explanation of the idea or problem in Russian.
3. Action Points: Array of concrete, actionable tasks/steps in Russian.
4. Tags: Array of relevant hashtags (e.g. ["#0xAgent", "#voice", "#telegram"]).
5. Project: Name of the exact matched project from KNOWN PROJECTS or null if not project-specific.

CRITICAL: Return ONLY a valid JSON object matching this schema, with no markdown code fences, no extra commentary:
{
  "title": "string",
  "summary": "string",
  "action_points": ["string"],
  "tags": ["string"],
  "project": "string or null"
}`;

    const promptPayload = `TRANSCRIPT TO STRUCTURE:\n"${transcript}"\n\nReturn strictly valid JSON:`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: promptPayload },
    ];

    try {
      const rawRes = await inferenceGateway.callLlm(config, messages, systemPrompt, promptPayload);
      const cleanJson = rawRes
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      const parsed = JSON.parse(cleanJson);
      return {
        title: parsed.title || transcript.slice(0, 50),
        summary: parsed.summary || transcript,
        action_points: Array.isArray(parsed.action_points) ? parsed.action_points : [],
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        project: parsed.project || null,
      };
    } catch (err) {
      console.warn('[Veronica Orchestrator] Failed to structure thought dump via LLM:', err);
      return null;
    }
  }

  /**
   * Raw LLM call helper for background tasks (fact-checking, summarization)
   */
  public async callRawLlm(prompt: string): Promise<string> {
    const config = loadConfig();
    const messages = [{ role: 'user', content: prompt }];
    return inferenceGateway.callLlm(config, messages, '', prompt);
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
