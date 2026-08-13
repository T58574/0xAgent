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
 * Supports: <think>...</think>, <|channel>thought...<channel|>
 * Returns { thinkText, bodyText } — the extracted thinking and the remaining content.
 */
export function extractThinkingBlock(text: string): { thinkText: string; bodyText: string } {
  if (!text) return { thinkText: '', bodyText: text || '' };

  let thinkText = '';
  let bodyText = text;

  // 1. Standard <think>...</think> (closed)
  const thinkRegex = /<think>([\s\S]*?)<\/think>/i;
  const thinkMatch = text.match(thinkRegex);
  if (thinkMatch) {
    thinkText = thinkMatch[1].trim();
    bodyText = text.replace(thinkRegex, '').trim();
    return { thinkText, bodyText };
  }

  // 2. Gemma 4 format: <|channel>thought ... <channel|> (closed)
  const gemmaThinkRegex = /<\|channel>thought([\s\S]*?)<channel\|>/i;
  const gemmaMatch = text.match(gemmaThinkRegex);
  if (gemmaMatch) {
    thinkText = gemmaMatch[1].trim();
    bodyText = text.replace(gemmaThinkRegex, '').trim();
    return { thinkText, bodyText };
  }

  // 3. Standard <think> (unclosed / streaming)
  if (text.includes('<think>')) {
    const startIdx = text.indexOf('<think>');
    thinkText = text.substring(startIdx + 7).trim();
    bodyText = text.substring(0, startIdx).trim();
    return { thinkText, bodyText };
  }

  // 4. Gemma 4 <|channel>thought (unclosed / streaming)
  const gemmaOpenMatch = text.match(/<\|channel>thought/i);
  if (gemmaOpenMatch && gemmaOpenMatch.index !== undefined) {
    const startIdx = gemmaOpenMatch.index;
    thinkText = text.substring(startIdx + '<|channel>thought'.length).trim();
    bodyText = text.substring(0, startIdx).trim();
    return { thinkText, bodyText };
  }

  return { thinkText, bodyText };
}
