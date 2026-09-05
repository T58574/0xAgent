import { taskRegistry } from '../core/taskRegistry';
import { veronicaScheduler } from '../core/scheduler';
import { antigravityAdapter } from '../adapters/antigravityAdapter';
import { sessionStateManager, UserSessionState } from './sessionStateManager';

export class TaskActionDispatcher {
  /**
   * Helper to parse XML tag attributes into a key-value dictionary
   * regardless of attribute order or quote style.
   */
  private parseActionAttributes(rawTag: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const attrRegex = /([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
    let match: RegExpExecArray | null;
    while ((match = attrRegex.exec(rawTag)) !== null) {
      const key = match[1].toLowerCase();
      const val = match[2] ?? match[3] ?? match[4] ?? '';
      attrs[key] = val;
    }
    return attrs;
  }

  /**
   * Dispatch action tags inside LLM output:
   * <action type="run_task" ... />
   * <action type="continue_task" ... />
   * <action type="schedule_task" ... />
   */
  public async dispatchActionTags(
    session: UserSessionState,
    rawText: string,
    resolveTargetProject: (candidate?: string, queryText?: string, fallbackActiveProject?: string) => Promise<string | null>
  ): Promise<string> {
    let cleanText = rawText;
    const actionTagRegex = /<action\b([^>]*?)(?:\/>|>[\s\S]*?<\/action>|>)/gi;
    const matches = Array.from(rawText.matchAll(actionTagRegex));

    for (const match of matches) {
      const fullTag = match[0];
      const attrString = match[1];
      const attrs = this.parseActionAttributes(attrString);
      const actionType = (attrs.type || '').toLowerCase();

      if (actionType === 'run_task') {
        const targetProjectCandidate = attrs.project || session.activeProject;
        const skill = attrs.skill || 'custom_task';
        const prompt = attrs.prompt;

        if (prompt) {
          const resolvedProject = await resolveTargetProject(
            targetProjectCandidate,
            prompt,
            session.activeProject
          );

          if (resolvedProject) {
            try {
              const task = await antigravityAdapter.spawnTask({
                project: resolvedProject,
                skill,
                custom_prompt: prompt,
              });

              session.lastTaskId = task.id;
              session.lastTaskProject = resolvedProject;
              session.lastTaskSummary = prompt;
              sessionStateManager.persistSessionMeta(session);

              cleanText = cleanText.replace(fullTag, '');
            } catch (err: any) {
              cleanText = cleanText.replace(fullTag, '');
              cleanText += `\n\n⚠️ <i>Не удалось запустить задачу для ${resolvedProject}: ${err?.message || err}</i>`;
            }
          } else {
            cleanText = cleanText.replace(fullTag, '');
            cleanText += `\n\n⚠️ <i>Проект «${targetProjectCandidate || 'не указан'}» не найден в каталоге.</i>`;
          }
        }
      } else if (actionType === 'continue_task') {
        const taskId = attrs.task_id || session.lastTaskId;
        const refinementPrompt = attrs.prompt;

        if (taskId && refinementPrompt) {
          const prevTask = taskRegistry.getTask(taskId);
          const targetProj = prevTask?.project || session.lastTaskProject || session.activeProject;

          if (targetProj) {
            let resumeConvoId: string | undefined = undefined;
            if (prevTask?.result_json) {
              try {
                const res = JSON.parse(prevTask.result_json);
                resumeConvoId = res.conversation_id;
              } catch {}
            }

            try {
              const task = await antigravityAdapter.spawnTask({
                project: targetProj,
                skill: 'custom_task',
                custom_prompt: refinementPrompt,
                conversation_id: resumeConvoId,
                continue_recent: !resumeConvoId,
              });

              session.lastTaskId = task.id;
              session.lastTaskProject = targetProj;
              session.lastTaskSummary = refinementPrompt;
              sessionStateManager.persistSessionMeta(session);

              cleanText = cleanText.replace(fullTag, '');
            } catch (err: any) {
              cleanText = cleanText.replace(fullTag, '');
              cleanText += `\n\n⚠️ <i>Не удалось продолжить задачу: ${err?.message || err}</i>`;
            }
          }
        }
      } else if (actionType === 'schedule_task') {
        const targetProjectCandidate = attrs.project || session.activeProject;
        const schedule = attrs.schedule;
        const prompt = attrs.prompt;

        if (schedule && prompt) {
          const resolvedProject = await resolveTargetProject(
            targetProjectCandidate,
            prompt,
            session.activeProject
          );

          if (resolvedProject) {
            try {
              const jobId = `cron_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
              await veronicaScheduler.addCronJob({
                id: jobId,
                project: resolvedProject,
                skill: attrs.skill || 'custom_task',
                schedule,
                enabled: true,
                custom_prompt: prompt,
              });

              cleanText = cleanText.replace(fullTag, '');
            } catch (err: any) {
              cleanText = cleanText.replace(fullTag, '');
              cleanText += `\n\n⚠️ <i>Не удалось запланировать задачу: ${err?.message || err}</i>`;
            }
          } else {
            cleanText = cleanText.replace(fullTag, '');
            cleanText += `\n\n⚠️ <i>Проект «${targetProjectCandidate || 'не указан'}» не найден для планирования.</i>`;
          }
        }
      }
    }

    return cleanText.trim();
  }
}

export const taskActionDispatcher = new TaskActionDispatcher();
