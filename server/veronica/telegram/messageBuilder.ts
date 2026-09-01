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

function escapeHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class MessageBuilder {
  /**
   * Persistent Main Reply Keyboard (Fixed at bottom of screen)
   */
  public static getMainReplyKeyboard(): Keyboard {
    return new Keyboard()
      .text('📁 Проекты')
      .text('📊 Что сделано')
      .row()
      .text('⚡ Быстрый запуск')
      .text('⏱ Автоматизации')
      .row()
      .text('🧠 Модель')
      .text('⚙️ Статус')
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

  public static buildModelSelectMessage(currentModel: string): string {
    const isAgy = currentModel === 'agy' || currentModel === 'antigravity';
    const isLocal = currentModel.startsWith('local:') || currentModel.endsWith('.gguf');
    const cleanModelName = currentModel.replace(/^local:/, '');

    const lines: string[] = [
      `🧠 <b>Выбор активной модели и движка для Вероники:</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🔹 <b>Текущая модель:</b> <code>${escapeHtml(cleanModelName)}</code>`,
      `🔹 <b>Движок:</b> ${isAgy ? '⚡ Antigravity CLI Headless (agy)' : isLocal ? '🖥️ Local llama-server (GGUF)' : '🖥️ Local LLM Engine'}`,
      ``,
      `<i>Выберите модель или движок из списка ниже для переключения:</i>`,
    ];
    return lines.join('\n');
  }

  public static buildModelSelectKeyboard(models: string[], currentModel: string): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    const cleanCurrent = currentModel.replace(/^local:/, '');

    // Local Models
    for (const m of models) {
      const isSelected = cleanCurrent === m;
      const label = `${isSelected ? '🔘' : '⚪'} 🖥️ ${m.length > 25 ? m.substring(0, 22) + '...' : m}`;
      keyboard.text(label, `veronica:set_model:${m}`).row();
    }

    // Antigravity Cloud Slugs
    const agyModels = [
      { slug: 'gemini-3.7-flash-high', label: '⚡ Gemini 3.7 Flash (High)' },
      { slug: 'gemini-3.6-flash-high', label: '⚡ Gemini 3.6 Flash (High)' },
      { slug: 'gemini-3.5-flash-medium', label: '⚡ Gemini 3.5 Flash' },
      { slug: 'claude-sonnet-4-6', label: '⚡ Claude Sonnet 4.6' },
      { slug: 'agy', label: '⚡ Antigravity (Default/Auto)' },
    ];

    for (const am of agyModels) {
      const isSelected = cleanCurrent === am.slug || (am.slug === 'agy' && (cleanCurrent === 'agy' || cleanCurrent === 'antigravity'));
      const label = `${isSelected ? '🔘' : '⚪'} ${am.label}`;
      keyboard.text(label, `veronica:set_model:${am.slug}`).row();
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
      .text('⚡ Запустить Skill', `veronica:skills:${projectName}`)
      .text('📝 Поставить задачу', `veronica:prompt:${projectName}`)
      .row()
      .text('📄 Паспорт и Доки', `veronica:doc:${projectName}`)
      .text('📊 История задач', `veronica:history:${projectName}`)
      .row()
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
      endOfDay = startOfDay + 24 * 60 * 60 * 1000;
    } else {
      startOfDay = 0;
      endOfDay = Date.now();
    }

    const stmt = db.prepare(`
      SELECT project, skill, status, summary, started_at, finished_at
      FROM agent_tasks
      WHERE started_at >= ? AND started_at < ?
      ORDER BY project, started_at DESC
    `);
    const tasks: any[] = stmt.all(startOfDay, endOfDay) as any[];

    const periodLabel = period === 'today' ? 'сегодня' : period === 'yesterday' ? 'вчера' : 'все время';

    if (tasks.length === 0) {
      return `📊 <b>Отчет за ${periodLabel}:</b> Задач не выполнялось.`;
    }

    const lines: string[] = [
      `📊 <b>Отчет по задачам за ${periodLabel} (${tasks.length}):</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
    ];

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

    return lines.join('\n');
  }

  public static buildPeriodSelectKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('Сегодня', 'veronica:report:today')
      .text('Вчера', 'veronica:report:yesterday')
      .text('Все время', 'veronica:report:all');
  }
}
