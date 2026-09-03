import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { Bot } from 'grammy';
import { loadConfig, saveConfig } from '../../config';
import { MessageBuilder } from './messageBuilder';
import { notificationService } from './notificationService';
import { antigravityAdapter } from '../adapters/antigravityAdapter';
import { taskRegistry } from '../core/taskRegistry';
import { projectDiscovery } from '../core/projectDiscovery';
import { projectDocManager } from '../core/projectDocManager';
import { veronicaScheduler } from '../core/scheduler';
import { veronicaOrchestrator } from './veronicaOrchestrator';
import { voiceThoughtService } from './voiceThoughtService';
import { videoIngestionService } from './videoIngestionService';
import { factCheckingService } from './factCheckingService';

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
          `⛔ <b>Доступ ограничен.</b> Ваш Telegram ID: <code>${userId}</code>\nДобавьте этот ID в белый список Veronica в настройках 0xAgent.`,
          { parse_mode: 'HTML' }
        );
        return;
      }
      await next();
    });

    // Helper to send projects menu
    const sendProjectsMenu = async (ctx: any, edit: boolean = false) => {
      const projects = await projectDiscovery.discoverAllProjects();
      const text = await MessageBuilder.buildProjectsSummary();
      const keyboard = MessageBuilder.buildProjectListKeyboard(projects, 0);

      if (edit && ctx.callbackQuery) {
        try {
          await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
          await ctx.answerCallbackQuery();
          return;
        } catch {}
      }
      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    };

    // /start & /help
    bot.command(['start', 'help'], async (ctx) => {
      const userId = ctx.from?.id;
      const helpText = [
        `👋 <b>Здравствуйте, сэр! Я Вероника — ваш персональный ИИ-ассистент и оркестратор разработки.</b>`,
        userId ? `👤 <i>Telegram ID:</i> <code>${userId}</code>` : '',
        ``,
        `Я синхронизирую ваши проекты, запускаю фоновые задачи через Antigravity (<code>agy</code> CLI), веду документацию и предоставляю отчеты.`,
        ``,
        `💡 <i>Вы можете писать мне сообщения обычным языком, выбирать проекты кнопками или ставить задачи напрямую.</i>`,
      ].filter(Boolean).join('\n');

      await ctx.reply(helpText, {
        parse_mode: 'HTML',
        reply_markup: MessageBuilder.getMainReplyKeyboard(),
      });
    });

    // /status
    bot.command('status', async (ctx) => {
      const msg = MessageBuilder.buildStatusMessage();
      await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: MessageBuilder.getMainReplyKeyboard() });
    });

    async function sendModelMenu(ctx: any) {
      const config = loadConfig();
      const currentModel = config.model_name || 'Qwen3.8-27B-CRACK-IQ3_M.gguf';
      const models = MessageBuilder.listAvailableModels();
      const msg = MessageBuilder.buildModelSelectMessage(currentModel);
      const keyboard = MessageBuilder.buildModelSelectKeyboard(models, currentModel);
      await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: keyboard });
    }

    // /model
    bot.command('model', async (ctx) => {
      await sendModelMenu(ctx);
    });

    // /projects
    bot.command('projects', async (ctx) => {
      await sendProjectsMenu(ctx);
    });

    // /today
    bot.command('today', async (ctx) => {
      const msg = MessageBuilder.buildPeriodReport('today');
      await ctx.reply(msg, {
        parse_mode: 'HTML',
        reply_markup: MessageBuilder.buildPeriodSelectKeyboard(),
      });
    });

    // /yesterday
    bot.command('yesterday', async (ctx) => {
      const msg = MessageBuilder.buildPeriodReport('yesterday');
      await ctx.reply(msg, {
        parse_mode: 'HTML',
        reply_markup: MessageBuilder.buildPeriodSelectKeyboard(),
      });
    });

    // /run <skill> <project>
    bot.command('run', async (ctx) => {
      const text = ctx.message?.text || '';
      const parts = text.split(/\s+/).slice(1);
      if (parts.length < 2) {
        await ctx.reply(
          '⚠️ Использование: <code>/run &lt;skill&gt; &lt;project&gt;</code> (например: <code>/run security_audit 0xAgent</code>)',
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
          )}</b>\nSkill: <code>${escapeHtml(skill)}</code>\nСтатус: <code>${task.status}</code>`,
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

    // /new, /reset, /clear
    bot.command(['new', 'reset', 'clear'], async (ctx) => {
      const userId = ctx.from?.id;
      if (userId) {
        veronicaOrchestrator.resetSession(userId);
      }
      await ctx.reply('🔄 <b>Контекст сессии сброшен.</b> Начнем с чистого листа, сэр. Чем могу помочь?', {
        parse_mode: 'HTML',
        reply_markup: MessageBuilder.getMainReplyKeyboard(),
      });
    });

    // /tasks
    bot.command('tasks', async (ctx) => {
      const activeTasks = taskRegistry.getActiveTasks();
      if (activeTasks.length === 0) {
        await ctx.reply('📋 <b>Активные задачи:</b> Нет запущенных фоновых процессов.', {
          parse_mode: 'HTML',
          reply_markup: MessageBuilder.getMainReplyKeyboard(),
        });
        return;
      }

      const lines = [
        `📋 <b>Активные фоновые задачи (${activeTasks.length}):</b>`,
        `━━━━━━━━━━━━━━━━━━━━━━`,
      ];
      for (const t of activeTasks) {
        const pingSec = Math.round((Date.now() - (t.last_heartbeat || t.started_at)) / 1000);
        lines.push(
          `• <code>${t.id.substring(0, 8)}</code> | <b>${escapeHtml(t.project)}</b> | skill: <code>${escapeHtml(
            t.skill
          )}</code> | ${pingSec}с назад`
        );
      }
      await ctx.reply(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: MessageBuilder.getMainReplyKeyboard(),
      });
    });

    // /history <project>
    bot.command('history', async (ctx) => {
      const text = ctx.message?.text || '';
      const parts = text.split(/\s+/).slice(1);
      const targetProject = parts[0] || veronicaOrchestrator.getUserSession(ctx.from?.id || 0).activeProject;

      if (!targetProject) {
        await ctx.reply('⚠️ Укажите проект: <code>/history &lt;project&gt;</code> или выберите проект кнопкой «📁 Проекты».', {
          parse_mode: 'HTML',
        });
        return;
      }

      const changelog = await projectDocManager.getChangelog(targetProject, 20);
      await ctx.reply(
        `📊 <b>История активности <code>${escapeHtml(targetProject)}</code>:</b>\n\n<pre>${escapeHtml(
          changelog.substring(0, 3500)
        )}</pre>`,
        {
          parse_mode: 'HTML',
          reply_markup: MessageBuilder.buildProjectActionsKeyboard(targetProject),
        }
      );
    });

    // Callback queries navigation
    bot.callbackQuery('veronica:projects_menu', async (ctx) => {
      await sendProjectsMenu(ctx, true);
    });

    bot.callbackQuery(/^veronica:proj_page:(\d+)$/, async (ctx) => {
      const page = parseInt(ctx.match[1], 10) || 0;
      const projects = await projectDiscovery.discoverAllProjects();
      const text = await MessageBuilder.buildProjectsSummary();
      const keyboard = MessageBuilder.buildProjectListKeyboard(projects, page);
      try {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } catch {}
      await ctx.answerCallbackQuery();
    });

    bot.callbackQuery(/^veronica:proj:(.+)$/, async (ctx) => {
      const projectName = ctx.match[1];
      const userId = ctx.from?.id;
      if (userId) {
        veronicaOrchestrator.setActiveProject(userId, projectName);
      }

      const text = await MessageBuilder.buildProjectDetails(projectName);
      const keyboard = MessageBuilder.buildProjectActionsKeyboard(projectName);

      try {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } catch {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
      await ctx.answerCallbackQuery();
    });

    bot.callbackQuery(/^veronica:skills:(.+)$/, async (ctx) => {
      const projectName = ctx.match[1];
      const skills = veronicaScheduler.listSkills();
      const text = `⚡ <b>Выберите навык (Skill) для запуска в проекте ${escapeHtml(projectName)}:</b>`;
      const keyboard = MessageBuilder.buildSkillsKeyboard(projectName, skills);

      try {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } catch {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
      await ctx.answerCallbackQuery();
    });

    bot.callbackQuery(/^veronica:run_skill:([^:]+):(.+)$/, async (ctx) => {
      const projectName = ctx.match[1];
      const skillName = ctx.match[2];

      try {
        const task = await antigravityAdapter.spawnTask({
          project: projectName,
          skill: skillName,
        });

        await ctx.answerCallbackQuery({ text: `Задача ${skillName} запущена!` });
        await ctx.reply(
          `🚀 <b>Задача создана!</b>\n🆔 ID: <code>${task.id.substring(0, 8)}</code>\n📦 Проект: <b>${escapeHtml(
            projectName
          )}</b>\n⚡ Skill: <code>${escapeHtml(skillName)}</code>\n\n<i>Агент Antigravity приступил к выполнению.</i>`,
          { parse_mode: 'HTML' }
        );
      } catch (err: any) {
        await ctx.answerCallbackQuery({ text: 'Ошибка запуска' });
        await ctx.reply(`❌ Ошибка запуска: ${escapeHtml(err?.message || err)}`);
      }
    });

    bot.callbackQuery(/^veronica:prompt:(.+)$/, async (ctx) => {
      const projectName = ctx.match[1];
      const userId = ctx.from?.id;
      if (userId) {
        veronicaOrchestrator.setAwaitingPrompt(userId, projectName);
      }

      await ctx.answerCallbackQuery();
      await ctx.reply(
        `✍️ <b>Постановка задачи для проекта <code>${escapeHtml(projectName)}</code>:</b>\n\n` +
        `Отправьте мне текстовое сообщение с описанием того, что нужно сделать.\n` +
        `<i>Например: «добавь кнопку переключения темы в шапку» или «проведи рефакторинг роутов».</i>`,
        { parse_mode: 'HTML' }
      );
    });

    bot.callbackQuery(/^veronica:doc:(.+)$/, async (ctx) => {
      const projectName = ctx.match[1];
      const passport = await projectDocManager.getPassport(projectName);
      const keyboard = MessageBuilder.buildProjectActionsKeyboard(projectName);

      await ctx.answerCallbackQuery();
      await ctx.reply(
        `📄 <b>Паспорт проекта <code>${escapeHtml(projectName)}</code>:</b>\n\n<pre>${escapeHtml(
          passport.substring(0, 3500)
        )}</pre>`,
        { parse_mode: 'HTML', reply_markup: keyboard }
      );
    });

    bot.callbackQuery(/^veronica:history:(.+)$/, async (ctx) => {
      const projectName = ctx.match[1];
      const changelog = await projectDocManager.getChangelog(projectName, 25);
      const keyboard = MessageBuilder.buildProjectActionsKeyboard(projectName);

      await ctx.answerCallbackQuery();
      await ctx.reply(
        `📊 <b>История активности <code>${escapeHtml(projectName)}</code>:</b>\n\n<pre>${escapeHtml(
          changelog.substring(0, 3500)
        )}</pre>`,
        { parse_mode: 'HTML', reply_markup: keyboard }
      );
    });

    bot.callbackQuery(/^veronica:report:(today|yesterday|all)$/, async (ctx) => {
      const period = ctx.match[1] as 'today' | 'yesterday' | 'all';
      const msg = MessageBuilder.buildPeriodReport(period);
      await ctx.answerCallbackQuery();
      try {
        await ctx.editMessageText(msg, {
          parse_mode: 'HTML',
          reply_markup: MessageBuilder.buildPeriodSelectKeyboard(),
        });
      } catch {
        await ctx.reply(msg, {
          parse_mode: 'HTML',
          reply_markup: MessageBuilder.buildPeriodSelectKeyboard(),
        });
      }
    });

    // Approvals
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

    bot.callbackQuery(/^veronica:set_model:(.+)$/, async (ctx) => {
      const chosen = ctx.match[1];
      const config = loadConfig();
      const isLocalGguf = chosen.endsWith('.gguf') || chosen.startsWith('local:');

      if (isLocalGguf) {
        const cleanName = chosen.replace(/^local:/, '');
        config.model_name = `local:${cleanName}`;
        if (config.local_server) {
          const localPath = path.join(process.cwd(), 'models', cleanName);
          if (fs.existsSync(localPath)) {
            config.local_server.model_path = localPath;
          }
        }
        if (!config.veronica) config.veronica = {};
        config.veronica.model = `local:${cleanName}`;
      } else {
        // Antigravity official model slug (gemini-3.7-flash-high, claude-sonnet-4-6, etc.)
        config.model_name = chosen;
        if (!config.veronica) config.veronica = {};
        config.veronica.model = chosen;
      }

      saveConfig(config);
      await ctx.answerCallbackQuery({ text: `Выбрана модель: ${chosen}` });

      const models = MessageBuilder.listAvailableModels();
      const msg = MessageBuilder.buildModelSelectMessage(config.model_name);
      const keyboard = MessageBuilder.buildModelSelectKeyboard(models, config.model_name);
      try {
        await ctx.editMessageText(
          `✅ <b>Активная модель переключена на:</b> <code>${escapeHtml(chosen)}</code>\n\n${msg}`,
          { parse_mode: 'HTML', reply_markup: keyboard }
        );
      } catch {
        await ctx.reply(
          `✅ <b>Активная модель переключена на:</b> <code>${escapeHtml(chosen)}</code>`,
          { parse_mode: 'HTML' }
        );
      }
    });

    // -------------------------------------------------------------
    // Main Text Message Handler (Conversational & Reply Buttons)
    // -------------------------------------------------------------
    bot.on('message:text', async (ctx) => {
      const text = ctx.message.text.trim();
      const userId = ctx.from.id;

      // Handle Main Keyboard Buttons
      if (text === '📁 Проекты') {
        await sendProjectsMenu(ctx);
        return;
      }
      if (text === '📊 Что сделано') {
        const msg = MessageBuilder.buildPeriodReport('today');
        await ctx.reply(msg, {
          parse_mode: 'HTML',
          reply_markup: MessageBuilder.buildPeriodSelectKeyboard(),
        });
        return;
      }
      if (text === '⚡ Быстрый запуск') {
        await sendProjectsMenu(ctx);
        return;
      }
      if (text === '⏱ Автоматизации') {
        const jobs = veronicaScheduler.listCronJobs();
        const msg =
          jobs.length > 0
            ? `⏱ <b>Запланированные автоматизации (${jobs.length}):</b>\n\n` +
              jobs
                .map(
                  (j) =>
                    `• <b>${escapeHtml(j.project)}</b> | <code>${escapeHtml(j.skill)}</code> | график: <i>${escapeHtml(
                      j.schedule
                    )}</i> [${j.enabled ? '🟢 Активен' : '⏸ Выключен'}]`
                )
                .join('\n')
            : `⏱ <b>Автоматизации:</b> Нет активных расписаний.\n<i>Вы можете настроить запуск через меню проекта или CLI.</i>`;

        await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: MessageBuilder.getMainReplyKeyboard() });
        return;
      }
      if (text === '🧠 Модель') {
        await sendModelMenu(ctx);
        return;
      }
      if (text === '⚙️ Статус') {
        const msg = MessageBuilder.buildStatusMessage();
        await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: MessageBuilder.getMainReplyKeyboard() });
        return;
      }
      if (text === '❓ Помощь') {
        const helpText = [
          `👋 <b>Справка по работе с Вероникой:</b>`,
          ``,
          `1️⃣ <b>Управление проектами:</b> Нажмите «📁 Проекты» для перехода к интерактивному списку.`,
          `2️⃣ <b>Постановка задач:</b> Напишите в чат «Поставь задачу на проект X: ...» или нажмите «📝 Поставить задачу» в карточке проекта.`,
          `3️⃣ <b>Сводки:</b> Спросите «Вероника, что сделано за вчера?» или нажмите «📊 Что сделано».`,
          `4️⃣ <b>CLI для агентов:</b> Любой агент может читать и обновлять проект через <code>0xagent veronica doc</code>.`,
        ].join('\n');
        await ctx.reply(helpText, { parse_mode: 'HTML', reply_markup: MessageBuilder.getMainReplyKeyboard() });
        return;
      }

      // Video / TikTok / Shorts / Reels URL interceptor for instant fact-checking
      const detectedVideo = videoIngestionService.extractVideoUrl(text);
      if (detectedVideo) {
        let statusMsg: any = null;
        try {
          statusMsg = await ctx.reply('🔍 <i>Анализирую видеоматериал... Извлекаю субтитры</i>', { parse_mode: 'HTML' });
          await ctx.replyWithChatAction('typing');

          let transcriptText = '';
          let videoTitle = '';

          // 1. Try fast cloud subtitle extraction first (~0.5s)
          const subs = await videoIngestionService.fetchSubtitles(detectedVideo.url);
          if (subs && subs.text) {
            transcriptText = subs.text;
          } else {
            // 2. Fallback: Download audio and transcribe via local STT
            try {
              if (statusMsg) {
                await ctx.api.editMessageText(
                  ctx.chat.id,
                  statusMsg.message_id,
                  '🎧 <i>Субтитры отсутствуют. Скачиваю аудиодорожку и запускаю распознавание...</i>',
                  { parse_mode: 'HTML' }
                );
              }
            } catch {}

            const ingested = await videoIngestionService.ingestUrl(detectedVideo.url, detectedVideo.sourceType);
            try {
              videoTitle = ingested.metadata.title || '';
              const trResult = await voiceThoughtService.transcribeAudio(ingested.audioPath);
              transcriptText = trResult.text;
            } finally {
              await ingested.cleanup();
            }
          }

          if (!transcriptText || transcriptText.trim().length < 15) {
            try { if (statusMsg) await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id); } catch {}
            await ctx.reply(
              '⚠️ <i>Не удалось получить четкую речь или субтитры из этого видеоматериала. Возможно, в ролике играет только музыка или речь неразборчива.</i>',
              { parse_mode: 'HTML' }
            );
            return;
          }

          // 3. Fact check
          try {
            if (statusMsg) {
              await ctx.api.editMessageText(
                ctx.chat.id,
                statusMsg.message_id,
                '⚖️ <i>Сверяю утверждения из видео с источниками и фактами...</i>',
                { parse_mode: 'HTML' }
              );
            }
          } catch {}

          const report = await factCheckingService.verifyTranscript(transcriptText, {
            title: videoTitle,
            url: detectedVideo.url,
          });

          const formattedCard = factCheckingService.formatTelegramCard(report, detectedVideo.url);

          try { if (statusMsg) await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id); } catch {}
          await ctx.reply(formattedCard, {
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
            reply_markup: MessageBuilder.getMainReplyKeyboard(),
          });
          return;
        } catch (videoErr: any) {
          console.error('[Veronica Telegram] Error processing video URL:', videoErr);
          try { if (statusMsg) await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id); } catch {}
          await ctx.reply(`⚠️ <i>Ошибка обработки видео:</i> ${escapeHtml(videoErr?.message || videoErr)}`, {
            parse_mode: 'HTML',
          });
          return;
        }
      }

      // Delegate all natural language conversation to Veronica Orchestrator
      try {
        await ctx.replyWithChatAction('typing');
        const replyText = await veronicaOrchestrator.handleUserMessage(userId, text);
        await ctx.reply(replyText, {
          parse_mode: 'HTML',
          reply_markup: MessageBuilder.getMainReplyKeyboard(),
        });
      } catch (err: any) {
        console.error('[Veronica Telegram] Error handling user message:', err);
        await ctx.reply(`⚠️ Произошла ошибка при обработке запроса: ${escapeHtml(err?.message || err)}`);
      }
    });

    // -------------------------------------------------------------
    // Voice Message Handler (Voice Brain Dump)
    // -------------------------------------------------------------
    bot.on(['message:voice', 'message:audio'], async (ctx) => {
      const userId = ctx.from.id;
      const voice = ctx.message.voice || ctx.message.audio;
      if (!voice) return;

      const cleanToken = token.trim();
      const statusMsg = await ctx.reply('🎙️ <i>Слушаю и расшифровываю голосовую мысль...</i>', { parse_mode: 'HTML' });

      try {
        await ctx.replyWithChatAction('record_voice');
        const file = await ctx.getFile();
        if (!file.file_path) {
          throw new Error('Не удалось получить файл голосового сообщения из Telegram.');
        }

        // 1. Transcribe audio
        const tempAudioPath = await voiceThoughtService.downloadTelegramAudio(cleanToken, file.file_path);
        let rawText = '';
        try {
          const transcriptionResult = await voiceThoughtService.transcribeAudio(tempAudioPath);
          rawText = (transcriptionResult.text || '').trim();
        } finally {
          if (fs.existsSync(tempAudioPath)) {
            try { await fs.promises.unlink(tempAudioPath); } catch {}
          }
        }

        if (!rawText) {
          try { await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id); } catch {}
          await ctx.reply('⚠️ <i>Запись слишком тихая или не содержит чёткой речи. Попробуйте сказать чуть громче или ближе к микрофону.</i>', { parse_mode: 'HTML' });
          return;
        }

        // 2. Check if user is explicitly dictating a note / thought dump
        const isNoteIntent = /^(?:запиши\s+(?:мысль|заметку|идею)|в\s+инбокс|сохрани\s+(?:мысль|заметку|в\s+инбокс)|зафиксируй\s+(?:мысль|идею)|заметка[:\s]|мысль[:\s])/i.test(rawText);

        if (isNoteIntent) {
          const thought = await voiceThoughtService.structureThought(rawText);
          await voiceThoughtService.appendThoughtToInbox(thought);

          const lines: string[] = [
            `🎙 <i>«${escapeHtml(rawText)}»</i>`,
            ``,
            `💡 <b>Записала в инбокс!</b>`,
            `📌 <b>Суть:</b> ${escapeHtml(thought.summary || thought.title)}`,
          ];

          if (thought.detectedProject) {
            lines.push(`📁 <b>Проект:</b> <code>${escapeHtml(thought.detectedProject)}</code>`);
          }

          if (thought.actionPoints && thought.actionPoints.length > 0) {
            lines.push(``);
            lines.push(`🎯 <b>Что сделать:</b>`);
            for (const pt of thought.actionPoints) {
              lines.push(`• ${escapeHtml(pt)}`);
            }
          }

          if (thought.tags && thought.tags.length > 0) {
            lines.push(``);
            lines.push(`🏷 <i>${thought.tags.map((t) => `#${t.replace(/^#/, '')}`).join(' ')}</i>`);
          }

          lines.push(``);
          lines.push(`💾 <i>Сохранено в <code>brain/inbox.md</code></i>`);

          try { await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id); } catch {}
          await ctx.reply(lines.join('\n'), {
            parse_mode: 'HTML',
            reply_markup: MessageBuilder.getMainReplyKeyboard(),
          });
          return;
        }

        // 3. Conversational message, question, command or status request directly to Veronica
        await ctx.replyWithChatAction('typing');
        const veronicaReply = await veronicaOrchestrator.handleUserMessage(userId, rawText);

        try { await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id); } catch {}

        const finalReply = `🎙 <i>«${escapeHtml(rawText)}»</i>\n\n${veronicaReply}`;
        await ctx.reply(finalReply, {
          parse_mode: 'HTML',
          reply_markup: MessageBuilder.getMainReplyKeyboard(),
        });
      } catch (err: any) {
        console.error('[Veronica Telegram] Error processing voice message:', err);
        try {
          await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
        } catch {}
        await ctx.reply(`⚠️ Ошибка обработки голосовой записи: ${escapeHtml(err?.message || err)}`);
      }
    });

    // -------------------------------------------------------------
    // Direct Video & Video Note (Кружочки) Handler
    // -------------------------------------------------------------
    bot.on(['message:video', 'message:video_note'], async (ctx) => {
      const isVideoNote = Boolean(ctx.message.video_note);
      const video = ctx.message.video || ctx.message.video_note;
      if (!video) return;

      const cleanToken = token.trim();
      const statusMsg = await ctx.reply(
        isVideoNote
          ? '🎥 <i>Получила кружочек. Извлекаю аудио и проверяю факты...</i>'
          : '📹 <i>Получила видеофайл. Извлекаю аудиодорожку...</i>',
        { parse_mode: 'HTML' }
      );

      try {
        await ctx.replyWithChatAction('record_video');
        const file = await ctx.getFile();
        if (!file.file_path) {
          throw new Error('Не удалось получить файл видео из Telegram.');
        }

        const ingested = await videoIngestionService.ingestTelegramVideo(cleanToken, file.file_path, isVideoNote);
        let transcriptText = '';
        try {
          try {
            await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, '🎙️ <i>Распознаю речь из видео...</i>', { parse_mode: 'HTML' });
          } catch {}

          const trResult = await voiceThoughtService.transcribeAudio(ingested.audioPath);
          transcriptText = trResult.text;
        } finally {
          await ingested.cleanup();
        }

        if (!transcriptText || transcriptText.trim().length < 15) {
          try { await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id); } catch {}
          await ctx.reply('⚠️ <i>В видео не обнаружено четкой речи для анализа или проверки фактов.</i>', { parse_mode: 'HTML' });
          return;
        }

        try {
          await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, '⚖️ <i>Сверяю факты и тезисы из видео с источниками...</i>', { parse_mode: 'HTML' });
        } catch {}

        const report = await factCheckingService.verifyTranscript(transcriptText, {
          title: isVideoNote ? 'Кружочек в Telegram' : 'Видеозапись в Telegram',
        });

        const formattedCard = factCheckingService.formatTelegramCard(report);

        try { await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id); } catch {}
        await ctx.reply(formattedCard, {
          parse_mode: 'HTML',
          reply_markup: MessageBuilder.getMainReplyKeyboard(),
        });
      } catch (err: any) {
        console.error('[Veronica Telegram] Error processing video message:', err);
        try { await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id); } catch {}
        await ctx.reply(`⚠️ Ошибка обработки видео: ${escapeHtml(err?.message || err)}`, { parse_mode: 'HTML' });
      }
    });

    // -------------------------------------------------------------
    // Photo & Image Understanding Handler
    // -------------------------------------------------------------
    bot.on('message:photo', async (ctx) => {
      const photos = ctx.message.photo;
      if (!photos || photos.length === 0) return;

      const largestPhoto = photos[photos.length - 1];
      const caption = (ctx.message.caption || '').trim();
      const userId = ctx.from.id;

      let statusMsg: any = null;
      try {
        statusMsg = await ctx.reply('🖼️ <i>Загружаю и анализирую изображение...</i>', { parse_mode: 'HTML' });
        await ctx.replyWithChatAction('typing');

        const file = await ctx.getFile();
        if (!file.file_path) {
          throw new Error('Не удалось получить файл изображения из Telegram.');
        }

        const tempDir = path.join(os.tmpdir(), '0xagent_images');
        if (!fs.existsSync(tempDir)) {
          await fs.promises.mkdir(tempDir, { recursive: true });
        }

        const ext = path.extname(file.file_path) || '.jpg';
        const localImagePath = path.join(tempDir, `photo_${Date.now()}_${largestPhoto.file_unique_id}${ext}`);

        const cleanToken = token.trim();
        const downloadUrl = `https://api.telegram.org/file/bot${cleanToken}/${file.file_path}`;
        const res = await fetch(downloadUrl);
        if (!res.ok) {
          throw new Error(`Ошибка скачивания фото: HTTP ${res.status}`);
        }

        const arrayBuffer = await res.arrayBuffer();
        await fs.promises.writeFile(localImagePath, Buffer.from(arrayBuffer));

        const userPrompt = caption || 'Что изображено на этой картинке? Опиши её детально и выдели ключевые элементы.';
        const replyText = await veronicaOrchestrator.handleUserMessage(userId, userPrompt, localImagePath);

        try { await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id); } catch {}
        await ctx.reply(replyText, {
          parse_mode: 'HTML',
          reply_markup: MessageBuilder.getMainReplyKeyboard(),
        });
      } catch (err: any) {
        console.error('[Veronica Telegram] Error processing photo:', err);
        try {
          if (statusMsg) await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
        } catch {}
        await ctx.reply(`⚠️ Ошибка анализа изображения: ${escapeHtml(err?.message || err)}`, {
          parse_mode: 'HTML',
        });
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
