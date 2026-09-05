import { Bot, InlineKeyboard } from 'grammy';
import { AgentTask } from '../types';
import { loadConfig } from '../../config';
import { veronicaOrchestrator } from './veronicaOrchestrator';
import { extractButtonsToInlineKeyboard } from './handlers/telegramUtils';

function escapeHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class NotificationService {
  private static instance: NotificationService;
  private botInstance: Bot | null = null;
  private notifiedTaskIds = new Set<string>();

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public setBot(bot: Bot): void {
    this.botInstance = bot;
  }

  public isTaskNotified(taskId: string): boolean {
    return this.notifiedTaskIds.has(taskId);
  }

  public markTaskNotified(taskId: string): void {
    if (this.notifiedTaskIds.size >= 1000) {
      const firstKey = this.notifiedTaskIds.values().next().value;
      if (firstKey) this.notifiedTaskIds.delete(firstKey);
    }
    this.notifiedTaskIds.add(taskId);
  }

  public resetTaskNotification(taskId: string): void {
    this.notifiedTaskIds.delete(taskId);
  }

  public async broadcastToWhitelist(message: string, replyMarkup?: InlineKeyboard): Promise<void> {
    if (!this.botInstance) return;
    const config = loadConfig();
    const whitelist = config.veronica?.telegram_whitelist || [];

    for (const chatId of whitelist) {
      try {
        if (message.includes('<tg-button') && typeof (this.botInstance.api.raw as any)?.sendRichMessage === 'function') {
          try {
            await (this.botInstance.api.raw as any).sendRichMessage({
              chat_id: chatId,
              rich_message: { html: message },
            });
            continue;
          } catch {}
        }
        const extracted = extractButtonsToInlineKeyboard(message);
        const effectiveMarkup = replyMarkup || extracted.keyboard;
        await this.botInstance.api.sendMessage(chatId, extracted.cleanedHtml, {
          parse_mode: 'HTML',
          reply_markup: effectiveMarkup,
        });
      } catch (err) {
        console.error(`[Veronica Telegram] Failed to send message to ${chatId}:`, err);
      }
    }
  }

  public async notifyTaskCompleted(task: AgentTask, rawChanges?: string[] | string): Promise<void> {
    if (this.notifiedTaskIds.has(task.id)) {
      return;
    }
    this.markTaskNotified(task.id);

    const changes = Array.isArray(rawChanges) ? rawChanges : rawChanges ? [rawChanges] : [];

    // Automatically synchronize lastTaskId and project into Veronica Orchestrator session
    const config = loadConfig();
    const whitelist = config.veronica?.telegram_whitelist || [];
    for (const chatId of whitelist) {
      try {
        const session = veronicaOrchestrator.getUserSession(Number(chatId));
        session.lastTaskId = task.id;
        session.lastTaskProject = task.project;
        session.lastTaskSummary = task.summary || undefined;
        veronicaOrchestrator.persistSessionMeta(session);
      } catch {}
    }

    const lines: string[] = [
      `✅ <b>Задача завершена:</b> <code>${task.id.substring(0, 8)}</code>`,
      `📁 <b>Проект:</b> <code>${escapeHtml(task.project)}</code>`,
      `⚡ <b>Навык:</b> <i>${escapeHtml(task.skill)}</i>`,
      '',
    ];

    if (task.summary) {
      lines.push(`📝 <b>Что сделано:</b>`);
      lines.push(`${escapeHtml(task.summary)}`);
      lines.push('');
    }

    if (changes.length > 0) {
      lines.push(`🛠 <b>Внесённые изменения:</b>`);
      for (const ch of changes) {
        lines.push(`• ${escapeHtml(ch)}`);
      }
      lines.push('');
    }

    // Display Antigravity token usage telemetry if available
    if (task.result_json) {
      try {
        const parsedResult = JSON.parse(task.result_json);
        const usage = parsedResult.usage;
        const durationSec = parsedResult.duration_seconds;
        if (usage && (usage.total_tokens || usage.input_tokens)) {
          const parts: string[] = [];
          if (usage.total_tokens) parts.push(`⚡ <b>${Number(usage.total_tokens).toLocaleString()} токенов</b>`);
          const details: string[] = [];
          if (usage.input_tokens) details.push(`in: ${Number(usage.input_tokens).toLocaleString()}`);
          if (usage.output_tokens) details.push(`out: ${Number(usage.output_tokens).toLocaleString()}`);
          if (usage.thinking_tokens) details.push(`think: ${Number(usage.thinking_tokens).toLocaleString()}`);
          if (usage.cache_read_tokens) details.push(`cached: ${Number(usage.cache_read_tokens).toLocaleString()}`);
          if (details.length > 0) parts.push(`(${details.join(' | ')})`);
          if (durationSec) parts.push(`⏱ ${Number(durationSec).toFixed(1)}с`);
          lines.push(`📊 <b>Расход:</b> ${parts.join(' ')}`);
          lines.push('');
        }
      } catch {}
    }

    lines.push(
      `<tg-button-row align="center">` +
        `<tg-button type="callback_data" data="veronica:continue:${task.id}">🔄 Продолжить задачу</tg-button>` +
        `<tg-button type="callback_data" data="veronica:projects_menu">📁 Меню проектов</tg-button>` +
      `</tg-button-row>`
    );

    const keyboard = new InlineKeyboard()
      .text('🔄 Продолжить задачу', `veronica:continue:${task.id}`)
      .text('📁 Меню проектов', 'veronica:projects_menu');

    const msg = lines.join('\n').trim();
    await this.broadcastToWhitelist(msg, keyboard);
  }

  public async notifyTaskCrashed(task: AgentTask, reason: string): Promise<void> {
    const msg = [
      `🚨 <b>АВАРИЯ АГЕНТА:</b> <code>${task.id.substring(0, 8)}</code>`,
      `📁 <b>Проект:</b> ${escapeHtml(task.project)}`,
      `⚡ <b>Skill:</b> <i>${escapeHtml(task.skill)}</i>`,
      `💥 <b>Причина:</b> ${escapeHtml(reason)}`,
    ].join('\n');

    await this.broadcastToWhitelist(msg);
  }

  public async notifyTaskTimeout(task: AgentTask, timeoutSec: number): Promise<void> {
    const msg = [
      `⏱️ <b>WATCHDOG TIMEOUT:</b> <code>${task.id.substring(0, 8)}</code>`,
      `📁 <b>Проект:</b> ${escapeHtml(task.project)}`,
      `⚡ <b>Skill:</b> <i>${escapeHtml(task.skill)}</i>`,
      `⚠️ <b>Причина:</b> Нет активности более ${timeoutSec}с. Процесс принудительно остановлен.`,
    ].join('\n');

    await this.broadcastToWhitelist(msg);
  }

  public async notifyApprovalRequired(task: AgentTask, payload: { action: string; details?: string }): Promise<void> {
    if (!this.botInstance) return;

    const keyboard = new InlineKeyboard()
      .text('✅ Одобрить', `veronica:approve:${task.id}`)
      .text('❌ Отклонить', `veronica:reject:${task.id}`);

    const msg = [
      `⚠️ <b>ТРЕБУЕТСЯ ПОДТВЕРЖДЕНИЕ:</b> <code>${task.id.substring(0, 8)}</code>`,
      `📁 <b>Проект:</b> ${escapeHtml(task.project)}`,
      `⚡ <b>Skill:</b> <i>${escapeHtml(task.skill)}</i>`,
      `🎯 <b>Действие:</b> ${escapeHtml(payload.action)}`,
      payload.details ? `📝 <b>Детали:</b> ${escapeHtml(payload.details)}` : '',
      '',
      `<tg-button-row align="center">` +
        `<tg-button type="callback_data" data="veronica:approve:${task.id}">✅ Одобрить</tg-button>` +
        `<tg-button type="callback_data" data="veronica:reject:${task.id}">❌ Отклонить</tg-button>` +
      `</tg-button-row>`,
    ].filter(Boolean).join('\n');

    await this.broadcastToWhitelist(msg, keyboard);
  }
}

export const notificationService = NotificationService.getInstance();
