import { loadConfig } from '../../../config';
import { MessageBuilder } from '../messageBuilder';
import { projectDiscovery } from '../../core/projectDiscovery';

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
  const currentModel = config.veronica?.model || config.model_name || 'gemini-3.7-flash-high';
  const currentStt = config.veronica?.stt_engine || 'auto';
  const models = MessageBuilder.listAvailableModels();
  const msg = MessageBuilder.buildModelSelectMessage(currentModel, currentStt);
  const keyboard = MessageBuilder.buildModelSelectKeyboard(models, currentModel, currentStt);
  await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: keyboard });
}
