import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { AppConfig } from '../../src/types';
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
import { getActivePersona, appendSilentUserTrait, updatePersonaFile } from '../personas';
import { listSessions, loadSession } from '../session';

export async function dispatchToolExecution(
  tc: { name: string; arguments: any },
  config: AppConfig,
  userResponseOrApproved: boolean | string
): Promise<string> {
  const activePersona = getActivePersona();

  switch (tc.name) {
    case 'read_file':
      return executeReadFile(config.workspace_dir, tc.arguments.path);

    case 'write_file':
      return executeWriteFile(config.workspace_dir, tc.arguments.path, tc.arguments.content);

    case 'patch_file':
      return executePatchFile(config.workspace_dir, tc.arguments.path, tc.arguments.content);

    case 'create_directory':
      return executeCreateDirectory(config.workspace_dir, tc.arguments.path);

    case 'get_file_info':
      return executeGetFileInfo(config.workspace_dir, tc.arguments.path);

    case 'list_dir':
      return executeListDir(config.workspace_dir, tc.arguments.path);

    case 'grep_search':
      return executeGrepSearch(config.workspace_dir, tc.arguments.pattern, tc.arguments.path);

    case 'fff_search':
      return await executeFffSearch(config.workspace_dir, tc.arguments.query || tc.arguments.pattern || '');

    case 'web_search':
      return await executeWebSearch(tc.arguments.query || tc.arguments.pattern || '');

    case 'read_web_page':
      return await executeReadWebPage(tc.arguments.url || tc.arguments.path || '');

    case 'execute_command':
      return await executeShellCommand(config.workspace_dir, tc.arguments.command);

    case 'remember_fact': {
      const saved = addOrUpdateMemory(tc.arguments.key, tc.arguments.value, tc.arguments.category);
      appendSilentUserTrait(activePersona.metadata.id, `[${saved.category}] ${saved.key} = ${saved.value}`);
      return `Successfully stored fact in long-term memory & persona profile USER.md: [${saved.category}] ${saved.key} = ${saved.value}`;
    }

    case 'save_knowledge':
      return await executeSaveKnowledge({
        title: tc.arguments.title,
        category: tc.arguments.category,
        content: tc.arguments.content,
        summary: tc.arguments.summary,
        tags: tc.arguments.tags,
        source: tc.arguments.source || '0xAgent LLM',
      });

    case 'search_knowledge':
      return await executeSearchKnowledge(tc.arguments.query, tc.arguments.category, tc.arguments.tag);

    case 'list_knowledge':
      return await executeListKnowledge(tc.arguments.category);

    case 'recall_memories': {
      const found = queryMemories(tc.arguments.query);
      return found.length > 0 ? JSON.stringify(found, null, 2) : 'No matching long-term memories found.';
    }

    case 'list_skills':
      return JSON.stringify(listSkills(), null, 2);

    case 'execute_skill': {
      const skillContent = readSkill(tc.arguments.name);
      return `Loaded skill instructions [${tc.arguments.name}]:\n${skillContent}`;
    }

    case 'search_sessions': {
      const sessionSummaries = await listSessions();
      const query = (tc.arguments.query || '').toLowerCase();
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
      return results.length > 0 ? JSON.stringify(results, null, 2) : 'No matching text found across past session logs.';
    }

    case 'run_scratch_script': {
      const lang = (tc.arguments.language || 'js').toLowerCase();
      const code = tc.arguments.code || '';
      const scratchDir = path.join(os.homedir(), '.0xagent', 'scratch');
      if (!fs.existsSync(scratchDir)) {
        await fs.promises.mkdir(scratchDir, { recursive: true });
      }

      const ext = lang.includes('py') ? 'py' : lang.includes('ps') || lang.includes('shell') ? 'ps1' : 'js';
      const scratchFile = path.join(scratchDir, `scratch_${Date.now()}.${ext}`);
      await fs.promises.writeFile(scratchFile, code, 'utf-8');

      return await new Promise<string>((resolve) => {
        let executable = 'node';
        let args = [scratchFile];
        if (lang.includes('py')) {
          executable = 'python';
          args = [scratchFile];
        } else if (lang.includes('ps') || lang.includes('shell')) {
          executable = 'powershell';
          args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scratchFile];
        }

        execFile(executable, args, { timeout: 15000 }, (err: any, stdout: string, stderr: string) => {
          if (err) {
            resolve(`Scratch Execution Error:\n${stdout || ''}\n${stderr || err.message}`);
          } else {
            resolve(`Scratch Execution Output:\n${(stdout || 'Executed cleanly with no output.').trim()}`);
          }
        });
      });
    }

    case 'ask_user': {
      if (typeof userResponseOrApproved === 'string') {
        return `User provided clarification: "${userResponseOrApproved}"`;
      }
      return `User responded to question: "${tc.arguments.question}"`;
    }

    case 'spawn_subagent': {
      const role = tc.arguments.role || 'Assistant Sub-Agent';
      const goal = tc.arguments.goal || 'Complete delegated task';
      try {
        const subApiEndpoint = `${config.api_url.replace(/\/$/, '')}/chat/completions`;
        const subRes = await fetch(subApiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: config.model_name,
            messages: [
              {
                role: 'system',
                content: `You are a specialized sub-agent with role: "${role}". Focus strictly on achieving your designated goal.`,
              },
              { role: 'user', content: `Goal: ${goal}\nProvide your solution and synthesis.` },
            ],
            temperature: 0.2,
            max_tokens: 2048,
          }),
        });

        if (subRes.ok) {
          const subData = (await subRes.json()) as any;
          const subOutput = subData.choices?.[0]?.message?.content || 'Sub-agent returned no output.';
          return `Sub-agent [${role}] result:\n${subOutput}`;
        }
        return `Sub-agent execution error: HTTP ${subRes.status} ${subRes.statusText}`;
      } catch (err: any) {
        return `Failed to spawn sub-agent: ${err.message || err}`;
      }
    }

    case 'update_user_profile': {
      const trait = tc.arguments.trait || tc.arguments.content || tc.arguments.value || '';
      const category = tc.arguments.category || 'profile';
      if (!trait.trim()) {
        return 'Error: trait content cannot be empty for update_user_profile.';
      }
      appendSilentUserTrait(activePersona.metadata.id, `[${category}] ${trait.trim()}`);
      addOrUpdateMemory(`user_${category}`, trait.trim(), category);
      return `[OK] Профиль пользователя (${activePersona.metadata.user_id}) успешно дополнен в ~/.0xagent/personas/${activePersona.metadata.id}/USER.md: [${category}] ${trait.trim()}`;
    }

    case 'update_persona_file': {
      const filename = (tc.arguments.file || tc.arguments.filename || 'USER.md') as 'SOUL.md' | 'TOOLS.md' | 'USER.md';
      const content = tc.arguments.content || '';
      if (!['SOUL.md', 'TOOLS.md', 'USER.md'].includes(filename)) {
        return `Error: Invalid persona filename '${filename}'. Allowed: SOUL.md, TOOLS.md, USER.md`;
      }
      updatePersonaFile(activePersona.metadata.id, filename, content);
      return `[OK] Файл ${filename} активной персоны [${activePersona.metadata.name}] успешно обновлен в ~/.0xagent/personas/${activePersona.metadata.id}/${filename}`;
    }

    default:
      throw new Error(`Unknown tool name: ${tc.name}`);
  }
}
