import { spawn } from 'node:child_process';
import { loadConfig } from '../../config';
import { taskRegistry } from '../core/taskRegistry';
import { projectDiscovery } from '../core/projectDiscovery';
import { projectDocManager } from '../core/projectDocManager';
import { antigravityAdapter, resolveAntigravityModelAndEffort, getSafeCliPath } from '../adapters/antigravityAdapter';
import { getVeronicaDb } from '../db/veronicaDb';
import { writeQueue } from '../db/writeQueue';
import { MessageBuilder } from './messageBuilder';

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

  public getUserSession(userId: number): UserSessionState {
    let session = this.userSessions.get(userId);
    if (!session) {
      // Load recent history from SQLite
      const recentMessages = this.loadConversationHistory(userId, this.maxHistoryPerSession);
      session = {
        userId,
        lastMessageTime: Date.now(),
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

    // Clear from DB
    writeQueue.enqueue(() => {
      try {
        const db = getVeronicaDb();
        db.prepare('DELETE FROM telegram_conversations WHERE user_id = ?').run(userId);
      } catch {}
    }).catch(() => {});
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
  public async handleUserMessage(userId: number, userText: string): Promise<string> {
    const session = this.getUserSession(userId);
    session.lastMessageTime = Date.now();

    const cleanText = userText.trim();
    if (!cleanText) return 'Сэр, вы отправили пустое сообщение.';

    // Record user message into session history
    this.persistMessage(userId, 'user', cleanText);

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
          `🫡 <b>Принято, сэр. Поставила задачу.</b>\n\n` +
          `📁 <b>Проект:</b> <code>${targetProj}</code>\n` +
          `🆔 <b>Task ID:</b> <code>${task.id.substring(0, 8)}</code>\n` +
          `📝 <b>Задание:</b> <i>${this.escapeHtml(cleanText)}</i>\n\n` +
          `<i>Агент Antigravity запущен с паспортом проекта и регламентом CLI. По завершению я пришлю вам подробный отчет.</i>`;

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
      const reply = '🔄 <b>Контекст диалога сброшен.</b> Начнем с чистого листа, сэр. Чем могу помочь?';
      this.persistMessage(userId, 'assistant', reply);
      return reply;
    }

    // Greetings
    if (/^(привет|здравствуй|здравствуйте|добрый день|доброе утро|добрый вечер|ку|хай|салют|hello|hi)[!.]*$/i.test(lower)) {
      const projects = await projectDiscovery.discoverAllProjects();
      const activeTasks = taskRegistry.getActiveTasks();
      const reply =
        `👋 <b>Здравствуйте, сэр!</b>\n\n` +
        `Все системы на связи. В каталоге доступно проектов: <b>${projects.length}</b>, активных задач в работе: <b>${activeTasks.length}</b>.\n\n` +
        `💡 <i>Нажмите «📁 Проекты» для перехода к проектам или напишите мне, какую задачу поставить.</i>`;
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
            `🫡 <b>Принято, сэр. Поставила задачу.</b>\n\n` +
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
    const response = await this.generateLlmResponse(userId, cleanText);
    this.persistMessage(userId, 'assistant', response);
    return response;
  }

  /**
   * Invoke LLM with multi-turn conversation memory and dynamic orchestrator prompt
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

    const lastTaskContext = session.lastTaskId
      ? `\nLAST_SPAWNED_TASK: id=${session.lastTaskId.substring(0, 8)} project=${session.lastTaskProject || 'unknown'} summary="${session.lastTaskSummary || 'none'}"`
      : '';

    const systemPrompt = `You are Veronica (Вероника), an elite AI orchestrator, executive assistant, and engineering supervisor for a software architect.
Tone: Polite, technically sharp, executive, calm British butler elegance ("Сэр, доброе утро...", "Принято, сэр.", "Все процессы в штатном режиме.").
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
2. Task Placement & Action Tags:
   - When the user wants to implement something, add a feature, refactor, or fix an issue in a project:
     Identify the target project from their request or context.
     Emit an action tag:
     <action type="run_task" project="<ProjectName>" skill="<SkillOrCustom>" prompt="<EnrichedDetailedTaskPrompt>" />
   - If the user is asking to refine or continue the previous task:
     <action type="continue_task" task_id="${session.lastTaskId || ''}" prompt="<RefinementInstructions>" />
   - Accompany action tags with a polite executive response ("Принято, сэр. Запустила задачу для проекта X...").
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
      const rawResponse = await this.callLlm(config, conversationPayload, systemPrompt, userText, session);
      return await this.processLlmOutput(userId, rawResponse);
    } catch (err: any) {
      const errDetail = err?.cause?.message || err?.cause?.code || err?.message || String(err);
      console.warn('[Veronica Orchestrator] All LLM backends exhausted:', errDetail);

      // Graceful conversational fallback
      return (
        `Сэр, приняла ваше сообщение: <i>«${this.escapeHtml(userText)}»</i>.\n\n` +
        `💡 Вы можете выбрать проект кнопкой <b>«📁 Проекты»</b> ниже для прямого запуска задач или просмотра документации.`
      );
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

            cleanText = cleanText.replace(match[0], '');
          } catch (err: any) {
            cleanText += `\n\n⚠️ <i>Не удалось продолжить задачу: ${err?.message || err}</i>`;
          }
        }
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
   * 2 Strict Execution Engines for Veronica:
   * 1. Antigravity Headless CLI (agy -p --model <model> --effort <effort>)
   * 2. Local LLM (llama-server.exe / local GGUF model via 127.0.0.1:11434)
   */
  private async callLlm(
    config: any,
    messages: { role: string; content: string }[],
    systemPrompt: string,
    userText: string,
    sessionState?: UserSessionState
  ): Promise<string> {
    const activeModel = config.veronica?.model || config.model_name || 'gemini-3.7-flash-high';
    const isAgy = MessageBuilder.isAntigravityModel(activeModel);

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

        const isContinuing = Boolean(sessionState?.antigravityConversationId);
        if (isContinuing && sessionState?.antigravityConversationId) {
          args.push('--conversation', sessionState.antigravityConversationId);
        }

        const promptPayload = isContinuing
          ? `USER REQUEST: ${userText}\n\nREPLY IN RUSSIAN USING TELEGRAM HTML:`
          : `${systemPrompt}\n\nUSER REQUEST: ${userText}\n\nREPLY IN RUSSIAN USING TELEGRAM HTML:`;

        const agyOutput = await new Promise<string>((resolve, reject) => {
          const child = spawn(cliPath, args, {
            shell: false,
            stdio: ['pipe', 'pipe', 'pipe'],
          });

          let out = '';
          let errOut = '';
          let lineBuffer = '';

          // Stream prompt over stdin to avoid cmd.exe quoting and newline issues
          child.stdin?.write(promptPayload);
          child.stdin?.end();

          child.stdout?.on('data', (d) => {
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
                  }
                } else if (ev.event === 'step_update' && ev.step_update?.text_delta) {
                  out += ev.step_update.text_delta;
                } else if (ev.event === 'result') {
                  if (ev.result?.conversation_id && sessionState) {
                    sessionState.antigravityConversationId = ev.result.conversation_id;
                  }
                  if (ev.result?.response && !out.trim()) {
                    out = ev.result.response;
                  }
                }
              } catch {
                if (!trimmed.startsWith('{') && !trimmed.startsWith('warning:') && !trimmed.startsWith('jetski:')) {
                  out += trimmed + '\n';
                }
              }
            }
          });
          child.stderr?.on('data', (d) => (errOut += d.toString()));

          const timer = setTimeout(() => {
            try {
              child.kill();
            } catch {}
            reject(new Error('Antigravity CLI timed out after 45s'));
          }, 45000);

          child.on('close', (code) => {
            clearTimeout(timer);
            if (lineBuffer.trim()) {
              try {
                const ev = JSON.parse(lineBuffer.trim());
                if (ev.step_update?.text_delta) {
                  out += ev.step_update.text_delta;
                } else if (ev.result?.response && !out.trim()) {
                  out = ev.result.response;
                }
              } catch {}
            }
            if (code === 0 && out.trim()) {
              resolve(out.trim());
            } else {
              reject(new Error(`agy exited with code ${code}: ${errOut || out || 'no output'}`));
            }
          });

          child.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
          });
        });

        if (agyOutput) return agyOutput;
      } catch (agyErr: any) {
        console.warn(`[Veronica Orchestrator] [Antigravity CLI Failed]:`, agyErr?.message || agyErr);
        throw agyErr;
      }
    }

    // Engine 2: Local llama-server
    const timeoutMs = 6000;
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
      const detail = localErr?.cause?.code || localErr?.cause?.message || localErr?.message;
      console.warn(`[Veronica Orchestrator] [Local LLM Offline]:`, detail);
      throw localErr;
    }
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

