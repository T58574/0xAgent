import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { InlineKeyboard, Keyboard } from 'grammy';
import { getVeronicaDb } from '../db/veronicaDb';
import { snapshotCache } from '../core/snapshotCache';
import { taskRegistry } from '../core/taskRegistry';
import { remoteNodeService } from '../../remoteNodeService';
import { projectDiscovery, DiscoveredProject } from '../core/projectDiscovery';
import { projectDocManager } from '../core/projectDocManager';
import { antigravityAdapter } from '../adapters/antigravityAdapter';
import type { UserSessionState } from './veronicaOrchestrator';
import { loadConfig } from '../../config';
import { proxyService } from '../../proxyService';
import { quotaManager } from '../../agent/quotaManager';

function escapeHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class MessageBuilder {
  /**
   * Persistent Main Reply Keyboard (Redesigned 3-row layout)
   */
  public static getMainReplyKeyboard(): Keyboard {
    return new Keyboard()
      .text('📁 Проекты')
      .text('💬 Сессии')
      .row()
      .text('📈 Аналитика')
      .text('⚙️ Настройки')
      .row()
      .text('⌨️ Команды /')
      .text('❓ Помощь')
      .resized();
  }

  public static listAvailableModels(): string[] {
    const candidateDirs = [
      path.join(process.cwd(), 'models'),
      path.join(os.homedir(), '.0xagent', 'models'),
    ];
    const modelNames: string[] = [];
    for (const dir of candidateDirs) {
      if (fs.existsSync(dir)) {
        try {
          const files = fs.readdirSync(dir);
          for (const f of files) {
            if (f.endsWith('.gguf') && !modelNames.includes(f)) {
              modelNames.push(f);
            }
          }
        } catch {}
      }
    }
    return modelNames;
  }

  public static isAntigravityModel(model?: string | null): boolean {
    if (!model) return true;
    const m = model.toLowerCase();
    if (m.endsWith('.gguf') || m.startsWith('local:')) return false;
    return true;
  }

  public static buildModelSelectMessage(currentModel: string): string {
    const isAgy = MessageBuilder.isAntigravityModel(currentModel);
    const cleanModelName = currentModel.replace(/^local:/, '');

    const lines: string[] = [
      `🧠 <b>Выбор активной модели и движка для Вероники:</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🔹 <b>Текущая модель:</b> <code>${escapeHtml(cleanModelName)}</code>`,
      `🔹 <b>Движок:</b> ${isAgy ? '⚡ Antigravity CLI Headless (agy)' : '🖥️ Local llama-server (GGUF)'}`,
      ``,
      `<i>Выберите модель из списка ниже для переключения:</i>`,
    ];
    return lines.join('\n');
  }

  public static buildModelSelectKeyboard(models: string[], currentModel: string): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    const cleanCurrent = currentModel.replace(/^local:/, '');

    // 1. Antigravity Official CLI Models (dynamically fetched from cache/CLI)
    const rawAgyModels = antigravityAdapter.getAvailableRawAntigravityModels();

    for (const am of rawAgyModels) {
      const isSelected = cleanCurrent === am.slug || (am.slug === 'inherit' && (cleanCurrent === 'agy' || cleanCurrent === 'antigravity'));
      const label = `${isSelected ? '🔘' : '⚪'} ⚡ ${am.name}`;
      keyboard.text(label, `veronica:set_model:${am.slug}`).row();
    }

    // 2. Local llama-server GGUF Models (if any available)
    for (const m of models) {
      const isSelected = cleanCurrent === m;
      const label = `${isSelected ? '🔘' : '⚪'} 🖥️ ${m.length > 25 ? m.substring(0, 22) + '...' : m}`;
      keyboard.text(label, `veronica:set_model:${m}`).row();
    }

    return keyboard;
  }

  public static buildStatusMessage(): string {
    const activeTasks = taskRegistry.getActiveTasks();
    const remoteStatus = remoteNodeService.getStatus();

    const lines: string[] = [
      `🤖 <b>Вероника :: Статус Системы</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🔹 <b>Активных задач:</b> ${activeTasks.length}`,
      `🔹 <b>GPU Compute Node:</b> ${
        remoteStatus.online
          ? `🟢 Online (${escapeHtml(remoteStatus.host)}:${remoteStatus.port}) — ${remoteStatus.latencyMs}ms`
          : `🔴 Offline (${escapeHtml(remoteStatus.host)})`
      }`,
    ];

    // Add Antigravity Quota Indicators
    const quota = quotaManager.getQuotaStatus();
    if (quota.limits && quota.limits.length > 0) {
      lines.push(`\n📊 <b>Квоты Antigravity CLI:</b>`);
      for (const lim of quota.limits) {
        const filled = Math.max(0, Math.min(10, Math.round(lim.remainingPercentage / 10)));
        const empty = 10 - filled;
        const bar = `[${'●'.repeat(filled)}${'○'.repeat(empty)}]`;
        lines.push(`• <b>${escapeHtml(lim.modelGroup)}</b> (${escapeHtml(lim.limitType)}): <code>${bar} ${lim.remainingPercentage}%</code>`);
      }
    } else if (quota.exhausted) {
      lines.push(`\n⚠️ <b>Квота:</b> <code>[○○○○○○○○○○] 0% (429 Исчерпана)</code>${quota.resetText ? ` — сброс через ${quota.resetText}` : ''}`);
    }

    if (activeTasks.length > 0) {
      lines.push(`\n📋 <b>Текущие задачи в работе:</b>`);
      for (const t of activeTasks) {
        const pingSec = Math.round((Date.now() - (t.last_heartbeat || t.started_at)) / 1000);
        lines.push(
          `• <code>${t.id.substring(0, 8)}</code> | <b>${escapeHtml(t.project)}</b> | skill: <i>${escapeHtml(
            t.skill
          )}</i> | ping: ${pingSec}с назад`
        );
      }
    } else {
      lines.push(`\n<i>Все фоновые агенты в режиме ожидания.</i>`);
    }

    return lines.join('\n');
  }

  public static async buildProjectsSummary(): Promise<string> {
    const projects = await projectDiscovery.discoverAllProjects();
    if (projects.length === 0) {
      return `📁 <b>Проекты:</b> Не найдено активных проектов в dev-каталогах.`;
    }

    const lines: string[] = [
      `📁 <b>Доступные проекты (${projects.length}):</b>`,
      `<i>Выберите проект ниже для просмотра деталей и постановки задач:</i>`,
    ];

    return lines.join('\n');
  }

  public static buildProjectListKeyboard(projects: DiscoveredProject[], page: number = 0, perPage: number = 6): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    const start = page * perPage;
    const currentSlice = projects.slice(start, start + perPage);

    for (let i = 0; i < currentSlice.length; i += 2) {
      const p1 = currentSlice[i];
      const p2 = currentSlice[i + 1];

      if (p2) {
        keyboard.text(`📦 ${p1.name}`, `veronica:proj:${p1.name}`).text(`📦 ${p2.name}`, `veronica:proj:${p2.name}`).row();
      } else {
        keyboard.text(`📦 ${p1.name}`, `veronica:proj:${p1.name}`).row();
      }
    }

    // Pagination row
    const paginationRow: { text: string; data: string }[] = [];
    if (page > 0) {
      paginationRow.push({ text: '⬅️ Назад', data: `veronica:proj_page:${page - 1}` });
    }
    if (start + perPage < projects.length) {
      paginationRow.push({ text: 'Вперед ➡️', data: `veronica:proj_page:${page + 1}` });
    }

    if (paginationRow.length > 0) {
      for (const btn of paginationRow) {
        keyboard.text(btn.text, btn.data);
      }
      keyboard.row();
    }

    return keyboard;
  }

  public static async buildProjectDetails(projectName: string): Promise<string> {
    const snapshot = snapshotCache.getSnapshot(projectName) || (await snapshotCache.refreshSnapshot(projectName));
    const resolvedPath = (await projectDiscovery.resolveProjectPath(projectName)) || 'unknown';
    const metrics = projectDocManager.getMetrics(projectName);

    const lines: string[] = [
      `📦 <b>Проект:</b> <code>${escapeHtml(projectName)}</code>`,
      `📁 <b>Путь:</b> <code>${escapeHtml(resolvedPath)}</code>`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `⚡ <b>Активных задач:</b> ${snapshot.active_tasks_count}`,
      metrics.version ? `🏷 <b>Версия:</b> ${escapeHtml(metrics.version)}` : '',
      metrics.conversion ? `📈 <b>Конверсия:</b> ${escapeHtml(String(metrics.conversion))}` : '',
    ].filter(Boolean);

    // Recent completions
    let recentTasks: any[] = [];
    try {
      recentTasks = JSON.parse(snapshot.recent_completions || '[]');
    } catch {}

    if (recentTasks.length > 0) {
      lines.push(`\n📋 <b>Последние задачи:</b>`);
      for (const t of recentTasks.slice(0, 3)) {
        const icon = t.status === 'completed' ? '✅' : '❌';
        lines.push(`• ${icon} <i>${escapeHtml(t.skill)}</i>: ${escapeHtml(t.summary || 'выполнено')}`);
      }
    }

    return lines.join('\n');
  }

  public static buildProjectActionsKeyboard(projectName: string): InlineKeyboard {
    return new InlineKeyboard()
      .text('📝 Поставить задачу', `veronica:prompt:${projectName}`)
      .text('📄 Паспорт и Доки', `veronica:doc:${projectName}`)
      .row()
      .text('📊 История задач', `veronica:history:${projectName}`)
      .text('🔙 Все проекты', 'veronica:projects_menu');
  }

  public static buildSkillsKeyboard(projectName: string, skills: { name: string; description?: string }[]): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    for (const s of skills.slice(0, 8)) {
      keyboard.text(`⚡ ${s.name}`, `veronica:run_skill:${projectName}:${s.name}`).row();
    }
    keyboard.text('🔙 Назад к проекту', `veronica:proj:${projectName}`);
    return keyboard;
  }

  public static buildPeriodReport(period: 'today' | 'yesterday' | 'all'): string {
    const db = getVeronicaDb();
    const now = new Date();
    let startOfDay: number;
    let endOfDay: number;

    if (period === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      startOfDay = today.getTime();
      endOfDay = Date.now();
    } else if (period === 'yesterday') {
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      startOfDay = yesterday.getTime();
      endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    } else {
      startOfDay = 0;
      endOfDay = Date.now();
    }

    const journalStmt = db.prepare(`
      SELECT project, task_id, agent, operation_type, status, summary, changes_json, important, timestamp
      FROM operational_journal
      WHERE timestamp >= ? AND timestamp < ?
      ORDER BY timestamp DESC
    `);
    const journalEntries: any[] = journalStmt.all(startOfDay, endOfDay) as any[];

    const taskStmt = db.prepare(`
      SELECT project, skill, status, summary, started_at, finished_at
      FROM agent_tasks
      WHERE started_at >= ? AND started_at < ?
      ORDER BY project, started_at DESC
    `);
    const tasks: any[] = taskStmt.all(startOfDay, endOfDay) as any[];

    const periodLabel = period === 'today' ? 'сегодня' : period === 'yesterday' ? 'вчера' : 'всё время';

    if (journalEntries.length === 0 && tasks.length === 0) {
      return `📊 <b>Отчет за ${periodLabel}:</b> Событий и задач не зафиксировано.`;
    }

    const lines: string[] = [
      `📊 <b>Сводка активности за ${periodLabel}:</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
    ];

    if (journalEntries.length > 0) {
      const grouped: Record<string, any[]> = {};
      for (const entry of journalEntries) {
        if (!grouped[entry.project]) grouped[entry.project] = [];
        grouped[entry.project].push(entry);
      }

      for (const [proj, entries] of Object.entries(grouped)) {
        lines.push(`\n📂 <b>${escapeHtml(proj)}:</b>`);
        for (const e of entries) {
          const icon = e.status === 'completed' || e.status === 'success' ? '✅' : e.status === 'failed' ? '❌' : '⚡';
          const star = e.important ? ' 🌟' : '';
          lines.push(`  ${icon} <b>[${escapeHtml(e.operation_type)}]</b> ${escapeHtml(e.summary)}${star}`);

          if (e.changes_json) {
            try {
              const changes = JSON.parse(e.changes_json);
              if (Array.isArray(changes) && changes.length > 0) {
                for (const ch of changes.slice(0, 3)) {
                  lines.push(`    ▫️ <i>${escapeHtml(ch)}</i>`);
                }
              }
            } catch {}
          }
        }
      }
    } else {
      // Fallback to tasks table
      const grouped: Record<string, any[]> = {};
      for (const t of tasks) {
        if (!grouped[t.project]) grouped[t.project] = [];
        grouped[t.project].push(t);
      }

      for (const [project, pTasks] of Object.entries(grouped)) {
        lines.push(`\n📂 <b>${escapeHtml(project)}:</b>`);
        for (const t of pTasks) {
          const icon = t.status === 'completed' ? '✅' : t.status === 'running' ? '⏳' : '❌';
          const summary = escapeHtml(t.summary || 'без описания');
          lines.push(`  ${icon} <i>${escapeHtml(t.skill)}</i>: ${summary}`);
        }
      }
    }

    return lines.join('\n');
  }

  public static buildPeriodSelectKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('Сегодня', 'veronica:report:today')
      .text('Вчера', 'veronica:report:yesterday')
      .text('Все время', 'veronica:report:all');
  }

  /**
   * Sessions management card
   */
  public static buildSessionsCard(session: UserSessionState): { text: string; keyboard: InlineKeyboard } {
    const activeConvId = session.antigravityConversationId || 'Не инициализирована (создастся при запросе)';
    const cleanConvId = session.antigravityConversationId ? session.antigravityConversationId.substring(0, 8) : '—';
    const activeProject = session.activeProject || '0xAgent';
    const historyCount = session.messages ? session.messages.length : 0;
    const lastTask = session.lastTaskId ? `${session.lastTaskId.substring(0, 8)} (${session.lastTaskProject || ''})` : 'Нет активных';

    const lines: string[] = [
      `💬 <b>Управление Сессиями Вероники</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🔹 <b>Активная сессия:</b> <code>${escapeHtml(activeConvId)}</code>`,
      `🔹 <b>Короткий ID:</b> <code>${escapeHtml(cleanConvId)}</code>`,
      `🔹 <b>Текущий проект:</b> <code>${escapeHtml(activeProject)}</code>`,
      `🔹 <b>Сообщений в памяти:</b> <code>${historyCount}</code>`,
      `🔹 <b>Последняя задача:</b> <code>${escapeHtml(lastTask)}</code>`,
      ``,
      `💡 <i>Контекст сессии надёжно персистится в SQLite и автоматически восстанавливается после любых перезапусков сервера.</i>`,
    ];

    const keyboard = new InlineKeyboard()
      .text('🔄 Сбросить сессию (/reset)', 'veronica:session:reset')
      .text('📋 История сессий CLI', 'veronica:session:recent')
      .row()
      .text('📁 Выбрать проект', 'veronica:projects_menu')
      .text('📈 Аналитика', 'veronica:menu:analytics');

    return { text: lines.join('\n'), keyboard };
  }

  /**
   * Recent CLI sessions card
   */
  public static buildRecentSessionsCard(limit = 5): { text: string; keyboard: InlineKeyboard } {
    const dbPath = path.join(os.homedir(), '.gemini', 'antigravity-cli', 'conversation_summaries.db');
    const sessions: Array<{ id: string; title: string; steps: number }> = [];

    if (fs.existsSync(dbPath)) {
      try {
        const Database = (getVeronicaDb() as any).constructor;
        const agyDb = new Database(dbPath, { readonly: true });
        const rows: any[] = agyDb.prepare(`
          SELECT conversation_id, title, preview, step_count
          FROM conversation_summaries
          WHERE preview != '' OR title != ''
          ORDER BY last_modified_time DESC
          LIMIT ?
        `).all(limit);
        agyDb.close();

        for (const r of rows) {
          sessions.push({
            id: r.conversation_id,
            title: (r.title || r.preview || 'Сессия без названия').trim(),
            steps: r.step_count || 0,
          });
        }
      } catch (err) {
        console.warn('[MessageBuilder] Could not read conversation_summaries.db:', err);
      }
    }

    const lines: string[] = [
      `📋 <b>Недавние сессии Antigravity CLI:</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
    ];

    const keyboard = new InlineKeyboard();

    if (sessions.length === 0) {
      lines.push(`<i>Сохранённых сессий пока не найдено.</i>`);
    } else {
      for (const s of sessions) {
        const shortId = s.id.substring(0, 8);
        const title = s.title.length > 32 ? s.title.substring(0, 30) + '...' : s.title;
        lines.push(`• <code>${shortId}</code> — <b>${escapeHtml(title)}</b> (<i>${s.steps} шагов</i>)`);
        keyboard.text(`📌 ${shortId}: ${title}`, `veronica:session:switch:${s.id}`).row();
      }
      lines.push(``);
      lines.push(`<i>Нажмите на кнопку сессии для мгновенного переключения диалога:</i>`);
    }

    keyboard.text('◀️ Назад к текущей сессии', 'veronica:menu:sessions');

    return { text: lines.join('\n'), keyboard };
  }

  /**
   * Unified Analytics & Gamification Dashboard
   */
  public static buildAnalyticsDashboard(): { text: string; keyboard: InlineKeyboard } {
    const db = getVeronicaDb();
    
    let totalTasks = 0;
    let completedTasks = 0;
    let failedTasks = 0;
    try {
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'failed' OR status = 'crashed' THEN 1 ELSE 0 END) as failed
        FROM agent_tasks
      `).get() as any;
      if (stats) {
        totalTasks = stats.total || 0;
        completedTasks = stats.completed || 0;
        failedTasks = stats.failed || 0;
      }
    } catch {}

    let totalDurationMinutes = 0;
    try {
      const dur = db.prepare(`
        SELECT SUM(COALESCE(finished_at, started_at) - started_at) as dur_ms
        FROM agent_tasks
        WHERE started_at IS NOT NULL
      `).get() as any;
      if (dur && dur.dur_ms) {
        totalDurationMinutes = Math.round(dur.dur_ms / 60000);
      }
    } catch {}

    let cronCount = 0;
    try {
      const cronStats = db.prepare(`SELECT COUNT(*) as cnt FROM cron_jobs WHERE enabled = 1`).get() as any;
      if (cronStats) cronCount = cronStats.cnt || 0;
    } catch {}

    let activeDays = 1;
    try {
      const dayStats = db.prepare(`SELECT COUNT(DISTINCT date(timestamp/1000, 'unixepoch')) as days FROM operational_journal`).get() as any;
      if (dayStats && dayStats.days > 0) activeDays = dayStats.days;
    } catch {}

    // Gamification XP calculation
    const xp = totalTasks * 150 + completedTasks * 100;
    const level = Math.floor(xp / 500) + 1;
    const progressInLevel = Math.min(10, Math.max(0, Math.round(((xp % 500) / 500) * 10)));
    const progressBar = '█'.repeat(progressInLevel) + '░'.repeat(Math.max(0, 10 - progressInLevel));
    const progressPct = Math.round(((xp % 500) / 500) * 100);

    let rankTitle = 'Новобранец ИИ-Операций 🛸';
    if (level >= 3 && level < 6) rankTitle = 'Кибер-Инженер 0xAgent ⚡';
    else if (level >= 6 && level < 10) rankTitle = 'Главный Архитектор Систем 🛠';
    else if (level >= 10) rankTitle = 'Сингулярный Мастер Оркестрации 🌟';

    const successRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;
    const hours = Math.floor(totalDurationMinutes / 60);
    const mins = totalDurationMinutes % 60;
    const timeFormatted = hours > 0 ? `${hours} ч ${mins} мин` : `${mins} мин`;

    const lines: string[] = [
      `📈 <b>Центр Аналитики & Активности Вероники</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🏆 <b>Ваш ранг:</b> <b>${rankTitle}</b> (Уровень ${level})`,
      `⭐ <b>Опыт взаимодействия (XP):</b> <code>${xp} XP</code>`,
      `📊 <b>Прогресс до Ур. ${level + 1}:</b> <code>[${progressBar}] ${progressPct}%</code>`,
      ``,
      `⚡ <b>Метрики продуктивности:</b>`,
      `• Всего поставлено задач: <b>${totalTasks}</b>`,
      `• Успешно выполнено: <b>${completedTasks}</b> (✅ ${successRate}%)`,
      `• Ошибок / падений: <b>${failedTasks}</b>`,
      `• Времени работы агентов: <b>${timeFormatted}</b> ⏱`,
      `• Ударных дней активности: <b>${activeDays}</b> 🔥`,
      `• Автоматизаций на расписании: <b>${cronCount}</b> ⏱`,
      ``,
      `<i>Выберите раздел для детального просмотра:</i>`,
    ];

    const keyboard = new InlineKeyboard()
      .text('📋 Активные задачи', 'veronica:menu:tasks')
      .text('📊 Что сделано', 'veronica:menu:today')
      .row()
      .text('⏱ Автоматизации', 'veronica:menu:cron')
      .text('📁 Меню проектов', 'veronica:projects_menu');

    return { text: lines.join('\n'), keyboard };
  }

  /**
   * Settings & Quota Dashboard
   */
  public static buildSettingsDashboard(): { text: string; keyboard: InlineKeyboard } {
    const config = loadConfig();
    const activeModel = config.veronica?.model || config.model_name || 'gemini-3.7-flash-high';
    const isAgy = MessageBuilder.isAntigravityModel(activeModel);
    const cleanModel = activeModel.replace(/^local:/, '');
    const proxyUrl = proxyService.getProxyUrlFor('cloud_ai');
    const proxyEnabled = Boolean(proxyUrl);

    const lines: string[] = [
      `⚙️ <b>Панель Настроек & Квоты Вероники:</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🧠 <b>Активная модель:</b> <code>${escapeHtml(cleanModel)}</code>`,
      `⚡ <b>Движок инференса:</b> ${isAgy ? '⚡ Antigravity CLI (Headless)' : '🖥️ Local llama-server (GGUF)'}`,
      `👤 <b>Аккаунт CLI:</b> <code>Google AI / Antigravity Pro</code>`,
      `📊 <b>Статус квоты:</b> 🟢 <i>Активна / В норме</i>`,
      `🛡️ <b>Прокси-шлюз:</b> ${proxyEnabled ? '🟢 Включен' : '⚪ Прямое подключение'}`,
      ``,
      `💡 <i>Для переключения или смены аккаунта выполните <code>agy auth</code> в консоли.</i>`,
    ];

    const keyboard = new InlineKeyboard()
      .text('🧠 Сменить модель', 'veronica:menu:model')
      .text('🔄 Проверить квоту', 'veronica:settings:check_quota')
      .row()
      .text('⚙️ Полный статус (/status)', 'veronica:menu:status')
      .text('📁 Каталог проектов', 'veronica:projects_menu');

    return { text: lines.join('\n'), keyboard };
  }

  /**
   * Slash command cheatsheet
   */
  public static buildCommandsHelpMessage(): string {
    return [
      `⌨️ <b>Быстрые команды Вероники (/):</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🔹 <b>Диалог и сессии:</b>`,
      `• /reset или /clear — сбросить контекст диалога и начать новую сессию`,
      `• /new — начать новый чистый диалог`,
      ``,
      `🔹 <b>Инференс и система:</b>`,
      `• /quota — подробный статус квот инференса agy CLI (5h, Weekly)`,
      `• /model — меню выбора активной модели (Gemini, Claude, GGUF)`,
      `• /status — системная телеметрия, статус GPU Node, порты`,
      ``,
      `🔹 <b>Задачи и проекты:</b>`,
      `• /projects — интерактивный каталог проектов`,
      `• /tasks — мониторинг работающих сейчас агентов`,
      `• /kill <code>id</code> — принудительно остановить агента`,
      `• /run <code>skill</code> <code>project</code> — запуск конкретного навыка`,
      ``,
      `🔹 <b>Аналитика и отчеты:</b>`,
      `• /today — сводка выполненных задач за сегодня`,
      `• /yesterday — сводка за вчера`,
      `• /history <code>project</code> — архив изменений проекта`,
      `• /help — эта интерактивная справка`,
      ``,
      `💡 <i>Нажмите на любую синюю команду выше для моментального ввода!</i>`,
    ].join('\n');
  }
}
