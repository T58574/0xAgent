import { projectDocManager } from './projectDocManager';
import { contextEngine } from './contextEngine';
import { projectDiscovery } from './projectDiscovery';

export interface TaskPromptOptions {
  project: string;
  skill: string;
  custom_prompt?: string;
  task_id: string;
  autonomy_level?: string;
  project_path?: string;
  parent_task_id?: string;
  parent_summary?: string;
}

export class TaskPromptBuilder {
  private static instance: TaskPromptBuilder;

  private constructor() {}

  public static getInstance(): TaskPromptBuilder {
    if (!TaskPromptBuilder.instance) {
      TaskPromptBuilder.instance = new TaskPromptBuilder();
    }
    return TaskPromptBuilder.instance;
  }

  /**
   * Builds a structured, self-contained single-prompt autonomous payload
   * for background Antigravity agents working under Veronica Orchestrator.
   */
  public async buildAutonomousTaskPrompt(options: TaskPromptOptions): Promise<string> {
    const { project, skill, custom_prompt, task_id, autonomy_level = 'L2' } = options;

    const resolvedPath =
      options.project_path || (await projectDiscovery.resolveProjectPath(project)) || process.cwd();

    // Fetch project passport snippet
    let passportSnippet = '';
    try {
      const fullPassport = await projectDocManager.getPassport(project);
      if (fullPassport && !fullPassport.includes('Passport for new project')) {
        passportSnippet = fullPassport.substring(0, 1000);
      }
    } catch {}

    // Fetch dense context
    let denseContext = '';
    try {
      denseContext = await contextEngine.getProjectContext(project, { task: task_id });
    } catch {}

    const objective =
      custom_prompt?.trim() ||
      `Execute skill '${skill}' on project '${project}'. Perform necessary code inspection, modifications, refactoring, and verifications.`;

    const continuationContext = options.parent_task_id
      ? `\n# CONTINUATION CONTEXT:\n- This task is a direct follow-up to parent task [${options.parent_task_id.substring(
          0,
          8
        )}].\n- Previous task outcome: ${options.parent_summary || 'in progress'}\n- Continue refining the implementation according to user feedback.\n`
      : '';

    return `You are an elite autonomous software engineering agent dispatched by Veronica AI Orchestrator to work on project '${project}'.

# 1. [PROJECT & WORKSPACE CONTEXT]
- Project: ${project}
- Workspace Root: ${resolvedPath}
- Autonomy Level: ${autonomy_level}
- Dense State: ${denseContext || 'N/A'}
${passportSnippet ? `\n## Project Passport:\n${passportSnippet}\n` : ''}
${continuationContext}
# 2. [TASK OBJECTIVE & SCOPE]
Skill: ${skill}
Task ID: ${task_id}

Objective:
${objective}

# 3. [ORCHESTRATOR CLI PROTOCOL & INVARIANTS]
You MUST use the internal Veronica CLI protocol to query state and report progress:
- Fetch full project context:
  \`0xagent veronica context ${project} --task ${task_id}\`
- Periodic Heartbeat during multi-step operations:
  \`0xagent veronica heartbeat --task ${task_id} --action "<current_step>" --progress "<pct>"\`
- Final Completion Report (MANDATORY on completion):
  \`0xagent veronica report --task ${task_id} --status completed --summary "<Понятное, ёмкое описание сделанного на русском языке>" --changes '["Конкретное изменение 1 на русском", "Конкретное изменение 2 на русском"]' --important\`
  IMPORTANT: The summary and changes MUST be written strictly in RUSSIAN for the user to easily understand.
- Error Reporting (if blocked or fatal error occurs):
  \`0xagent veronica error --task ${task_id} --message "<detailed error message>" --fatal\`

CRITICAL INVARIANTS:
1. Do NOT directly modify system Markdown files or internal documentation; the Veronica CLI automatically updates operational journals, changelogs, and state snapshots.
2. Keep code changes modular, clean, and strictly aligned with the existing codebase style.
3. Verify your changes (run test suites or build commands) before reporting completion.
4. Always deliver your final report text in Russian.

# 4. [EXECUTION WORKFLOW]
1. Step 1 (Inspect): Read relevant files and understand code architecture before modifying.
2. Step 2 (Implement): Make precise, production-grade code modifications.
3. Step 3 (Verify): Run tests or build checks to ensure 0 errors and 0 regressions.
4. Step 4 (Report): Call \`0xagent veronica report --task ${task_id} --status completed ...\` to submit your final operational digest.

Begin execution now.`;
  }
}

export const taskPromptBuilder = TaskPromptBuilder.getInstance();