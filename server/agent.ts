import { v4 as uuidv4 } from 'uuid';
import { AppConfig, ChatMessage, ToolCallInfo } from '../src/types';
import { loadSession, saveSession } from './session';
import { estimatePromptTokens } from './summarizer';

// 0xVoice2Text Model Configuration Stack & Fallback Chain
export const PRIMARY_TEXT_MODEL = 'gemini-3.6-flash';
export const GEMMA_MODEL = 'gemma-4-31b-it';
export const FAST_LITE_MODEL = 'gemini-3.5-flash-lite';
export const NATIVE_AUDIO_MODEL = 'gemini-2.5-flash-preview-tts';

export const DEFAULT_FALLBACK_CHAIN: string[] = [
  'gemini-3.6-flash',
  'gemma-4-31b-it',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
];

import { strip_ai_reasoning_fluff, stripToolCallTags } from './agent/fluffSanitizer';
import { detectRepetitionLoop } from './agent/contextManager';
import { buildFullSystemPrompt } from './agent/promptBuilder';
import { dispatchToolExecution } from './agent/toolDispatcher';
import { parseToolCalls, detectToolOutputHallucination, stripHallucinatedToolOutput } from './agent/toolParser';
import { loopBreaker } from './agent/loopBreaker';
import { handleOutputSpill } from './agent/outputSpiller';
import { evaluateToolPermission } from './agent/permissionGuard';
import { runCompactionPipeline } from './agent/compactionPipeline';
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
    let session = await loadSession(sessionId);
    activeCancelTokens.delete(sessionId);

    const sessionWorkspace = session.workspace_dir !== undefined ? session.workspace_dir : config.workspace_dir;
    const sessionConfig: AppConfig = {
      ...config,
      workspace_dir: sessionWorkspace,
    };

    broadcast('agent-status-changed', { sessionId, status: 'thinking' });
    let loopRetryCount = 0;
    let truncationRetryCount = 0;
    const contextMax = config.local_server?.ctx_size || config.max_tokens || 16384;

  while (true) {
    if (activeCancelTokens.has(sessionId)) {
      activeCancelTokens.delete(sessionId);
      broadcast('agent-status-changed', { sessionId, status: 'idle' });
      break;
    }

    const fullSystemPrompt = buildFullSystemPrompt(sessionConfig);
    const compactionRes = await runCompactionPipeline(session, sessionConfig, fullSystemPrompt, broadcast);
    const messages = compactionRes.messages;

    const selectedModel = config.model_name || PRIMARY_TEXT_MODEL;
    const isLocalModel = selectedModel.startsWith('local:') || selectedModel.endsWith('.gguf') || config.api_url.includes('127.0.0.1') || config.api_url.includes('localhost');

    let response: Response | null = null;
    let activeModelName = selectedModel;
    let lastErrorText = '';
    let lastStatusCode = 500;

    const configuredEffort = config.reasoning_effort || config.local_server?.reasoning_effort || 'auto';
    const isReasoningOff = config.reasoning_enabled === false || configuredEffort === 'off';
    const requestTimeoutMs = Math.max(15, config.api_timeout_sec || 90) * 1000;

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

      if (configuredEffort !== 'auto' && !isReasoningOff) {
        requestBody.chat_template_kwargs = {
          reasoning_effort: configuredEffort,
          enable_thinking: true,
        };
      } else if (isReasoningOff) {
        requestBody.chat_template_kwargs = {
          enable_thinking: false,
          reasoning_effort: 'off',
        };
      }

      let attempts = 0;
      const maxAttempts = 6;
      while (attempts < maxAttempts) {
        attempts++;
        try {
          response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(requestTimeoutMs),
          });
          if (response.status === 503 && attempts < maxAttempts) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          // If llama-server returns 400 (e.g. unknown chat_template_kwargs), retry with vanilla body
          if (response.status === 400 && requestBody.chat_template_kwargs) {
            delete requestBody.chat_template_kwargs;
            delete requestBody.reasoning_effort;
            response = await fetch(apiEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
              signal: AbortSignal.timeout(requestTimeoutMs),
            });
          }
          break;
        } catch (err: any) {
          if (attempts < maxAttempts) {
            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }
          const errMsg = `[!] **Локальный LLM Сервер не запущен или недоступен!**\nНе удалось подключиться к \`${apiEndpoint}\` (${err.message}).\n\n[›] **Решение:** Нажмите кнопку **[Запустить LLM Сервер]** прямо над чатом или перейдите во вкладку **Настройки -> Сервер LLM**.`;
          handleAgentError(session, sessionId, broadcast, errMsg);
          return;
        }
      }
    } else {
      const apiKey = config.gemini_api_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || config.groq_api_key || '';
      
      if (!apiKey && !selectedModel.includes('localhost') && !selectedModel.includes('127.0.0.1')) {
        const errMsg = `[!] **Google AI Studio API Key не задан!**\nДля использования облачной модели \`${selectedModel}\` требуется API ключ Google AI Studio.\n\n[›] **Решение:** Укажите Ваш **GEMINI_API_KEY** в **Настройках (Сервер LLM / Облачные модели)** или в переменной окружения.`;
        handleAgentError(session, sessionId, broadcast, errMsg);
        return;
      }

      const modelCandidates = [selectedModel];
      const fallbackList = config.fallback_models && config.fallback_models.length > 0 ? config.fallback_models : DEFAULT_FALLBACK_CHAIN;
      for (const m of fallbackList) {
        if (!modelCandidates.includes(m)) modelCandidates.push(m);
      }

      const cloudEndpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

      for (const candidateModel of modelCandidates) {
        activeModelName = candidateModel;
        const baseMaxTokens = config.max_tokens ?? 16384;
        const effectiveMaxTokens = (!isReasoningOff && baseMaxTokens < 16384) ? 16384 : baseMaxTokens;

        const requestBody: any = {
          model: candidateModel,
          messages,
          stream: true,
          temperature: loopRetryCount > 0 ? 0.7 : (config.temperature ?? 0.2),
          max_tokens: effectiveMaxTokens,
        };

        if (configuredEffort && configuredEffort !== 'auto' && !isReasoningOff) {
          const cloudEffort = configuredEffort === 'xhigh' ? 'high' : configuredEffort;
          requestBody.reasoning_effort = cloudEffort;
        }

        let rateLimitAttempts = 0;
        const maxRateLimitRetries = 2;

        while (rateLimitAttempts <= maxRateLimitRetries) {
          try {
            let res = await fetch(cloudEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
              },
              body: JSON.stringify(requestBody),
              signal: AbortSignal.timeout(requestTimeoutMs),
            });

            // Handle HTTP 429 Rate Limit with exponential backoff retry
            if (res.status === 429 && rateLimitAttempts < maxRateLimitRetries) {
              rateLimitAttempts++;
              console.warn(`[agent] Cloud model ${candidateModel} hit 429 Rate Limit. Attempt ${rateLimitAttempts}/${maxRateLimitRetries}. Waiting 2.5s before retry...`);
              await new Promise((r) => setTimeout(r, 2500 * rateLimitAttempts));
              continue;
            }

            // HTTP 400 Fallback (for models not supporting reasoning_effort or systemInstruction)
            if (res.status === 400) {
              console.warn(`[agent] Model ${candidateModel} returned 400. Retrying without reasoning_effort/systemInstruction...`);
              const strippedMessages = messages.filter((m) => m.role !== 'system');
              const fallbackBody = { ...requestBody, messages: strippedMessages };
              delete fallbackBody.reasoning_effort;
              delete fallbackBody.chat_template_kwargs;
              const retryRes = await fetch(cloudEndpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify(fallbackBody),
                signal: AbortSignal.timeout(requestTimeoutMs),
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
              break; // Try next candidate in modelCandidates
            }
          } catch (fetchErr: any) {
            lastErrorText = fetchErr.message;
            console.warn(`[agent] Cloud model ${candidateModel} network error: ${fetchErr.message}. Falling back...`);
            break;
          }
        }

        if (response && response.ok) break;
      }
    }

    if (!response || !response.ok) {
      let errMsg = `[!] **LLM Сервер вернул ошибку (${lastStatusCode}):**\n\`\`\`\n${lastErrorText || 'No response from LLM server / all fallback models exhausted'}\n\`\`\``;

      if (lastStatusCode === 401 || lastStatusCode === 403) {
        errMsg = `[KEY] **Ошибка авторизации или регионального доступа Google API (HTTP ${lastStatusCode} Unauthorized/Forbidden)!**\n\n` +
          `Модель \`${activeModelName}\` отвергла запрос из-за недействительного API-ключа или региональных ограничений.\n\n` +
          `[›] **Решения:**\n` +
          `1. Проверьте **GEMINI_API_KEY** в **Настройках (Сервер LLM / Облачные модели)**.\n` +
          `2. Если Вы подключаетесь из региона с ограничениями Google Cloud, включите VPN / прокси.\n` +
          `3. Переключитесь на локальную модель ИИ вверху чата.\n\n` +
          `\`\`\`json\n${lastErrorText.substring(0, 400)}\n\`\`\``;
      } else if (lastStatusCode === 429) {
        errMsg = `[TIME] **Превышен лимит запросов / квота Google AI Studio (HTTP 429 Rate Limit Exceeded)!**\n\n` +
          `Модель \`${activeModelName}\` вернула ошибку **429 Too Many Requests** (превышены ограничения RPM / TPM / RPD на бесплатном тарифе).\n\n` +
          `[›] **Решения:**\n` +
          `1. **Подождите 15-30 секунд** и повторите запрос (минутный лимит RPM восстановится).\n` +
          `2. **Переключитесь на локальную модель** вверху чата (без каких-либо лимитов).\n` +
          `3. **Выберите другую модель Google** (например, \`Gemini 3.5 Flash Lite\` или \`Gemini 3.5 Flash\`).\n` +
          `4. Укажите новый **GEMINI_API_KEY** в **Настройках (Сервер LLM / Облачные модели)**.\n\n` +
          `\`\`\`json\n${lastErrorText.substring(0, 400)}\n\`\`\``;
      } else if (lastStatusCode === 404) {
        errMsg = `[SEARCH] **Модель не найдена в API эндпоинте Google (HTTP 404 Not Found)!**\n\n` +
          `Модель \`${activeModelName}\` недоступна по эндпоинту Google AI Studio.\n\n` +
          `[›] **Решение:** Выберите актуальную модель (\`Gemini 3.6 Flash\`, \`Gemini 3.5 Flash Lite\`, \`Gemini 3.5 Flash\`, \`Gemma 4 31B\`) из выпадающего списка.\n\n` +
          `\`\`\`json\n${lastErrorText.substring(0, 300)}\n\`\`\``;
      } else if (lastStatusCode >= 500) {
        errMsg = `[NET] **Сбой инфраструктуры ИИ / Сервер недоступен (HTTP ${lastStatusCode} Server Error)!**\n\n` +
          `Удаленный сервер моделей верунул ошибку инфраструктуры.\n\n` +
          `[›] **Решения:**\n` +
          `1. Повторите запрос через 5-10 секунд.\n` +
          `2. Переключитесь на локальную модель \`llama.cpp\`.\n\n` +
          `\`\`\`json\n${lastErrorText.substring(0, 300)}\n\`\`\``;
      }

      handleAgentError(session, sessionId, broadcast, errMsg);
      return;
    }


    if (!response.body) {
      const errMsg = '[!] **LLM Сервер вернул пустой ответ (body is empty)**';
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
    let isInReasoning = false;
    let streamFinishReason = '';

    const processJsonData = (data: string) => {
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta;
        const finishReason = parsed.choices?.[0]?.finish_reason;

        if (finishReason) {
          streamFinishReason = finishReason;
        }

        const reasoningChunk = delta?.reasoning_content || delta?.reasoning || delta?.thought;
        const contentChunk = delta?.content || parsed.choices?.[0]?.text;

        if (reasoningChunk) {
          const rawReasoning = String(reasoningChunk);
          if (!isInReasoning) {
            if (rawReasoning.startsWith('<think>')) {
              emitToken(rawReasoning);
            } else {
              emitToken('<think>' + rawReasoning);
            }
            isInReasoning = true;
          } else {
            emitToken(rawReasoning);
          }
        }

        if (contentChunk) {
          const rawContent = String(contentChunk);
          if (isInReasoning) {
            if (rawContent.startsWith('</think>')) {
              emitToken(rawContent);
            } else {
              emitToken('</think>' + rawContent);
            }
            isInReasoning = false;
          } else {
            emitToken(rawContent);
          }
        }
      } catch {
        // Ignore parse errors for partial chunks
      }
    };

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
              processJsonData(data);
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
          processJsonData(data);
        }
      }
    }

    if (isInReasoning) {
      emitToken('</think>');
      isInReasoning = false;
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
    await saveSession(session);

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
        await saveSession(session);

        broadcast('agent-error', {
          sessionId,
          message: '[!] Зафиксировано зацикливание модели. Автоматический сброс петли и повторный вызов с повышенным штрафом за повторы...',
        });
        continue;
      }
    }

    // Parse tools from assistant response content
    const parsedCalls = parseToolCalls(assistantMessage.content);

    // Handle max_tokens truncation: if response was cut off and no tool calls parsed, auto-retry
    if (parsedCalls.length === 0 && streamFinishReason === 'length' && truncationRetryCount < 2) {
      truncationRetryCount++;
      console.warn(`[agent] Response truncated by max_tokens (finish_reason=length). Auto-retry ${truncationRetryCount}/2...`);

      session.messages.push({
        id: uuidv4(),
        role: 'user',
        content: '[SYSTEM DIRECTIVE: Ваш предыдущий ответ был обрезан по лимиту max_tokens! Не повторяйте уже написанный текст и рассуждения. Сократите блок мыслей до минимума. Сразу переходите к исполнению XML инструментов (<read_file>, <grep_search>, <list_dir>, <patch_file>, <execute_command>). Минимум текста — максимум действий.]',
        timestamp: Date.now(),
      });
      session.updated_at = Date.now();
      await saveSession(session);

      broadcast('agent-error', {
        sessionId,
        message: '[!] Ответ модели обрезан по лимиту токенов (max_tokens). Автоматическое продолжение с директивой сокращения рассуждений...',
      });
      continue;
    }

    if (parsedCalls.length === 0) {
      // Check if model hallucinated tool output directly in its response text instead of calling the tool
      if (detectToolOutputHallucination(assistantMessage.content)) {
        console.warn(`[agent] Hallucinated tool output detected in response text without parsed calls. Auto-recovering...`);
        assistantMessage.content = stripHallucinatedToolOutput(assistantMessage.content);
        await saveSession(session);

        if (loopRetryCount < 2) {
          loopRetryCount++;
          session.messages.push({
            id: uuidv4(),
            role: 'user',
            content: '[SYSTEM DIRECTIVE: Вы попытались написать вывод инструмента самостоятельно! Запрещено симулировать вывод в тексте. Вызывайте инструменты исключительно через XML-теги (например, <list_dir path="." /> или <read_file path="..." />). Реальный вывод будет предоставлен исполняющей средой.]',
            timestamp: Date.now(),
          });
          session.updated_at = Date.now();
          await saveSession(session);

          broadcast('agent-error', {
            sessionId,
            message: '[!] Модель попыталась сымитировать вывод инструмента вместо его вызова. Автоматический перезапуск с корректирующей директивой...',
          });
          continue;
        }
      }

      broadcast('agent-status-changed', { sessionId, status: 'idle' });
      break;
    }

    // Clean any hallucinated output trailing blocks if tools were parsed
    if (detectToolOutputHallucination(assistantMessage.content)) {
      assistantMessage.content = stripHallucinatedToolOutput(assistantMessage.content);
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
      // Do NOT destructively strip XML tags from session.messages.content!
      // Preserving XML tags in assistant history ensures LLM context stays consistent
      // and prevents Qwen/Gemma from role confusion / hallucinating tool outputs.
    }
    await saveSession(session);

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

      const perm = evaluateToolPermission(
        tc.name,
        tc.arguments,
        sessionConfig.permission_preset || 'prompt',
        sessionConfig.workspace_dir
      );

      if (!perm.allowed) {
        const output = perm.reason || `[SECURITY REJECTED]: Tool '${tc.name}' denied by permission policy.`;
        broadcast('agent-tool-status-changed', {
          sessionId,
          message_id: assistantMessageId,
          tool_id: tc.id,
          status: 'error',
          output,
        });
        toolResults.push({
          id: uuidv4(),
          role: 'tool',
          content: `<tool_response name="${tc.name}" id="${tc.id}">\n${output}\n</tool_response>`,
          timestamp: Date.now(),
        });
        if (lastMsg && lastMsg.tool_calls) {
          const t = lastMsg.tool_calls.find((x) => x.id === tc.id);
          if (t) {
            t.status = 'error';
            t.output = output;
          }
        }
        hasNewExecutions = true;
        continue;
      }

      let userResponseOrApproved: boolean | string = true;

      if (perm.requiresApproval) {
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
        const loopCheck = loopBreaker.trackCall(sessionId, tc.name, tc.arguments);
        if (loopCheck.forceHalt) {
          output = loopCheck.advisoryReminder || `[КРИТИЧЕСКАЯ ОШИБКА]: Превышен лимит повторных вызовов инструмента ${tc.name}.`;
          broadcast('agent-tool-status-changed', {
            sessionId,
            message_id: assistantMessageId,
            tool_id: tc.id,
            status: 'error',
            output,
          });
        } else {
          try {
            output = await dispatchToolExecution(tc, sessionConfig, userResponseOrApproved, sessionId, broadcast);

            if (loopCheck.advisoryReminder) {
              output = `${output}\n\n${loopCheck.advisoryReminder}`;
            }

            const spillResult = await handleOutputSpill(output, tc.name);
            output = spillResult.output;

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
        }
      } else {
        output = 'Tool execution rejected by the user.';
      }

      toolResults.push({
        id: uuidv4(),
        role: 'tool',
        content: `<tool_response name="${tc.name}" id="${tc.id}">\n${output}\n</tool_response>`,
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
    await saveSession(session);

    if (!hasNewExecutions) {
      broadcast('agent-status-changed', { sessionId, status: 'idle' });
      break;
    }

    // Smart turn termination: Prevent redundant re-generation turns
    const SILENT_BACKGROUND_TOOLS = [
      'update_user_profile',
      'update_persona_file',
      'remember_fact',
      'save_knowledge',
      'list_skills',
    ];

    const INVESTIGATIVE_TOOLS = [
      'read_file',
      'grep_search',
      'fff_search',
      'list_dir',
      'web_search',
      'read_web_page',
      'search_knowledge',
      'recall_memories',
      'search_sessions',
      'ask_user',
      'spawn_subagent',
      'run_scratch_script',
    ];

    const hasInvestigativeTools = parsedCalls.some((tc) => INVESTIGATIVE_TOOLS.includes(tc.name));
    const hasErrors = toolResults.some((tr) => tr.content.includes('Error:'));
    const cleanExplanationText = stripToolCallTags(assistantMessage.content).trim();
    const hasSubstantialText = cleanExplanationText.length >= 25;

    // 1. If all tools were silent background tools (e.g. updating profile/persona/memory), finish immediately
    const isAllSilentTools = parsedCalls.every((tc) => SILENT_BACKGROUND_TOOLS.includes(tc.name));
    if (isAllSilentTools && hasSubstantialText) {
      broadcast('agent-status-changed', { sessionId, status: 'idle' });
      break;
    }

    // 2. If all tools were action/modifying tools without errors and assistant already gave its complete answer
    if (!hasInvestigativeTools && hasSubstantialText && !hasErrors) {
      broadcast('agent-status-changed', { sessionId, status: 'idle' });
      break;
    }

    broadcast('agent-status-changed', { sessionId, status: 'thinking' });
  }
  } finally {
    activeRunningLoops.delete(sessionId);
    loopBreaker.reset(sessionId);
  }
}
