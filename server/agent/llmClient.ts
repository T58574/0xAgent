import { AppConfig } from '../../src/types';
import {
  handleAgentError,
  registerActiveSessionStream,
  updateActiveSessionStream,
  removeActiveSessionStream,
} from './agentState';
import { strip_ai_reasoning_fluff } from './fluffSanitizer';
import { filterCloudPayload } from './cloudPrivacyFilter';
import { estimatePromptTokens } from '../summarizer';

export const PRIMARY_TEXT_MODEL = 'local:qwen2.5-coder-32b.gguf';
export const GEMMA_MODEL = 'local:gemma-4-31b-it.gguf';
export const FAST_LITE_MODEL = 'local:qwen2.5-coder-7b.gguf';
export const NATIVE_AUDIO_MODEL = 'local:tts-voice';

export const DEFAULT_FALLBACK_CHAIN: string[] = [
  'local:qwen2.5-coder-32b.gguf',
  'local:gemma-4-31b-it.gguf',
  'local:qwen2.5-coder-7b.gguf',
];

export interface LlmStreamResult {
  content: string;
  finishReason: string;
  tokensPerSec: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  evalDurationMs: number;
  modelName: string;
}

async function fetchWithHeaderTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException(`Connection timed out after ${Math.round(timeoutMs / 1000)}s`, 'TimeoutError'));
  }, timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export async function fetchLlmResponse(
  config: AppConfig,
  messages: { role: string; content: string | any[] }[],
  loopRetryCount: number,
  session: any,
  sessionId: string,
  broadcast: (event: string, payload: any) => void
): Promise<{ response: Response; activeModelName: string } | null> {
  const selectedModel = config.model_name || PRIMARY_TEXT_MODEL;
  const isLocalModel =
    selectedModel.startsWith('local:') ||
    selectedModel.endsWith('.gguf') ||
    !config.api_url ||
    config.api_url.includes('127.0.0.1') ||
    config.api_url.includes('localhost');

  let response: Response | null = null;
  let activeModelName = selectedModel;
  let lastErrorText = '';
  let lastStatusCode = 500;

  const configuredEffort = config.reasoning_effort || config.local_server?.reasoning_effort || 'auto';
  const isReasoningOff = config.reasoning_enabled === false || configuredEffort === 'off';

  // For large models (27B/32B GGUF) on local/LAN servers, allocate 300s-600s
  const baseTimeoutSec = config.api_timeout_sec || (isLocalModel ? 300 : 90);
  const requestTimeoutMs = Math.max(isLocalModel ? 180 : 30, baseTimeoutSec) * 1000;

  if (isLocalModel) {
    const localHost = config.local_server?.host || '127.0.0.1';
    const localPort = config.local_server?.port || 11434;
    const apiEndpoint = `http://${localHost}:${localPort}/v1/chat/completions`;
    const ctxLimit = config.local_server?.ctx_size || 16384;
    const requestBody: any = {
      model: selectedModel.replace(/^local:/, ''),
      messages,
      stream: true,
      max_tokens: config.max_tokens || Math.min(8192, Math.floor(ctxLimit / 2)),
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
    const maxAttempts = 4;
    while (attempts < maxAttempts) {
      attempts++;
      try {
        response = await fetchWithHeaderTimeout(
          apiEndpoint,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          },
          requestTimeoutMs
        );
        if (response.status === 503 && attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        if (response.status === 400 && requestBody.chat_template_kwargs) {
          delete requestBody.chat_template_kwargs;
          delete requestBody.reasoning_effort;
          response = await fetchWithHeaderTimeout(
            apiEndpoint,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
            },
            requestTimeoutMs
          );
        }
        break;
      } catch (err: any) {
        if (attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        const isTimeout = err?.name === 'TimeoutError' || String(err?.message).includes('timed out') || String(err?.message).includes('aborted');
        const errMsg = isTimeout
          ? `[!] **Превышен таймаут ожидания LLM сервера (${Math.round(requestTimeoutMs / 1000)}с)!**\nМодель не ответила за отведенное время (длинная фаза prefill или сетевая задержка).\n\n[›] **Решение:**\n1. В **Настройках -> Сервер LLM** убедитесь, что включен Flash Attention (\`-fa on\`) и квантованный KV-кэш (\`-ctk q8_0 -ctv q8_0\`).\n2. Увеличьте параметр **API Timeout** в настройках.`
          : `[!] **LLM Сервер (${localHost}:${localPort}) недоступен!**\nНе удалось подключиться к \`${apiEndpoint}\` (${err.message}).\n\n[›] **Решение:** Убедитесь, что сервер llama.cpp запущен локально или на рабочей станции в LAN.`;
        handleAgentError(session, sessionId, broadcast, errMsg);
        return null;
      }
    }
  } else {
    // Custom OpenAI-compatible endpoint (e.g. Ollama / LAN / Custom API)
    const customEndpoint = config.api_url || 'http://127.0.0.1:11434/v1/chat/completions';
    const apiKey = '';
    const { sanitizedMessages } = filterCloudPayload(messages);

    const requestBody: any = {
      model: selectedModel,
      messages: sanitizedMessages,
      stream: true,
      temperature: loopRetryCount > 0 ? 0.7 : (config.temperature ?? 0.2),
      max_tokens: config.max_tokens || 8192,
    };

    try {
      response = await fetchWithHeaderTimeout(
        customEndpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify(requestBody),
        },
        requestTimeoutMs
      );
    } catch (err: any) {
      lastErrorText = err.message;
    }
  }

  if (!response || !response.ok) {
    lastStatusCode = response?.status || 500;
    if (!lastErrorText && response) {
      lastErrorText = await response.text().catch(() => '');
    }
    const errMsg = `[!] **LLM Сервер вернул ошибку (${lastStatusCode}):**\n\`\`\`\n${lastErrorText || 'No response from LLM server'}\n\`\`\``;
    handleAgentError(session, sessionId, broadcast, errMsg);
    return null;
  }

  return { response, activeModelName };
}

export async function readLlmStream(
  response: Response,
  activeModelName: string,
  config: AppConfig,
  messages: { role: string; content: string | any[] }[],
  assistantMessageId: string,
  sessionId: string,
  session: any,
  activeCancelTokens: Set<string>,
  broadcast: (event: string, payload: any) => void
): Promise<LlmStreamResult | null> {
  if (!response.body) return null;

  const genStartTime = Date.now();
  let tokenCount = 0;
  const estimatedPromptTokens = estimatePromptTokens(messages);
  const contextMax = config.local_server?.ctx_size || config.max_tokens || 16384;
  const modelName = activeModelName || config.model_name || PRIMARY_TEXT_MODEL;

  let assistantContent = '';

  registerActiveSessionStream(sessionId, {
    sessionId,
    assistantMessageId,
    content: '',
    startTime: genStartTime,
    tokensPerSec: 0,
    tokenCount: 0,
    contextUsed: estimatedPromptTokens,
    contextMax,
    modelName,
  });

  const emitToken = (content: string) => {
    assistantContent += content;
    tokenCount++;
    const elapsedSec = (Date.now() - genStartTime) / 1000;
    const tokensPerSec = elapsedSec > 0.1 ? Math.round((tokenCount / elapsedSec) * 10) / 10 : 0;
    const contextUsed = estimatedPromptTokens + tokenCount;

    updateActiveSessionStream(sessionId, content, {
      tokensPerSec,
      tokenCount,
      contextUsed,
      contextMax,
      modelName,
    });

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
          if (/^\s*<think>/i.test(rawReasoning)) {
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
          if (/^\s*<\/think>/i.test(rawContent)) {
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

  try {
    const CHUNK_INACTIVITY_TIMEOUT_MS = 120_000;

    while (!isStreamDone) {
      if (activeCancelTokens.has(sessionId)) {
        await reader.cancel().catch(() => {});
        removeActiveSessionStream(sessionId);
        broadcast('agent-status-changed', { sessionId, status: 'idle' });
        return null;
      }

      let timeoutTimer: any;
      const timeoutPromise = new Promise<{ value: Uint8Array | undefined; done: boolean; timedOut: boolean }>((resolve) => {
        timeoutTimer = setTimeout(() => {
          resolve({ value: undefined, done: true, timedOut: true });
        }, CHUNK_INACTIVITY_TIMEOUT_MS);
      });

      const readPromise = reader.read().then((res) => {
        clearTimeout(timeoutTimer);
        return { ...res, timedOut: false };
      }).catch((err) => {
        clearTimeout(timeoutTimer);
        throw err;
      });

      const { value, done, timedOut } = await Promise.race([readPromise, timeoutPromise]);

      if (timedOut) {
        console.warn(`[agent] Stream chunk inactivity timeout (${CHUNK_INACTIVITY_TIMEOUT_MS / 1000}s) reached.`);
        await reader.cancel().catch(() => {});
        if (tokenCount === 0) {
          const errMsg = `[!] **Таймаут стриминга ответа LLM сервера!**\nСервер не прислал ни одного чанка в течение ${CHUNK_INACTIVITY_TIMEOUT_MS / 1000} секунд.\n\n[›] **Решение:** Проверьте доступность локального/удаленного сервера и загрузку VRAM.`;
          handleAgentError(session, sessionId, broadcast, errMsg);
          return null;
        }
        break; // Salvage already received tokens
      }

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

      if (value) {
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
    }
  } catch (streamErr: any) {
    await reader.cancel().catch(() => {});
    const isTimeout =
      streamErr?.name === 'TimeoutError' ||
      String(streamErr?.message).includes('timeout') ||
      String(streamErr?.message).includes('aborted');

    if (isTimeout && tokenCount > 0) {
      console.warn(`[agent] Stream interrupted by timeout after ${tokenCount} tokens generated.`);
    } else {
      const errMsg = isTimeout
        ? `[!] **Таймаут стриминга ответа LLM сервера!**\nГенерация была прервана из-за превышения времени ожидания чанков.\n\n[›] **Решение:** Увеличьте **API Timeout** в Настройках или используйте меньший размер контекста.`
        : `[!] **Сбой потока чтения ответа LLM:**\n\`\`\`\n${streamErr?.message || streamErr}\n\`\`\``;
      handleAgentError(session, sessionId, broadcast, errMsg);
      return null;
    }
  }

  if (isInReasoning) {
    emitToken('</think>');
    isInReasoning = false;
  }

  assistantContent = strip_ai_reasoning_fluff(assistantContent);

  const totalElapsedMs = Date.now() - genStartTime;
  const finalTokensPerSec =
    totalElapsedMs > 100 ? Math.round((tokenCount / (totalElapsedMs / 1000)) * 10) / 10 : 0;
  const finalContextUsed = estimatedPromptTokens + tokenCount;

  removeActiveSessionStream(sessionId);

  return {
    content: assistantContent,
    finishReason: streamFinishReason,
    tokensPerSec: finalTokensPerSec,
    promptTokens: estimatedPromptTokens,
    completionTokens: tokenCount,
    totalTokens: finalContextUsed,
    evalDurationMs: totalElapsedMs,
    modelName,
  };
}
