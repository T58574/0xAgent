import path from 'node:path';
import { PermissionPreset } from '../../src/types';

export interface PermissionCheckResult {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
}

export const READONLY_TOOLS: ReadonlySet<string> = new Set([
  'read_file',
  'list_dir',
  'grep_search',
  'fff_search',
  'get_file_info',
  'web_search',
  'read_web_page',
  'search_knowledge',
  'list_knowledge',
  'recall_memories',
  'list_skills',
  'execute_skill',
  'search_sessions',
  'ask_user',
  'ask_user_question',
  'todo_write',
  'list_subagents',
]);

export const MODIFYING_TOOLS: ReadonlySet<string> = new Set([
  'write_file',
  'patch_file',
  'create_directory',
  'execute_command',
  'run_scratch_script',
  'code_run',
  'spawn_subagent',
  'send_subagent_message',
  'interrupt_subagent',
]);

/**
 * Validates whether a file path is safely contained within the designated workspace directory.
 */
export function isPathInsideWorkspace(filePath: string, workspaceDir?: string | null): boolean {
  if (!workspaceDir) return true;
  const absWorkspace = path.resolve(workspaceDir);
  const absTarget = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(workspaceDir, filePath);

  const relative = path.relative(absWorkspace, absTarget);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Permission Guard adapted from DeepSeek Harness permission presets.
 * Evaluates tool execution requests against the active security preset.
 */
export function evaluateToolPermission(
  toolName: string,
  args: any,
  preset: PermissionPreset = 'prompt',
  workspaceDir?: string | null
): PermissionCheckResult {
  const isModifying = MODIFYING_TOOLS.has(toolName);

  // 1. Read-Only Preset: Completely reject mutating and shell tools
  if (preset === 'readonly') {
    if (isModifying) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: `[SECURITY REJECTED]: Инструмент '${toolName}' заблокирован. Активен режим безопасности 'readonly' (Только чтение).`,
      };
    }
    return { allowed: true, requiresApproval: false };
  }

  // 2. Workspace-Write Preset: Allow mutations only strictly inside workspace
  if (preset === 'workspace-write') {
    const targetPath = args?.path || args?.file || args?.filePath;
    if (targetPath && typeof targetPath === 'string' && workspaceDir) {
      if (!isPathInsideWorkspace(targetPath, workspaceDir)) {
        return {
          allowed: false,
          requiresApproval: false,
          reason: `[SECURITY REJECTED]: Доступ к пути '${targetPath}' за пределами рабочей области проекта запрещен политикой 'workspace-write'.`,
        };
      }
    }
    return { allowed: true, requiresApproval: false };
  }

  // 3. Unrestricted Preset: Execute without confirmation prompts
  if (preset === 'unrestricted') {
    return { allowed: true, requiresApproval: false };
  }

  // 4. Default: Prompt Preset (ask for user approval on modifying tools)
  return {
    allowed: true,
    requiresApproval: isModifying,
  };
}
