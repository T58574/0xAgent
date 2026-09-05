import { taskRegistry } from '../core/taskRegistry';
import { veronicaScheduler } from '../core/scheduler';
import { antigravityAdapter } from '../adapters/antigravityAdapter';
import { sessionStateManager, UserSessionState } from './sessionStateManager';

export class TaskActionDispatcher {
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

    // Action 1: run_task
    const runTaskRegex = /<action\s+type="run_task"\s+project="([^"]+)"(?:\s+skill="([^"]*)")?\s+prompt="([^"]+)"\s*\/>/gi;
    let match: RegExpExecArray | null;

    while ((match = runTaskRegex.exec(rawText)) !== null) {
      const targetProjectCandidate = match[1];
      const skill = match[2] || 'custom_task';
      const prompt = match[3];

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

          cleanText = cleanText.replace(match[0], '');
        } catch (err: any) {
          cleanText += `\n\n⚠️ <i>Не удалось запустить задачу для ${resolvedProject}: ${err?.message || err}</i>`;
        }
      } else {
        cleanText += `\n\n⚠️ <i>Проект «${targetProjectCandidate}» не найден в каталоге.</i>`;
      }
    }

    // Action 2: continue_task
    const continueTaskRegex = /<action\s+type="continue_task"(?:\s+task_id="([^"]*)")?\s+prompt="([^"]+)"\s*\/>/gi;
    while ((match = continueTaskRegex.exec(rawText)) !== null) {
      const taskId = match[1] || session.lastTaskId;
      const refinementPrompt = match[2];

      if (taskId) {
        const prevTask = taskRegistry.getTask(taskId);
        const targetProj = prevTask?.project || session.lastTaskProject || session.activeProject;

        if (targetProj) {
          try {
            const task = await antigravityAdapter.spawnTask({
              project: targetProj,
              skill: 'custom_task',
              custom_prompt: refinementPrompt,
            });

            session.lastTaskId = task.id;
            session.lastTaskProject = targetProj;
            session.lastTaskSummary = refinementPrompt;
            sessionStateManager.persistSessionMeta(session);

            cleanText = cleanText.replace(match[0], '');
          } catch (err: any) {
            cleanText += `\n\n⚠️ <i>Не удалось продолжить задачу: ${err?.message || err}</i>`;
          }
        }
      }
    }

    // Action 3: schedule_task (Periodic automated ТЗ placement)
    const scheduleTaskRegex = /<action\s+type="schedule_task"\s+project="([^"]+)"\s+schedule="([^"]+)"\s+prompt="([^"]+)"\s*\/>/gi;
    while ((match = scheduleTaskRegex.exec(rawText)) !== null) {
      const targetProjectCandidate = match[1];
      const schedule = match[2];
      const prompt = match[3];

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
            skill: 'custom_task',
            schedule,
            enabled: true,
            custom_prompt: prompt,
          });

          cleanText = cleanText.replace(match[0], '');
        } catch (err: any) {
          cleanText += `\n\n⚠️ <i>Не удалось запланировать задачу: ${err?.message || err}</i>`;
        }
      } else {
        cleanText += `\n\n⚠️ <i>Проект «${targetProjectCandidate}» не найден для планирования.</i>`;
      }
    }

    return cleanText.trim();
  }
}

export const taskActionDispatcher = new TaskActionDispatcher();
