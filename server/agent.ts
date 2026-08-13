import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { v4 as uuidv4 } from 'uuid';
import { AppConfig, ChatMessage, ToolCallInfo } from '../src/types';
import { loadSession, saveSession, listSessions } from './session';
import {
  executeReadFile,
  executeWriteFile,
  executePatchFile,
  executeListDir,
  executeGrepSearch,
  executeShellCommand,
  executeCreateDirectory,
  executeGetFileInfo,
  executeFffSearch,
  executeWebSearch,
  executeReadWebPage,
  getWorkspace0xAgentMdContext,
} from './tools';
import { addOrUpdateMemory, queryMemories, getSystemPromptMemoryContext } from './memory';
import { listSkills, readSkill } from './skills';
import { getActivePersona, appendSilentUserTrait, getUnifiedToolsContext } from './personas';
import { summarizeContext, estimatePromptTokens } from './summarizer';

// 0xVoice2Text Model Configuration Stack & Fallback Chain
export const PRIMARY_TEXT_MODEL = 'gemini-3.6-flash';
export const GEMMA_MODEL = 'gemma-4-31b-it';
export const FAST_LITE_MODEL = 'gemini-3.5-flash-lite';
export const NATIVE_AUDIO_MODEL = 'gemini-2.5-flash-preview-tts';

export const FALLBACK_CHAIN: string[] = [
  'gemini-3.6-flash',
  'gemma-4-31b-it',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
];

import { strip_ai_reasoning_fluff, stripToolCallTags } from './agent/fluffSanitizer';
import { pruneMessagesForContext, detectRepetitionLoop } from './agent/contextManager';
import { parseToolCalls } from './agent/toolParser';
import {
  PendingConfirmation,
  activeConfirmations,
  activeCancelTokens,
  activeRunningLoops,
  handleAgentError,
  respondToToolConfirmation,
  cancelAgentSession,
} from './agent/agentState';

export { strip_ai_reasoning_fluff, handleAgentError, respondToToolConfirmation, cancelAgentSession };
export type { PendingConfirmation };



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

    broadcast('agent-status-changed', { sessionId, status: 'thinking' });
    let loopRetryCount = 0;

  while (true) {
    if (activeCancelTokens.has(sessionId)) {
      activeCancelTokens.delete(sessionId);
      broadcast('agent-status-changed', { sessionId, status: 'idle' });
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

## USER.md — USER PROFILE & OBSERVED TRAITS (${activePersona.metadata.user_id})
${activePersona.user}`;

    const toolExecutionDirective = `\n\n# ⚠️ CRITICAL INSTRUCTIONS FOR TOOL EXECUTION & CODE MODIFICATIONS
1. EXPLANATION FIRST: Always write a brief natural language explanation of your diagnosis and intended changes BEFORE emitting XML tool calls.
2. MANDATORY PATCH FIRST POLICY: ALWAYS use <patch_file> for modifying existing codebase files. NEVER use <write_file> to rewrite an entire file (>50 lines) just to change a few components or lines!
3. MULTI-BLOCK PATCHES: You can place MULTIPLE SEARCH/REPLACE blocks inside a single <patch_file path="..."> tag to modify multiple places at once. Keep SEARCH blocks concise and unique (3-8 lines).
4. NO RAW CODE PATCH LEAKS: NEVER output raw SEARCH/REPLACE blocks outside of <patch_file path="..."> tags.
5. PROPER XML TAGS: Always close every XML tool call tag (<patch_file path="...">...</patch_file>). Reserve <write_file> strictly for creating new files or tiny config files under 50 lines.`;

    // Detect Gemma 4 model for specialized prompting
    const modelNameLower = (config.model_name || '').toLowerCase();
    const modelPathLower = (config.local_server?.model_path || '').toLowerCase();
    const isGemmaModel = modelNameLower.includes('gemma') || modelPathLower.includes('gemma');

    const gemmaToolDirective = isGemmaModel ? `\n\n# 🔧 ALTERNATIVE TOOL CALL FORMAT (Gemma 4)
You may also call tools using JSON format wrapped in <tool_call> tags:
<tool_call>{"name": "read_file", "arguments": {"path": "src/main.ts"}}</tool_call>
<tool_call>{"name": "write_file", "arguments": {"path": "src/main.ts", "content": "file contents here"}}</tool_call>
<tool_call>{"name": "execute_command", "arguments": {"command": "npm run build"}}</tool_call>
<tool_call>{"name": "list_dir", "arguments": {"path": "."}}</tool_call>
<tool_call>{"name": "grep_search", "arguments": {"pattern": "TODO", "path": "src/"}}</tool_call>
<tool_call>{"name": "patch_file", "arguments": {"path": "file.ts", "content": "<<<<<<< SEARCH\nold code\n=======\nnew code\n>>>>>>> REPLACE"}}</tool_call>
Both XML and JSON tool call formats are accepted.` : '';

    const unifiedToolsContext = getUnifiedToolsContext();
    const workspaceMdContext = getWorkspace0xAgentMdContext(config.workspace_dir);
    const fullSystemPrompt = personaContext + unifiedToolsContext + toolExecutionDirective + gemmaToolDirective + envContext + planningContext + memoryContext + workspaceMdContext;

    const formatMessageContent = (m: ChatMessage): string | any[] => {
      if (Array.isArray(m.images) && m.images.length > 0) {
        const parts: any[] = [];
        if (m.content) {
          parts.push({ type: 'text', text: m.content });
        } else {
          parts.push({ type: 'text', text: 'Посмотри на изображение и проанализируй его.' });
        }
        for (const imgUrl of m.images) {
          parts.push({
            type: 'image_url',
            image_url: { url: imgUrl },
          });
        }
        return parts;
      }
      return m.content;
    };

    const rawMessages: { role: string; content: string | any[] }[] = [
      { role: 'system', content: fullSystemPrompt },
      ...session.messages.map((m) => ({
        role: m.role === 'tool' ? 'user' : m.role,
        content: formatMessageContent(m),
      })),
    ];

    const contextMax = config.local_server?.ctx_size || config.max_tokens || 16384;
    const estPromptTokens = estimatePromptTokens(rawMessages);

    let messages: { role: string; content: string | any[] }[] = rawMessages;
    if (estPromptTokens > Math.floor(contextMax * 0.75) && session.messages.length > 6) {
      console.log(`[agent] Context size (${estPromptTokens} tokens) exceeded 75% threshold (${contextMax}). Invoking LLM summarizer...`);
      try {
        const tailCount = 4;
        const msgsToSummarize = session.messages.slice(0, Math.max(1, session.messages.length - tailCount));
        const tailMsgs = session.messages.slice(session.messages.length - tailCount);

        const summaryText = await summarizeContext(msgsToSummarize, config, broadcast);

        session.messages = [
          {
            id: uuidv4(),
            role: 'user',
            content: `[СВОДКА ПРЕДЫДУЩЕЙ ЧАСТИ ДИАЛОГА]:\n${summaryText}`,
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
            content: formatMessageContent(m),
          })),
        ];
      } catch (sumErr) {
        console.error('LLM context summarization failed, falling back to basic pruning:', sumErr);
        messages = pruneMessagesForContext(rawMessages, contextMax);
      }
    } else {
      messages = pruneMessagesForContext(rawMessages, contextMax);
    }

    const selectedModel = config.model_name || PRIMARY_TEXT_MODEL;
    const isLocalModel = selectedModel.startsWith('local:') || selectedModel.endsWith('.gguf') || config.api_url.includes('127.0.0.1') || config.api_url.includes('localhost');

    let response: Response | null = null;
    let activeModelName = selectedModel;
    let lastErrorText = '';
    let lastStatusCode = 500;

    if (isLocalModel && (selectedModel.startsWith('local:') || selectedModel.endsWith('.gguf'))) {
      // Route local model to llama.cpp local server
      const localHost = config.local_server?.host || '127.0.0.1';
      const localPort = config.local_server?.port || 11434;
      const apiEndpoint = `http://${localHost}:${localPort}/v1/chat/completions`;
      const requestBody: any = {
        model: selectedModel.replace(/^local:/, ''),
        messages,
        stream: true,
        temperature: loopRetryCount > 0 ? 0.7 : (config.temperature ?? 0.2),
        frequency_penalty: loopRetryCount > 0 ? 0.5 : (config.local_server?.frequency_penalty ?? 0.3),
        presence_penalty: config.local_server?.presence_penalty ?? 0.1,
      };

      let attempts = 0;
      const maxAttempts = 6;
      while (attempts < maxAttempts) {
        attempts++;
        try {
          response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          });
          if (response.status === 503 && attempts < maxAttempts) {
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
          handleAgentError(session, sessionId, broadcast, errMsg);
          return;
        }
      }
    } else {
      const apiKey = config.gemini_api_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || config.groq_api_key || '';
      
      if (!apiKey && !selectedModel.includes('localhost') && !selectedModel.includes('127.0.0.1')) {
        const errMsg = `⚠️ **Google AI Studio API Key не задан!**\nДля использования облачной модели \`${selectedModel}\` требуется API ключ Google AI Studio.\n\n👉 **Решение:** Укажите Ваш **GEMINI_API_KEY** в **Настройках (Сервер LLM / Облачные модели)** или в переменной окружения.`;
        handleAgentError(session, sessionId, broadcast, errMsg);
        return;
      }

      const modelCandidates = [selectedModel];
      for (const m of FALLBACK_CHAIN) {
        if (!modelCandidates.includes(m)) modelCandidates.push(m);
      }

      const cloudEndpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

      for (const candidateModel of modelCandidates) {
        activeModelName = candidateModel;
        const requestBody: any = {
          model: candidateModel,
          messages,
          stream: true,
          temperature: loopRetryCount > 0 ? 0.7 : (config.temperature ?? 0.2),
          max_tokens: config.max_tokens ?? 8192,
        };

        try {
          let res = await fetch(cloudEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(requestBody),
          });

          // HTTP 400 Fallback (for models/endpoints not supporting systemInstruction)
          if (res.status === 400) {
            console.warn(`[agent] Model ${candidateModel} returned 400 (possible systemInstruction issue). Retrying without system instruction...`);
            const strippedMessages = messages.filter((m) => m.role !== 'system');
            const fallbackBody = { ...requestBody, messages: strippedMessages };
            const retryRes = await fetch(cloudEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
              },
              body: JSON.stringify(fallbackBody),
            });
            if (retryRes.ok) {
              res = retryRes;
            }
          }

          if (res.ok) {
            response = res;
            break;
          } else {
            lastStatusCode = res.status;
            lastErrorText = await res.text().catch(() => '');
            console.warn(`[agent] Cloud model ${candidateModel} failed (${res.status}): ${lastErrorText.substring(0, 200)}. Falling back to next model...`);
          }
        } catch (fetchErr: any) {
          lastErrorText = fetchErr.message;
          console.warn(`[agent] Cloud model ${candidateModel} network error: ${fetchErr.message}. Falling back...`);
        }
      }
    }

    if (!response || !response.ok) {
      const errMsg = `⚠️ **LLM Сервер вернул ошибку (${lastStatusCode}):**\n\`\`\`\n${lastErrorText || 'No response from LLM server / all fallback models exhausted'}\n\`\`\``;
      handleAgentError(session, sessionId, broadcast, errMsg);
      return;
    }


    if (!response.body) {
      const errMsg = '⚠️ **LLM Сервер вернул пустой ответ (body is empty)**';
      handleAgentError(session, sessionId, broadcast, errMsg);
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
      sessionId,
    });

    const genStartTime = Date.now();
    let tokenCount = 0;
    const estimatedPromptTokens = estimatePromptTokens(messages);
    const modelName = activeModelName || config.model_name || PRIMARY_TEXT_MODEL;

    const emitToken = (content: string) => {
      assistantMessage.content += content;
      tokenCount++;
      const elapsedSec = (Date.now() - genStartTime) / 1000;
      const tokensPerSec = elapsedSec > 0.1 ? Math.round((tokenCount / elapsedSec) * 10) / 10 : 0;
      const contextUsed = estimatedPromptTokens + tokenCount;

      broadcast('agent-token-stream', {
        sessionId,
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
        broadcast('agent-status-changed', { sessionId, status: 'idle' });
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

    // Sanitize assistant content from drafts, metadata headers, and LaTeX arrows
    assistantMessage.content = strip_ai_reasoning_fluff(assistantMessage.content);

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
      broadcast('agent-status-changed', { sessionId, status: 'idle' });
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
      lastMsg.content = stripToolCallTags(lastMsg.content);
    }
    saveSession(session);

    broadcast('agent-tools-updated', {
      sessionId,
      message_id: assistantMessageId,
      tools: toolCallsInfo,
    });

    let hasNewExecutions = false;
    const toolResults: ChatMessage[] = [];

    for (const tc of parsedCalls) {
      if (activeCancelTokens.has(sessionId)) {
        broadcast('agent-status-changed', { sessionId, status: 'idle' });
        return;
      }

      const isInteractive = tc.name === 'write_file' || tc.name === 'patch_file' || tc.name === 'execute_command' || tc.name === 'ask_user';
      let userResponseOrApproved: boolean | string = true;

      if (isInteractive) {
        broadcast('agent-status-changed', { sessionId, status: 'waiting_approval' });
        broadcast('agent-tool-status-changed', {
          sessionId,
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
      broadcast('agent-status-changed', { sessionId, status: approved ? 'executing_tool' : 'thinking' });
      broadcast('agent-tool-status-changed', {
        sessionId,
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
            case 'fff_search':
              output = await executeFffSearch(config.workspace_dir, tc.arguments.query || tc.arguments.pattern || '');
              break;
            case 'web_search':
              output = await executeWebSearch(tc.arguments.query || tc.arguments.pattern || '');
              break;
            case 'read_web_page':
              output = await executeReadWebPage(tc.arguments.url || tc.arguments.path || '');
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
                const full = loadSession(s.id);
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

              const ext = lang.includes('py') ? 'py' : (lang.includes('ps') || lang.includes('shell')) ? 'ps1' : 'js';
              const scratchFile = path.join(scratchDir, `scratch_${Date.now()}.${ext}`);
              fs.writeFileSync(scratchFile, code, 'utf-8');

              output = await new Promise<string>((resolve) => {
                const { execFile } = require('node:child_process');
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
                output = `[Sub-Agent (${role}) Error]: Не удалось выполнить под-агент: ${subErr.message}`;
              }
              break;
            }
            default:
              output = `Unknown tool: ${tc.name}`;
          }

          broadcast('agent-tool-status-changed', {
            sessionId,
            message_id: assistantMessageId,
            tool_id: tc.id,
            status: 'completed',
            output,
          });
        } catch (err: any) {
          output = `Error: ${err.message}\n\n[SYSTEM HINT TO AGENT]: The tool call returned an error. Analyze the error message above, use <read_file> if needed to inspect exact file lines, and try a corrected approach.`;
          broadcast('agent-tool-status-changed', {
            sessionId,
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
      broadcast('agent-status-changed', { sessionId, status: 'idle' });
      break;
    }

    broadcast('agent-status-changed', { sessionId, status: 'thinking' });
  }
  } finally {
    activeRunningLoops.delete(sessionId);
  }
}
