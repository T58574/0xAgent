import { Bot, InlineKeyboard } from 'grammy';
import { AgentTask } from '../types';
import { loadConfig } from '../../config';
import { veronicaOrchestrator } from './veronicaOrchestrator';

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

  public async broadcastToWhitelist(message: string, replyMarkup?: InlineKeyboard): Promise<void> {
    if (!this.botInstance) return;
    const config = loadConfig();
    const whitelist = config.veronica?.telegram_whitelist || [];

    for (const chatId of whitelist) {
      try {
        await this.botInstance.api.sendMessage(chatId, message, {
          parse_mode: 'HTML',
          reply_markup: replyMarkup,
        });
      } catch (err) {
        console.error(`[Veronica Telegram] Failed to send message to ${chatId}:`, err);
      }
    }
  }

  public async notifyTaskCompleted(task: AgentTask, rawChanges?: string[] | string): Promise<void> {
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
    const config = loadConfig();
    const whitelist = config.veronica?.telegram_whitelist || [];

    const keyboard = new InlineKeyboard()
      .text('✅ Одобрить', `veronica:approve:${task.id}`)
      .text('❌ Отклонить', `veronica:reject:${task.id}`);

    const msg = [
      `⚠️ <b>ТРЕБУЕТСЯ ПОДТВЕРЖДЕНИЕ:</b> <code>${task.id.substring(0, 8)}</code>`,
      `📁 <b>Проект:</b> ${escapeHtml(task.project)}`,
      `⚡ <b>Skill:</b> <i>${escapeHtml(task.skill)}</i>`,
      `🎯 <b>Действие:</b> ${escapeHtml(payload.action)}`,
      payload.details ? `📝 <b>Детали:</b> ${escapeHtml(payload.details)}` : '',
    ].filter(Boolean).join('\n');

    for (const chatId of whitelist) {
      try {
        await this.botInstance.api.sendMessage(chatId, msg, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
      } catch (err) {
        console.error(`[Veronica Telegram] Failed to send approval request to ${chatId}:`, err);
      }
    }
  }
}

export const notificationService = NotificationService.getInstance();
