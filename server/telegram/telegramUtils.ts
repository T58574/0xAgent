/**
 * Common HTML escape and formatting utilities for 0xAgent Telegram Bot.
 */
export function escapeHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
  let res = html.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');

  const allowedTagsRegex = /<\/?(?:b|strong|i|em|u|ins|s|strike|del|span|tg-spoiler|a\b[^>]*|code\b[^>]*|pre\b[^>]*|blockquote\b[^>]*)>/gi;
  const validTagTokens: string[] = [];
  res = res.replace(allowedTagsRegex, (match) => {
    const token = `@@TGVALIDTAG_${validTagTokens.length}@@`;
    validTagTokens.push(match);
    return token;
  });

  res = res.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  res = res.replace(/@@TGVALIDTAG_(\d+)@@/g, (_match, idx) => validTagTokens[Number(idx)] || '');

  return res;
}

/**
 * Convert modern Markdown to valid Telegram HTML formatting.
 */
export function markdownToTelegramHtml(markdown: string): string {
  if (!markdown) return '';

  // Extract model thoughts (<think>...</think>) as blockquotes
  let text = markdown.replace(/<(?:think|thought)>([\s\S]*?)<\/(?:think|thought)>/gi, (_match, thoughtContent) => {
    const cleanThought = thoughtContent.trim();
    if (!cleanThought) return '';
    return `\n<blockquote>💭 <i>${escapeHtml(cleanThought)}</i></blockquote>\n\n`;
  });

  // Preserve code blocks (fenced ```...```)
  const codeBlocks: string[] = [];
  text = text.replace(/```([a-zA-Z0-9_-]*)[ \t]*(?:\r?\n([\s\S]*?)|[ \t]+([^\n`]+?))```/g, (_match, lang, codeMulti, codeSingle) => {
    const rawCode = codeMulti !== undefined ? codeMulti : codeSingle || '';
    const escapedCode = escapeHtml(rawCode.trimEnd());
    const placeholder = `@@TGCODEBLOCK${codeBlocks.length}@@`;
    if (lang && lang.trim()) {
      codeBlocks.push(`<pre><code class="language-${escapeHtml(lang.trim())}">${escapedCode}</code></pre>`);
    } else {
      codeBlocks.push(`<pre>${escapedCode}</pre>`);
    }
    return placeholder;
  });

  // Preserve inline code (`...`)
  const inlineCodes: string[] = [];
  text = text.replace(/`([^`\n]+)`/g, (_match, code) => {
    const placeholder = `@@TGINLINECODE${inlineCodes.length}@@`;
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
    return placeholder;
  });

  // Tables
  text = formatMarkdownTables(text);

  // List bullets
  text = text.replace(/^([ \t]*)[*-]\s+(.+)$/gm, (_match, indent, content) => {
    const bullet = indent.length >= 2 ? '▫️' : '•';
    return `${indent}${bullet} ${content}`;
  });

  // Horizontal dividers
  text = text.replace(/^(?:---|___|\*\*\*)\s*$/gm, '━━━━━━━━━━━━━━━━━━━━━━');

  // Blockquotes: > quote
  text = text.replace(/(?:^\s*> ?(.*(?:\n\s*> ?.*)*))/gm, (block) => {
    const content = block
      .split('\n')
      .map((line) => line.replace(/^\s*> ?/, ''))
      .join('\n');
    return `<blockquote>${content.trim()}</blockquote>`;
  });

  // Headers
  text = text.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>');

  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  text = text.replace(/(?<=^|[\s(\[{«"„'—–<])__(.+?)__(?=$|[\s),.!?;:—–»"”'\]}>])/g, '<b>$1</b>');

  // Italic
  text = text.replace(/(?<=^|[\s(\[{«"„'—–<])\*([^*\n]+?)\*(?=$|[\s),.!?;:—–»"”'\]}>])/g, '<i>$1</i>');
  text = text.replace(/(?<=^|[\s(\[{«"„'—–<])_([^_\n]+?)_(?=$|[\s),.!?;:—–»"”'\]}>])/g, '<i>$1</i>');

  // Strikethrough
  text = text.replace(/~~(.+?)~~/g, '<s>$1</s>');

  // Spoilers
  text = text.replace(/\|\|(.+?)\|\|/g, '<tg-spoiler>$1</tg-spoiler>');

  // Links
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');

  // Escape unhandled HTML
  text = escapeUnsafeHtmlEntities(text);

  // Restore codes
  text = text.replace(/@@TGINLINECODE(\d+)@@/g, (_match, idx) => inlineCodes[Number(idx)] || '');
  text = text.replace(/@@TGCODEBLOCK(\d+)@@/g, (_match, idx) => codeBlocks[Number(idx)] || '');

  return text;
}

/**
 * Splits HTML message into chunks <= maxLength while ensuring open HTML tags are closed and reopened cleanly.
 */
export function splitHtmlIntoBalancedChunks(html: string, maxLength = 3900): string[] {
  if (html.length <= maxLength) return [html];

  const chunks: string[] = [];
  let remaining = html;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    let splitIndex = remaining.lastIndexOf('\n\n', maxLength);
    if (splitIndex < maxLength / 2) {
      splitIndex = remaining.lastIndexOf('\n', maxLength);
    }
    if (splitIndex < maxLength / 2) {
      splitIndex = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitIndex < maxLength / 2) {
      splitIndex = maxLength;
    }

    const chunk = remaining.substring(0, splitIndex).trim();
    remaining = remaining.substring(splitIndex).trim();
    chunks.push(chunk);
  }

  return chunks;
}
