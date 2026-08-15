import { ChatMessage, ToolCallInfo } from '../../src/types';

export interface PruneConfig {
  thresholdChars: number;
  headChars: number;
  tailChars: number;
}

export const DEFAULT_PRUNE_CONFIG: PruneConfig = {
  thresholdChars: 6144,
  headChars: 4096,
  tailChars: 1024,
};

/**
 * Prunes oversized tool output text using a zero-token syntactic head-tail retention method.
 * Retains exact head and tail while replacing the middle with a structured omission marker.
 */
export function pruneToolResultText(
  text: string,
  config: PruneConfig = DEFAULT_PRUNE_CONFIG
): { text: string; wasPruned: boolean; originalLength: number } {
  if (!text || typeof text !== 'string') {
    return { text: text || '', wasPruned: false, originalLength: 0 };
  }

  const originalLength = text.length;
  if (originalLength <= config.thresholdChars) {
    return { text, wasPruned: false, originalLength };
  }

  const head = text.slice(0, config.headChars);
  const tail = text.slice(originalLength - config.tailChars);
  const omitted = originalLength - (config.headChars + config.tailChars);

  const marker = `\n\n[... middle output pruned (${omitted.toLocaleString()} chars) ...]\n\n`;
  const prunedText = `${head}${marker}${tail}`;

  return {
    text: prunedText,
    wasPruned: true,
    originalLength,
  };
}

/**
 * Scans historical message list and prunes old tool results for model prompt assembly,
 * keeping the most recent active turn/step completely intact.
 */
export function pruneHistoricalMessages(
  messages: ChatMessage[],
  config: PruneConfig = DEFAULT_PRUNE_CONFIG,
  keepRecentMessagesCount: number = 2
): ChatMessage[] {
  if (!messages || messages.length === 0) return [];

  const boundaryIndex = Math.max(0, messages.length - keepRecentMessagesCount);

  return messages.map((msg, index) => {
    // Keep most recent messages completely unpruned for active reasoning
    if (index >= boundaryIndex) {
      return msg;
    }

    let modifiedToolCalls: ToolCallInfo[] | null = null;
    let modifiedContent = msg.content;

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      modifiedToolCalls = msg.tool_calls.map((tc) => {
        if (tc.output && tc.output.length > config.thresholdChars) {
          const { text } = pruneToolResultText(tc.output, config);
          return { ...tc, output: text };
        }
        return tc;
      });
    }

    if (msg.role === 'tool' && modifiedContent && modifiedContent.length > config.thresholdChars) {
      const { text } = pruneToolResultText(modifiedContent, config);
      modifiedContent = text;
    }

    if (modifiedToolCalls || modifiedContent !== msg.content) {
      return {
        ...msg,
        content: modifiedContent,
        tool_calls: modifiedToolCalls || msg.tool_calls,
      };
    }

    return msg;
  });
}
