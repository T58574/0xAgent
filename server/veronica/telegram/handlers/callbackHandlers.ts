import path from 'node:path';
import fs from 'node:fs';
import { Bot, InlineKeyboard, InputFile } from 'grammy';
import { loadConfig, saveConfig } from '../../../config';
import { MessageBuilder } from '../messageBuilder';
import { antigravityAdapter } from '../../adapters/antigravityAdapter';
import { taskRegistry } from '../../core/taskRegistry';
import { projectDiscovery } from '../../core/projectDiscovery';
import { projectDocManager } from '../../core/projectDocManager';
import { veronicaScheduler } from '../../core/scheduler';
import { veronicaOrchestrator } from '../veronicaOrchestrator';
import { sendProjectsMenu, sendModelMenu } from './menuHandlers';
import { escapeHtml } from './telegramUtils';
import { getSpillFilePath } from '../../../agent/outputSpiller';

export function registerCallbackQueries(bot: Bot): void {
  // Navigation & Menus
  bot.callbackQuery('veronica:projects_menu', async (ctx) => {
    await sendProjectsMenu(ctx, true);
  });

  bot.callbackQuery(/^veronica:continue:(.+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    const task = taskRegistry.getTask(taskId);
    const userId = ctx.from?.id;
    if (userId && task) {
      veronicaOrchestrator.setActiveProject(userId, task.project);
      const session = veronicaOrchestrator.getUserSession(userId);
      session.lastTaskId = task.id;
      session.lastTaskProject = task.project;
      session.lastTaskSummary = task.summary || undefined;
      veronicaOrchestrator.persistSessionMeta(session);
      veronicaOrchestrator.setAwaitingPrompt(userId, task.project);
    }
    await ctx.answerCallbackQuery();
    await ctx.reply(
      `✍️ <b>Продолжение задачи <code>${escapeHtml(taskId.substring(0, 8))}</code> (проект <code>${escapeHtml(
        task?.project || ''
      )}</code>):</b>\n\n` +
        `Отправьте мне сообщение с описанием того, что нужно доработать, расширить или проверить дальше.\n` +
        `<i>Агент подхватит контекст предыдущей работы без повторного сканирования.</i>`,
      { parse_mode: 'HTML' }
    );
  });

  bot.callbackQuery(/^veronica:resume:(.+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    const task = taskRegistry.getTask(taskId);
    await ctx.answerCallbackQuery({ text: 'Возобновляю задачу...' });

    if (!task) {
      await ctx.reply(`⚠️ Задача не найдена в реестре.`, { parse_mode: 'HTML' });
      return;
    }

    try {
      const resumedTask = await taskRegistry.resumeTask(task.id, task.custom_prompt || undefined);
      if (!resumedTask) {
        await ctx.reply(`⚠️ Не удалось возобновить задачу <code>${taskId.substring(0, 8)}</code>.`, { parse_mode: 'HTML' });
        return;
      }

      const userId = ctx.from?.id;
      if (userId) {
        const session = veronicaOrchestrator.getUserSession(userId);
        session.lastTaskId = resumedTask.id;
        session.lastTaskProject = task.project;
        session.lastTaskSummary = task.summary || undefined;
        veronicaOrchestrator.persistSessionMeta(session);
      }

      await ctx.reply(
        `🔄 <b>Задача <code>${task.id.substring(0, 8)}</code> возобновлена!</b>\n\n` +
          `📁 <b>Проект:</b> <code>${escapeHtml(task.project)}</code>\n` +
          `<i>Агент продолжает выполнение с сохраненным чекпоинтом без потери контекста.</i>`,
        { parse_mode: 'HTML' }
      );
    } catch (err: any) {
      await ctx.reply(`❌ Ошибка возобновления задачи: ${escapeHtml(err?.message || err)}`, { parse_mode: 'HTML' });
    }
  });

  // Delivery of oversized spilled logs directly into Telegram chat
  bot.callbackQuery(/^veronica:spill:(.+)$/, async (ctx) => {
    const rawFileName = ctx.match[1];
    await ctx.answerCallbackQuery({ text: 'Загрузка лога...' });
    const filePath = await getSpillFilePath(rawFileName);
    if (!filePath || !fs.existsSync(filePath)) {
      await ctx.reply('⚠️ <b>Лог-файл не найден</b> или был удален системой ротации.', { parse_mode: 'HTML' });
      return;
    }

    try {
      const fileName = path.basename(filePath);
      await ctx.replyWithDocument(new InputFile(filePath, fileName), {
        caption: `📄 <b>Полный лог вывода</b> (>10 КБ)\n<code>${escapeHtml(fileName)}</code>`,
        parse_mode: 'HTML',
      });
    } catch (err: any) {
      await ctx.reply(`❌ Не удалось отправить документ: ${escapeHtml(err?.message || err)}`, { parse_mode: 'HTML' });
    }
  });

  // Sessions callbacks
  bot.callbackQuery('veronica:menu:sessions', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    const session = veronicaOrchestrator.getUserSession(userId);
    const card = MessageBuilder.buildSessionsCard(session);
    try {
      await ctx.editMessageText(card.text, { parse_mode: 'HTML', reply_markup: card.keyboard });
    } catch {
      await ctx.reply(card.text, { parse_mode: 'HTML', reply_markup: card.keyboard });
    }
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('veronica:session:reset', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId) {
      veronicaOrchestrator.resetSession(userId);
    }
    await ctx.answerCallbackQuery({ text: 'Сессия сброшена!' });
    await ctx.reply(
      `🔄 <b>Контекст сессии очищен.</b>\n` +
        `Вероника готова к новому диалогу. История и активные привязки сохранены в базе данных.`,
      { parse_mode: 'HTML', reply_markup: MessageBuilder.getMainReplyKeyboard() }
    );
  });

  bot.callbackQuery('veronica:session:recent', async (ctx) => {
    const recent = MessageBuilder.buildRecentSessionsCard(6);
    try {
      await ctx.editMessageText(recent.text, { parse_mode: 'HTML', reply_markup: recent.keyboard });
    } catch {
      await ctx.reply(recent.text, { parse_mode: 'HTML', reply_markup: recent.keyboard });
    }
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^veronica:session:switch:(.+)$/, async (ctx) => {
    const targetConvId = ctx.match[1];
    const userId = ctx.from?.id;
    if (userId) {
      const session = veronicaOrchestrator.getUserSession(userId);
      session.antigravityConversationId = targetConvId;
      veronicaOrchestrator.persistSessionMeta(session);
    }
    await ctx.answerCallbackQuery({ text: `Переключено на ${targetConvId.substring(0, 8)}` });
    await ctx.reply(
      `✅ <b>Диалог переключен на сессию:</b> <code>${escapeHtml(targetConvId)}</code>\n\n` +
        `Теперь все ваши сообщения будут отправляться в контекст этой сессии CLI.`,
      { parse_mode: 'HTML', reply_markup: MessageBuilder.getMainReplyKeyboard() }
    );
  });

  // Analytics callbacks
  bot.callbackQuery('veronica:menu:analytics', async (ctx) => {
    const dash = MessageBuilder.buildAnalyticsDashboard();
    try {
      await ctx.editMessageText(dash.text, { parse_mode: 'HTML', reply_markup: dash.keyboard });
    } catch {
      await ctx.reply(dash.text, { parse_mode: 'HTML', reply_markup: dash.keyboard });
    }
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('veronica:menu:tasks', async (ctx) => {
    const activeTasks = taskRegistry.getActiveTasks();
    let text = `📋 <b>Активные фоновые задачи (${activeTasks.length}):</b>\n━━━━━━━━━━━━━━━━━━━━━━\n`;
    if (activeTasks.length === 0) {
      text += `<i>Сейчас нет работающих агентов.</i>`;
    } else {
      for (const t of activeTasks) {
        text += `• <code>${t.id.substring(0, 8)}</code> | <b>${escapeHtml(t.project)}</b> (<i>${escapeHtml(t.skill)}</i>)\n`;
      }
    }
    const keyboard = new InlineKeyboard()
      .text('📈 Назад к аналитике', 'veronica:menu:analytics')
      .text('📁 Проекты', 'veronica:projects_menu');
    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
    } catch {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('veronica:menu:today', async (ctx) => {
    const msg = MessageBuilder.buildPeriodReport('today');
    const keyboard = MessageBuilder.buildPeriodSelectKeyboard();
    try {
      await ctx.editMessageText(msg, { parse_mode: 'HTML', reply_markup: keyboard });
    } catch {
      await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: keyboard });
    }
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('veronica:menu:cron', async (ctx) => {
    const jobs = veronicaScheduler.listCronJobs();
    const msg =
      jobs.length > 0
        ? `⏱ <b>Запланированные автоматизации (${jobs.length}):</b>\n━━━━━━━━━━━━━━━━━━━━━━\n` +
          jobs
            .map(
              (j) =>
                `• <b>${escapeHtml(j.project)}</b> | график: <i>${escapeHtml(
                  j.schedule
                )}</i> [${j.enabled ? '🟢 Активен' : '⏸ Выключен'}]\n  📝 <i>${escapeHtml(
                  (j.custom_prompt || j.skill || 'Регулярная задача').substring(0, 80)
                )}</i>`
            )
            .join('\n\n')
        : `⏱ <b>Автоматизации:</b> Нет активных расписаний.\n<i>Вы можете настроить запуск через меню проекта или CLI.</i>`;

    const keyboard = new InlineKeyboard()
      .text('📈 Назад к аналитике', 'veronica:menu:analytics')
      .text('📁 Проекты', 'veronica:projects_menu');

    try {
      await ctx.editMessageText(msg, { parse_mode: 'HTML', reply_markup: keyboard });
    } catch {
      await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: keyboard });
    }
    await ctx.answerCallbackQuery();
  });

  // Settings callbacks
  bot.callbackQuery('veronica:menu:model', async (ctx) => {
    await sendModelMenu(ctx);
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('veronica:menu:status', async (ctx) => {
    const msg = MessageBuilder.buildStatusMessage();
    await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: MessageBuilder.getMainReplyKeyboard() });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('veronica:menu:settings', async (ctx) => {
    const dash = MessageBuilder.buildSettingsDashboard();
    try {
      await ctx.editMessageText(dash.text, { parse_mode: 'HTML', reply_markup: dash.keyboard });
    } catch {
      await ctx.reply(dash.text, { parse_mode: 'HTML', reply_markup: dash.keyboard });
    }
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery('veronica:menu:stt', async (ctx) => {
    const card = MessageBuilder.buildSttSelectMessage();
    try {
      await ctx.editMessageText(card.text, { parse_mode: 'HTML', reply_markup: card.keyboard });
    } catch {
      await ctx.reply(card.text, { parse_mode: 'HTML', reply_markup: card.keyboard });
    }
    await ctx.answerCallbackQuery();
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
      config.model_name = chosen;
      if (!config.veronica) config.veronica = {};
      config.veronica.model = chosen;
    }

    saveConfig(config);
    await ctx.answerCallbackQuery({ text: `Выбрана модель: ${chosen}` });

    const currentStt = config.veronica?.stt_engine || 'auto';
    const models = MessageBuilder.listAvailableModels();
    const msg = MessageBuilder.buildModelSelectMessage(config.model_name, currentStt);
    const keyboard = MessageBuilder.buildModelSelectKeyboard(models, config.model_name, currentStt);
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

  bot.callbackQuery(/^veronica:set_stt:(.+)$/, async (ctx) => {
    const chosenStt = ctx.match[1] as 'auto' | 'local' | 'groq' | 'vosk';
    const config = loadConfig();
    if (!config.veronica) config.veronica = {};
    config.veronica.stt_engine = chosenStt;
    saveConfig(config);

    const sttNames: Record<string, string> = {
      auto: 'Авто (Qwen3 ➜ Groq ➜ Vosk)',
      local: 'Локальный Qwen3-ASR (DirectML)',
      groq: 'Groq Cloud Whisper (через 0xProxy)',
      vosk: 'Vosk Offline',
    };

    await ctx.answerCallbackQuery({ text: `🎙️ Движок STT: ${sttNames[chosenStt] || chosenStt}` });

    const currentModel = config.veronica?.model || config.model_name || 'Qwen3.8-27B-CRACK-IQ3_M.gguf';
    const models = MessageBuilder.listAvailableModels();
    const msg = MessageBuilder.buildModelSelectMessage(currentModel, chosenStt);
    const keyboard = MessageBuilder.buildModelSelectKeyboard(models, currentModel, chosenStt);

    try {
      await ctx.editMessageText(
        `✅ <b>Движок транскрибации переключен на:</b> <code>${escapeHtml(sttNames[chosenStt] || chosenStt)}</code>\n\n${msg}`,
        { parse_mode: 'HTML', reply_markup: keyboard }
      );
    } catch {
      await ctx.reply(
        `✅ <b>Движок транскрибации переключен на:</b> <code>${escapeHtml(sttNames[chosenStt] || chosenStt)}</code>`,
        { parse_mode: 'HTML' }
      );
    }
  });

  bot.callbackQuery('veronica:noop', async (ctx) => {
    await ctx.answerCallbackQuery();
  });

  // Emergency Alert Callbacks
  bot.callbackQuery('veronica:alert_ack:katya', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Захват подтвержден!' });
    await ctx.reply(
      `🫡 <b>ПРИНЯТО В РАБОТУ!</b>\n\n` +
      `🎯 Цель <code>КАТЯ ТАРАБАЕВА</code> помечена как захваченная 3-й личностью.\n` +
      `<i>1-я личность: подними Figma OSINT и видеоархив, синхронизируй стратегию. Не сбавлять темп!</i>`,
      { parse_mode: 'HTML', reply_markup: MessageBuilder.getMainReplyKeyboard() }
    );
  });

  bot.callbackQuery('veronica:alert_action:katya', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Инициализация контакта...' });
    await ctx.reply(
      `⚡ <b>БОЕВОЙ РЕЖИМ АКТИВИРОВАН:</b>\n\n` +
      `🔥 <i>3-я личность, вперёд на контакт! Ты знаешь что делать. Зайди в переписку или набери. Никакого страха.</i>\n\n` +
      `📋 <i>Если нужен драфт первого сообщения или анализ OSINT — просто напиши мне сюда в чат «Вероника, напиши Кате...»</i>`,
      { parse_mode: 'HTML', reply_markup: MessageBuilder.getMainReplyKeyboard() }
    );
  });
}
