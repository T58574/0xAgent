/**
 * Sanitizes LLM response content by removing drafts, metadata headers,
 * reasoning fluff, and converting LaTeX arrows to standard unicode arrows.
 * Supports both standard <think>...</think> and Gemma 4 <|channel>thought...<channel|> formats.
 */
export function strip_ai_reasoning_fluff(text: string): string {
  if (!text) return text;
  let cleaned = text;

  cleaned = cleaned.replace(/^(?:Draft\s*\d+:?|\[Draft\s*\d+\])/gim, '');
  cleaned = cleaned.replace(/^(?:Constraints|Topic|Closing)\s*:\s*.*$/gim, '');
  cleaned = cleaned.replace(/\$\s*\\rightarrow\s*\$/gi, '→');
  cleaned = cleaned.replace(/\\rightarrow/gi, '→');
  cleaned = cleaned.replace(/\$\s*\\Rightarrow\s*\$/gi, '⇒');
  cleaned = cleaned.replace(/\\Rightarrow/gi, '⇒');
  cleaned = cleaned.replace(/^(?:Thinking Process|Reasoning Fluff|Draft Notes):\s*/gim, '');

  return cleaned;
}

/**
 * Extracts thinking content from LLM response for display in UI.
 * Supports: <think>...</think>, <thought>...</thought>, <|channel>thought...<channel|>
 * Returns { thinkText, bodyText } — the extracted thinking and the remaining content.
 */
export function extractThinkingBlock(text: string): { thinkText: string; bodyText: string } {
  if (!text) return { thinkText: '', bodyText: text || '' };

  let thinkText = '';
  let bodyText = text;

  // 1. Standard <think>...</think> or <thought>...</thought> (closed)
  const thinkRegex = /<(?:think|thought)>([\s\S]*?)<\/(?:think|thought)>/i;
  const thinkMatch = text.match(thinkRegex);
  if (thinkMatch) {
    thinkText = thinkMatch[1].trim();
    bodyText = text.replace(thinkRegex, '').trim();
    return { thinkText, bodyText };
  }

  // 2. Gemma 4 / Channel format: <|channel>thought ... <channel|> or <channel|thought ... channel|> (closed)
  const gemmaThinkRegex = /<\|?channel\|?thought([\s\S]*?)<\|?channel\|?>/i;
  const gemmaMatch = text.match(gemmaThinkRegex);
  if (gemmaMatch) {
    thinkText = gemmaMatch[1].trim();
    bodyText = text.replace(gemmaThinkRegex, '').trim();
    return { thinkText, bodyText };
  }

  // 3. Standard <think> or <thought> (unclosed / streaming)
  const openThinkMatch = text.match(/<(?:think|thought)>/i);
  if (openThinkMatch && openThinkMatch.index !== undefined) {
    const startIdx = openThinkMatch.index;
    const tagLen = openThinkMatch[0].length;
    thinkText = text.substring(startIdx + tagLen).trim();
    bodyText = text.substring(0, startIdx).trim();
    return { thinkText, bodyText };
  }

  // 4. Gemma 4 <|channel>thought (unclosed / streaming)
  const gemmaOpenMatch = text.match(/<\|?channel\|?thought/i);
  if (gemmaOpenMatch && gemmaOpenMatch.index !== undefined) {
    const startIdx = gemmaOpenMatch.index;
    const tagLen = gemmaOpenMatch[0].length;
    thinkText = text.substring(startIdx + tagLen).trim();
    bodyText = text.substring(0, startIdx).trim();
    return { thinkText, bodyText };
  }

  return { thinkText, bodyText };
}

/**
 * Removes raw XML tool tags and leaked SEARCH/REPLACE patch blocks from body text
 * so the chat UI only displays the model's natural explanation text.
 */
export function stripToolCallTags(text: string): string {
  if (!text) return text;
  let cleaned = text;

  // Remove XML tool blocks (<patch_file>...</patch_file>, <write_file>...</write_file>, <read_file.../>, etc.)
  cleaned = cleaned.replace(/<patch_file[\s\S]*?(?:<\/patch_file>|$)/gi, '');
  cleaned = cleaned.replace(/<write_file[\s\S]*?(?:<\/write_file>|$)/gi, '');
  cleaned = cleaned.replace(/<read_file[\s\S]*?(?:<\/read_file>|\/>|$)/gi, '');
  cleaned = cleaned.replace(/<list_dir[\s\S]*?(?:<\/list_dir>|\/>|$)/gi, '');
  cleaned = cleaned.replace(/<grep_search[\s\S]*?(?:<\/grep_search>|\/>|$)/gi, '');
  cleaned = cleaned.replace(/<tool_?call[\s\S]*?(?:<\/tool_?call>|$)/gi, '');
  cleaned = cleaned.replace(/<execute_command[\s\S]*?(?:<\/execute_command>|$)/gi, '');

  // Remove leaked standalone SEARCH/REPLACE markers
  cleaned = cleaned.replace(/<<<<<<< SEARCH[\s\S]*?>>>>>>> REPLACE/gi, '');

  // Clean orphaned ```xml, ```html, ```json fences
  cleaned = cleaned.replace(/```(?:xml|html|json|tsx|ts|bash|sh)?\s*$/gim, '');
  cleaned = cleaned.replace(/```(?:xml|html|json)\s*```/gim, '');

  return cleaned.trim();
}
