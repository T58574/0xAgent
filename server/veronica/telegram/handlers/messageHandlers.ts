import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { Bot } from 'grammy';
import { MessageBuilder } from '../messageBuilder';
import { veronicaScheduler } from '../../core/scheduler';
import { veronicaOrchestrator } from '../veronicaOrchestrator';
import { voiceThoughtService } from '../voiceThoughtService';
import { videoIngestionService } from '../videoIngestionService';
import { factCheckingService } from '../factCheckingService';
import { escapeHtml, safeReply, handleResponseAttachments, deliverWithStatusTransition } from './telegramUtils';
import { projectDiscovery } from '../../core/projectDiscovery';
import { sendProjectsMenu, sendModelMenu, sendQuotaStatus } from './menuHandlers';

export function registerMessageHandlers(bot: Bot, token: string): void {
  const cleanToken = token.trim();

  // -------------------------------------------------------------
  // Main Text Message Handler (Conversational & Reply Buttons)
  // -------------------------------------------------------------
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text.trim();
    const userId = ctx.from.id;

    // Handle Main Keyboard Buttons
    if (text === '📁 Проекты' || text === '⚡ Быстрый запуск') {
      await sendProjectsMenu(ctx);
      return;
    }
    if (text === '💬 Сессии') {
      const session = veronicaOrchestrator.getUserSession(userId);
      const card = MessageBuilder.buildSessionsCard(session);
      await ctx.reply(card.text, {
        parse_mode: 'HTML',
        reply_markup: card.keyboard,
      });
      return;
    }
    if (text === '📈 Аналитика') {
      const dash = MessageBuilder.buildAnalyticsDashboard();
      await ctx.reply(dash.text, {
        parse_mode: 'HTML',
        reply_markup: dash.keyboard,
      });
      return;
    }
    if (text === '⚙️ Настройки') {
      const dash = MessageBuilder.buildSettingsDashboard();
      await ctx.reply(dash.text, {
        parse_mode: 'HTML',
        reply_markup: dash.keyboard,
      });
      return;
    }
    if (text === '⌨️ Команды /') {
      const cmdMsg = MessageBuilder.buildCommandsHelpMessage();
      await ctx.reply(cmdMsg, {
        parse_mode: 'HTML',
        reply_markup: MessageBuilder.getMainReplyKeyboard(),
      });
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
    if (text === '📊 Квота' || text === 'Квота' || text === '🔄 Квота') {
      await sendQuotaStatus(ctx);
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
        `1️⃣ <b>Управление проектами:</b> Нажмите «📁 Проекты» для перехода к каталогу.`,
        `2️⃣ <b>Сессии диалога:</b> Нажмите «💬 Сессии» для проверки текущей сессии или переключения на прошлые.`,
        `3️⃣ <b>Аналитика и геймификация:</b> Нажмите «📈 Аналитика» для просмотра своего ранга, XP, времени и задач.`,
        `4️⃣ <b>Настройки:</b> Нажмите «⚙️ Настройки» для выбора модели и проверки квоты.`,
        `5️⃣ <b>Быстрые команды:</b> Нажмите «⌨️ Команды /» для просмотра всех слэш-команд.`,
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

    // Dynamic status indicator stages for Agent Thinking & Execution UX/UI
    const statusStages = [
      '🧠 <i>Вероника думает над задачей...</i>',
      '🔍 <i>Анализирую контекст проекта и инструменты...</i>',
      '⚡ <i>Прорабатываю решение и код...</i>',
      '✍️ <i>Шлифую финальный ответ...</i>',
    ];
    let stageIdx = 0;
    let statusMsg: any = null;

    try {
      statusMsg = await ctx.reply(statusStages[0], { parse_mode: 'HTML' });
    } catch {}

    const typingTimer = setInterval(async () => {
      try {
        await ctx.replyWithChatAction('typing');
        if (statusMsg) {
          stageIdx = (stageIdx + 1) % statusStages.length;
          await ctx.api.editMessageText(
            ctx.chat.id,
            statusMsg.message_id,
            statusStages[stageIdx],
            { parse_mode: 'HTML' }
          );
        }
      } catch {}
    }, 4500);

    try {
      await ctx.replyWithChatAction('typing').catch(() => {});
      const replyText = await veronicaOrchestrator.handleUserMessage(userId, text);
      clearInterval(typingTimer);

      const session = veronicaOrchestrator.getUserSession(userId);
      const activeDir = session?.activeProject ? (await projectDiscovery.resolveProjectPath(session.activeProject)) || undefined : undefined;
      const processedReply = await handleResponseAttachments(ctx, replyText, activeDir);

      await deliverWithStatusTransition(ctx, statusMsg, processedReply, {
        parse_mode: 'HTML',
        reply_markup: MessageBuilder.getMainReplyKeyboard(),
      });
    } catch (err: any) {
      clearInterval(typingTimer);
      try {
        if (statusMsg) await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
      } catch {}
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

    const statusMsg = await ctx.reply('🎙️ <i>Слушаю и расшифровываю голосовую мысль...</i>', { parse_mode: 'HTML' });

    let statusUpdated = false;
    const startTime = Date.now();
    const typingTimer = setInterval(async () => {
      try {
        await ctx.replyWithChatAction('record_voice');
        if (!statusUpdated && Date.now() - startTime > 12000) {
          statusUpdated = true;
          await ctx.api.editMessageText(
            ctx.chat.id,
            statusMsg.message_id,
            '🎙️ <i>Длинная аудиозапись: идёт глубокая обработка нейросетью...</i>',
            { parse_mode: 'HTML' }
          ).catch(() => {});
        }
      } catch {}
    }, 4000);

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

      const isLongVoice = rawText.length > 350;
      const displayQuote = isLongVoice ? `${rawText.slice(0, 300)}...` : rawText;

      if (isNoteIntent) {
        const thought = await voiceThoughtService.structureThought(rawText);
        await voiceThoughtService.appendThoughtToInbox(thought);

        const lines: string[] = [
          `🎙 <i>«${escapeHtml(displayQuote)}»</i>`,
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
        await safeReply(ctx, lines.join('\n'), {
          parse_mode: 'HTML',
          reply_markup: MessageBuilder.getMainReplyKeyboard(),
        });

        if (isLongVoice) {
          const transcriptCard = `📝 <b>Полный текст голосовой заметки (${rawText.length} симв.):</b>\n\n${escapeHtml(rawText)}`;
          await safeReply(ctx, transcriptCard, { parse_mode: 'HTML' });
        }
        return;
      }

      // 3. Conversational message, question, command or status request directly to Veronica
      await ctx.replyWithChatAction('typing');
      const veronicaReply = await veronicaOrchestrator.handleUserMessage(userId, rawText);

      const session = veronicaOrchestrator.getUserSession(userId);
      const activeDir = session?.activeProject ? (await projectDiscovery.resolveProjectPath(session.activeProject)) || undefined : undefined;
      const processedReply = await handleResponseAttachments(ctx, veronicaReply, activeDir);

      const finalReply = `🎙 <i>«${escapeHtml(displayQuote)}»</i>\n\n${processedReply}`;
      await deliverWithStatusTransition(ctx, statusMsg, finalReply, {
        parse_mode: 'HTML',
        reply_markup: MessageBuilder.getMainReplyKeyboard(),
      });

      if (isLongVoice) {
        const transcriptCard = `📝 <b>Полная расшифровка записи (${rawText.length} симв.):</b>\n\n${escapeHtml(rawText)}`;
        await safeReply(ctx, transcriptCard, { parse_mode: 'HTML' });
      }
    } catch (err: any) {
      console.error('[Veronica Telegram] Error processing voice message:', err);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
      } catch {}
      await ctx.reply(`⚠️ Ошибка обработки голосовой записи: ${escapeHtml(err?.message || err)}`);
    } finally {
      clearInterval(typingTimer);
    }
  });

  // -------------------------------------------------------------
  // Direct Video & Video Note (Кружочки) Handler
  // -------------------------------------------------------------
  bot.on(['message:video', 'message:video_note'], async (ctx) => {
    const isVideoNote = Boolean(ctx.message.video_note);
    const video = ctx.message.video || ctx.message.video_note;
    if (!video) return;

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
      await safeReply(ctx, formattedCard, {
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

      const downloadUrl = `https://api.telegram.org/file/bot${cleanToken}/${file.file_path}`;
      const res = await fetch(downloadUrl);
      if (!res.ok) {
        throw new Error(`Ошибка скачивания фото: HTTP ${res.status}`);
      }

      const arrayBuffer = await res.arrayBuffer();
      await fs.promises.writeFile(localImagePath, Buffer.from(arrayBuffer));

      const userPrompt = caption || 'Что изображено на этой картинке? Опиши её детально и выдели ключевые элементы.';
      const replyText = await veronicaOrchestrator.handleUserMessage(userId, userPrompt, localImagePath);

      const session = veronicaOrchestrator.getUserSession(userId);
      const activeDir = session?.activeProject ? (await projectDiscovery.resolveProjectPath(session.activeProject)) || undefined : undefined;
      const processedReply = await handleResponseAttachments(ctx, replyText, activeDir);

      await deliverWithStatusTransition(ctx, statusMsg, processedReply, {
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
}
