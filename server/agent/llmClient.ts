import { AppConfig } from '../../src/types';
import { handleAgentError } from './agentState';
import { strip_ai_reasoning_fluff } from './fluffSanitizer';
import { estimatePromptTokens } from '../summarizer';

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
    config.api_url.includes('127.0.0.1') ||
    config.api_url.includes('localhost');

  let response: Response | null = null;
  let activeModelName = selectedModel;
  let lastErrorText = '';
  let lastStatusCode = 500;

  const configuredEffort = config.reasoning_effort || config.local_server?.reasoning_effort || 'auto';
  const isReasoningOff = config.reasoning_enabled === false || configuredEffort === 'off';
  const requestTimeoutMs = Math.max(15, config.api_timeout_sec || 90) * 1000;

  if (isLocalModel && (selectedModel.startsWith('local:') || selectedModel.endsWith('.gguf'))) {
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
        return null;
      }
    }
  } else {
    const apiKey =
      config.gemini_api_key ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      config.groq_api_key ||
      '';

    if (!apiKey && !selectedModel.includes('localhost') && !selectedModel.includes('127.0.0.1')) {
      const errMsg = `[!] **Google AI Studio API Key не задан!**\nДля использования облачной модели \`${selectedModel}\` требуется API ключ Google AI Studio.\n\n[›] **Решение:** Укажите Ваш **GEMINI_API_KEY** в **Настройках (Сервер LLM / Облачные модели)** или в переменной окружения.`;
      handleAgentError(session, sessionId, broadcast, errMsg);
      return null;
    }

    const modelCandidates = [selectedModel];
    const fallbackList =
      config.fallback_models && config.fallback_models.length > 0
        ? config.fallback_models
        : DEFAULT_FALLBACK_CHAIN;
    for (const m of fallbackList) {
      if (!modelCandidates.includes(m)) modelCandidates.push(m);
    }

    const cloudEndpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

    for (const candidateModel of modelCandidates) {
      activeModelName = candidateModel;
      const baseMaxTokens = config.max_tokens ?? 16384;
      const effectiveMaxTokens = !isReasoningOff && baseMaxTokens < 16384 ? 16384 : baseMaxTokens;

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
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(requestTimeoutMs),
          });

          if (res.status === 429 && rateLimitAttempts < maxRateLimitRetries) {
            rateLimitAttempts++;
            console.warn(`[agent] Cloud model ${candidateModel} hit 429. Attempt ${rateLimitAttempts}/${maxRateLimitRetries}. Retrying in 2.5s...`);
            await new Promise((r) => setTimeout(r, 2500 * rateLimitAttempts));
            continue;
          }

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
                Authorization: `Bearer ${apiKey}`,
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
            console.warn(`[agent] Cloud model ${candidateModel} failed (${res.status}): ${lastErrorText.substring(0, 200)}`);
            break;
          }
        } catch (fetchErr: any) {
          lastErrorText = fetchErr.message;
          console.warn(`[agent] Cloud model ${candidateModel} network error: ${fetchErr.message}`);
          break;
        }
      }

      if (response && response.ok) break;
    }
  }

  if (!response || !response.ok) {
    let errMsg = `[!] **LLM Сервер вернул ошибку (${lastStatusCode}):**\n\`\`\`\n${lastErrorText || 'No response from LLM server / all fallback models exhausted'}\n\`\`\``;

    if (lastStatusCode === 401 || lastStatusCode === 403) {
      errMsg = `[KEY] **Ошибка авторизации Google API (HTTP ${lastStatusCode})!**\n\nПроверьте **GEMINI_API_KEY** в Настройках.\n\n\`\`\`json\n${lastErrorText.substring(0, 400)}\n\`\`\``;
    } else if (lastStatusCode === 429) {
      errMsg = `[TIME] **Превышен лимит запросов Google AI Studio (HTTP 429)!**\n\nПодождите 15-30 секунд или переключитесь на локальную модель.\n\n\`\`\`json\n${lastErrorText.substring(0, 400)}\n\`\`\``;
    }

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

  const emitToken = (content: string) => {
    assistantContent += content;
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
      return null;
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

  assistantContent = strip_ai_reasoning_fluff(assistantContent);

  const totalElapsedMs = Date.now() - genStartTime;
  const finalTokensPerSec =
    totalElapsedMs > 100 ? Math.round((tokenCount / (totalElapsedMs / 1000)) * 10) / 10 : 0;
  const finalContextUsed = estimatedPromptTokens + tokenCount;

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
