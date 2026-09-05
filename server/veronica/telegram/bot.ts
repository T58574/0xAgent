import { Bot } from 'grammy';
import { loadConfig } from '../../config';
import { notificationService } from './notificationService';
import { registerBotCommands } from './handlers/commandHandlers';
import { registerCallbackQueries } from './handlers/callbackHandlers';
import { registerMessageHandlers } from './handlers/messageHandlers';

export { escapeHtml, safeReply } from './handlers/telegramUtils';

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
          `⛔ <b>Доступ ограничен.</b> Ваш Telegram ID: <code>${userId}</code>\nДобавьте этот ID в белый список Veronica в настройках 0xAgent.`,
          { parse_mode: 'HTML' }
        );
        return;
      }
      await next();
    });

    // Register decomposed modular handlers
    registerBotCommands(bot);
    registerCallbackQueries(bot);
    registerMessageHandlers(bot, cleanToken);

    notificationService.setBot(bot);

    // Start polling in background with pending updates dropped to prevent message replays on restarts (skip in test mode)
    const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT) || Boolean(process.env.TEST_APP_DIR);
    if (!isTestEnv) {
      bot.start({
        drop_pending_updates: true,
        onStart: (info) => {
          console.log(`[Veronica Telegram] [OK] Bot started as @${info.username}`);
        },
      }).catch((err) => {
        console.error('[Veronica Telegram] Polling failed to start:', err);
      });
    }

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
