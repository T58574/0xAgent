import { v4 as uuidv4 } from 'uuid';
import { AppConfig, ChatSession } from '../../src/types';
import { pruneHistoricalMessages } from './toolResultPruner';
import { formatMessageContent } from './promptBuilder';
import { pruneMessagesForContext } from './contextManager';
import { estimatePromptTokens, summarizeContext } from '../summarizer';
import { saveSession } from '../session';

export interface CompactionResult {
  messages: { role: string; content: string | any[] }[];
  wasSummarized: boolean;
  estimatedTokens: number;
}

/**
 * 4-Tier Context Compaction Pipeline for token optimization and context management.
 * Tier 1: Zero-token syntactic tool-result pruning
 * Tier 2: CoT Channel thought-stripping on history
 * Tier 3: Bounded context-window fitting
 * Tier 4: Milestone LLM-summarization at 75% threshold
 */
export async function runCompactionPipeline(
  session: ChatSession,
  config: AppConfig,
  fullSystemPrompt: string,
  broadcast?: (event: string, payload: any) => void
): Promise<CompactionResult> {
  const contextMax = config.local_server?.ctx_size || config.max_tokens || 16384;

  // Tier 1: Zero-Token Model-Free Pruning of older tool calls
  const effectiveMessages = pruneHistoricalMessages(session.messages);

  // Tier 2: Format & strip historical thinking tags
  const rawMessages: { role: string; content: string | any[] }[] = [
    { role: 'system', content: fullSystemPrompt },
    ...effectiveMessages.map((m) => ({
      role: m.role === 'tool' ? 'user' : m.role,
      content: formatMessageContent(m, m.role === 'assistant'),
    })),
  ];

  const estTokens = estimatePromptTokens(rawMessages);
  let finalMessages = rawMessages;
  let wasSummarized = false;

  // Tier 4: Milestone Summarizer when exceeding 75% threshold
  if (estTokens > Math.floor(contextMax * 0.75) && session.messages.length > 6) {
    try {
      const tailCount = 4;
      let tailStartIndex = Math.max(1, session.messages.length - tailCount);
      // Ensure tail does not start with an orphaned tool response without its assistant tool_calls
      while (tailStartIndex > 0 && session.messages[tailStartIndex]?.role === 'tool') {
        tailStartIndex--;
      }

      const initialUserMsg = session.messages.find((m) => m.role === 'user');
      const msgsToSummarize = session.messages.slice(0, tailStartIndex);
      const tailMsgs = session.messages.slice(tailStartIndex);

      const summaryText = await summarizeContext(msgsToSummarize, config, broadcast || (() => {}));

      const newMessages = [];
      if (initialUserMsg && !tailMsgs.some((m) => m.id === initialUserMsg.id)) {
        newMessages.push(initialUserMsg);
      }
      newMessages.push({
        id: uuidv4(),
        role: 'user' as const,
        content: `[СВОДКА ПРЕДЫДУЩЕЙ ЧАСТИ ДИАЛОГА]:\n${summaryText}`,
        timestamp: Date.now(),
      });
      newMessages.push(...tailMsgs);

      session.messages = newMessages;
      session.updated_at = Date.now();
      await saveSession(session);

      const postSummaryEffective = pruneHistoricalMessages(session.messages);
      finalMessages = [
        { role: 'system', content: fullSystemPrompt },
        ...postSummaryEffective.map((m) => ({
          role: m.role === 'tool' ? 'user' : m.role,
          content: formatMessageContent(m, m.role === 'assistant'),
        })),
      ];
      wasSummarized = true;
    } catch (err) {
      console.error('[compaction] Milestone summarization fallback to basic windowing:', err);
      finalMessages = pruneMessagesForContext(rawMessages, contextMax);
    }
  } else {
    // Tier 3: Bounded context-window fitting
    finalMessages = pruneMessagesForContext(rawMessages, contextMax);
  }

  return {
    messages: finalMessages,
    wasSummarized,
    estimatedTokens: estimatePromptTokens(finalMessages),
  };
}
