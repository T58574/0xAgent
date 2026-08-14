import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface NotionMarkdownProps {
  content: string;
}

export const NotionMarkdown: React.FC<NotionMarkdownProps> = ({ content }) => {
  if (!content) return null;

  const renderMathBlocks = (text: string) => {
    // Replace block math $$ ... $$ or \[ ... \]
    const blockMathRegex = /\$\$\s*([\s\S]*?)\s*\$\$|\\\[\s*([\s\S]*?)\s*\\\]/g;
    const parts: Array<{ type: 'text' | 'block-math'; value: string }> = [];
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = blockMathRegex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push({ type: 'text', value: text.substring(lastIdx, match.index) });
      }
      const mathExpr = match[1] || match[2];
      parts.push({ type: 'block-math', value: mathExpr.trim() });
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < text.length) {
      parts.push({ type: 'text', value: text.substring(lastIdx) });
    }
    return parts;
  };

  const textParts = renderMathBlocks(content);

  return (
    <div className="notion-markdown text-slate-100 font-sans leading-relaxed space-y-3 select-text">
      {textParts.map((part, idx) => {
        if (part.type === 'block-math') {
          return (
            <div
              key={idx}
              className="my-3 p-3 rounded-lg border border-[var(--theme-border)] bg-black/40 text-[var(--theme-text)] font-mono text-xs sm:text-sm flex items-center justify-center overflow-x-auto"
            >
              <div className="flex items-center gap-2">
                <span className="text-[var(--theme-text-muted)] font-mono text-xs select-none">∑ math</span>
                <span className="select-all font-medium">{part.value}</span>
              </div>
            </div>
          );
        }
        return <FormattedMarkdownSection key={idx} rawText={part.value} />;
      })}
    </div>
  );
};

const FormattedMarkdownSection: React.FC<{ rawText: string }> = ({ rawText }) => {
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  // Split into code blocks vs non-code blocks
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const elements: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let blockCount = 0;

  while ((match = codeBlockRegex.exec(rawText)) !== null) {
    if (match.index > lastIdx) {
      elements.push(
        <RenderTextParagraphs
          key={`text-${lastIdx}`}
          text={rawText.substring(lastIdx, match.index)}
        />
      );
    }

    const lang = match[1].trim() || 'code';
    const codeContent = match[2].replace(/\n$/, '');
    const codeId = `code-block-${blockCount++}`;

    elements.push(
      <div key={codeId} className="my-3 rounded-xl border border-[var(--theme-border)] bg-black/50 overflow-hidden font-mono shadow-md">
        <div className="flex items-center justify-between px-3.5 py-1.5 bg-black/40 border-b border-[var(--theme-border)] text-[11px] text-[var(--theme-text-muted)] select-none">
          <span className="text-[var(--theme-text)] font-medium lowercase flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--theme-accent)] inline-block" />
            {lang}
          </span>
          <button
            type="button"
            onClick={() => handleCopy(codeContent, codeId)}
            className="flex items-center gap-1 hover:text-[var(--theme-text)] transition-colors cursor-pointer text-[var(--theme-text-muted)] px-2 py-0.5 rounded hover:bg-white/5"
          >
            {copiedCodeId === codeId ? (
              <>
                <Check size={12} className="text-emerald-400" />
                <span className="text-emerald-400 font-sans">Скопировано!</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span className="font-sans">Копировать</span>
              </>
            )}
          </button>
        </div>
        <pre className="p-3.5 text-xs text-[var(--theme-text)] overflow-x-auto whitespace-pre leading-relaxed scrollbar-thin">
          <code>{codeContent}</code>
        </pre>
      </div>
    );

    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < rawText.length) {
    const tail = rawText.substring(lastIdx);
    const unclosedMatch = /^```([a-zA-Z0-9_-]*)\n([\s\S]*)$/.exec(tail);
    if (unclosedMatch) {
      const lang = unclosedMatch[1].trim() || 'code';
      const codeContent = unclosedMatch[2];
      const codeId = `code-block-${blockCount++}`;
      elements.push(
        <div key={codeId} className="my-3 rounded-xl border border-[var(--theme-accent)]/30 bg-black/50 overflow-hidden font-mono shadow-md">
          <div className="flex items-center justify-between px-3.5 py-1.5 bg-black/40 border-b border-[var(--theme-border)] text-[11px] text-[var(--theme-text-muted)] select-none">
            <span className="text-[var(--theme-accent)] font-medium lowercase flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--theme-accent)] animate-pulse inline-block" />
              {lang} (генерация...)
            </span>
          </div>
          <pre className="p-3.5 text-xs text-[var(--theme-text)] overflow-x-auto whitespace-pre leading-relaxed scrollbar-thin">
            <code>{codeContent}</code>
          </pre>
        </div>
      );
    } else {
      elements.push(
        <RenderTextParagraphs key={`text-${lastIdx}`} text={tail} />
      );
    }
  }

  return <>{elements}</>;
};

const RenderTextParagraphs: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let inTable = false;
  let tableLines: string[] = [];

  const flushTable = (keyIndex: number) => {
    if (tableLines.length > 0) {
      renderedElements.push(<RenderNotionTable key={`table-${keyIndex}`} lines={tableLines} />);
      tableLines = [];
      inTable = false;
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Table detection
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      inTable = true;
      tableLines.push(trimmed);
      return;
    } else if (inTable) {
      flushTable(index);
    }

    // Callout boxes (> [!NOTE], etc.)
    if (trimmed.startsWith('>')) {
      renderedElements.push(<RenderNotionCallout key={`callout-${index}`} line={line} />);
      return;
    }

    // Headers
    if (trimmed.startsWith('# ')) {
      renderedElements.push(
        <h1 key={`h1-${index}`} className="text-base sm:text-lg font-bold text-[var(--theme-text)] mt-4 mb-2 pb-1 border-b border-[var(--theme-border)] font-sans tracking-tight">
          {trimmed.substring(2)}
        </h1>
      );
      return;
    }
    if (trimmed.startsWith('## ')) {
      renderedElements.push(
        <h2 key={`h2-${index}`} className="text-sm sm:text-base font-semibold text-[var(--theme-text)] mt-3 mb-1.5 font-sans tracking-tight flex items-center gap-1.5">
          <span className="text-[var(--theme-accent)] font-bold font-mono">›</span>
          <span>{trimmed.substring(3)}</span>
        </h2>
      );
      return;
    }
    if (trimmed.startsWith('### ')) {
      renderedElements.push(
        <h3 key={`h3-${index}`} className="text-xs sm:text-sm font-semibold text-[var(--theme-text-muted)] mt-2 mb-1 font-sans">
          {trimmed.substring(4)}
        </h3>
      );
      return;
    }

    // Checklist items
    if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ')) {
      const isChecked = trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ');
      const checkText = trimmed.substring(6);
      renderedElements.push(
        <div key={`check-${index}`} className="flex items-start gap-2 my-1 text-[13.5px] text-[var(--theme-text)] font-sans">
          <input
            type="checkbox"
            checked={isChecked}
            readOnly
            className="mt-0.5 rounded border-[var(--theme-border)] bg-black/40 text-[var(--theme-accent,#38bdf8)] focus:ring-0 cursor-default"
          />
          <span className={isChecked ? 'line-through opacity-50' : ''}>
            <InlineFormattedText text={checkText} />
          </span>
        </div>
      );
      return;
    }

    // Bullet point
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      renderedElements.push(
        <div key={`bullet-${index}`} className="flex items-start gap-2 my-1 text-[13.5px] text-[var(--theme-text)] font-sans pl-2">
          <span className="text-[var(--theme-accent,#38bdf8)] font-bold select-none">•</span>
          <span><InlineFormattedText text={trimmed.substring(2)} /></span>
        </div>
      );
      return;
    }

    // Empty line
    if (!trimmed) {
      renderedElements.push(<div key={`blank-${index}`} className="h-1.5" />);
      return;
    }

    // Standard paragraph
    renderedElements.push(
      <p key={`p-${index}`} className="my-1 text-[13.5px] text-[var(--theme-text)] leading-relaxed font-sans">
        <InlineFormattedText text={line} />
      </p>
    );
  });

  flushTable(lines.length);

  return <>{renderedElements}</>;
};

const InlineFormattedText: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;

  // Split by inline code blocks and math blocks first to avoid formatting inside code/math
  const parts = text.split(/(`[^`]+`|\$[^\$]+\$)/g);

  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
          return (
            <code
              key={idx}
              className="px-1.5 py-0.5 mx-0.5 rounded bg-slate-800 text-emerald-300 font-mono text-[11px] border border-white/10"
            >
              {part.substring(1, part.length - 1)}
            </code>
          );
        }
        if (part.startsWith('$') && part.endsWith('$') && part.length >= 2) {
          return (
            <span
              key={idx}
              className="px-1.5 py-0.5 mx-0.5 rounded-md bg-white/10 text-[var(--theme-text)] font-mono text-xs border border-[var(--theme-border)]"
            >
              {part.substring(1, part.length - 1)}
            </span>
          );
        }
        return <FormattedSubSpan key={idx} subtext={part} />;
      })}
    </>
  );
};

const FormattedSubSpan: React.FC<{ subtext: string }> = ({ subtext }) => {
  const regex = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|~~[^~]+~~|\*[^*]+\*|_[^_]+_)/g;
  const subparts = subtext.split(regex);

  return (
    <>
      {subparts.map((sub, i) => {
        const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(sub);
        if (linkMatch) {
          return (
            <a
              key={i}
              href={linkMatch[2]}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 hover:text-emerald-300 underline font-medium cursor-pointer transition-colors"
            >
              {linkMatch[1]}
            </a>
          );
        }

        if (sub.startsWith('**') && sub.endsWith('**') && sub.length >= 4) {
          return (
            <strong key={i} className="font-semibold text-slate-100">
              {sub.substring(2, sub.length - 2)}
            </strong>
          );
        }

        if (sub.startsWith('~~') && sub.endsWith('~~') && sub.length >= 4) {
          return (
            <del key={i} className="line-through text-slate-400">
              {sub.substring(2, sub.length - 2)}
            </del>
          );
        }

        if (
          ((sub.startsWith('*') && sub.endsWith('*')) || (sub.startsWith('_') && sub.endsWith('_'))) &&
          sub.length >= 2
        ) {
          return (
            <em key={i} className="italic text-slate-200">
              {sub.substring(1, sub.length - 1)}
            </em>
          );
        }

        return sub;
      })}
    </>
  );
};

const RenderNotionCallout: React.FC<{ line: string }> = ({ line }) => {
  let content = line.substring(1).trim();
  let type: 'note' | 'tip' | 'warning' | 'important' | 'caution' | 'quote' = 'quote';

  if (content.startsWith('[!NOTE]')) {
    type = 'note';
    content = content.replace('[!NOTE]', '').trim();
  } else if (content.startsWith('[!TIP]')) {
    type = 'tip';
    content = content.replace('[!TIP]', '').trim();
  } else if (content.startsWith('[!WARNING]')) {
    type = 'warning';
    content = content.replace('[!WARNING]', '').trim();
  } else if (content.startsWith('[!IMPORTANT]')) {
    type = 'important';
    content = content.replace('[!IMPORTANT]', '').trim();
  } else if (content.startsWith('[!CAUTION]')) {
    type = 'caution';
    content = content.replace('[!CAUTION]', '').trim();
  }

  const styles = {
    note: { border: 'border-[var(--theme-accent)]/40', bg: 'bg-[var(--theme-accent)]/10', text: 'text-[var(--theme-text)]', badge: '[NOTE]', badgeClass: 'text-[var(--theme-accent)] font-bold' },
    tip: { border: 'border-[var(--theme-accent)]/40', bg: 'bg-[var(--theme-accent)]/10', text: 'text-[var(--theme-text)]', badge: '[TIP]', badgeClass: 'text-[var(--theme-accent)] font-bold' },
    warning: { border: 'border-amber-500/40', bg: 'bg-amber-950/20', text: 'text-amber-200', badge: '[WARN]', badgeClass: 'text-amber-400 font-bold' },
    important: { border: 'border-[var(--theme-accent)]/50', bg: 'bg-[var(--theme-accent)]/15', text: 'text-[var(--theme-text)]', badge: '[IMPORTANT]', badgeClass: 'text-[var(--theme-accent)] font-bold' },
    caution: { border: 'border-red-500/40', bg: 'bg-red-950/20', text: 'text-red-200', badge: '[CAUTION]', badgeClass: 'text-red-400 font-bold' },
    quote: { border: 'border-[var(--theme-border)]', bg: 'bg-black/30', text: 'text-[var(--theme-text-muted)]', badge: '[>]', badgeClass: 'text-[var(--theme-text-muted)]' },
  }[type];

  return (
    <div className={`my-2.5 p-3 rounded-xl border-l-4 ${styles.border} ${styles.bg} ${styles.text} text-xs sm:text-sm flex items-start gap-2.5 shadow-sm font-sans`}>
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/40 border border-[var(--theme-border)] shrink-0 select-none ${styles.badgeClass}`}>
        {styles.badge}
      </span>
      <div className="flex-1 whitespace-pre-wrap font-sans leading-relaxed">
        <InlineFormattedText text={content} />
      </div>
    </div>
  );
};

const RenderNotionTable: React.FC<{ lines: string[] }> = ({ lines }) => {
  if (lines.length === 0) return null;

  const parseRow = (rowStr: string) => {
    return rowStr
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
  };

  const headerCells = parseRow(lines[0]);
  const bodyRows = lines
    .slice(1)
    .filter((l) => !l.includes('---'))
    .map(parseRow);

  return (
    <div className="my-3 overflow-x-auto rounded-xl border border-[var(--theme-border)] shadow-sm bg-black/30">
      <table className="w-full text-xs text-left border-collapse font-sans">
        <thead className="bg-black/50 text-[var(--theme-text)] border-b border-[var(--theme-border)] font-semibold">
          <tr>
            {headerCells.map((cell, idx) => (
              <th key={idx} className="px-3.5 py-2">
                <InlineFormattedText text={cell} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--theme-border)]/40 text-[var(--theme-text-muted)]">
          {bodyRows.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-white/5 transition-colors">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-3.5 py-2">
                  <InlineFormattedText text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
