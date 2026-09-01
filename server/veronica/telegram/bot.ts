import { Bot } from 'grammy';
import { loadConfig } from '../../config';
import { MessageBuilder } from './messageBuilder';
import { notificationService } from './notificationService';
import { antigravityAdapter } from '../adapters/antigravityAdapter';

let botInstance: Bot | null = null;

export function initTelegramBot(): Bot | null {
  const config = loadConfig();
  const token = config.veronica?.telegram_token || process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.log('[Veronica Telegram] [INFO] Telegram token not configured. Telegram bot disabled.');
    return null;
  }

  if (botInstance) return botInstance;

  const bot = new Bot(token);
  const whitelist = (config.veronica?.telegram_whitelist || []).map((id) => Number(id));

  // Whitelist verification middleware
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId || (whitelist.length > 0 && !whitelist.includes(userId))) {
      await ctx.reply(`⛔ Доступ запрещен. Ваш Telegram ID: \`${userId}\`. Добавьте его в белый список Veronica.`, {
        parse_mode: 'Markdown',
      });
      return;
    }
    await next();
  });

  // /start & /help
  bot.command(['start', 'help'], async (ctx) => {
    const helpText = [
      `👋 *Здравствуйте! Я Вероника — ваш персональный ассистент.*`,
      ``,
      `📌 *Доступные команды:*`,
      `• /status — текущий статус системы, активные задачи и GPU узел`,
      `• /projects — список проектов и сводка`,
      `• /today — что сделано за сегодня`,
      `• /yesterday — что сделано за вчера`,
      `• /run <skill> <project> — запустить задачу агенту`,
      `• /kill <task_id> — остановить зависшую задачу`,
    ].join('\n');
    await ctx.reply(helpText, { parse_mode: 'Markdown' });
  });

  // /status
  bot.command('status', async (ctx) => {
    const msg = MessageBuilder.buildStatusMessage();
    await ctx.reply(msg, { parse_mode: 'Markdown' });
  });

  // /projects
  bot.command('projects', async (ctx) => {
    const msg = MessageBuilder.buildProjectsSummary();
    await ctx.reply(msg, { parse_mode: 'Markdown' });
  });

  // /today
  bot.command('today', async (ctx) => {
    const msg = MessageBuilder.buildPeriodReport('today');
    await ctx.reply(msg, { parse_mode: 'Markdown' });
  });

  // /yesterday
  bot.command('yesterday', async (ctx) => {
    const msg = MessageBuilder.buildPeriodReport('yesterday');
    await ctx.reply(msg, { parse_mode: 'Markdown' });
  });

  // /run <skill> <project>
  bot.command('run', async (ctx) => {
    const text = ctx.message?.text || '';
    const parts = text.split(/\s+/).slice(1);
    if (parts.length < 2) {
      await ctx.reply('⚠️ Использование: `/run <skill> <project>` (например: `/run security_audit WebApp`)', {
        parse_mode: 'Markdown',
      });
      return;
    }

    const skill = parts[0];
    const project = parts[1];

    try {
      const task = await antigravityAdapter.spawnTask({ project, skill });
      await ctx.reply(
        `🚀 *Задача создана!* \nID: \`${task.id.substring(0, 8)}\`\nПроект: *${project}*\nСтатус: \`${task.status}\``,
        { parse_mode: 'Markdown' }
      );
    } catch (err: any) {
      await ctx.reply(`❌ Ошибка запуска задачи: ${err?.message || err}`);
    }
  });

  // /kill <task_id>
  bot.command('kill', async (ctx) => {
    const text = ctx.message?.text || '';
    const parts = text.split(/\s+/).slice(1);
    if (parts.length < 1) {
      await ctx.reply('⚠️ Использование: `/kill <task_id>`');
      return;
    }

    const taskId = parts[0];
    const killed = await antigravityAdapter.killTask(taskId);
    if (killed) {
      await ctx.reply(`🛑 Задача \`${taskId}\` остановлена.`);
    } else {
      await ctx.reply(`❌ Не удалось остановить задачу \`${taskId}\`.`);
    }
  });

  notificationService.setBot(bot);

  // Start polling in background
  bot.start({
    onStart: (info) => {
      console.log(`[Veronica Telegram] [OK] Bot started as @${info.username}`);
    },
  }).catch((err) => {
    console.error('[Veronica Telegram] Polling error:', err);
  });

  botInstance = bot;
  return bot;
}

export function stopTelegramBot(): void {
  if (botInstance) {
    botInstance.stop().catch(() => {});
    botInstance = null;
  }
}
