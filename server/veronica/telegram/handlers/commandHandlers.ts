import { Bot } from 'grammy';
import { MessageBuilder } from '../messageBuilder';
import { antigravityAdapter } from '../../adapters/antigravityAdapter';
import { taskRegistry } from '../../core/taskRegistry';
import { projectDocManager } from '../../core/projectDocManager';
import { veronicaOrchestrator } from '../veronicaOrchestrator';
import { notificationService } from '../notificationService';
import { escapeHtml } from './telegramUtils';
import { sendProjectsMenu, sendModelMenu } from './menuHandlers';

export function registerBotCommands(bot: Bot): void {
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

  // /model
  bot.command('model', async (ctx) => {
    await sendModelMenu(ctx);
  });

  // /stt
  bot.command('stt', async (ctx) => {
    const card = MessageBuilder.buildSttSelectMessage();
    await ctx.reply(card.text, { parse_mode: 'HTML', reply_markup: card.keyboard });
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

  // /continue [prompt]
  bot.command('continue', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    const session = veronicaOrchestrator.getUserSession(userId);

    if (!session.lastTaskId) {
      await ctx.reply(
        '⚠️ <b>Нет предыдущей задачи для продолжения.</b>\n<i>Выберите проект в меню или запустите новую задачу.</i>',
        { parse_mode: 'HTML' }
      );
      return;
    }

    const prevTask = taskRegistry.getTask(session.lastTaskId);
    if (!prevTask) {
      await ctx.reply(`⚠️ Задача <code>${session.lastTaskId.substring(0, 8)}</code> не найдена в реестре.`, {
        parse_mode: 'HTML',
      });
      return;
    }

    const text = ctx.message?.text || '';
    const customPrompt = text.replace(/^\/continue\s*/i, '').trim() || prevTask.custom_prompt || 'Продолжить выполнение.';

    try {
      const task = await taskRegistry.resumeTask(prevTask.id, customPrompt);
      if (!task) {
        await ctx.reply(`⚠️ Не удалось возобновить задачу <code>${prevTask.id.substring(0, 8)}</code>.`, { parse_mode: 'HTML' });
        return;
      }

      session.lastTaskId = task.id;
      session.lastTaskProject = prevTask.project;
      session.lastTaskSummary = customPrompt;
      veronicaOrchestrator.persistSessionMeta(session);

      await ctx.reply(
        `🔄 <b>Возобновляю задачу <code>${task.id.substring(0, 8)}</code> (${prevTask.project})</b>\n\n` +
          `<i>Агент продолжает выполнение с сохраненным чекпоинтом без потери контекста.</i>`,
        { parse_mode: 'HTML' }
      );
    } catch (err: any) {
      await ctx.reply(`❌ Ошибка возобновления задачи: ${escapeHtml(err?.message || err)}`, { parse_mode: 'HTML' });
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

  // /alert [target] — trigger missile priority notification immediately
  bot.command('alert', async (ctx) => {
    const text = ctx.message?.text || '';
    const customTarget = text.replace(/^\/alert\s*/i, '').trim() || 'КАТЯ ТАРАБАЕВА';
    await ctx.reply('🚀 <i>Запускаю боевое оповещение наивысшего приоритета...</i>', { parse_mode: 'HTML' });
    await notificationService.sendMissilePriorityAlert({ targetName: customTarget });
  });

  // /briefing & /news — trigger morning briefing and AGY CLI releases check immediately
  bot.command(['briefing', 'news'], async (ctx) => {
    await ctx.reply('☕ <b>Формирую дайджест новостей и проверяю релизы AGY CLI...</b>', {
      parse_mode: 'HTML',
    });

    try {
      const { veronicaScheduler } = await import('../../core/scheduler');
      const result = await veronicaScheduler.executeTrendingDigestJob();
      if (result.success) {
        await ctx.reply(`✅ <b>${escapeHtml(result.message)}</b>`, { parse_mode: 'HTML' });
      } else {
        await ctx.reply(`❌ <b>Не удалось собрать дайджест:</b> ${escapeHtml(result.message)}`, { parse_mode: 'HTML' });
      }
    } catch (err: any) {
      await ctx.reply(`❌ Ошибка выполнения дайджеста: ${escapeHtml(err?.message || err)}`, { parse_mode: 'HTML' });
    }
  });
}
