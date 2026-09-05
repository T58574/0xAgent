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
 * Helper to convert Markdown tables to structured cards for Telegram HTML
 */
function formatMarkdownTables(text: string): string {
  const tableRegex = /(?:^|\n)((?:\|[^\n]+\|\r?\n)(?:\|[ \t]*:?-+:?[ \t]*)+\|\r?\n(?:\|[^\n]+\|\r?\n?)+)/g;
  return text.replace(tableRegex, (_full, tableContent) => {
    const lines = tableContent.trim().split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
    if (lines.length < 3) return tableContent;

    const parseRow = (line: string): string[] =>
      line
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell: string) => cell.trim());

    const headers = parseRow(lines[0]);
    const dataRows = lines.slice(2).map(parseRow);

    const cleanCell = (cell: string) => cell.replace(/^\*\*|\*\*$/g, '').replace(/^__|__$/g, '').trim();

    const cards = dataRows.map((row: string[]) => {
      if (row.length === 2) {
        return `• <b>${cleanCell(row[0])}:</b> ${row[1]}`;
      }
      const title = cleanCell(row[0] || 'Пункт');
      const details = row
        .slice(1)
        .map((cell: string, idx: number) => {
          const header = cleanCell(headers[idx + 1] || `Параметр ${idx + 1}`);
          return `  ▫️ <i>${header}:</i> ${cell}`;
        })
        .filter(Boolean)
        .join('\n');
      return `• <b>${title}</b>\n${details}`;
    });

    return '\n\n' + cards.join('\n\n') + '\n\n';
  });
}

export function escapeUnsafeHtmlEntities(html: string): string {
  // 1. Escape ampersands not part of standard entity
  let res = html.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');

  // 2. Protect valid Telegram HTML tags
  const allowedTagsRegex = /<\/?(?:b|strong|i|em|u|ins|s|strike|del|span|tg-spoiler|a\b[^>]*|code\b[^>]*|pre\b[^>]*|blockquote\b[^>]*|tg-button\b[^>]*|tg-button-row\b[^>]*)>/gi;
  const validTagTokens: string[] = [];
  res = res.replace(allowedTagsRegex, (match) => {
    const token = `@@TGVALIDTAG_${validTagTokens.length}@@`;
    validTagTokens.push(match);
    return token;
  });

  // 3. Escape all remaining raw < and >
  res = res.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 4. Restore valid Telegram HTML tags
  res = res.replace(/@@TGVALIDTAG_(\d+)@@/g, (_match, idx) => validTagTokens[Number(idx)] || '');

  return res;
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

  // 3. Convert Markdown tables to clean structured cards
  text = formatMarkdownTables(text);

  // 4. Convert markdown list bullets (* item, - item) to clean Telegram unicode bullets
  text = text.replace(/^([ \t]*)[*-]\s+(.+)$/gm, (_match, indent, content) => {
    const bullet = indent.length >= 2 ? '▫️' : '•';
    return `${indent}${bullet} ${content}`;
  });

  // 5. Horizontal dividers (---, ___, ***)
  text = text.replace(/^(?:---|___|\*\*\*)\s*$/gm, '━━━━━━━━━━━━━━━━━━━━━━');

  // 6. Expandable blockquotes: **> quote or **>quote
  text = text.replace(/(?:^\s*\*\*> ?(.*(?:\n\s*\*\*> ?.*)*))/gm, (block) => {
    const content = block
      .split('\n')
      .map((line) => line.replace(/^\s*\*\*> ?/, ''))
      .join('\n');
    return `<blockquote expandable>${content}</blockquote>`;
  });

  // 7. Standard blockquotes: > quote
  text = text.replace(/(?:^\s*> ?(.*(?:\n\s*> ?.*)*))/gm, (block) => {
    const content = block
      .split('\n')
      .map((line) => line.replace(/^\s*> ?/, ''))
      .join('\n');
    return `<blockquote>${content}</blockquote>`;
  });

  // 8. Headers: ### Header -> <b>Header</b>
  text = text.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>');

  // 9. Bold: **text** or __text__
  text = text.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  text = text.replace(/(?<=^|[\s(])__(.+?)__(?=$|[\s),.!?])/g, '<b>$1</b>');

  // 10. Italic: *text* or _text_ (excluding inside identifiers)
  text = text.replace(/(?<=^|[\s(])\*([^*\n]+?)\*(?=$|[\s),.!?])/g, '<i>$1</i>');
  text = text.replace(/(?<=^|[\s(])_([^_\n]+?)_(?=$|[\s),.!?])/g, '<i>$1</i>');

  // 11. Strikethrough: ~~text~~
  text = text.replace(/~~(.+?)~~/g, '<s>$1</s>');

  // 12. Spoilers: ||text||
  text = text.replace(/\|\|(.+?)\|\|/g, '<tg-spoiler>$1</tg-spoiler>');

  // 13. In-Text Buttons (Telegram 13 / Bot API 10.3)
  // 13a. Callback buttons: [🔘 Button Text](btn:data) or [🔘 Button Text](callback:data) or [🔘 Button Text](tg-btn:data)
  text = text.replace(/\[([^\]]+)\]\((?:btn|callback|tg-btn):([^)]+)\)/g, (_match, label, data) => {
    return `<tg-button type="callback_data" data="${escapeHtml(data.trim())}">${escapeHtml(label)}</tg-button>`;
  });

  // 13b. URL buttons: [🌐 Button Text](btn-url:https://...) or [🌐 Button Text](button-url:https://...)
  text = text.replace(/\[([^\]]+)\]\((?:btn-url|button-url):(https?:\/\/[^\s)]+)\)/g, (_match, label, url) => {
    return `<tg-button type="url" url="${escapeHtml(url.trim())}">${escapeHtml(label)}</tg-button>`;
  });

  // 13c. Copy text buttons: [📋 Copy Text](copy:content) or [📋 Copy Text](copy-text:content)
  text = text.replace(/\[([^\]]+)\]\((?:copy|copy-text):([^)]+)\)/g, (_match, label, toCopy) => {
    return `<tg-button type="copy_text" text="${escapeHtml(toCopy.trim())}">${escapeHtml(label)}</tg-button>`;
  });

  // 13d. Auto-wrap multiple adjacent button elements on a single line into <tg-button-row>
  text = text.replace(/(?:^|\n)((?:[ \t]*<tg-button\b[^>]*>.*?<\/tg-button>[ \t]*){2,})(?=\n|$)/g, (_match, group) => {
    const inner = group.trim();
    if (inner.startsWith('<tg-button-row')) return group;
    return `\n<tg-button-row align="center">${inner}</tg-button-row>`;
  });

  // 14. Links: [text](url)
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');

  // 15. Escape any unhandled raw < or > or unescaped &
  text = escapeUnsafeHtmlEntities(text);

  // 16. Restore inline codes
  text = text.replace(/@@TGINLINECODE(\d+)@@/g, (_match, idx) => inlineCodes[Number(idx)] || '');

  // 17. Restore code blocks
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

export function splitHtmlIntoBalancedChunks(html: string, maxChunk: number = 3800): string[] {
  const chunks: string[] = [];
  let rest = html;
  let carryOpenTags: string[] = [];

  while (rest.length > 0) {
    const prefix = carryOpenTags.map((t) => `<${t}>`).join('');
    const targetSlice = Math.max(200, maxChunk - prefix.length - carryOpenTags.length * 10);

    if (rest.length <= targetSlice) {
      chunks.push(prefix + rest);
      break;
    }

    let cut = rest.lastIndexOf('\n\n', targetSlice);
    if (cut === -1 || cut < targetSlice / 2) {
      cut = rest.lastIndexOf('\n', targetSlice);
    }
    if (cut === -1 || cut < targetSlice / 2) {
      cut = rest.lastIndexOf('. ', targetSlice);
      if (cut !== -1) cut += 1;
    }
    if (cut === -1 || cut < targetSlice / 2) {
      cut = rest.lastIndexOf(' ', targetSlice);
    }
    if (cut === -1) {
      cut = targetSlice;
    }

    const chunkContent = rest.slice(0, cut);
    rest = rest.slice(cut).trim();

    const fullChunk = prefix + chunkContent;
    const tagStack: string[] = [];
    const tagRegex = /<\/?([a-zA-Z0-9_-]+)(?:\s+[^>]*)?>/g;
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(fullChunk)) !== null) {
      const fullTag = match[0];
      const tagName = match[1].toLowerCase();
      const isClosing = fullTag.startsWith('</');

      if (isClosing) {
        if (tagStack.length > 0 && tagStack[tagStack.length - 1] === tagName) {
          tagStack.pop();
        }
      } else if (!fullTag.endsWith('/>')) {
        tagStack.push(tagName);
      }
    }

    let suffix = '';
    for (let i = tagStack.length - 1; i >= 0; i--) {
      suffix += `</${tagStack[i]}>`;
    }

    chunks.push(fullChunk + suffix);
    carryOpenTags = [...tagStack];
  }

  return chunks;
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

  // Split into smart chunks <= MAX_CHUNK with balanced HTML tags
  const chunks = splitHtmlIntoBalancedChunks(finalText, MAX_CHUNK);

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
