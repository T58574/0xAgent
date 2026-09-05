/**
 * Common HTML escape and reply utilities for Veronica Telegram handlers.
 */
export function escapeHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Convert modern Markdown (code blocks, inline code, bold, italics, blockquotes, expandable quotes, spoilers, links)
 * to valid Telegram HTML formatting.
 * Preserves already present valid HTML tags.
 */
export function markdownToTelegramHtml(markdown: string): string {
  if (!markdown) return '';

  // 1. Extract and preserve code blocks (fenced ```...```)
  const codeBlocks: string[] = [];
  let text = markdown.replace(/```([a-zA-Z0-9_-]*)\s*\n([\s\S]*?)```/g, (_match, lang, code) => {
    const escapedCode = escapeHtml(code.trimEnd());
    const placeholder = `@@TGCODEBLOCK${codeBlocks.length}@@`;
    if (lang) {
      codeBlocks.push(`<pre><code class="language-${escapeHtml(lang)}">${escapedCode}</code></pre>`);
    } else {
      codeBlocks.push(`<pre>${escapedCode}</pre>`);
    }
    return placeholder;
  });

  // 2. Extract and preserve inline code (`...`)
  const inlineCodes: string[] = [];
  text = text.replace(/`([^`\n]+)`/g, (_match, code) => {
    const placeholder = `@@TGINLINECODE${inlineCodes.length}@@`;
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
    return placeholder;
  });

  // 3. Expandable blockquotes: **> quote or **>quote
  text = text.replace(/(?:^\s*\*\*> ?(.*(?:\n\s*\*\*> ?.*)*))/gm, (block) => {
    const content = block
      .split('\n')
      .map((line) => line.replace(/^\s*\*\*> ?/, ''))
      .join('\n');
    return `<blockquote expandable>${content}</blockquote>`;
  });

  // 4. Standard blockquotes: > quote
  text = text.replace(/(?:^\s*> ?(.*(?:\n\s*> ?.*)*))/gm, (block) => {
    const content = block
      .split('\n')
      .map((line) => line.replace(/^\s*> ?/, ''))
      .join('\n');
    return `<blockquote>${content}</blockquote>`;
  });

  // 5. Headers: ### Header -> <b>Header</b>
  text = text.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>');

  // 6. Bold: **text** or __text__
  text = text.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  text = text.replace(/(?<=^|[\s(])__(.+?)__(?=$|[\s),.!?])/g, '<b>$1</b>');

  // 7. Italic: *text* or _text_ (excluding inside identifiers)
  text = text.replace(/(?<=^|[\s(])\*([^*\n]+?)\*(?=$|[\s),.!?])/g, '<i>$1</i>');
  text = text.replace(/(?<=^|[\s(])_([^_\n]+?)_(?=$|[\s),.!?])/g, '<i>$1</i>');

  // 8. Strikethrough: ~~text~~
  text = text.replace(/~~(.+?)~~/g, '<s>$1</s>');

  // 9. Spoilers: ||text||
  text = text.replace(/\|\|(.+?)\|\|/g, '<tg-spoiler>$1</tg-spoiler>');

  // 10. Links: [text](url)
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');

  // 11. Restore inline codes
  text = text.replace(/@@TGINLINECODE(\d+)@@/g, (_match, idx) => inlineCodes[Number(idx)] || '');

  // 12. Restore code blocks
  text = text.replace(/@@TGCODEBLOCK(\d+)@@/g, (_match, idx) => codeBlocks[Number(idx)] || '');

  return text;
}

/**
 * Safely send a message, splitting into chunks if length exceeds Telegram's 4096-character limit.
 * Converts markdown to Telegram HTML formatting when parse_mode is HTML.
 * Falls back gracefully to plain text if HTML entity parsing fails.
 */
export async function safeReply(ctx: any, rawText: string, options: any = { parse_mode: 'HTML' }): Promise<any> {
  const MAX_CHUNK = 3800;

  if (!rawText) return;

  const text = options?.parse_mode === 'HTML' ? markdownToTelegramHtml(rawText) : rawText;

  if (text.length <= MAX_CHUNK) {
    try {
      return await ctx.reply(text, options);
    } catch (err: any) {
      if (options?.parse_mode && (err?.message?.includes('entity') || err?.message?.includes('parse') || err?.message?.includes('tag'))) {
        const plain = text.replace(/<[^>]+>/g, '');
        return await ctx.reply(plain, { ...options, parse_mode: undefined });
      }
      throw err;
    }
  }

  // Split into smart chunks <= MAX_CHUNK
  const chunks: string[] = [];
  let rest = text;

  while (rest.length > 0) {
    if (rest.length <= MAX_CHUNK) {
      chunks.push(rest);
      break;
    }

    let cut = rest.lastIndexOf('\n\n', MAX_CHUNK);
    if (cut === -1 || cut < MAX_CHUNK / 2) {
      cut = rest.lastIndexOf('\n', MAX_CHUNK);
    }
    if (cut === -1 || cut < MAX_CHUNK / 2) {
      cut = rest.lastIndexOf('. ', MAX_CHUNK);
      if (cut !== -1) cut += 1;
    }
    if (cut === -1 || cut < MAX_CHUNK / 2) {
      cut = rest.lastIndexOf(' ', MAX_CHUNK);
    }
    if (cut === -1) {
      cut = MAX_CHUNK;
    }

    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }

  let lastRes: any = null;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk) continue;
    const isLast = i === chunks.length - 1;
    const chunkOpts = {
      ...options,
      reply_markup: isLast ? options?.reply_markup : undefined,
    };

    try {
      lastRes = await ctx.reply(chunk, chunkOpts);
    } catch (err: any) {
      const plain = chunk.replace(/<[^>]+>/g, '');
      lastRes = await ctx.reply(plain, { ...chunkOpts, parse_mode: undefined });
    }
  }

  return lastRes;
}
