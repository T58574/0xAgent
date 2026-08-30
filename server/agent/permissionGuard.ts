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
  'request_approval',
  'todo_write',
]);

export const MODIFYING_TOOLS: ReadonlySet<string> = new Set([
  'write_file',
  'patch_file',
  'create_directory',
  'execute_command',
  'run_scratch_script',
  'code_run',
]);

/**
 * Detects whether a path targets the 0xAgent engine's own core codebase (server, src, scripts, configs).
 */
export function isCoreSystemPath(filePath: string, workspaceDir?: string | null): boolean {
  if (!filePath) return false;

  const appRoot = process.cwd();
  const baseDir = workspaceDir ? path.resolve(workspaceDir) : appRoot;
  const targetAbs = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(baseDir, filePath);

  const relFromAppRoot = path.relative(appRoot, targetAbs).replace(/\\/g, '/');
  if (relFromAppRoot.startsWith('..') || path.isAbsolute(relFromAppRoot)) {
    return false;
  }

  const corePrefixes = [
    'server/',
    'src/',
    'scripts/',
    'package.json',
    'vite.config.ts',
    'tsconfig.json',
  ];

  return corePrefixes.some((pat) => relFromAppRoot === pat || relFromAppRoot.startsWith(pat));
}

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
 * Permission Guard and security presets enforcement.
 * Evaluates tool execution requests against the active security preset.
 * 
 * 1. 'prompt' (Частичная автоматизация / Partial Automation):
 *    - Auto-approves safe vectors: reading, search, memory, skills, questions, todo.
 *    - Requires user approval for modifying/destructive vectors: file writes, patches, shell commands, code execution.
 * 
 * 2. 'unrestricted' (Полная автоматизация / Full Automation):
 *    - Fully autonomous: auto-executes all tools under the background guard protection (core system paths protected by Staged Proposals).
 */
export function evaluateToolPermission(
  toolName: string,
  _args: any,
  preset: PermissionPreset = 'prompt',
  _workspaceDir?: string | null
): PermissionCheckResult {
  const isModifying = MODIFYING_TOOLS.has(toolName);

  // 1. Full Automation Preset ('unrestricted'): execute all tools autonomously under guard protection
  if (preset === 'unrestricted') {
    return { allowed: true, requiresApproval: false };
  }

  // 2. Partial Automation Preset ('prompt'): safe tools auto-approved; mutating tools require Tier-2 approval
  return {
    allowed: true,
    requiresApproval: isModifying,
  };
}
