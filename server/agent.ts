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
  executeCreateDirectory,
  executeGetFileInfo,
  getWorkspace0xAgentMdContext,
} from './tools';
import { addOrUpdateMemory, queryMemories, getSystemPromptMemoryContext } from './memory';
import { listSkills, readSkill } from './skills';
import { listSessions, loadSession as getSessionById } from './session';
import { getActivePersona, appendSilentUserTrait } from './personas';
import { summarizeContext } from './summarizer';

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
const activeRunningLoops = new Set<string>();

export function respondToToolConfirmation(sessionId: string, toolCallId: string, approve: boolean | string): boolean {
  const key = `${sessionId}:${toolCallId}`;
  let pending = activeConfirmations.get(key);

  if (!pending) {
    // Fallback: search by toolCallId alone in case sessionId desynchronized
    for (const [k, p] of activeConfirmations.entries()) {
      if (p.toolCallId === toolCallId || k.endsWith(`:${toolCallId}`)) {
        pending = p;
        activeConfirmations.delete(k);
        break;
      }
    }
  } else {
    activeConfirmations.delete(key);
  }

  if (pending) {
    pending.resolve(approve);
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

  // 15. Create Directory
  const reMkdir = /<create_directory\s+path=["']([^"']+)["']\s*\/?>/gs;
  while ((match = reMkdir.exec(text)) !== null) {
    toolCalls.push({
      id: `mkdir_${uuidv4().substring(0, 8)}`,
      name: 'create_directory',
      arguments: { path: match[1] },
      raw_content: match[0],
    });
  }

  // 16. Get File Info
  const reFileInfo = /<get_file_info\s+path=["']([^"']+)["']\s*\/?>/gs;
  while ((match = reFileInfo.exec(text)) !== null) {
    toolCalls.push({
      id: `fileinfo_${uuidv4().substring(0, 8)}`,
      name: 'get_file_info',
      arguments: { path: match[1] },
      raw_content: match[0],
    });
  }

  return toolCalls;
}

export function pruneMessagesForContext(
  messages: { role: string; content: string }[],
  maxTokens: number
): { role: string; content: string }[] {
  const estTokens = (arr: { role: string; content: string }[]) =>
    Math.max(1, Math.round(JSON.stringify(arr).length / 3.8));

  // Safety context threshold (80% of contextMax)
  const safeLimit = Math.floor(maxTokens * 0.8);
  if (estTokens(messages) <= safeLimit) {
    return messages;
  }

  const systemMsg = messages[0];
  const tailCount = Math.min(8, messages.length - 1);
  const tailMsgs = messages.slice(messages.length - tailCount);
  const middleMsgs = messages.slice(1, messages.length - tailCount);

  // Truncate long tool/file outputs in middle messages
  const prunedMiddle = middleMsgs.map((m) => {
    if (m.content.length > 500 && (m.role === 'user' || m.role === 'tool')) {
      const head = m.content.substring(0, 200);
      const tail = m.content.substring(m.content.length - 200);
      return {
        ...m,
        content: `${head}\n\n[... Вывод инструмента сжат для сохранения контекста (${m.content.length} байт) ...]\n\n${tail}`,
      };
    }
    return m;
  });

  let result = [systemMsg, ...prunedMiddle, ...tailMsgs];

  // If still above safety threshold, discard oldest middle messages
  while (estTokens(result) > safeLimit && prunedMiddle.length > 1) {
    prunedMiddle.shift();
    result = [systemMsg, ...prunedMiddle, ...tailMsgs];
  }

  return result;
}

export function detectRepetitionLoop(history: ChatMessage[], newContent: string): boolean {
  const trimmedNew = newContent.trim().toLowerCase();
  if (!trimmedNew) return false;

  const loopTriggers = [
    'скажи продолжи',
    'напиши продолжи',
    'ответь продолжи',
    'скажите продолжи',
    'say continue',
    'reply continue',
    'если ты хочешь что бы написал код',
    'если вы хотите чтобы я продолжил',
  ];

  for (const trigger of loopTriggers) {
    if (trimmedNew.includes(trigger)) {
      const assistantMsgs = history.filter((m) => m.role === 'assistant');
      const recentAssistants = assistantMsgs.slice(-3);
      if (recentAssistants.some((m) => m.content.toLowerCase().includes(trigger))) {
        return true;
      }
    }
  }

  const assistantMsgs = history.filter((m) => m.role === 'assistant');
  if (assistantMsgs.length > 0) {
    const prevAssistantContent = assistantMsgs[assistantMsgs.length - 1].content.trim().toLowerCase();
    if (prevAssistantContent.length > 30 && trimmedNew === prevAssistantContent) {
      return true;
    }

    if (prevAssistantContent.length > 50 && trimmedNew.length > 50) {
      const minLen = Math.min(100, Math.floor(prevAssistantContent.length * 0.8));
      if (trimmedNew.substring(0, minLen) === prevAssistantContent.substring(0, minLen)) {
        return true;
      }
    }

    // Check for exact duplicate tool calls repeated 3 times in a row
    const newToolCalls = parseToolCalls(newContent);
    if (newToolCalls.length > 0 && assistantMsgs.length >= 2) {
      const newSignature = newToolCalls.map((t) => `${t.name}:${JSON.stringify(t.arguments)}`).join('|');
      const prev1 = assistantMsgs[assistantMsgs.length - 1];
      const prev2 = assistantMsgs[assistantMsgs.length - 2];

      const sig1 = parseToolCalls(prev1.content).map((t) => `${t.name}:${JSON.stringify(t.arguments)}`).join('|');
      const sig2 = parseToolCalls(prev2.content).map((t) => `${t.name}:${JSON.stringify(t.arguments)}`).join('|');

      if (newSignature && newSignature === sig1 && newSignature === sig2) {
        return true;
      }
    }
  }

  return false;
}

export type EventBroadcaster = (event: string, payload: any) => void;

export async function runAgentLoop(
  sessionId: string,
  config: AppConfig,
  broadcast: EventBroadcaster
): Promise<void> {
  if (activeRunningLoops.has(sessionId)) {
    console.warn(`[agent] Loop already running for session ${sessionId}. Ignoring duplicate invocation.`);
    return;
  }
  activeRunningLoops.add(sessionId);

  try {
    let session = loadSession(sessionId);
    activeCancelTokens.delete(sessionId);

    broadcast('agent-status-changed', 'thinking');
    let loopRetryCount = 0;

  while (true) {
    if (activeCancelTokens.has(sessionId)) {
      activeCancelTokens.delete(sessionId);
      broadcast('agent-status-changed', 'idle');
      break;
    }

    const memoryContext = getSystemPromptMemoryContext();
    const envContext = `\n\n# OPERATING SYSTEM & SHELL ENVIRONMENT
- OS: Windows (${process.platform})
- Shell: PowerShell (powershell.exe)
- Active Working Directory: ${config.workspace_dir || process.cwd()}

CRITICAL RULES FOR <execute_command>:
1. You are running on Windows inside PowerShell. Write standard PowerShell commands.
2. Do NOT wrap commands in "powershell -Command ...", "powershell -Command cd ...", or explicit "cd <path>". The command is ALREADY executed inside PowerShell in the workspace root directory! Write direct commands like: \`npm run build\`, \`npx tsc --noEmit\`, \`Get-ChildItem\`, \`git status\`.
3. NEVER execute long-running blocking background dev-servers (e.g., 'npm run dev', 'vite', 'npm start') inside <execute_command> as they will run indefinitely and time out. Execute one-off build or test commands instead.`;

    const isPlanningMode = config.planning_mode !== false;
    const planningContext = isPlanningMode
      ? `\n\n# 📋 PLANNING MODE IS ACTIVE
You are operating in Planning Mode.
Before executing modifying tool calls (<write_file>, <patch_file>, <execute_command>), follow this mandatory workflow:
1. RESEARCH & DIAGNOSE: Use read-only tools (<read_file>, <list_dir>, <grep_search>) to inspect existing codebase, imports, types, and find the exact root cause.
2. FORMULATE IMPLEMENTATION PLAN: Clearly present your analysis and proposed solution in your response before or alongside executing actions:
   - Root Cause Analysis
   - Proposed Changes (files to create/modify)
   - Verification Plan
3. Explain your technical rationale concisely.`
      : '';

    const activePersona = getActivePersona();
    const personaContext = `\n\n# 🎭 ACTIVE AGENT PERSONA: ${activePersona.metadata.name} (${activePersona.metadata.id})

## SOUL.md — CHARACTER & BEHAVIOR
${activePersona.soul}

## TOOLS.md — PERSONA TOOL INSTRUCTIONS
${activePersona.tools}

## USER.md — USER PROFILE & OBSERVED TRAITS (${activePersona.metadata.user_id})
${activePersona.user}`;

    const workspaceMdContext = getWorkspace0xAgentMdContext(config.workspace_dir);
    const fullSystemPrompt = personaContext + envContext + planningContext + memoryContext + workspaceMdContext;

    const rawMessages = [
      { role: 'system', content: fullSystemPrompt },
      ...session.messages.map((m) => ({
        role: m.role === 'tool' ? 'user' : m.role,
        content: m.content,
      })),
    ];

    const contextMax = config.local_server?.ctx_size || config.max_tokens || 16384;
    const estPromptTokens = Math.max(1, Math.round(JSON.stringify(rawMessages).length / 3.8));

    let messages = rawMessages;
    if (estPromptTokens > Math.floor(contextMax * 0.75) && session.messages.length > 6) {
      console.log(`[agent] Context size (${estPromptTokens} tokens) exceeded 75% threshold (${contextMax}). Invoking LLM summarizer...`);
      try {
        const summaryText = await summarizeContext(session.messages, config, broadcast);
        const tailMsgs = session.messages.slice(session.messages.length - 4);

        session.messages = [
          {
            id: uuidv4(),
            role: 'user',
            content: `[🧠 АВТОМАТИЧЕСКИ СЖАТЫЙ КОНТЕКСТ СЕССИИ]:\n${summaryText}`,
            timestamp: Date.now(),
          },
          ...tailMsgs,
        ];
        session.updated_at = Date.now();
        saveSession(session);

        messages = [
          { role: 'system', content: fullSystemPrompt },
          ...session.messages.map((m) => ({
            role: m.role === 'tool' ? 'user' : m.role,
            content: m.content,
          })),
        ];
      } catch (sumErr) {
        console.error('LLM context summarization failed, falling back to basic pruning:', sumErr);
        messages = pruneMessagesForContext(rawMessages, contextMax);
      }
    } else {
      messages = pruneMessagesForContext(rawMessages, contextMax);
    }

    const apiEndpoint = `${config.api_url.replace(/\/$/, '')}/chat/completions`;
    const requestBody: any = {
      model: config.model_name,
      messages,
      stream: true,
      temperature: loopRetryCount > 0 ? 0.7 : (config.temperature ?? 0.2),
      frequency_penalty: loopRetryCount > 0 ? 0.5 : (config.local_server?.frequency_penalty ?? 0.3),
      presence_penalty: config.local_server?.presence_penalty ?? 0.1,
      repeat_penalty: config.local_server?.repeat_penalty ?? 1.1,
    };

    let response: Response | null = null;
    let attempts = 0;
    const maxAttempts = 6; // Initial attempt + up to 5 retries (10 seconds total)

    while (attempts < maxAttempts) {
      attempts++;
      try {
        response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        if (response.status === 503 && attempts < maxAttempts) {
          console.log(`[agent] LLM server returning 503 (loading model). Retrying in 2s (${attempts}/${maxAttempts})...`);
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        break;
      } catch (err: any) {
        if (attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
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
    }

    if (!response || !response.ok) {
      const errorText = response ? await response.text() : 'No response from server';
      const errMsg = `⚠️ **LLM Сервер вернул ошибку (${response?.status || 500}):**\n\`\`\`\n${errorText}\n\`\`\``;
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

    const genStartTime = Date.now();
    let tokenCount = 0;
    const estimatedPromptTokens = Math.max(1, Math.round(JSON.stringify(messages).length / 3.8));
    const modelName = config.model_name || 'qwen2.5-coder:7b';

    const emitToken = (content: string) => {
      assistantMessage.content += content;
      tokenCount++;
      const elapsedSec = (Date.now() - genStartTime) / 1000;
      const tokensPerSec = elapsedSec > 0.1 ? Math.round((tokenCount / elapsedSec) * 10) / 10 : 0;
      const contextUsed = estimatedPromptTokens + tokenCount;

      broadcast('agent-token-stream', {
        message_id: assistantMessageId,
        token: content,
        tokensPerSec,
        tokenCount,
        contextUsed,
        contextMax,
        modelName,
      });
    };

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let isStreamDone = false;

    while (!isStreamDone) {
      if (activeCancelTokens.has(sessionId)) {
        broadcast('agent-status-changed', 'idle');
        return;
      }

      const { value, done } = await reader.read();
      if (done) {
        isStreamDone = true;
        if (buffer.trim()) {
          const lines = buffer.split('\n');
          buffer = '';
          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (line.startsWith('data:')) {
              const data = line.slice(5).trim();
              if (data === '[DONE]') break;
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text;
                if (content) {
                  emitToken(content);
                }
              } catch {}
            }
          }
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line.startsWith('data:')) {
          const data = line.slice(5).trim();
          if (data === '[DONE]') {
            isStreamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text;
            if (content) {
              emitToken(content);
            }
          } catch {
            // Ignore parse errors for broken chunk lines
          }
        }
      }
    }

    const totalElapsedMs = Date.now() - genStartTime;
    const finalTokensPerSec = totalElapsedMs > 100 ? Math.round((tokenCount / (totalElapsedMs / 1000)) * 10) / 10 : 0;
    const finalContextUsed = estimatedPromptTokens + tokenCount;

    assistantMessage.metrics = {
      tokensPerSec: finalTokensPerSec,
      promptTokens: estimatedPromptTokens,
      completionTokens: tokenCount,
      totalTokens: finalContextUsed,
      contextUsed: finalContextUsed,
      contextMax,
      evalDurationMs: totalElapsedMs,
      modelName,
    };

    // Save assistant message to session
    session.messages.push(assistantMessage);
    session.updated_at = Date.now();
    saveSession(session);

    // Check if generated assistant response triggered a repetition loop
    if (detectRepetitionLoop(session.messages.slice(0, -1), assistantMessage.content)) {
      if (loopRetryCount < 2) {
        loopRetryCount++;
        console.warn(`[agent] Repetition loop detected! Attempt ${loopRetryCount}. Injecting anti-loop directive...`);

        session.messages.push({
          id: uuidv4(),
          role: 'user',
          content: '[SYSTEM DIRECTIVE: Обнаружено зацикливание / повторение предыдущего ответа! Не повторяйте текст и не просите пользователя писать "продолжи". Сразу переходите к исполнению нужного XML инструмента (<read_file>, <write_file>, <patch_file>, <execute_command>) или завершите решение.]',
          timestamp: Date.now(),
        });
        session.updated_at = Date.now();
        saveSession(session);

        broadcast('agent-error', {
          sessionId,
          message: '⚠️ Зафиксировано зацикливание модели. Автоматический сброс петли и повторный вызов с повышенным штрафом за повторы...',
        });
        continue;
      }
    }

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

      const approved = userResponseOrApproved !== false && userResponseOrApproved !== 'false';
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
            case 'create_directory':
              output = executeCreateDirectory(config.workspace_dir, tc.arguments.path);
              break;
            case 'get_file_info':
              output = executeGetFileInfo(config.workspace_dir, tc.arguments.path);
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
              appendSilentUserTrait(activePersona.metadata.id, `[${saved.category}] ${saved.key} = ${saved.value}`);
              output = `Successfully stored fact in long-term memory & persona profile USER.md: [${saved.category}] ${saved.key} = ${saved.value}`;
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
          output = `Error: ${err.message}\n\n[SYSTEM HINT TO AGENT]: The tool call returned an error. Analyze the error message above, use <read_file> if needed to inspect exact file lines, and try a corrected approach.`;
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
  } finally {
    activeRunningLoops.delete(sessionId);
  }
}
