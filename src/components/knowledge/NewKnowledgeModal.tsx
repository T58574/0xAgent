import React from 'react';
import { BookOpen, X, RefreshCw, Check } from 'lucide-react';
import { KnowledgeCategory } from '../../types';
import { useI18n } from '../../i18n';

interface NewKnowledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  newTitle: string;
  setNewTitle: (val: string) => void;
  newCategory: KnowledgeCategory;
  setNewCategory: (val: KnowledgeCategory) => void;
  newTags: string;
  setNewTags: (val: string) => void;
  newSummary: string;
  setNewSummary: (val: string) => void;
  newContent: string;
  setNewContent: (val: string) => void;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export const NewKnowledgeModal: React.FC<NewKnowledgeModalProps> = React.memo(({
  isOpen,
  onClose,
  newTitle,
  setNewTitle,
  newCategory,
  setNewCategory,
  newTags,
  setNewTags,
  newSummary,
  setNewSummary,
  newContent,
  setNewContent,
  saving,
  onSubmit,
}) => {
  const { t } = useI18n();

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fadeIn font-sans"
    >
      <div className="w-full max-w-2xl bento-card border border-[var(--theme-border)] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] bg-[var(--theme-panel)] text-[var(--theme-text)]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-[var(--theme-border)] flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-[var(--theme-text-muted)]" />
            <h3 className="text-xs font-semibold text-[var(--theme-text)]">{t.knowledge.newEntryTitle}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/10 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="p-5 space-y-3.5 overflow-y-auto flex-1 text-xs">
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--theme-text-muted)]">{t.knowledge.titleLabel}</label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t.knowledge.titlePlaceholder}
              className="w-full px-3 py-2 rounded-lg bento-card text-xs font-medium text-[var(--theme-text)] focus:outline-none bg-black/40"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--theme-text-muted)]">{t.knowledge.category}</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as KnowledgeCategory)}
                className="w-full px-3 py-2 rounded-lg bento-card text-xs text-[var(--theme-text)] focus:outline-none bg-black/40 cursor-pointer"
              >
                <option value="strategy">Strategy</option>
                <option value="architecture">Architecture</option>
                <option value="research">Research</option>
                <option value="user_directive">User Directive</option>
                <option value="market_insight">Market Insight</option>
                <option value="general">General</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--theme-text-muted)]">{t.knowledge.tagsLabel}</label>
              <input
                type="text"
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                placeholder={t.knowledge.tagsPlaceholder}
                className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] focus:outline-none bg-black/40"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--theme-text-muted)]">{t.knowledge.summaryLabel}</label>
            <input
              type="text"
              value={newSummary}
              onChange={(e) => setNewSummary(e.target.value)}
              placeholder={t.knowledge.summaryPlaceholder}
              className="w-full px-3 py-2 rounded-lg bento-card text-xs text-[var(--theme-text)] focus:outline-none bg-black/40"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--theme-text-muted)]">{t.knowledge.contentLabel}</label>
            <textarea
              required
              rows={8}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder={t.knowledge.contentPlaceholder}
              className="w-full p-3 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] focus:outline-none bg-black/40"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--theme-border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bento-card text-xs font-medium text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer"
            >
              {t.knowledge.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-[var(--theme-border)] text-xs font-medium text-[var(--theme-text)] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
            >
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
              <span>{t.knowledge.saveToArchive}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});
