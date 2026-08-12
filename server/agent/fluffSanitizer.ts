/**
 * Sanitizes LLM response content by removing drafts, metadata headers,
 * reasoning fluff, and converting LaTeX arrows to standard unicode arrows.
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
