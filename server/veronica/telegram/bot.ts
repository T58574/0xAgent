import { Bot } from 'grammy';
import { loadConfig } from '../../config';
import { MessageBuilder } from './messageBuilder';
import { notificationService } from './notificationService';
import { antigravityAdapter } from '../adapters/antigravityAdapter';
import { taskRegistry } from '../core/taskRegistry';

function escapeHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let botInstance: Bot | null = null;

export function initTelegramBot(): Bot | null {
  const config = loadConfig();
  const token = config.veronica?.telegram_token || process.env.TELEGRAM_BOT_TOKEN;

  if (!token || !token.trim()) {
    console.log('[Veronica Telegram] [INFO] Telegram token not configured. Telegram bot disabled.');
    return null;
  }

  if (botInstance) return botInstance;

  try {
    const cleanToken = token.trim();
    const bot = new Bot(cleanToken);
    const whitelist = (config.veronica?.telegram_whitelist || [])
      .map((id) => Number(id))
      .filter((id) => !isNaN(id) && id > 0);

    // Global error handler
    bot.catch((err) => {
      console.error('[Veronica Telegram] Bot error caught:', err);
    });

    // Whitelist verification middleware
    bot.use(async (ctx, next) => {
      const userId = ctx.from?.id;
      if (whitelist.length > 0 && userId && !whitelist.includes(userId)) {
        await ctx.reply(
          `⛔ <b>Доступ ограничен.</b> Ваш Telegram ID: <code>${userId}</code>\nДобавьте этот ID в белый список Veronica в интерфейсе 0xAgent.`,
          { parse_mode: 'HTML' }
        );
        return;
      }
      await next();
    });

    // /start & /help
    bot.command(['start', 'help'], async (ctx) => {
      const userId = ctx.from?.id;
      const helpText = [
        `👋 <b>Здравствуйте! Я Вероника — ваш персональный ассистент.</b>`,
        userId ? `👤 Ваш Telegram ID: <code>${userId}</code>` : '',
        ``,
        `📌 <b>Доступные команды:</b>`,
        `• /status — текущий статус системы, активные задачи и GPU узел`,
        `• /projects — список проектов и сводка`,
        `• /today — что сделано за сегодня`,
        `• /yesterday — что сделано за вчера`,
        `• /run <i>&lt;skill&gt;</i> <i>&lt;project&gt;</i> — запустить задачу агенту`,
        `• /kill <i>&lt;task_id&gt;</i> — остановить зависшую задачу`,
      ].filter(Boolean).join('\n');
      await ctx.reply(helpText, { parse_mode: 'HTML' });
    });

    // /status
    bot.command('status', async (ctx) => {
      const msg = MessageBuilder.buildStatusMessage();
      await ctx.reply(msg, { parse_mode: 'HTML' });
    });

    // /projects
    bot.command('projects', async (ctx) => {
      const msg = MessageBuilder.buildProjectsSummary();
      await ctx.reply(msg, { parse_mode: 'HTML' });
    });

    // /today
    bot.command('today', async (ctx) => {
      const msg = MessageBuilder.buildPeriodReport('today');
      await ctx.reply(msg, { parse_mode: 'HTML' });
    });

    // /yesterday
    bot.command('yesterday', async (ctx) => {
      const msg = MessageBuilder.buildPeriodReport('yesterday');
      await ctx.reply(msg, { parse_mode: 'HTML' });
    });

    // /run <skill> <project>
    bot.command('run', async (ctx) => {
      const text = ctx.message?.text || '';
      const parts = text.split(/\s+/).slice(1);
      if (parts.length < 2) {
        await ctx.reply(
          '⚠️ Использование: <code>/run &lt;skill&gt; &lt;project&gt;</code> (например: <code>/run security_audit WebApp</code>)',
          { parse_mode: 'HTML' }
        );
        return;
      }

      const skill = parts[0];
      const project = parts[1];

      try {
        const task = await antigravityAdapter.spawnTask({ project, skill });
        await ctx.reply(
          `🚀 <b>Задача создана!</b>\nID: <code>${task.id.substring(0, 8)}</code>\nПроект: <b>${escapeHtml(
            project
          )}</b>\nСтатус: <code>${task.status}</code>`,
          { parse_mode: 'HTML' }
        );
      } catch (err: any) {
        await ctx.reply(`❌ Ошибка запуска задачи: ${escapeHtml(err?.message || err)}`);
      }
    });

    // /kill <task_id>
    bot.command('kill', async (ctx) => {
      const text = ctx.message?.text || '';
      const parts = text.split(/\s+/).slice(1);
      if (parts.length < 1) {
        await ctx.reply('⚠️ Использование: <code>/kill &lt;task_id&gt;</code>', { parse_mode: 'HTML' });
        return;
      }

      const taskId = parts[0];
      const killed = await antigravityAdapter.killTask(taskId);
      if (killed) {
        await ctx.reply(`🛑 Задача <code>${escapeHtml(taskId)}</code> остановлена.`, { parse_mode: 'HTML' });
      } else {
        await ctx.reply(`❌ Не удалось остановить задачу <code>${escapeHtml(taskId)}</code>.`, {
          parse_mode: 'HTML',
        });
      }
    });

    // Callback query handlers for awaiting_approval inline buttons
    bot.callbackQuery(/^veronica:approve:(.+)$/, async (ctx) => {
      const match = ctx.match;
      const taskId = match ? match[1] : '';
      const user = ctx.from?.first_name || 'Telegram User';
      if (taskId) {
        await taskRegistry.resolveApproval(taskId, true, user);
        await ctx.answerCallbackQuery({ text: 'Действие одобрено!' });
        await ctx.editMessageText(
          `✅ <b>Действие одобрено</b> пользователем ${escapeHtml(user)}.\nЗадача <code>${taskId.substring(
            0,
            8
          )}</code> продолжена.`,
          { parse_mode: 'HTML' }
        );
      }
    });

    bot.callbackQuery(/^veronica:reject:(.+)$/, async (ctx) => {
      const match = ctx.match;
      const taskId = match ? match[1] : '';
      const user = ctx.from?.first_name || 'Telegram User';
      if (taskId) {
        await taskRegistry.resolveApproval(taskId, false, user);
        await ctx.answerCallbackQuery({ text: 'Действие отклонено!' });
        await ctx.editMessageText(
          `❌ <b>Действие отклонено</b> пользователем ${escapeHtml(user)}.\nЗадача <code>${taskId.substring(
            0,
            8
          )}</code> отменена.`,
          { parse_mode: 'HTML' }
        );
      }
    });

    notificationService.setBot(bot);

    // Start polling in background
    bot.start({
      onStart: (info) => {
        console.log(`[Veronica Telegram] [OK] Bot started as @${info.username}`);
      },
    }).catch((err) => {
      console.error('[Veronica Telegram] Polling failed to start:', err);
    });

    botInstance = bot;
    return bot;
  } catch (err) {
    console.error('[Veronica Telegram] Initialization error:', err);
    return null;
  }
}

export function stopTelegramBot(): void {
  if (botInstance) {
    try {
      botInstance.stop().catch(() => {});
    } catch {}
    botInstance = null;
  }
}

export function restartTelegramBot(): Bot | null {
  stopTelegramBot();
  return initTelegramBot();
}
