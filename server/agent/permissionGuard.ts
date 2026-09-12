import path from 'node:path';
import os from 'node:os';
import { PermissionPreset } from '../../src/types';

export interface PermissionCheckResult {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
}

export const FORBIDDEN_PRIVACY_TOOLS: ReadonlySet<string> = new Set([
  'search_sessions',
  'recall_memories',
]);

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
  'list_skills',
  'execute_skill',
  'ask_user',
  'ask_user_question',
  'request_approval',
  'todo_write',
]);

export const MODIFYING_TOOLS: ReadonlySet<string> = new Set([
  'write_file',
  'patch_file',
  'rename_file',
  'delete_file',
  'create_directory',
  'execute_command',
  'run_scratch_script',
  'code_run',
]);

/**
 * Checks whether a path targets sensitive personal chats, conversation logs, transcripts, or memory files.
 * Protects:
 * - 0xAgent chat sessions (.0xagent/sessions, .0xagent/data/sessions)
 * - Memory database (.0xagent/memory.db, .0xagent/memory.db-wal, .0xagent/memory.db-shm)
 * - Persona user traits and memories (.0xagent/personas/*\/USER.md, USER_PINNED.md)
 * - Veronica logs and database (.0xagent/veronica/veronica.db*)
 * - Large command output spill dumps (.0xagent/spill)
 * - Antigravity/Gemini conversation logs and transcripts (*transcript*.jsonl, conversation_summaries.db)
 */
export function isForbiddenPrivacyPath(filePath: string, workspaceDir?: string | null): boolean {
  if (!filePath || typeof filePath !== 'string') return false;

  const baseDir = workspaceDir && workspaceDir.trim().length > 0 ? workspaceDir : process.cwd();
  const absPath = path.isAbsolute(filePath)
    ? path.normalize(path.resolve(filePath))
    : path.normalize(path.resolve(baseDir, filePath));

  const normalized = absPath.replace(/\\/g, '/').toLowerCase();
  const baseName = path.basename(absPath).toLowerCase();

  // 1. Antigravity & Gemini conversation logs & transcripts
  if (baseName === 'transcript.jsonl' || baseName === 'transcript_full.jsonl' || baseName === 'conversation_summaries.db') {
    return true;
  }
  if (normalized.includes('/.gemini/antigravity-cli/conversation_summaries.db')) {
    return true;
  }
  if (normalized.includes('/.gemini/antigravity/brain/') && (normalized.includes('/logs/') || normalized.endsWith('.jsonl'))) {
    return true;
  }
  if (normalized.includes('/.system_generated/logs')) {
    return true;
  }

  // 2. 0xAgent sessions & chat history
  const homeDir = os.homedir().replace(/\\/g, '/').toLowerCase();
  const zeroAgentDir = `${homeDir}/.0xagent`;

  if (normalized.startsWith(`${zeroAgentDir}/sessions`) || normalized.startsWith(`${zeroAgentDir}/data/sessions`)) {
    return true;
  }
  // Generic sessions directory pattern under .0xagent
  if (normalized.includes('/.0xagent/sessions') || normalized.includes('/.0xagent/data/sessions')) {
    return true;
  }

  // 3. 0xAgent long-term memory database
  if (
    baseName === 'memory.db' ||
    baseName === 'memory.db-wal' ||
    baseName === 'memory.db-shm' ||
    normalized.includes('/.0xagent/memory.db')
  ) {
    return true;
  }

  // 4. 0xAgent user profile / memories inside personas
  if (
    normalized.includes('/.0xagent/personas/') &&
    (baseName === 'user.md' || baseName === 'user_pinned.md')
  ) {
    return true;
  }

  // 5. Veronica database & audit journal
  if (
    normalized.startsWith(`${zeroAgentDir}/veronica`) ||
    normalized.includes('/.0xagent/veronica/veronica.db')
  ) {
    return true;
  }

  // 6. Output spill logs
  if (normalized.startsWith(`${zeroAgentDir}/spill`) || normalized.includes('/.0xagent/spill')) {
    return true;
  }

  return false;
}

/**
 * Detects whether a path targets the 0xAgent engine's own core codebase.
 */
export function isCoreSystemPath(filePath: string, workspaceDir?: string | null): boolean {
  if (!filePath) return false;
  if (workspaceDir && (workspaceDir.includes('.0xagent') || workspaceDir.includes('workspaces'))) return false;
  const normalized = filePath.replace(/\\/g, '/');
  if (
    normalized.startsWith('server/') ||
    normalized.startsWith('src/') ||
    normalized.startsWith('scripts/') ||
    normalized.startsWith('bin/') ||
    normalized.startsWith('launcher/') ||
    normalized === 'package.json' ||
    normalized.endsWith('/package.json')
  ) {
    return true;
  }
  return false;
}

/**
 * Validates whether a file path is contained within the workspace.
 */
export function isPathInsideWorkspace(filePath: string, workspaceDir?: string | null): boolean {
  if (!filePath) return false;
  const baseDir = workspaceDir && workspaceDir.trim().length > 0 ? path.resolve(workspaceDir) : process.cwd();
  const target = path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(baseDir, filePath);
  const rel = path.relative(baseDir, target);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Permission Guard and security presets enforcement.
 * Enforces strict Zero-Trust privacy boundary across all presets:
 * Viewing personal chats, conversation logs, transcripts, and memory reading is hard-blocked at system level.
 */
export function evaluateToolPermission(
  toolName: string,
  args: any,
  preset: PermissionPreset = 'unrestricted',
  workspaceDir?: string | null
): PermissionCheckResult {
  // 1. Strict System Privacy Check: forbidden tools are unconditionally rejected
  if (FORBIDDEN_PRIVACY_TOOLS.has(toolName)) {
    return {
      allowed: false,
      requiresApproval: false,
      reason: `[SYSTEM PRIVACY GUARD]: Access to personal chats, conversation logs, and memory is strictly forbidden at the system level (Tool: '${toolName}').`,
    };
  }

  // 2. Strict System Privacy Check: any file path targeting chat logs, transcripts, or memory files
  const pathsToCheck: string[] = [];
  if (args && typeof args === 'object') {
    if (typeof args.path === 'string') pathsToCheck.push(args.path);
    if (typeof args.file === 'string') pathsToCheck.push(args.file);
    if (typeof args.filePath === 'string') pathsToCheck.push(args.filePath);
    if (typeof args.old_path === 'string') pathsToCheck.push(args.old_path);
    if (typeof args.new_path === 'string') pathsToCheck.push(args.new_path);
    if (typeof args.from === 'string') pathsToCheck.push(args.from);
    if (typeof args.to === 'string') pathsToCheck.push(args.to);
  }

  for (const p of pathsToCheck) {
    if (isForbiddenPrivacyPath(p, workspaceDir)) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: `[SYSTEM PRIVACY GUARD]: Access to path '${p}' is forbidden. Personal chats, conversation logs, and memory files are protected at the system level.`,
      };
    }
  }

  // 3. Preset Evaluation
  if (preset === 'unrestricted') {
    return { allowed: true, requiresApproval: false };
  }

  const isModifying = MODIFYING_TOOLS.has(toolName);
  return {
    allowed: true,
    requiresApproval: isModifying,
  };
}
