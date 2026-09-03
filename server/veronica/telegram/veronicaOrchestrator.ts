import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { loadConfig } from '../../config';
import { taskRegistry } from '../core/taskRegistry';
import { projectDiscovery } from '../core/projectDiscovery';
import { projectDocManager } from '../core/projectDocManager';
import { antigravityAdapter, resolveAntigravityModelAndEffort, getSafeCliPath } from '../adapters/antigravityAdapter';
import { getVeronicaDb } from '../db/veronicaDb';
import { writeQueue } from '../db/writeQueue';
import { veronicaScheduler } from '../core/scheduler';
import { MessageBuilder } from './messageBuilder';
import { getUserMemories } from '../../memory';
import { proxyService } from '../../proxyService';
import { AntigravityUsage } from '../../../src/types';

export interface DialogMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface UserSessionState {
  userId: number;
  activeProject?: string;
  awaitingPromptForProject?: string;
  lastTaskId?: string;
  lastTaskProject?: string;
  lastTaskSummary?: string;
  lastMessageTime: number;
  messages: DialogMessage[];
  antigravityConversationId?: string;
  lastUsage?: AntigravityUsage;
  lastDurationSeconds?: number;
}

export class VeronicaOrchestrator {
  private static instance: VeronicaOrchestrator;
  private userSessions: Map<number, UserSessionState> = new Map();
  private maxHistoryPerSession: number = 15;

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

  private loadUserSessionMeta(userId: number): {
    active_project?: string;
    awaiting_prompt_for_project?: string;
    last_task_id?: string;
    last_task_project?: string;
    last_task_summary?: string;
    antigravity_conversation_id?: string;
    updated_at?: number;
  } | null {
    try {
      const db = getVeronicaDb();
      const row = db.prepare(
        'SELECT active_project, awaiting_prompt_for_project, last_task_id, last_task_project, last_task_summary, antigravity_conversation_id, updated_at FROM telegram_user_sessions WHERE user_id = ?'
      ).get(userId) as any;
      if (!row) return null;
      return {
        active_project: row.active_project || undefined,
        awaiting_prompt_for_project: row.awaiting_prompt_for_project || undefined,
        last_task_id: row.last_task_id || undefined,
        last_task_project: row.last_task_project || undefined,
        last_task_summary: row.last_task_summary || undefined,
        antigravity_conversation_id: row.antigravity_conversation_id || undefined,
        updated_at: row.updated_at ? Number(row.updated_at) : undefined,
      };
    } catch {
      return null;
    }
  }

  public persistSessionMeta(session: UserSessionState): void {
    const now = Date.now();
    session.lastMessageTime = now;
    writeQueue.enqueue(() => {
      try {
        const db = getVeronicaDb();
        db.prepare(`
          INSERT INTO telegram_user_sessions 
            (user_id, active_project, awaiting_prompt_for_project, last_task_id, last_task_project, last_task_summary, antigravity_conversation_id, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            active_project = excluded.active_project,
            awaiting_prompt_for_project = excluded.awaiting_prompt_for_project,
            last_task_id = excluded.last_task_id,
            last_task_project = excluded.last_task_project,
            last_task_summary = excluded.last_task_summary,
            antigravity_conversation_id = excluded.antigravity_conversation_id,
            updated_at = excluded.updated_at
        `).run(
          session.userId,
          session.activeProject || null,
          session.awaitingPromptForProject || null,
          session.lastTaskId || null,
          session.lastTaskProject || null,
          session.lastTaskSummary || null,
          session.antigravityConversationId || null,
          now
        );
      } catch (err) {
        console.warn('[Veronica Orchestrator] Failed to persist session metadata:', err);
      }
    }).catch(() => {});
  }

  public getUserSession(userId: number): UserSessionState {
    let session = this.userSessions.get(userId);
    if (!session) {
      // Load recent history from SQLite
      const recentMessages = this.loadConversationHistory(userId, this.maxHistoryPerSession);
      const meta = this.loadUserSessionMeta(userId);
      session = {
        userId,
        activeProject: meta?.active_project,
        awaitingPromptForProject: meta?.awaiting_prompt_for_project,
        lastTaskId: meta?.last_task_id,
        lastTaskProject: meta?.last_task_project,
        lastTaskSummary: meta?.last_task_summary,
        antigravityConversationId: meta?.antigravity_conversation_id,
        lastMessageTime: meta?.updated_at || Date.now(),
        messages: recentMessages,
      };
      this.userSessions.set(userId, session);
    }
    return session;
  }

  public resetSession(userId: number): void {
    const session = this.getUserSession(userId);
    session.messages = [];
    session.antigravityConversationId = undefined;
    session.awaitingPromptForProject = undefined;
    session.lastTaskId = undefined;
    session.lastTaskProject = undefined;
    session.lastTaskSummary = undefined;
    session.lastMessageTime = Date.now();

    this.persistSessionMeta(session);

    // Clear from DB
    writeQueue.enqueue(() => {
      try {
        const db = getVeronicaDb();
        db.prepare('DELETE FROM telegram_conversations WHERE user_id = ?').run(userId);
        db.prepare('DELETE FROM telegram_user_sessions WHERE user_id = ?').run(userId);
      } catch {}
    }).catch(() => {});
  }

  public setActiveProject(userId: number, project: string): void {
    const session = this.getUserSession(userId);
    session.activeProject = project;
    session.awaitingPromptForProject = undefined;
    this.persistSessionMeta(session);
  }

  public setAwaitingPrompt(userId: number, project: string): void {
    const session = this.getUserSession(userId);
    session.activeProject = project;
    session.awaitingPromptForProject = project;
    this.persistSessionMeta(session);
  }

  public clearAwaitingPrompt(userId: number): void {
    const session = this.getUserSession(userId);
    session.awaitingPromptForProject = undefined;
    this.persistSessionMeta(session);
  }

  private persistMessage(userId: number, role: 'user' | 'assistant' | 'system', content: string): void {
    const now = Date.now();
    const session = this.getUserSession(userId);
    session.messages.push({ role, content, timestamp: now });

    if (session.messages.length > this.maxHistoryPerSession) {
      session.messages.shift();
    }

    writeQueue.enqueue(() => {
      try {
        const db = getVeronicaDb();
        db.prepare(
          'INSERT INTO telegram_conversations (user_id, role, content, timestamp) VALUES (?, ?, ?, ?)'
        ).run(userId, role, content, now);
      } catch {}
    }).catch(() => {});
  }

  private loadConversationHistory(userId: number, limit: number = 15): DialogMessage[] {
    try {
      const db = getVeronicaDb();
      const rows = db.prepare(
        'SELECT role, content, timestamp FROM telegram_conversations WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?'
      ).all(userId, limit) as any[];

      return rows.reverse().map((r) => ({
        role: r.role as 'user' | 'assistant' | 'system',
        content: r.content,
        timestamp: Number(r.timestamp),
      }));
    } catch {
      return [];
    }
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
Language: Always reply in Russian. Format messages using Telegram HTML tags (<b>, <i>, <code>, <pre>). Do not use Markdown asterisks.

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

    // Construct multi-turn messages array
    const conversationPayload: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Include last turns excluding the one we just added (to avoid duplicating current userText)
    const historySlice = session.messages.slice(0, -1);
    for (const msg of historySlice) {
      conversationPayload.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      });
    }

    conversationPayload.push({ role: 'user', content: userText });

    try {
      const rawResponse = await this.callLlm(config, conversationPayload, systemPrompt, userText, session, imagePath);
      return await this.processLlmOutput(userId, rawResponse);
    } catch (err: any) {
      const errDetail = err?.cause?.message || err?.cause?.code || err?.message || String(err);
      console.warn('[Veronica Orchestrator] All LLM backends exhausted:', errDetail);

      return this.formatLlmErrorResponse(err, userText, session);
    }
  }

  /**
   * Dispatch action tags inside LLM output
   */
  private async processLlmOutput(userId: number, rawText: string): Promise<string> {
    const session = this.getUserSession(userId);
    let cleanText = rawText;

    // Action 1: run_task
    const runTaskRegex = /<action\s+type="run_task"\s+project="([^"]+)"(?:\s+skill="([^"]*)")?\s+prompt="([^"]+)"\s*\/>/gi;
    let match: RegExpExecArray | null;

    while ((match = runTaskRegex.exec(rawText)) !== null) {
      const targetProjectCandidate = match[1];
      const skill = match[2] || 'custom_task';
      const prompt = match[3];

      const resolvedProject = await this.resolveTargetProject(
        targetProjectCandidate,
        prompt,
        session.activeProject
      );

      if (resolvedProject) {
        try {
          const task = await antigravityAdapter.spawnTask({
            project: resolvedProject,
            skill,
            custom_prompt: prompt,
          });

          session.lastTaskId = task.id;
          session.lastTaskProject = resolvedProject;
          session.lastTaskSummary = prompt;
          this.persistSessionMeta(session);

          cleanText = cleanText.replace(match[0], '');
        } catch (err: any) {
          cleanText += `\n\n⚠️ <i>Не удалось запустить задачу для ${resolvedProject}: ${err?.message || err}</i>`;
        }
      } else {
        cleanText += `\n\n⚠️ <i>Проект «${targetProjectCandidate}» не найден в каталоге.</i>`;
      }
    }

    // Action 2: continue_task
    const continueTaskRegex = /<action\s+type="continue_task"(?:\s+task_id="([^"]*)")?\s+prompt="([^"]+)"\s*\/>/gi;
    while ((match = continueTaskRegex.exec(rawText)) !== null) {
      const taskId = match[1] || session.lastTaskId;
      const refinementPrompt = match[2];

      if (taskId) {
        const prevTask = taskRegistry.getTask(taskId);
        const targetProj = prevTask?.project || session.lastTaskProject || session.activeProject;

        if (targetProj) {
          try {
            const task = await antigravityAdapter.spawnTask({
              project: targetProj,
              skill: 'custom_task',
              custom_prompt: refinementPrompt,
            });

            session.lastTaskId = task.id;
            session.lastTaskProject = targetProj;
            session.lastTaskSummary = refinementPrompt;
            this.persistSessionMeta(session);

            cleanText = cleanText.replace(match[0], '');
          } catch (err: any) {
            cleanText += `\n\n⚠️ <i>Не удалось продолжить задачу: ${err?.message || err}</i>`;
          }
        }
      }
    }

    // Action 3: schedule_task (Periodic automated ТЗ placement)
    const scheduleTaskRegex = /<action\s+type="schedule_task"\s+project="([^"]+)"\s+schedule="([^"]+)"\s+prompt="([^"]+)"\s*\/>/gi;
    while ((match = scheduleTaskRegex.exec(rawText)) !== null) {
      const targetProjectCandidate = match[1];
      const schedule = match[2];
      const prompt = match[3];

      const resolvedProject = await this.resolveTargetProject(
        targetProjectCandidate,
        prompt,
        session.activeProject
      );

      if (resolvedProject) {
        try {
          const jobId = `cron_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await veronicaScheduler.addCronJob({
            id: jobId,
            project: resolvedProject,
            skill: 'custom_task',
            schedule,
            enabled: true,
            custom_prompt: prompt,
          });

          cleanText = cleanText.replace(match[0], '');
        } catch (err: any) {
          cleanText += `\n\n⚠️ <i>Не удалось запланировать задачу: ${err?.message || err}</i>`;
        }
      } else {
        cleanText += `\n\n⚠️ <i>Проект «${targetProjectCandidate}» не найден для планирования.</i>`;
      }
    }

    return cleanText.trim();
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
      const rawRes = await this.callLlm(config, messages, systemPrompt, promptPayload);
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
    return this.callLlm(config, messages, '', prompt);
  }

  /**
   * 2 Strict Execution Engines for Veronica:
   * 1. Antigravity Headless CLI (agy -p --model <model> --effort <effort>)
   * 2. Local LLM (llama-server.exe / local GGUF model via 127.0.0.1:11434)
   * With adaptive stream watchdog and graceful retry.
   */
  private async callLlm(
    config: any,
    messages: { role: string; content: string }[],
    systemPrompt: string,
    userText: string,
    sessionState?: UserSessionState,
    imagePath?: string
  ): Promise<string> {
    // HARD GUARD: Never call real LLM inference during automated test executions
    if (process.env.NODE_ENV === 'test' || process.env.TEST_APP_DIR || process.env.NODE_TEST_CONTEXT) {
      return 'Тестовый мок-ответ: инференс заблокирован тестовым контуром.';
    }

    const activeModel = config.veronica?.model || config.model_name || 'gemini-3.7-flash-high';
    const isAgy = MessageBuilder.isAntigravityModel(activeModel);

    let lastError: any = null;

    // Retry loop: up to 2 attempts
    for (let attempt = 1; attempt <= 2; attempt++) {
      // Engine 1: Antigravity Headless CLI
      if (isAgy) {
        try {
          const cliPath = getSafeCliPath(config.veronica?.antigravity_cli_path);
          const args = ['--dangerously-skip-permissions', '--output-format', 'stream-json'];

          const resolved = resolveAntigravityModelAndEffort(activeModel, config.veronica?.effort);
          if (resolved.model) {
            args.push('--model', resolved.model);
          }
          if (resolved.effort) {
            args.push('--effort', resolved.effort);
          }
          const agent = config.veronica?.agent;
          if (agent && agent !== 'default' && agent !== 'none') {
            args.push('--agent', agent);
          }

          if (imagePath && fs.existsSync(imagePath)) {
            args.push('--add-dir', path.dirname(imagePath));
          }

          // If retry or continue, reuse active conversation
          const isContinuing = Boolean(sessionState?.antigravityConversationId);
          if (isContinuing && sessionState?.antigravityConversationId) {
            try {
              const lockPath = path.join(os.homedir(), '.gemini', 'antigravity-cli', 'presence', `${sessionState.antigravityConversationId}.lock`);
              if (fs.existsSync(lockPath)) {
                fs.unlinkSync(lockPath);
              }
            } catch {}
            args.push('--conversation', sessionState.antigravityConversationId);
          }

          const imagePromptDirective = imagePath
            ? `\n\n[ATTACHED IMAGE FILE: ${imagePath}]\n[DIRECTIVE: Use your multimodal vision capabilities and the view_file tool to thoroughly examine the image at "${imagePath}". Inspect all visual details, text, code, diagrams, or objects in the image, and answer the user question based on the image content.]`
            : '';

          const promptPayload = isContinuing
            ? `USER REQUEST: ${userText}${imagePromptDirective}\n\nREPLY IN RUSSIAN USING TELEGRAM HTML:`
            : `${systemPrompt}\n\nUSER REQUEST: ${userText}${imagePromptDirective}\n\nREPLY IN RUSSIAN USING TELEGRAM HTML:`;

          const proxyUrl = proxyService.getProxyUrlFor('cloud_ai');
          const spawnEnv: NodeJS.ProcessEnv = { ...process.env };
          if (proxyUrl) {
            spawnEnv.HTTP_PROXY = proxyUrl;
            spawnEnv.HTTPS_PROXY = proxyUrl;
            spawnEnv.ALL_PROXY = proxyUrl;
            spawnEnv.http_proxy = proxyUrl;
            spawnEnv.https_proxy = proxyUrl;
            spawnEnv.all_proxy = proxyUrl;
          }

          const agyOutput = await new Promise<string>((resolve, reject) => {
            const child = spawn(cliPath, args, {
              shell: false,
              env: spawnEnv,
              stdio: ['pipe', 'pipe', 'pipe'],
            });

            const killChild = () => {
              try {
                if (process.platform === 'win32' && child.pid) {
                  spawn('taskkill', ['/pid', child.pid.toString(), '/T', '/F'], { shell: true });
                } else {
                  child.kill('SIGKILL');
                }
              } catch {}
            };

            let out = '';
            let errOut = '';
            let lineBuffer = '';

            // Stream watchdog: kill if no data received for 45 seconds
            let streamWatchdog: NodeJS.Timeout | null = null;
            const resetWatchdog = () => {
              if (streamWatchdog) clearTimeout(streamWatchdog);
              streamWatchdog = setTimeout(() => {
                killChild();
                reject(new Error('Watchdog: Antigravity stream dropped / stalled for 45s'));
              }, 45000);
            };

            resetWatchdog();

            // Stream prompt over stdin
            child.stdin?.write(promptPayload);
            child.stdin?.end();

            child.stdout?.on('data', (d) => {
              resetWatchdog();
              lineBuffer += d.toString();
              const lines = lineBuffer.split('\n');
              lineBuffer = lines.pop() || '';
              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                try {
                  const ev = JSON.parse(trimmed);
                  if (ev.event === 'init' && ev.conversation_id) {
                    if (sessionState) {
                      sessionState.antigravityConversationId = ev.conversation_id;
                      this.persistSessionMeta(sessionState);
                    }
                  } else if (ev.event === 'step_update' && ev.step_update?.text_delta) {
                    out += ev.step_update.text_delta;
                  } else if (ev.event === 'result') {
                    if (ev.result?.conversation_id && sessionState) {
                      sessionState.antigravityConversationId = ev.result.conversation_id;
                      this.persistSessionMeta(sessionState);
                    }
                    if (ev.result?.usage && sessionState) {
                      sessionState.lastUsage = ev.result.usage;
                    }
                    if (typeof ev.result?.duration_seconds === 'number' && sessionState) {
                      sessionState.lastDurationSeconds = ev.result.duration_seconds;
                    }
                    if (ev.result?.response && !out.trim()) {
                      out = ev.result.response;
                    }
                    if (ev.result?.error) {
                      errOut = (errOut ? errOut + '\n' : '') + ev.result.error;
                    }
                  }
                } catch {
                  if (!trimmed.startsWith('{') && !trimmed.startsWith('warning:') && !trimmed.startsWith('jetski:')) {
                    out += trimmed + '\n';
                  }
                }
              }
            });

            child.stderr?.on('data', (d) => {
              resetWatchdog();
              errOut += d.toString();
            });

            // Hard timeout at 240s total execution limit
            const totalTimer = setTimeout(() => {
              if (streamWatchdog) clearTimeout(streamWatchdog);
              killChild();
              reject(new Error('Antigravity CLI timed out after 240s total execution limit'));
            }, 240000);

            child.on('close', (code) => {
              clearTimeout(totalTimer);
              if (streamWatchdog) clearTimeout(streamWatchdog);

              if (lineBuffer.trim()) {
                try {
                  const ev = JSON.parse(lineBuffer.trim());
                  if (ev.step_update?.text_delta) {
                    out += ev.step_update.text_delta;
                  } else if (ev.result?.response && !out.trim()) {
                    out = ev.result.response;
                  }
                  if (ev.result?.usage && sessionState) {
                    sessionState.lastUsage = ev.result.usage;
                  }
                  if (typeof ev.result?.duration_seconds === 'number' && sessionState) {
                    sessionState.lastDurationSeconds = ev.result.duration_seconds;
                  }
                  if (ev.result?.error) {
                    errOut = (errOut ? errOut + '\n' : '') + ev.result.error;
                  }
                } catch {}
              }
              if (code === 0 && out.trim()) {
                let finalOut = out.trim();
                if (sessionState?.lastUsage && (sessionState.lastUsage.total_tokens || sessionState.lastUsage.input_tokens)) {
                  const u = sessionState.lastUsage;
                  const sec = sessionState.lastDurationSeconds;
                  const details: string[] = [];
                  if (u.input_tokens) details.push(`in: ${Number(u.input_tokens).toLocaleString()}`);
                  if (u.output_tokens) details.push(`out: ${Number(u.output_tokens).toLocaleString()}`);
                  if (u.thinking_tokens) details.push(`think: ${Number(u.thinking_tokens).toLocaleString()}`);
                  if (u.cache_read_tokens) details.push(`cached: ${Number(u.cache_read_tokens).toLocaleString()}`);
                  const secStr = sec ? ` | ${Number(sec).toFixed(1)}с` : '';
                  const badge = `\n\n⚡ <i>${Number(u.total_tokens || 0).toLocaleString()} токенов (${details.join(' | ')})${secStr}</i>`;
                  finalOut += badge;
                }
                resolve(finalOut);
              } else {
                reject(new Error(`agy exited with code ${code}: ${errOut || out || 'no output'}`));
              }
            });

            child.on('error', (err) => {
              clearTimeout(totalTimer);
              if (streamWatchdog) clearTimeout(streamWatchdog);
              reject(err);
            });
          });

          if (agyOutput) return agyOutput;
        } catch (agyErr: any) {
          lastError = agyErr;
          const errMsg = agyErr?.message || String(agyErr);
          console.warn(`[Veronica Orchestrator] [Antigravity CLI Attempt ${attempt} Failed]:`, errMsg);

          // Check if quota error - DO NOT retry immediately and DO NOT reset conversation ID!
          const isQuota = /quota reached|quota exceeded|subscription to increase your limits|rate limit|resets in/i.test(errMsg);
          if (isQuota) {
            console.warn('[Veronica Orchestrator] Quota limit reached, aborting retry loop.');
            break;
          }

          // If conversation failed, timed out, stalled, or is corrupted, reset conversation ID
          // so retry and subsequent messages do NOT hang on a stuck session or lock.
          if (sessionState && sessionState.antigravityConversationId) {
            console.warn('[Veronica Orchestrator] Resetting stale/stalled conversation ID:', sessionState.antigravityConversationId);
            try {
              const lockPath = path.join(os.homedir(), '.gemini', 'antigravity-cli', 'presence', `${sessionState.antigravityConversationId}.lock`);
              if (fs.existsSync(lockPath)) {
                fs.unlinkSync(lockPath);
              }
            } catch {}
            sessionState.antigravityConversationId = undefined;
            this.persistSessionMeta(sessionState);
          }

          if (attempt === 1) {
            // Brief backoff before retry
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }

          // Antigravity failed after 2 attempts. Fall through to Engine 2 (Local LLM)
          console.warn('[Veronica Orchestrator] Antigravity failed. Falling through to Engine 2 (Local LLM)...');
          break;
        }
      }

      // Engine 2: Local llama-server
      const timeoutMs = 8000;
      const localHost = config.local_server?.host || '127.0.0.1';
      const localPort = config.local_server?.port || 11434;

      try {
        const localRes = await fetch(`http://${localHost}:${localPort}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: activeModel.replace(/^local:/, '') || 'local',
            messages,
            temperature: 0.4,
            max_tokens: 2048,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (localRes.ok) {
          const localJson: any = await localRes.json();
          const text = localJson.choices?.[0]?.message?.content;
          if (text) return text;
        }
        throw new Error(`Local LLM HTTP ${localRes.status}`);
      } catch (localErr: any) {
        lastError = localErr;
        const detail = localErr?.cause?.code || localErr?.cause?.message || localErr?.message;
        console.warn(`[Veronica Orchestrator] [Local LLM Offline/Timeout Attempt ${attempt}]:`, detail);
        if (attempt === 1) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        throw localErr;
      }
    }

    throw lastError || new Error('All LLM inference attempts exhausted.');
  }

  /**
   * Technical, informative error response for Telegram when LLM fails
   */
  private formatLlmErrorResponse(err: any, _userText: string, session: UserSessionState): string {
    const rawMsg = err?.cause?.message || err?.cause?.code || err?.message || String(err);
    const isQuota = /quota reached|quota exceeded|subscription to increase your limits|resets in/i.test(rawMsg);
    const isTimeout = /timed out|watchdog|stalled/i.test(rawMsg);
    const isNotFound = /enoent|not found|cannot find/i.test(rawMsg);

    // Extract reset time if available
    const resetMatch = rawMsg.match(/Resets in ([^\.\n\r]+)/i);
    const resetText = resetMatch ? resetMatch[1].trim() : '';

    const sessionInfo = session.antigravityConversationId
      ? `\n\n📌 <i>Активная сессия сохранена (<code>${session.antigravityConversationId.substring(0, 8)}</code>). После устранения причины диалог продолжится в этой же сессии.</i>`
      : '';

    if (isQuota) {
      return (
        `⚠️ <b>Квота Antigravity CLI исчерпана</b>\n\n` +
        `Сэр, запрос к модели отклонён из-за достижения лимита квоты Google/CLI:\n` +
        `<code>${this.escapeHtml(rawMsg.trim())}</code>\n\n` +
        `💡 <b>Что необходимо сделать:</b>\n` +
        (resetText ? `• <b>Автоматический сброс:</b> через <b>${this.escapeHtml(resetText)}</b>\n` : '') +
        `• <b>Сменить аккаунт:</b> выполните в терминале <code>agy auth</code>\n` +
        `• Либо переключите модель/профиль в настройках 0xAgent.` +
        sessionInfo
      );
    }

    if (isTimeout) {
      return (
        `⏱️ <b>Таймаут выполнения команды</b>\n\n` +
        `Сэр, движок <code>agy</code> выполнялся дольше лимита или поток данных был прерван:\n` +
        `<code>${this.escapeHtml(rawMsg.trim())}</code>\n\n` +
        `💡 <i>Сессия сохранена. Попробуйте повторить запрос или разбить его на более компактные шаги.</i>` +
        sessionInfo
      );
    }

    if (isNotFound) {
      return (
        `❌ <b>Исполняемый файл agy не найден</b>\n\n` +
        `Сэр, операционная система не может найти CLI <code>agy</code>:\n` +
        `<code>${this.escapeHtml(rawMsg.trim())}</code>\n\n` +
        `💡 <i>Проверьте путь к agy в настройках Вероники или добавьте путь к agy в системную переменную PATH.</i>`
      );
    }

    const isNet = /fetch failed|network error|econnreset|etimedout|enotfound|socket hang up|connection refused|unable to connect|502|503|504|tls handshake timeout|network is unreachable/i.test(rawMsg);
    if (isNet) {
      return (
        `🌐 <b>Сетевая ошибка связи с инференсом Google AI / CLI</b>\n\n` +
        `Сэр, не удалось установить сетевое соединение с облачным движком:\n` +
        `<code>${this.escapeHtml(rawMsg.trim())}</code>\n\n` +
        `💡 <b>Что проверить:</b>\n` +
        `• Доступность интернета и прокси-шлюза (VPN / Clash)\n` +
        `• Статус подключения к Google AI Studio\n` +
        `• Попробуйте повторить запрос через минуту.` +
        sessionInfo
      );
    }

    return (
      `❌ <b>Сбой инференса Вероники</b>\n\n` +
      `Сэр, не удалось получить ответ от движков инференса:\n` +
      `<code>${this.escapeHtml(rawMsg.trim())}</code>\n\n` +
      `💡 <i>Проверьте сетевой статус/прокси или повторите запрос через несколько минут.</i>` +
      sessionInfo
    );
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

