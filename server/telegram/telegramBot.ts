import { Bot } from 'grammy';
import { loadConfig } from '../config';
import { escapeHtml, markdownToTelegramHtml, splitHtmlIntoBalancedChunks } from './telegramUtils';

let botInstance: Bot | null = null;
let botUsername: string | null = null;

// Multi-turn conversation context per user (user ID -> messages)
const userConversations: Map<number, { role: 'system' | 'user' | 'assistant'; content: string }[]> = new Map();

function getSystemPrompt(): string {
  const config = loadConfig();
  return (
    `You are 0xAgent Telegram Assistant, a helpful and highly capable local AI companion running 100% locally on the user's private machine via llama.cpp.\n` +
    `Respond in the user's language (default: Russian). Provide clear, concise, and helpful answers.\n` +
    `Active workspace: ${config.workspace_dir || process.cwd()}`
  );
}

export function getUserHistory(userId: number): { role: 'system' | 'user' | 'assistant'; content: string }[] {
  let history = userConversations.get(userId);
  if (!history) {
    history = [{ role: 'system', content: getSystemPrompt() }];
    userConversations.set(userId, history);
  }
  return history;
}

export function clearUserHistory(userId: number): void {
  userConversations.set(userId, [{ role: 'system', content: getSystemPrompt() }]);
}

async function callLocalLlm(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const config = loadConfig();
  const host = config.local_server?.host || '127.0.0.1';
  const port = config.local_server?.port || 11434;
  const activeModel = config.model_name || 'local';
  const timeoutMs = Math.max((config.api_timeout_sec || 120) * 1000, 120000);

  const res = await fetch(`http://${host}:${port}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: activeModel.replace(/^local:/, '') || 'local',
      messages,
      temperature: 0.7,
      max_tokens: config.max_tokens || 4096,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`Local LLM responded with HTTP ${res.status}: ${res.statusText}`);
  }

  const json: any = await res.json();
  const choice = json.choices?.[0]?.message;
  const content = choice?.content?.trim() || choice?.reasoning_content?.trim() || '';
  if (!content) {
    throw new Error('Пустой ответ от локальной языковой модели');
  }
  return content;
}

export function initTelegramBot(): Bot | null {
  const config = loadConfig();
  const token =
    config.telegram?.token ||
    config.veronica?.telegram_token ||
    process.env.TELEGRAM_BOT_TOKEN;

  if (!token || !token.trim()) {
    console.log('[Telegram Bot] [INFO] Telegram token not configured. Telegram bot disabled.');
    return null;
  }

  if (botInstance) return botInstance;

  try {
    const cleanToken = token.trim();
    const bot = new Bot(cleanToken);
    const whitelist = (config.telegram?.whitelist || config.veronica?.telegram_whitelist || [])
      .map((id) => Number(id))
      .filter((id) => !isNaN(id) && id > 0);

    // Global error handler
    bot.catch((err) => {
      console.error('[Telegram Bot] Error caught:', err);
    });

    // Whitelist verification middleware
    bot.use(async (ctx, next) => {
      const userId = ctx.from?.id;
      if (whitelist.length > 0 && userId && !whitelist.includes(userId)) {
        await ctx.reply(
          `⛔ <b>Доступ ограничен.</b> Ваш Telegram ID: <code>${userId}</code>\n` +
          `Добавьте этот ID в белый список Telegram в настройках 0xAgent.`,
          { parse_mode: 'HTML' }
        );
        return;
      }
      await next();
    });

    // /start & /help
    bot.command(['start', 'help'], async (ctx) => {
      const userId = ctx.from?.id;
      const cfg = loadConfig();
      const model = cfg.model_name || 'llama.cpp local model';

      const text = [
        `👋 <b>Здравствуйте! Я ваш локальный ИИ-ассистент 0xAgent.</b>`,
        userId ? `👤 <i>Telegram ID:</i> <code>${userId}</code>` : '',
        `🧠 <i>Активная модель:</i> <code>${escapeHtml(model)}</code>`,
        ``,
        `Я работаю <b>100% локально</b> на вашем компьютере без облаков и утечек данных.`,
        ``,
        `💬 <b>Как общаться:</b>`,
        `• Отправьте мне текстовый вопрос или задачу.`,
        `• Используйте /model для просмотра активной модели.`,
        `• Используйте /reset для очистки контекста диалога.`,
        `• Используйте /status для проверки состояния сервера.`,
      ].filter(Boolean).join('\n');

      await ctx.reply(text, { parse_mode: 'HTML' });
    });

    // /status
    bot.command('status', async (ctx) => {
      const cfg = loadConfig();
      const host = cfg.local_server?.host || '127.0.0.1';
      const port = cfg.local_server?.port || 11434;
      const model = cfg.model_name || 'default';

      let isOnline = false;
      try {
        const ping = await fetch(`http://${host}:${port}/health`, { signal: AbortSignal.timeout(3000) });
        isOnline = ping.ok;
      } catch {
        isOnline = false;
      }

      const statusText = [
        `⚙️ <b>Статус 0xAgent:</b>`,
        `• <b>Сервер llama.cpp:</b> ${isOnline ? '🟢 Онлайн' : '🔴 Офлайн'} (<code>${host}:${port}</code>)`,
        `• <b>Модель:</b> <code>${escapeHtml(model)}</code>`,
        `• <b>Рабочая папка:</b> <code>${escapeHtml(cfg.workspace_dir || process.cwd())}</code>`,
      ].join('\n');

      await ctx.reply(statusText, { parse_mode: 'HTML' });
    });

    // /model
    bot.command('model', async (ctx) => {
      const cfg = loadConfig();
      const model = cfg.model_name || 'Не выбрана';
      await ctx.reply(`🧠 <b>Текущая активная модель:</b> <code>${escapeHtml(model)}</code>`, { parse_mode: 'HTML' });
    });

    // /reset & /clear
    bot.command(['reset', 'clear'], async (ctx) => {
      const userId = ctx.from?.id;
      if (userId) {
        clearUserHistory(userId);
        await ctx.reply('🧹 <i>Контекст диалога очищен. Начинаем с чистого листа!</i>', { parse_mode: 'HTML' });
      }
    });

    // Text messages
    bot.on('message:text', async (ctx) => {
      const userId = ctx.from.id;
      const userText = ctx.message.text.trim();
      if (!userText) return;

      const history = getUserHistory(userId);
      history.push({ role: 'user', content: userText });

      // Keep last 20 messages to prevent infinite token accumulation
      if (history.length > 21) {
        history.splice(1, history.length - 21);
      }

      // Typing indicator
      const typingTimer = setInterval(() => {
        ctx.replyWithChatAction('typing').catch(() => {});
      }, 4000);
      await ctx.replyWithChatAction('typing').catch(() => {});

      try {
        const replyText = await callLocalLlm(history);
        clearInterval(typingTimer);

        history.push({ role: 'assistant', content: replyText });

        const htmlReply = markdownToTelegramHtml(replyText);
        const chunks = splitHtmlIntoBalancedChunks(htmlReply);

        for (const chunk of chunks) {
          await ctx.reply(chunk, { parse_mode: 'HTML' }).catch(async () => {
            // Fallback plain text if Telegram rejects malformed tags
            await ctx.reply(replyText);
          });
        }
      } catch (err: any) {
        clearInterval(typingTimer);
        console.error('[Telegram Bot] LLM error:', err);
        const errMsg = err?.message || String(err);
        await ctx.reply(
          `⚠️ <b>Ошибка связи с локальной моделью:</b>\n<code>${escapeHtml(errMsg)}</code>\n\n` +
          `<i>Убедитесь, что сервер llama-server запущен в 0xAgent.</i>`,
          { parse_mode: 'HTML' }
        );
      }
    });

    // Voice & Audio messages fallback
    bot.on(['message:voice', 'message:audio'], async (ctx) => {
      await ctx.reply('🎙️ <i>Голосовые сообщения не поддерживаются. Пожалуйста, отправьте текстовый запрос.</i>', { parse_mode: 'HTML' });
    });

    // Start background polling
    const isTestEnv =
      process.env.NODE_ENV === 'test' ||
      Boolean(process.env.NODE_TEST_CONTEXT) ||
      Boolean(process.env.TEST_APP_DIR);

    if (!isTestEnv) {
      bot.start({
        drop_pending_updates: true,
        onStart: (info) => {
          botUsername = info.username;
          console.log(`[Telegram Bot] [OK] Bot started as @${info.username}`);
        },
      }).catch((err) => {
        console.error('[Telegram Bot] Polling start error:', err);
      });
    }

    botInstance = bot;
    return bot;
  } catch (err) {
    console.error('[Telegram Bot] Initialization error:', err);
    return null;
  }
}

export function stopTelegramBot(): void {
  if (botInstance) {
    try {
      botInstance.stop().catch(() => {});
    } catch {}
    botInstance = null;
    botUsername = null;
  }
}

export function restartTelegramBot(): Bot | null {
  stopTelegramBot();
  return initTelegramBot();
}

export function isTelegramBotRunning(): boolean {
  return botInstance !== null;
}

export function getTelegramBotUsername(): string | null {
  return botUsername;
}
