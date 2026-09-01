import { Bot } from 'grammy';
import { AgentTask } from '../types';
import { loadConfig } from '../../config';

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
        await this.botInstance.api.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } catch (err) {
        console.error(`[Veronica Telegram] Failed to send message to ${chatId}:`, err);
      }
    }
  }

  public async notifyTaskCompleted(task: AgentTask): Promise<void> {
    const msg = [
      `✅ *Задача завершена:* \`${task.id.substring(0, 8)}\``,
      `📁 *Проект:* ${task.project}`,
      `⚡ *Skill:* _${task.skill}_`,
      task.summary ? `📝 *Итог:* ${task.summary}` : '',
    ].filter(Boolean).join('\n');

    await this.broadcastToWhitelist(msg);
  }

  public async notifyTaskCrashed(task: AgentTask, reason: string): Promise<void> {
    const msg = [
      `🚨 *АВАРИЯ АГЕНТА:* \`${task.id.substring(0, 8)}\``,
      `📁 *Проект:* ${task.project}`,
      `⚡ *Skill:* _${task.skill}_`,
      `💥 *Причина:* ${reason}`,
    ].join('\n');

    await this.broadcastToWhitelist(msg);
  }

  public async notifyTaskTimeout(task: AgentTask, timeoutSec: number): Promise<void> {
    const msg = [
      `⏱️ *WATCHDOG TIMEOUT:* \`${task.id.substring(0, 8)}\``,
      `📁 *Проект:* ${task.project}`,
      `⚡ *Skill:* _${task.skill}_`,
      `⚠️ *Причина:* Отсутствие heartbeat более ${timeoutSec}с. Процесс принудительно остановлен.`,
    ].join('\n');

    await this.broadcastToWhitelist(msg);
  }
}

export const notificationService = NotificationService.getInstance();
