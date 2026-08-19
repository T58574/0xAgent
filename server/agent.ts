import { v4 as uuidv4 } from 'uuid';
import { AppConfig, ChatMessage, ToolCallInfo } from '../src/types';
import { loadSession, saveSession } from './session';
import { strip_ai_reasoning_fluff } from './agent/fluffSanitizer';
import { detectRepetitionLoop } from './agent/contextManager';
import { buildFullSystemPrompt } from './agent/promptBuilder';
import { dispatchToolExecution } from './agent/toolDispatcher';
import { parseToolCalls, detectToolOutputHallucination, stripHallucinatedToolOutput } from './agent/toolParser';
import { loopBreaker } from './agent/loopBreaker';
import { handleOutputSpill } from './agent/outputSpiller';
import { evaluateToolPermission } from './agent/permissionGuard';
import { runCompactionPipeline } from './agent/compactionPipeline';
import { fetchLlmResponse, readLlmStream, PRIMARY_TEXT_MODEL, DEFAULT_FALLBACK_CHAIN, GEMMA_MODEL, FAST_LITE_MODEL, NATIVE_AUDIO_MODEL } from './agent/llmClient';
import {
  PendingConfirmation,
  activeConfirmations,
  activeCancelTokens,
  activeRunningLoops,
  handleAgentError,
  respondToToolConfirmation,
  cancelAgentSession,
} from './agent/agentState';

export {
  strip_ai_reasoning_fluff,
  handleAgentError,
  respondToToolConfirmation,
  cancelAgentSession,
  PRIMARY_TEXT_MODEL,
  DEFAULT_FALLBACK_CHAIN,
  GEMMA_MODEL,
  FAST_LITE_MODEL,
  NATIVE_AUDIO_MODEL,
};
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
    const session = await loadSession(sessionId);
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

      const llmFetchResult = await fetchLlmResponse(
        sessionConfig,
        messages,
        loopRetryCount,
        session,
        sessionId,
        broadcast
      );

      if (!llmFetchResult) {
        return;
      }

      const { response, activeModelName } = llmFetchResult;
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

      const streamResult = await readLlmStream(
        response,
        activeModelName,
        sessionConfig,
        messages,
        assistantMessageId,
        sessionId,
        session,
        activeCancelTokens,
        broadcast
      );

      if (!streamResult) {
        return;
      }

      // Auto-close unclosed tags to prevent DOM/context corruption
      let finalContent = streamResult.content || '';
      if (/<(?:think|thought|thinking)>[^<]*$/i.test(finalContent) || (/<(?:think|thought|thinking)>/i.test(finalContent) && !/<\/(?:think|thought|thinking)>/i.test(finalContent))) {
        finalContent += '\n</think>';
      }
      if (/<code_run[^>]*>[\s\S]*$/i.test(finalContent) && !/<\/code_run>/i.test(finalContent)) {
        finalContent += '\n</code_run>';
      }
      if (/<write_file[^>]*>[\s\S]*$/i.test(finalContent) && !/<\/write_file>/i.test(finalContent)) {
        finalContent += '\n</write_file>';
      }
      if (/<patch_file[^>]*>[\s\S]*$/i.test(finalContent) && !/<\/patch_file>/i.test(finalContent)) {
        finalContent += '\n</patch_file>';
      }

      assistantMessage.content = finalContent;
      assistantMessage.metrics = {
        tokensPerSec: streamResult.tokensPerSec,
        promptTokens: streamResult.promptTokens,
        completionTokens: streamResult.completionTokens,
        totalTokens: streamResult.totalTokens,
        contextUsed: streamResult.totalTokens,
        contextMax,
        evalDurationMs: streamResult.evalDurationMs,
        modelName: streamResult.modelName,
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
            content: '[SYSTEM DIRECTIVE: Обнаружено зацикливание / повторение предыдущего ответа! Не повторяйте текст и не просите пользователя писать "продолжи". Сразу переходите к исполнению нужного XML инструмента (<read_file>, <write_file>, <patch_file>, <save_knowledge>, <execute_command>) или завершите решение.]',
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

      // Handle max_tokens truncation
      if (parsedCalls.length === 0 && streamResult.finishReason === 'length' && truncationRetryCount < 2) {
        truncationRetryCount++;
        console.warn(`[agent] Response truncated by max_tokens. Auto-retry ${truncationRetryCount}/2...`);

        session.messages.push({
          id: uuidv4(),
          role: 'user',
          content: '[SYSTEM DIRECTIVE: Предыдущий ответ был обрезан по лимиту длины (max_tokens)! Не продолжайте незаконченный текст с середины слова. Не дублируйте черновики файлов в мыслях. Сразу вызовите целевой инструмент (<write_file>, <patch_file>, <save_knowledge>, <execute_command>) целиком в корректных XML-тегах.]',
          timestamp: Date.now(),
        });
        session.updated_at = Date.now();
        await saveSession(session);

        broadcast('agent-error', {
          sessionId,
          message: '[!] Ответ модели обрезан по лимиту токенов (max_tokens). Автоматическое продолжение с директивой прямого вызова инструментов...',
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

      // Smart turn termination: Prevent redundant re-generation turns for silent background tools
      const SILENT_BACKGROUND_TOOLS = [
        'update_user_profile',
        'update_persona_file',
        'remember_fact',
        'save_knowledge',
        'list_skills',
      ];

      const cleanExplanationText = strip_ai_reasoning_fluff(assistantMessage.content).trim();
      const hasSubstantialText = cleanExplanationText.length >= 25;

      const isAllSilentTools = parsedCalls.every((tc) => SILENT_BACKGROUND_TOOLS.includes(tc.name));
      if (isAllSilentTools && hasSubstantialText) {
        broadcast('agent-status-changed', { sessionId, status: 'idle' });
        break;
      }

      broadcast('agent-status-changed', { sessionId, status: 'thinking' });
    }
  } catch (err: any) {
    console.error(`[agent] Unhandled error in runAgentLoop for session ${sessionId}:`, err);
    let errMsg = `[!] **Системная ошибка выполнения Агента:**\n\`\`\`\n${err?.message || err}\n\`\`\``;
    if (
      err?.name === 'TimeoutError' ||
      String(err?.message).includes('timeout') ||
      String(err?.message).includes('aborted')
    ) {
      errMsg = `[!] **Таймаут ожидания ответа LLM сервера!**\n\nМодель не успела сформировать ответ за отведенное время (длинная prefill фаза или высокая нагрузка на систему).\n\n[›] **Рекомендации:**\n1. Увеличьте размер таймаута в **Настройки -> Основные (API Timeout)**.\n2. Для локальных 27B/31B моделей убедитесь, что в параметрах сервера включен Flash Attention (\`-fa on\`) и квантованный KV-кэш (\`-ctk q8_0 -ctv q8_0\`).`;
    }
    try {
      const sess = await loadSession(sessionId);
      handleAgentError(sess, sessionId, broadcast, errMsg);
    } catch {}
  } finally {
    activeRunningLoops.delete(sessionId);
    loopBreaker.reset(sessionId);
  }
}
