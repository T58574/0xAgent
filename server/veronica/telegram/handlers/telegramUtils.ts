import fs from 'node:fs';
import path from 'node:path';
import { InlineKeyboard, InputFile } from 'grammy';

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
 * Convert modern Markdown (code blocks, inline code, bold, italics, blockquotes, expandable quotes, spoilers, links, in-text buttons)
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

  // 10. In-Text Buttons (Telegram 13 / Bot API 10.3)
  // 10a. Callback buttons: [🔘 Button Text](btn:data) or [🔘 Button Text](callback:data) or [🔘 Button Text](tg-btn:data)
  text = text.replace(/\[([^\]]+)\]\((?:btn|callback|tg-btn):([^)]+)\)/g, (_match, label, data) => {
    return `<tg-button type="callback_data" data="${escapeHtml(data.trim())}">${escapeHtml(label)}</tg-button>`;
  });

  // 10b. URL buttons: [🌐 Button Text](btn-url:https://...) or [🌐 Button Text](button-url:https://...)
  text = text.replace(/\[([^\]]+)\]\((?:btn-url|button-url):(https?:\/\/[^\s)]+)\)/g, (_match, label, url) => {
    return `<tg-button type="url" url="${escapeHtml(url.trim())}">${escapeHtml(label)}</tg-button>`;
  });

  // 10c. Copy text buttons: [📋 Copy Text](copy:content) or [📋 Copy Text](copy-text:content)
  text = text.replace(/\[([^\]]+)\]\((?:copy|copy-text):([^)]+)\)/g, (_match, label, toCopy) => {
    return `<tg-button type="copy_text" text="${escapeHtml(toCopy.trim())}">${escapeHtml(label)}</tg-button>`;
  });

  // 10d. Auto-wrap multiple adjacent button elements on a single line into <tg-button-row>
  text = text.replace(/(?:^|\n)((?:[ \t]*<tg-button\b[^>]*>.*?<\/tg-button>[ \t]*){2,})(?=\n|$)/g, (_match, group) => {
    const inner = group.trim();
    if (inner.startsWith('<tg-button-row')) return group;
    return `\n<tg-button-row align="center">${inner}</tg-button-row>`;
  });

  // 11. Links: [text](url)
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');

  // 12. Restore inline codes
  text = text.replace(/@@TGINLINECODE(\d+)@@/g, (_match, idx) => inlineCodes[Number(idx)] || '');

  // 13. Restore code blocks
  text = text.replace(/@@TGCODEBLOCK(\d+)@@/g, (_match, idx) => codeBlocks[Number(idx)] || '');

  return text;
}

/**
 * Extract in-text <tg-button> and <tg-button-row> elements into a standard Grammy InlineKeyboard,
 * returning the cleaned HTML and the keyboard if buttons were found.
 * Provides backwards compatibility for clients or endpoints without native rich button support.
 */
export function extractButtonsToInlineKeyboard(html: string): { cleanedHtml: string; keyboard?: InlineKeyboard } {
  if (!html.includes('<tg-button')) {
    return { cleanedHtml: html };
  }

  const keyboard = new InlineKeyboard();
  let hasButtons = false;

  // Process rows first
  const rowRegex = /<tg-button-row\b[^>]*>([\s\S]*?)<\/tg-button-row>/gi;
  const textWithoutRows = html.replace(rowRegex, (_match, rowContent) => {
    const btnRegex = /<tg-button\s+([^>]*?)>(.*?)<\/tg-button>/gi;
    let rowAdded = false;
    let btnMatch;
    while ((btnMatch = btnRegex.exec(rowContent)) !== null) {
      const attrs = btnMatch[1];
      const label = btnMatch[2].replace(/<[^>]+>/g, '').trim();
      const typeMatch = attrs.match(/type="([^"]+)"/i);
      const dataMatch = attrs.match(/data="([^"]+)"/i);
      const urlMatch = attrs.match(/url="([^"]+)"/i);

      const type = typeMatch ? typeMatch[1] : 'callback_data';
      if (type === 'callback_data' && dataMatch) {
        keyboard.text(label, dataMatch[1]);
        hasButtons = true;
        rowAdded = true;
      } else if (type === 'url' && urlMatch) {
        keyboard.url(label, urlMatch[1]);
        hasButtons = true;
        rowAdded = true;
      }
    }
    if (rowAdded) {
      keyboard.row();
    }
    return '';
  });

  // Process any standalone buttons
  const standaloneBtnRegex = /<tg-button\s+([^>]*?)>(.*?)<\/tg-button>/gi;
  const cleanedHtml = textWithoutRows.replace(standaloneBtnRegex, (_match, attrs, labelHtml) => {
    const label = labelHtml.replace(/<[^>]+>/g, '').trim();
    const typeMatch = attrs.match(/type="([^"]+)"/i);
    const dataMatch = attrs.match(/data="([^"]+)"/i);
    const urlMatch = attrs.match(/url="([^"]+)"/i);

    const type = typeMatch ? typeMatch[1] : 'callback_data';
    if (type === 'callback_data' && dataMatch) {
      keyboard.text(label, dataMatch[1]).row();
      hasButtons = true;
    } else if (type === 'url' && urlMatch) {
      keyboard.url(label, urlMatch[1]).row();
      hasButtons = true;
    }
    return '';
  }).trim();

  return {
    cleanedHtml,
    keyboard: hasButtons ? keyboard : undefined,
  };
}

/**
 * Safely send a message, splitting into chunks if length exceeds Telegram's 4096-character limit.
 * Converts markdown to Telegram HTML formatting when parse_mode is HTML.
 * Supports native in-message buttons via sendRichMessage with automatic fallback to InlineKeyboard.
 * Falls back gracefully to plain text if HTML entity parsing fails.
 */
export async function safeReply(ctx: any, rawText: string, options: any = { parse_mode: 'HTML' }): Promise<any> {
  const MAX_CHUNK = 3800;

  if (!rawText) return;

  const text = options?.parse_mode === 'HTML' ? markdownToTelegramHtml(rawText) : rawText;

  // If text contains rich in-message buttons (<tg-button), try sendRichMessage first
  const hasRichElements = text.includes('<tg-button') || text.includes('<tg-button-row');
  if (hasRichElements && typeof (ctx.api?.raw as any)?.sendRichMessage === 'function' && ctx.chat?.id) {
    try {
      return await (ctx.api.raw as any).sendRichMessage({
        chat_id: ctx.chat.id,
        rich_message: { html: text },
      });
    } catch {
      // If sendRichMessage fails or is rejected, gracefully fall through to standard sendMessage with InlineKeyboard
    }
  }

  // Graceful fallback for buttons: extract to InlineKeyboard if rich message wasn't delivered
  let finalText = text;
  let finalMarkup = options?.reply_markup;
  if (hasRichElements) {
    const extracted = extractButtonsToInlineKeyboard(text);
    finalText = extracted.cleanedHtml;
    if (extracted.keyboard) {
      finalMarkup = extracted.keyboard;
    }
  }

  const effectiveOpts = {
    ...options,
    reply_markup: finalMarkup,
  };

  if (finalText.length <= MAX_CHUNK) {
    try {
      return await ctx.reply(finalText, effectiveOpts);
    } catch (err: any) {
      if (options?.parse_mode && (err?.message?.includes('entity') || err?.message?.includes('parse') || err?.message?.includes('tag'))) {
        const plain = finalText.replace(/<[^>]+>/g, '');
        return await ctx.reply(plain, { ...effectiveOpts, parse_mode: undefined });
      }
      throw err;
    }
  }

  // Split into smart chunks <= MAX_CHUNK
  const chunks: string[] = [];
  let rest = finalText;

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
      ...effectiveOpts,
      reply_markup: isLast ? effectiveOpts.reply_markup : undefined,
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

/**
 * Safely send a file or document into the chat with optional formatted caption.
 */
export async function safeReplyWithDocument(
  ctx: any,
  fileInput: string | Buffer,
  options: {
    filename?: string;
    caption?: string;
    parse_mode?: 'HTML';
    reply_markup?: any;
  } = {}
): Promise<any> {
  let inputFile: InputFile;
  if (typeof fileInput === 'string') {
    if (!fs.existsSync(fileInput)) {
      throw new Error(`File not found on disk: ${fileInput}`);
    }
    const resolvedName = options.filename || path.basename(fileInput);
    inputFile = new InputFile(fileInput, resolvedName);
  } else {
    const resolvedName = options.filename || 'attachment.dat';
    inputFile = new InputFile(fileInput, resolvedName);
  }

  const formattedCaption = options.caption ? markdownToTelegramHtml(options.caption) : undefined;
  const replyOpts: any = {
    caption: formattedCaption,
    parse_mode: options.parse_mode || (formattedCaption ? 'HTML' : undefined),
    reply_markup: options.reply_markup,
  };

  if (typeof ctx.replyWithDocument === 'function') {
    return await ctx.replyWithDocument(inputFile, replyOpts);
  } else if (ctx.api?.sendDocument && ctx.chat?.id) {
    return await ctx.api.sendDocument(ctx.chat.id, inputFile, replyOpts);
  }
}

/**
 * Scans Veronica response text for file attachment directives:
 * [file: path/to/file.ext] or [document: path/to/file.ext]
 * Resolves paths (including project relative), sends them as documents, and replaces the tag with a badge.
 */
export async function handleResponseAttachments(
  ctx: any,
  replyText: string,
  activeProjectDirectory?: string
): Promise<string> {
  if (!replyText) return '';

  const filePattern = /\[(?:file|document|attachment):\s*([^\]]+)\]/gi;
  const matches = Array.from(replyText.matchAll(filePattern));
  if (matches.length === 0) return replyText;

  let cleanedText = replyText;
  for (const match of matches) {
    const rawPath = match[1].trim();
    let resolvedPath = rawPath;

    if (!path.isAbsolute(resolvedPath) && activeProjectDirectory) {
      const candidate = path.resolve(activeProjectDirectory, resolvedPath);
      if (fs.existsSync(candidate)) {
        resolvedPath = candidate;
      }
    }

    if (fs.existsSync(resolvedPath)) {
      const filename = path.basename(resolvedPath);
      try {
        await safeReplyWithDocument(ctx, resolvedPath, {
          filename,
          caption: `📎 <b>Файл:</b> <code>${escapeHtml(filename)}</code>`,
        });
        cleanedText = cleanedText.replace(
          match[0],
          `📎 <i>Файл <code>${escapeHtml(filename)}</code> отправлен во вложении.</i>`
        );
      } catch (err) {
        console.error('[Veronica Telegram] Failed to send document attachment:', err);
      }
    }
  }
  return cleanedText;
}

/**
 * Smooth UX transition: if a status message bubble exists, edits it with the response
 * so the user sees a single uninterrupted message without jumping bubbles.
 */
export async function deliverWithStatusTransition(
  ctx: any,
  statusMsg: any,
  rawText: string,
  options: any = { parse_mode: 'HTML' }
): Promise<any> {
  const MAX_CHUNK = 3800;
  if (!rawText) return;

  const formatted = options?.parse_mode === 'HTML' ? markdownToTelegramHtml(rawText) : rawText;

  if (statusMsg && formatted.length <= MAX_CHUNK && !formatted.includes('<tg-button')) {
    try {
      return await ctx.api.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        formatted,
        options
      );
    } catch {
      try {
        await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
      } catch {}
    }
  } else if (statusMsg) {
    try {
      await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
    } catch {}
  }

  return await safeReply(ctx, rawText, options);
}
