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
 * Safely send a message, splitting into chunks if length exceeds Telegram's 4096-character limit.
 * Falls back gracefully to plain text if HTML entity parsing fails.
 */
export async function safeReply(ctx: any, text: string, options: any = { parse_mode: 'HTML' }): Promise<any> {
  const MAX_CHUNK = 3800;

  if (!text) return;

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
