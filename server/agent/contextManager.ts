import { ChatMessage } from '../../src/types';
import { estimatePromptTokens } from '../summarizer';
import { parseToolCalls } from './toolParser';

export function pruneMessagesForContext(
  messages: { role: string; content: string | any[] }[],
  maxTokens: number
): { role: string; content: string | any[] }[] {
  const safeLimit = Math.floor(maxTokens * 0.8);
  if (estimatePromptTokens(messages) <= safeLimit) {
    return messages;
  }

  const systemMsg = messages[0];
  const firstUserMsg = messages.length > 1 && messages[1].role === 'user' ? messages[1] : null;
  const startIdx = firstUserMsg ? 2 : 1;

  const tailCount = Math.min(8, messages.length - startIdx);
  const tailMsgs = messages.slice(messages.length - tailCount);
  const middleMsgs = messages.slice(startIdx, messages.length - tailCount);

  const prunedMiddle = middleMsgs.map((m) => {
    if (typeof m.content === 'string' && m.content.length > 500 && (m.role === 'user' || m.role === 'tool')) {
      const head = m.content.substring(0, 200);
      const tail = m.content.substring(m.content.length - 200);
      return {
        ...m,
        content: `${head}\n\n[... [Слайдинг Контекста] Вывод инструмента сжат (${m.content.length} байт) ...]\n\n${tail}`,
      };
    }
    return m;
  });

  const buildResult = (middle: typeof prunedMiddle) => {
    const list = [systemMsg];
    if (firstUserMsg) list.push(firstUserMsg);
    return [...list, ...middle, ...tailMsgs];
  };

  let result = buildResult(prunedMiddle);

  while (estimatePromptTokens(result) > safeLimit && prunedMiddle.length > 0) {
    prunedMiddle.shift();
    result = buildResult(prunedMiddle);
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
