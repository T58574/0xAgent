import { Bot, InlineKeyboard } from 'grammy';
import { AgentTask } from '../types';
import { loadConfig } from '../../config';

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

  public async broadcastToWhitelist(message: string): Promise<void> {
    if (!this.botInstance) return;
    const config = loadConfig();
    const whitelist = config.veronica?.telegram_whitelist || [];

    for (const chatId of whitelist) {
      try {
        await this.botInstance.api.sendMessage(chatId, message, { parse_mode: 'HTML' });
      } catch (err) {
        console.error(`[Veronica Telegram] Failed to send message to ${chatId}:`, err);
      }
    }
  }

  public async notifyTaskCompleted(task: AgentTask): Promise<void> {
    const msg = [
      `✅ <b>Задача завершена:</b> <code>${task.id.substring(0, 8)}</code>`,
      `📁 <b>Проект:</b> ${escapeHtml(task.project)}`,
      `⚡ <b>Skill:</b> <i>${escapeHtml(task.skill)}</i>`,
      task.summary ? `📝 <b>Итог:</b> ${escapeHtml(task.summary)}` : '',
    ].filter(Boolean).join('\n');

    await this.broadcastToWhitelist(msg);
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
