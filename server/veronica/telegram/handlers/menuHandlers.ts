import { InlineKeyboard } from 'grammy';
import { loadConfig } from '../../../config';
import { MessageBuilder } from '../messageBuilder';
import { projectDiscovery } from '../../core/projectDiscovery';
import { quotaManager } from '../../../agent/quotaManager';
import { escapeHtml } from './telegramUtils';

export async function sendProjectsMenu(ctx: any, edit: boolean = false): Promise<void> {
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
}

export async function sendModelMenu(ctx: any): Promise<void> {
  const config = loadConfig();
  const currentModel = config.veronica?.model || config.model_name || 'Qwen3.8-27B-CRACK-IQ3_M.gguf';
  const currentStt = config.veronica?.stt_engine || 'auto';
  const models = MessageBuilder.listAvailableModels();
  const msg = MessageBuilder.buildModelSelectMessage(currentModel, currentStt);
  const keyboard = MessageBuilder.buildModelSelectKeyboard(models, currentModel, currentStt);
  await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: keyboard });
}

export async function sendQuotaStatus(ctx: any, isEdit: boolean = false): Promise<void> {
  const quota = quotaManager.getQuotaStatus();
  const config = loadConfig();
  const activeModel = config.veronica?.model || config.model_name || 'gemini-3.7-flash-high';
  const cleanModel = activeModel.replace(/^local:/, '');

  const lines: string[] = [
    `📊 <b>Мониторинг Квот Antigravity (agy CLI):</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `• <b>Активная модель:</b> <code>${escapeHtml(cleanModel)}</code>`,
  ];

  if (quota.exhausted) {
    lines.push(`• <b>Статус:</b> ⚠️ <b>Исчерпана (429)</b>`);
    lines.push(`• <b>Заполненность:</b> <code>[○○○○○○○○○○] 0%</code>`);
    if (quota.reason) lines.push(`• <b>Причина:</b> <i>${escapeHtml(quota.reason)}</i>`);
    if (quota.resetText) lines.push(`• <b>Сброс через:</b> <b>${escapeHtml(quota.resetText)}</b>`);
  } else {
    lines.push(`• <b>Статус:</b> 🟢 <b>В норме (Инференс активен)</b>`);
  }

  if (quota.limits && quota.limits.length > 0) {
    lines.push(`\n📈 <b>Реальные лимиты инференса:</b>`);
    for (const lim of quota.limits) {
      const filled = Math.max(0, Math.min(10, Math.round(lim.remainingPercentage / 10)));
      const empty = 10 - filled;
      const bar = `[${'●'.repeat(filled)}${'○'.repeat(empty)}]`;

      let resetCountdown = lim.resetAtUtc;
      try {
        const diffMs = new Date(lim.resetAtUtc).getTime() - Date.now();
        if (diffMs > 0) {
          const totalSec = Math.ceil(diffMs / 1000);
          const h = Math.floor(totalSec / 3600);
          const m = Math.floor((totalSec % 3600) / 60);
          const s = totalSec % 60;
          const pad = (n: number) => String(n).padStart(2, '0');
          resetCountdown = h > 0 ? `${h}h ${pad(m)}m` : `${m}m ${pad(s)}s`;
        } else {
          resetCountdown = 'Готово к сбросу';
        }
      } catch {}

      lines.push(`\n🔹 <b>${escapeHtml(lim.modelGroup)}</b> — <i>${escapeHtml(lim.limitType)}</i>`);
      lines.push(`  Остаток: <code>${bar} ${lim.remainingPercentage}%</code>`);
      lines.push(`  Сброс через: <b>${escapeHtml(resetCountdown)}</b>`);
    }
  } else if (!quota.exhausted) {
    lines.push(`\n<i>Лимиты инференса обновляются в фоновом режиме из agy CLI.</i>`);
  }

  lines.push(`\n💡 <i>Для переключения аккаунта выполните <code>agy auth</code> в консоли.</i>`);

  const keyboard = new InlineKeyboard()
    .text('🔄 Обновить квоты', 'veronica:settings:check_quota')
    .text('⚙️ Настройки', 'veronica:menu:settings');

  const text = lines.join('\n');
  if (isEdit) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
    } catch {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
  } else {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
  }
}
