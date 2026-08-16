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

  // 2. Gemma 4 / Channel format: <|channel>thought ... <channel|> or <|channel|> or </channel> (closed)
  const gemmaThinkRegex = /<\|?channel\|?>?thought([\s\S]*?)(?:<\|?channel\|?>|<\/channel>|<channel\|>|<\|channel\|>)/i;
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

  // Remove XML tool blocks
  cleaned = cleaned.replace(/<patch_file[\s\S]*?(?:<\/patch_file>|$)/gi, '');
  cleaned = cleaned.replace(/<write_file[\s\S]*?(?:<\/write_file>|$)/gi, '');
  cleaned = cleaned.replace(/<read_file[\s\S]*?(?:<\/read_file>|\/>|$)/gi, '');
  cleaned = cleaned.replace(/<list_dir[\s\S]*?(?:<\/list_dir>|\/>|$)/gi, '');
  cleaned = cleaned.replace(/<grep_search[\s\S]*?(?:<\/grep_search>|\/>|$)/gi, '');
  cleaned = cleaned.replace(/<fff_search[\s\S]*?(?:<\/fff_search>|\/>|$)/gi, '');
  cleaned = cleaned.replace(/<web_search[\s\S]*?(?:<\/web_search>|\/>|$)/gi, '');
  cleaned = cleaned.replace(/<read_web_page[\s\S]*?(?:<\/read_web_page>|\/>|$)/gi, '');
  cleaned = cleaned.replace(/<save_knowledge[\s\S]*?(?:<\/save_knowledge>|$)/gi, '');
  cleaned = cleaned.replace(/<search_knowledge[\s\S]*?(?:<\/search_knowledge>|\/>|$)/gi, '');
  cleaned = cleaned.replace(/<list_knowledge[\s\S]*?(?:<\/list_knowledge>|\/>|$)/gi, '');
  cleaned = cleaned.replace(/<update_?user_?profile[\s\S]*?(?:<\/update_?user_?profile>|\/>|>|$)/gi, '');
  cleaned = cleaned.replace(/<update_?persona_?file[\s\S]*?(?:<\/update_?persona_?file>|\/>|>|$)/gi, '');
  cleaned = cleaned.replace(/<execute_command[\s\S]*?(?:<\/execute_command>|$)/gi, '');
  cleaned = cleaned.replace(/<run_scratch_script[\s\S]*?(?:<\/run_scratch_script>|$)/gi, '');
  cleaned = cleaned.replace(/<ask_user[\s\S]*?(?:<\/ask_user>|\/>|$)/gi, '');
  cleaned = cleaned.replace(/<spawn_subagent[\s\S]*?(?:<\/spawn_subagent>|\/>|$)/gi, '');
  cleaned = cleaned.replace(/<tool_?call[\s\S]*?(?:<\/tool_?call>|$)/gi, '');

  // Remove leaked standalone SEARCH/REPLACE markers
  cleaned = cleaned.replace(/<<<<<<< SEARCH[\s\S]*?>>>>>>> REPLACE/gi, '');

  // Remove orphaned standalone closing tags (not part of matched open+close blocks)
  cleaned = cleaned.replace(/<\/(?:read_file|write_file|patch_file|list_dir|grep_search|fff_search|web_search|read_web_page|execute_command|save_knowledge|search_knowledge|list_knowledge|run_scratch_script|ask_user|ask_user_question|spawn_subagent|send_subagent_message|interrupt_subagent|list_subagents|tool_?call|code_run|todo_write|update_?user_?profile|update_?persona_?file|search_sessions|remember_fact|recall_memories)\s*>/gi, '');

  // Clean orphaned ```xml, ```html, ```json fences
  cleaned = cleaned.replace(/```(?:xml|html|json|tsx|ts|bash|sh)?\s*$/gim, '');
  cleaned = cleaned.replace(/```(?:xml|html|json)\s*```/gim, '');

  return cleaned.trim();
}
