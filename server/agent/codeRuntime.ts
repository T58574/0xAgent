import vm from 'node:vm';
import { AppConfig, CodeRunResult } from '../../src/types';
import {
  executeReadFile,
  executeWriteFile,
  executePatchFile,
  executeCreateDirectory,
  executeGetFileInfo,
  executeListDir,
  executeGrepSearch,
  executeFffSearch,
  executeWebSearch,
  executeReadWebPage,
  executeShellCommand,
  executeSaveKnowledge,
  executeSearchKnowledge,
  executeListKnowledge,
} from '../tools';
import { addOrUpdateMemory, queryMemories } from '../memory';
import { listSkills, readSkill } from '../skills';
import { listSessions, loadSession } from '../session';
import { getActivePersona, appendSilentUserTrait, updatePersonaFile } from '../personas';

export interface CodeRuntimeOptions {
  timeoutMs?: number;
  maxLogEntries?: number;
}

export const DEFAULT_RUNTIME_OPTIONS: CodeRuntimeOptions = {
  timeoutMs: 15000,
  maxLogEntries: 200,
};

/**
 * Sandboxed Code Mode Runtime for isolated in-memory JavaScript execution.
 * Executes an async JavaScript program with bound host `tools.*` async methods in 1 single turn.
 */
export async function executeCodeProgram(
  program: string,
  config: AppConfig,
  options: CodeRuntimeOptions = DEFAULT_RUNTIME_OPTIONS
): Promise<CodeRunResult> {
  const startTime = Date.now();
  const logs: string[] = [];
  const timeoutMs = options.timeoutMs || 15000;
  const maxLogs = options.maxLogEntries || 200;

  const appendLog = (level: string, ...args: any[]) => {
    if (logs.length >= maxLogs) return;
    const formatted = args
      .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
      .join(' ');
    logs.push(`[${level}] ${formatted}`);
  };

  // Host Tools Object injected into program's global namespace
  const hostTools = {
    read_file: async (args: any) => {
      const p = typeof args === 'string' ? args : args?.path;
      return await executeReadFile(config.workspace_dir, p);
    },
    write_file: async (args: any) => {
      const p = args?.path;
      const c = args?.content !== undefined ? args.content : args?.text || '';
      return await executeWriteFile(config.workspace_dir, p, c);
    },
    patch_file: async (args: any) => {
      const p = args?.path;
      const c = args?.content !== undefined ? args.content : args?.patch || '';
      return await executePatchFile(config.workspace_dir, p, c);
    },
    create_directory: async (args: any) => {
      const p = typeof args === 'string' ? args : args?.path;
      return await executeCreateDirectory(config.workspace_dir, p);
    },
    get_file_info: async (args: any) => {
      const p = typeof args === 'string' ? args : args?.path;
      return await executeGetFileInfo(config.workspace_dir, p);
    },
    list_dir: async (args: any) => {
      const p = typeof args === 'string' ? args : args?.path;
      return await executeListDir(config.workspace_dir, p);
    },
    grep_search: async (args: any) => {
      const pattern = args?.pattern || args?.query;
      const p = args?.path;
      return await executeGrepSearch(config.workspace_dir, pattern, p);
    },
    fff_search: async (args: any) => {
      const q = typeof args === 'string' ? args : args?.query || args?.pattern || '';
      return await executeFffSearch(config.workspace_dir, q);
    },
    web_search: async (args: any) => {
      const q = typeof args === 'string' ? args : args?.query || '';
      return await executeWebSearch(q);
    },
    read_web_page: async (args: any) => {
      const u = typeof args === 'string' ? args : args?.url || args?.path || '';
      return await executeReadWebPage(u);
    },
    execute_command: async (args: any) => {
      const cmd = typeof args === 'string' ? args : args?.command || '';
      return await executeShellCommand(config.workspace_dir, cmd);
    },
    save_knowledge: async (args: any) => {
      return await executeSaveKnowledge(args);
    },
    search_knowledge: async (args: any) => {
      return await executeSearchKnowledge(args?.query, args?.category, args?.tag);
    },
    list_knowledge: async (args: any) => {
      return await executeListKnowledge(args?.category);
    },
    update_user_profile: async (args: any) => {
      const activePersona = getActivePersona();
      const trait = typeof args === 'string' ? args : args?.trait || args?.content || args?.value || '';
      const category = (typeof args === 'object' && args?.category) || 'profile';
      if (!trait.trim()) return 'Error: trait content cannot be empty.';
      appendSilentUserTrait(activePersona.metadata.id, `[${category}] ${trait.trim()}`);
      addOrUpdateMemory(`user_${category}`, trait.trim(), category);
      return `[OK] Profile updated in USER.md: [${category}] ${trait.trim()}`;
    },
    update_persona_file: async (args: any) => {
      const activePersona = getActivePersona();
      const filename = (args?.file || args?.filename || 'USER.md') as 'SOUL.md' | 'TOOLS.md' | 'USER.md';
      const content = args?.content || '';
      if (!['SOUL.md', 'TOOLS.md', 'USER.md'].includes(filename)) {
        return `Error: Invalid persona filename '${filename}'. Allowed: SOUL.md, TOOLS.md, USER.md`;
      }
      updatePersonaFile(activePersona.metadata.id, filename, content);
      return `[OK] File ${filename} updated in persona ${activePersona.metadata.id}`;
    },
    todo_write: async (_args: any) => {
      return `[OK] Todo write registered.`;
    },
    recall_memories: async (args: any) => {
      const q = typeof args === 'string' ? args : args?.query || '';
      return queryMemories(q);
    },
    remember_fact: async (args: any) => {
      return addOrUpdateMemory(args?.key, args?.value, args?.category);
    },
    search_sessions: async (args: any) => {
      const query = (typeof args === 'string' ? args : args?.query || '').toLowerCase();
      const sessionSummaries = await listSessions();
      const results: any[] = [];
      for (const s of sessionSummaries) {
        const full = await loadSession(s.id);
        if (full) {
          const matches = full.messages.filter((m) => m.content.toLowerCase().includes(query));
          if (matches.length > 0) {
            results.push({
              session_id: s.id,
              session_title: s.title,
              matches_count: matches.length,
              snippets: matches.slice(0, 3).map((m) => m.content.substring(0, 150)),
            });
          }
        }
      }
      return results;
    },
    list_skills: async () => {
      return listSkills();
    },
    read_skill: async (args: any) => {
      const name = typeof args === 'string' ? args : args?.name || '';
      return readSkill(name);
    },
  };

  const isUnrestricted = config.permission_preset === 'unrestricted';

  const sandbox: Record<string, any> = {
    tools: hostTools,
    console: {
      log: (...args: any[]) => appendLog('LOG', ...args),
      info: (...args: any[]) => appendLog('INFO', ...args),
      warn: (...args: any[]) => appendLog('WARN', ...args),
      error: (...args: any[]) => appendLog('ERROR', ...args),
    },
    Buffer,
    setTimeout,
    clearTimeout,
    process: {
      platform: process.platform,
      arch: process.arch,
      version: process.version,
      versions: process.versions,
      env: { ...process.env },
      cwd: () => (config.workspace_dir ? config.workspace_dir : process.cwd()),
    },
  };

  if (isUnrestricted) {
    sandbox.require = (moduleName: string) => {
      try {
        return require(moduleName);
      } catch (err: any) {
        throw new Error(`Module '${moduleName}' not found or cannot be loaded in code_run sandbox: ${err.message}`);
      }
    };
  }

  const context = vm.createContext(sandbox);

  // Wrap program in async IIFE
  const wrappedCode = `(async () => {\n${program}\n})()`;

  try {
    const script = new vm.Script(wrappedCode);
    const executionPromise = script.runInContext(context, {
      timeout: timeoutMs,
      displayErrors: true,
    });

    const result = await Promise.race([
      executionPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Code execution exceeded timeout budget (${timeoutMs}ms)`)), timeoutMs)
      ),
    ]);

    const executionTimeMs = Date.now() - startTime;
    return {
      success: true,
      value: result,
      logs,
      executionTimeMs,
    };
  } catch (err: any) {
    const executionTimeMs = Date.now() - startTime;
    return {
      success: false,
      error: err?.message || String(err),
      logs,
      executionTimeMs,
    };
  }
}
