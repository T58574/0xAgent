import React from 'react';
import { Layers, Edit3, Check, Copy, Trash2, Calendar, Sparkles } from 'lucide-react';
import { KnowledgeEntry } from '../../types';
import { NotionMarkdown } from '../NotionMarkdown';
import { useI18n } from '../../i18n';

interface KnowledgeViewerProps {
  selectedEntry: KnowledgeEntry | null;
  isEditing: boolean;
  copied: boolean;
  onStartEdit: () => void;
  onCopyContent: () => void;
  onDelete: (id: string, title: string) => void;
  children?: React.ReactNode;
}

export const KnowledgeViewer: React.FC<KnowledgeViewerProps> = React.memo(({
  selectedEntry,
  isEditing,
  copied,
  onStartEdit,
  onCopyContent,
  onDelete,
  children,
}) => {
  const { t, formatString } = useI18n();

  if (!selectedEntry) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center text-[var(--theme-text-muted)]">
        <Sparkles size={32} className="text-[var(--theme-text-muted)] mb-3 opacity-60" />
        <span className="text-sm font-medium text-[var(--theme-text)]">{t.knowledge.selectToRead}</span>
        <p className="text-xs text-[var(--theme-text-muted)] mt-1 max-w-sm">{t.knowledge.selectToReadDesc}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header Action Bar */}
      <div className="border-b border-[var(--theme-border)] pb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 text-[var(--theme-text)] border border-[var(--theme-border)] font-mono uppercase font-semibold">
              {selectedEntry.category.replace('_', ' ')}
            </span>
            {selectedEntry.source && (
              <span className="text-xs text-[var(--theme-text-muted)] flex items-center gap-1 font-mono">
                <Layers size={12} />
                <span>{selectedEntry.source}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {!isEditing && (
              <button
                type="button"
                onClick={onStartEdit}
                className="px-2.5 py-1 rounded-lg bento-card text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] flex items-center gap-1 transition-colors cursor-pointer"
                title="Edit Entry"
              >
                <Edit3 size={13} />
                <span>{t.knowledge.editBtn}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onCopyContent}
              className="px-2.5 py-1 rounded-lg bento-card text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] flex items-center gap-1 transition-colors cursor-pointer"
              title="Copy content"
            >
              {copied ? <Check size={13} className="text-[var(--theme-text)]" /> : <Copy size={13} />}
              <span>{copied ? t.knowledge.copied : t.knowledge.copyBtn}</span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(selectedEntry.id, selectedEntry.title)}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-[var(--theme-border)] text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] flex items-center gap-1 transition-colors cursor-pointer"
              title="Delete entry"
            >
              <Trash2 size={13} />
              <span>{t.knowledge.deleteBtn}</span>
            </button>
          </div>
        </div>

        {isEditing ? (
          children
        ) : (
          /* NORMAL READING VIEW */
          <>
            <h2 className="text-xl font-bold text-[var(--theme-text)] tracking-tight leading-snug">{selectedEntry.title}</h2>

            <div className="flex items-center gap-4 text-xs text-[var(--theme-text-muted)] font-mono">
              <span className="flex items-center gap-1">
                <Calendar size={13} />
                <span>{formatString(t.knowledge.addedDate, { date: new Date(selectedEntry.createdAt).toLocaleString() })}</span>
              </span>
            </div>

            {selectedEntry.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedEntry.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-md bg-white/5 text-[var(--theme-text-muted)] border border-[var(--theme-border)] font-mono">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {!isEditing && (
        <>
          {/* Summary Box */}
          {selectedEntry.summary && (
            <div className="p-4 rounded-xl bento-card space-y-1 bg-black/30">
              <span className="text-[10px] font-semibold text-[var(--theme-text-muted)] uppercase tracking-wider font-mono block">
                {t.knowledge.summaryTitle}
              </span>
              <p className="text-xs text-[var(--theme-text)] leading-relaxed">{selectedEntry.summary}</p>
            </div>
          )}

          {/* Article Markdown Body */}
          <div className="p-6 rounded-xl bento-card bg-black/20">
            <NotionMarkdown content={selectedEntry.content} />
          </div>
        </>
      )}
    </div>
  );
});
