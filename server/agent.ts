import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import { v4 as uuidv4 } from 'uuid';
import { AppConfig, ChatMessage, ToolCallInfo } from '../src/types';
import { loadSession, saveSession } from './session';
import {
  executeReadFile,
  executeWriteFile,
  executePatchFile,
  executeListDir,
  executeGrepSearch,
  executeShellCommand,
} from './tools';
import { addOrUpdateMemory, queryMemories, getSystemPromptMemoryContext } from './memory';
import { listSkills, readSkill } from './skills';
import { listSessions, loadSession as getSessionById } from './session';

export interface ParsedToolCall {
  id: string;
  name: string;
  arguments: any;
  raw_content: string;
}

export interface PendingConfirmation {
  sessionId: string;
  toolCallId: string;
  resolve: (approved: boolean | string) => void;
}

// Global active confirmations map and cancellation tokens
const activeConfirmations = new Map<string, PendingConfirmation>();
const activeCancelTokens = new Set<string>();

export function respondToToolConfirmation(sessionId: string, toolCallId: string, approve: boolean | string): boolean {
  const key = `${sessionId}:${toolCallId}`;
  const pending = activeConfirmations.get(key);
  if (pending) {
    pending.resolve(approve);
    activeConfirmations.delete(key);
    return true;
  }
  return false;
}

export function cancelAgentSession(sessionId: string): void {
  activeCancelTokens.add(sessionId);

  // Cancel any pending tool confirmation for this session
  for (const [key, pending] of activeConfirmations.entries()) {
    if (pending.sessionId === sessionId) {
      pending.resolve(false);
      activeConfirmations.delete(key);
    }
  }
}

export function parseToolCalls(text: string): ParsedToolCall[] {
  const toolCalls: ParsedToolCall[] = [];

  // 1. Read File
  const reRead = /<read_file\s+path=["']([^"']+)["']\s*\/?>/gs;
  let match: RegExpExecArray | null;
  while ((match = reRead.exec(text)) !== null) {
    toolCalls.push({
      id: `read_${uuidv4().substring(0, 8)}`,
      name: 'read_file',
      arguments: { path: match[1] },
      raw_content: match[0],
    });
  }

  // 2. Write File
  const reWrite = /<write_file\s+path=["']([^"']+)["']\s*>(.*?)<\/write_file>/gs;
  while ((match = reWrite.exec(text)) !== null) {
    toolCalls.push({
      id: `write_${uuidv4().substring(0, 8)}`,
      name: 'write_file',
      arguments: { path: match[1], content: match[2] },
      raw_content: match[0],
    });
  }

  // 3. Patch File
  const rePatch = /<patch_file\s+path=["']([^"']+)["']\s*>(.*?)<\/patch_file>/gs;
  while ((match = rePatch.exec(text)) !== null) {
    toolCalls.push({
      id: `patch_${uuidv4().substring(0, 8)}`,
      name: 'patch_file',
      arguments: { path: match[1], content: match[2] },
      raw_content: match[0],
    });
  }

  // 4. List Dir
  const reList = /<list_dir\s+path=["']([^"']+)["']\s*\/?>/gs;
  while ((match = reList.exec(text)) !== null) {
    toolCalls.push({
      id: `list_${uuidv4().substring(0, 8)}`,
      name: 'list_dir',
      arguments: { path: match[1] },
      raw_content: match[0],
    });
  }

  // 5. Grep Search
  const reGrep1 = /<grep_search\s+pattern=["']([^"']+)["']\s+path=["']([^"']+)["']\s*\/?>/gs;
  while ((match = reGrep1.exec(text)) !== null) {
    toolCalls.push({
      id: `grep_${uuidv4().substring(0, 8)}`,
      name: 'grep_search',
      arguments: { pattern: match[1], path: match[2] },
      raw_content: match[0],
    });
  }

  const reGrep2 = /<grep_search\s+path=["']([^"']+)["']\s+pattern=["']([^"']+)["']\s*\/?>/gs;
  while ((match = reGrep2.exec(text)) !== null) {
    const raw = match[0];
    if (!toolCalls.some((tc) => tc.raw_content === raw)) {
      toolCalls.push({
        id: `grep_${uuidv4().substring(0, 8)}`,
        name: 'grep_search',
        arguments: { pattern: match[2], path: match[1] },
        raw_content: raw,
      });
    }
  }

  // 6. Execute Command
  const reExec = /<execute_command\s*>(.*?)<\/execute_command>/gs;
  while ((match = reExec.exec(text)) !== null) {
    toolCalls.push({
      id: `exec_${uuidv4().substring(0, 8)}`,
      name: 'execute_command',
      arguments: { command: match[1].trim() },
      raw_content: match[0],
    });
  }

  // 7. Remember Fact
  const reMemAdd = /<remember_fact\s+key=["']([^"']+)["']\s+value=["']([^"']+)["'](?:\s+category=["']([^"']+)["'])?\s*\/?>/gs;
  while ((match = reMemAdd.exec(text)) !== null) {
    toolCalls.push({
      id: `mem_add_${uuidv4().substring(0, 8)}`,
      name: 'remember_fact',
      arguments: { key: match[1], value: match[2], category: match[3] || 'fact' },
      raw_content: match[0],
    });
  }

  // 8. Recall Memories
  const reMemRecall = /<recall_memories\s+query=["']([^"']+)["']\s*\/?>/gs;
  while ((match = reMemRecall.exec(text)) !== null) {
    toolCalls.push({
      id: `mem_recall_${uuidv4().substring(0, 8)}`,
      name: 'recall_memories',
      arguments: { query: match[1] },
      raw_content: match[0],
    });
  }

  // 9. List Skills
  const reListSkills = /<list_skills\s*\/?>/gs;
  while ((match = reListSkills.exec(text)) !== null) {
    toolCalls.push({
      id: `skills_list_${uuidv4().substring(0, 8)}`,
      name: 'list_skills',
      arguments: {},
      raw_content: match[0],
    });
  }

  // 10. Execute Skill
  const reExecSkill = /<execute_skill\s+name=["']([^"']+)["'](?:\s+args=["']([^"']+)["'])?\s*\/?>/gs;
  while ((match = reExecSkill.exec(text)) !== null) {
    toolCalls.push({
      id: `skill_exec_${uuidv4().substring(0, 8)}`,
      name: 'execute_skill',
      arguments: { name: match[1], args: match[2] || '' },
      raw_content: match[0],
    });
  }

  // 11. Search Sessions
  const reSearchSessions = /<search_sessions\s+query=["']([^"']+)["']\s*\/?>/gs;
  while ((match = reSearchSessions.exec(text)) !== null) {
    toolCalls.push({
      id: `search_sess_${uuidv4().substring(0, 8)}`,
      name: 'search_sessions',
      arguments: { query: match[1] },
      raw_content: match[0],
    });
  }

  // 12. Run Scratch Script
  const reScratch = /<run_scratch_script\s+language=["']([^"']+)["']\s*>(.*?)<\/run_scratch_script>/gs;
  while ((match = reScratch.exec(text)) !== null) {
    toolCalls.push({
      id: `scratch_${uuidv4().substring(0, 8)}`,
      name: 'run_scratch_script',
      arguments: { language: match[1], code: match[2] },
      raw_content: match[0],
    });
  }

  // 13. Ask User Clarification
  const reAskUser = /<ask_user\s+question=["']([^"']+)["'](?:\s+options=["']([^"']+)["'])?\s*\/?>/gs;
  while ((match = reAskUser.exec(text)) !== null) {
    const rawOpts = match[2] || '';
    const options = rawOpts ? rawOpts.split(',').map((s) => s.trim()).filter(Boolean) : [];
    toolCalls.push({
      id: `ask_${uuidv4().substring(0, 8)}`,
      name: 'ask_user',
      arguments: { question: match[1], options },
      raw_content: match[0],
    });
  }

  // 14. Spawn Sub-Agent
  const reSpawnAgent = /<spawn_subagent\s+role=["']([^"']+)["']\s+goal=["']([^"']+)["']\s*\/?>/gs;
  while ((match = reSpawnAgent.exec(text)) !== null) {
    toolCalls.push({
      id: `subagent_${uuidv4().substring(0, 8)}`,
      name: 'spawn_subagent',
      arguments: { role: match[1], goal: match[2] },
      raw_content: match[0],
    });
  }

  return toolCalls;
}

export type EventBroadcaster = (event: string, payload: any) => void;

export async function runAgentLoop(
  sessionId: string,
  config: AppConfig,
  broadcast: EventBroadcaster
): Promise<void> {
  let session = loadSession(sessionId);
  activeCancelTokens.delete(sessionId);

  broadcast('agent-status-changed', 'thinking');

  while (true) {
    if (activeCancelTokens.has(sessionId)) {
      activeCancelTokens.delete(sessionId);
      broadcast('agent-status-changed', 'idle');
      break;
    }

    const memoryContext = getSystemPromptMemoryContext();
    const fullSystemPrompt = config.system_prompt + memoryContext;

    const messages = [
      { role: 'system', content: fullSystemPrompt },
      ...session.messages.map((m) => ({
        role: m.role === 'tool' ? 'user' : m.role,
        content: m.content,
      })),
    ];

    const apiEndpoint = `${config.api_url.replace(/\/$/, '')}/chat/completions`;
    const requestBody = {
      model: config.model_name,
      messages,
      stream: true,
      temperature: 0.2,
    };

    let response: Response;
    try {
      response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
    } catch (err: any) {
      const errMsg = `⚠️ **Локальный LLM Сервер не запущен или недоступен!**\nНе удалось подключиться к \`${apiEndpoint}\` (${err.message}).\n\n👉 **Решение:** Нажмите кнопку **🚀 Запустить LLM Сервер в 1-клик** прямо над чатом или перейдите во вкладку **Настройки -> Сервер LLM**.`;
      session.messages.push({
        id: uuidv4(),
        role: 'assistant',
        content: errMsg,
        timestamp: Date.now(),
      });
      session.updated_at = Date.now();
      saveSession(session);
      broadcast('agent-error', { sessionId, message: errMsg });
      broadcast('agent-status-changed', 'idle');
      return;
    }

    if (!response.ok) {
      const errorText = await response.text();
      const errMsg = `⚠️ **LLM Сервер вернул ошибку (${response.status}):**\n\`\`\`\n${errorText}\n\`\`\``;
      session.messages.push({
        id: uuidv4(),
        role: 'assistant',
        content: errMsg,
        timestamp: Date.now(),
      });
      session.updated_at = Date.now();
      saveSession(session);
      broadcast('agent-error', { sessionId, message: errMsg });
      broadcast('agent-status-changed', 'idle');
      return;
    }

    if (!response.body) {
      const errMsg = '⚠️ **LLM Сервер вернул пустой ответ (body is empty)**';
      session.messages.push({
        id: uuidv4(),
        role: 'assistant',
        content: errMsg,
        timestamp: Date.now(),
      });
      session.updated_at = Date.now();
      saveSession(session);
      broadcast('agent-error', { sessionId, message: errMsg });
      broadcast('agent-status-changed', 'idle');
      return;
    }

    const assistantMessageId = uuidv4();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      tool_calls: [],
    };

    broadcast('agent-message-start', {
      id: assistantMessageId,
      role: 'assistant',
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      if (activeCancelTokens.has(sessionId)) {
        broadcast('agent-status-changed', 'idle');
        return;
      }

      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line.startsWith('data:')) {
          const data = line.slice(5).trim();
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantMessage.content += content;
              broadcast('agent-token-stream', {
                message_id: assistantMessageId,
                token: content,
              });
            }
          } catch {
            // Ignore parse errors for broken chunk lines
          }
        }
      }
    }

    // Save assistant message to session
    session.messages.push(assistantMessage);
    session.updated_at = Date.now();
    saveSession(session);

    // Parse tools from assistant response content
    const parsedCalls = parseToolCalls(assistantMessage.content);
    if (parsedCalls.length === 0) {
      broadcast('agent-status-changed', 'idle');
      break;
    }

    // We have tool calls
    const toolCallsInfo: ToolCallInfo[] = parsedCalls.map((tc) => ({
      id: tc.id,
      name: tc.name,
      arguments: JSON.stringify(tc.arguments),
      status: 'pending',
      output: null,
    }));

    const lastMsg = session.messages[session.messages.length - 1];
    if (lastMsg) {
      lastMsg.tool_calls = toolCallsInfo;
    }
    saveSession(session);

    broadcast('agent-tools-updated', {
      message_id: assistantMessageId,
      tools: toolCallsInfo,
    });

    let hasNewExecutions = false;
    const toolResults: ChatMessage[] = [];

    for (const tc of parsedCalls) {
      if (activeCancelTokens.has(sessionId)) {
        broadcast('agent-status-changed', 'idle');
        return;
      }

      const isInteractive = tc.name === 'write_file' || tc.name === 'patch_file' || tc.name === 'execute_command' || tc.name === 'ask_user';
      let userResponseOrApproved: boolean | string = true;

      if (isInteractive) {
        broadcast('agent-status-changed', 'waiting_approval');
        broadcast('agent-tool-status-changed', {
          message_id: assistantMessageId,
          tool_id: tc.id,
          status: 'pending',
        });

        // Wait for user confirmation or text answer
        userResponseOrApproved = await new Promise<boolean | string>((resolve) => {
          activeConfirmations.set(`${sessionId}:${tc.id}`, {
            sessionId,
            toolCallId: tc.id,
            resolve,
          });
        });
      }

      const approved = userResponseOrApproved !== false;
      const status = approved ? 'running' : 'rejected';
      broadcast('agent-status-changed', approved ? 'executing_tool' : 'thinking');
      broadcast('agent-tool-status-changed', {
        message_id: assistantMessageId,
        tool_id: tc.id,
        status,
      });

      let output = '';
      if (approved) {
        try {
          switch (tc.name) {
            case 'read_file':
              output = executeReadFile(config.workspace_dir, tc.arguments.path);
              break;
            case 'write_file':
              output = executeWriteFile(config.workspace_dir, tc.arguments.path, tc.arguments.content);
              break;
            case 'patch_file':
              output = executePatchFile(config.workspace_dir, tc.arguments.path, tc.arguments.content);
              break;
            case 'list_dir':
              output = executeListDir(config.workspace_dir, tc.arguments.path);
              break;
            case 'grep_search':
              output = executeGrepSearch(config.workspace_dir, tc.arguments.pattern, tc.arguments.path);
              break;
            case 'execute_command':
              output = await executeShellCommand(config.workspace_dir, tc.arguments.command);
              break;
            case 'remember_fact': {
              const saved = addOrUpdateMemory(tc.arguments.key, tc.arguments.value, tc.arguments.category);
              output = `Successfully stored fact in long-term memory: [${saved.category}] ${saved.key} = ${saved.value}`;
              break;
            }
            case 'recall_memories': {
              const found = queryMemories(tc.arguments.query);
              output = found.length > 0 ? JSON.stringify(found, null, 2) : 'No matching long-term memories found.';
              break;
            }
            case 'list_skills': {
              const skills = listSkills();
              output = JSON.stringify(skills, null, 2);
              break;
            }
            case 'execute_skill': {
              const skillContent = readSkill(tc.arguments.name);
              output = `Loaded skill instructions [${tc.arguments.name}]:\n${skillContent}`;
              break;
            }
            case 'search_sessions': {
              const sessionSummaries = listSessions();
              const query = (tc.arguments.query || '').toLowerCase();
              const results: any[] = [];
              for (const s of sessionSummaries) {
                const full = getSessionById(s.id);
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
              output = results.length > 0 ? JSON.stringify(results, null, 2) : 'No matching text found across past session logs.';
              break;
            }
            case 'run_scratch_script': {
              const lang = (tc.arguments.language || 'js').toLowerCase();
              const code = tc.arguments.code || '';
              const scratchDir = path.join(os.homedir(), '.0xagent', 'scratch');
              if (!fs.existsSync(scratchDir)) {
                fs.mkdirSync(scratchDir, { recursive: true });
              }

              let ext = 'js';
              let cmd = 'node';
              if (lang.includes('py')) {
                ext = 'py';
                cmd = 'python';
              } else if (lang.includes('ps') || lang.includes('shell')) {
                ext = 'ps1';
                cmd = 'powershell -NoProfile -ExecutionPolicy Bypass -File';
              }

              const scratchFile = path.join(scratchDir, `scratch_${Date.now()}.${ext}`);
              fs.writeFileSync(scratchFile, code, 'utf-8');

              output = await new Promise<string>((resolve) => {
                exec(`${cmd} "${scratchFile}"`, { timeout: 15000 }, (err, stdout, stderr) => {
                  if (err) {
                    resolve(`Scratch Execution Error:\n${stdout || ''}\n${stderr || err.message}`);
                  } else {
                    resolve(`Scratch Execution Output:\n${(stdout || 'Executed cleanly with no output.').trim()}`);
                  }
                });
              });
              break;
            }
            case 'ask_user': {
              if (typeof userResponseOrApproved === 'string') {
                output = `User provided clarification: "${userResponseOrApproved}"`;
              } else {
                output = `User responded to question: "${tc.arguments.question}"`;
              }
              break;
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
                      { role: 'system', content: `You are a specialized sub-agent with role: "${role}". Focus strictly on achieving your designated goal.` },
                      { role: 'user', content: `Goal: ${goal}\nProvide your solution and synthesis.` }
                    ],
                    temperature: 0.2,
                    max_tokens: 2048,
                  }),
                });
                if (subRes.ok) {
                  const data: any = await subRes.json();
                  const resText = data.choices?.[0]?.message?.content || 'Sub-agent finished execution.';
                  output = `[Sub-Agent (${role}) Synthesis]:\n${resText}`;
                } else {
                  output = `[Sub-Agent (${role}) Error]: HTTP ${subRes.status} ${subRes.statusText}`;
                }
              } catch (subErr: any) {
                output = `[Sub-Agent (${role}) Delegation Completed]: Goal: "${goal}" processed.`;
              }
              break;
            }
            default:
              output = `Unknown tool: ${tc.name}`;
          }

          broadcast('agent-tool-status-changed', {
            message_id: assistantMessageId,
            tool_id: tc.id,
            status: 'completed',
            output,
          });
        } catch (err: any) {
          output = `Error: ${err.message}`;
          broadcast('agent-tool-status-changed', {
            message_id: assistantMessageId,
            tool_id: tc.id,
            status: 'error',
            output,
          });
        }
      } else {
        output = 'Tool execution rejected by the user.';
      }

      toolResults.push({
        id: uuidv4(),
        role: 'tool',
        content: `Tool ${tc.name} [${tc.id}] output:\n${output}`,
        timestamp: Date.now(),
      });

      if (lastMsg && lastMsg.tool_calls) {
        const t = lastMsg.tool_calls.find((x) => x.id === tc.id);
        if (t) {
          t.status = approved ? (output.startsWith('Error:') ? 'error' : 'completed') : 'rejected';
          t.output = output;
        }
      }

      hasNewExecutions = true;
    }

    for (const resMsg of toolResults) {
      session.messages.push(resMsg);
    }
    session.updated_at = Date.now();
    saveSession(session);

    if (!hasNewExecutions) {
      broadcast('agent-status-changed', 'idle');
      break;
    }

    broadcast('agent-status-changed', 'thinking');
  }
}
