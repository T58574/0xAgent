import React from 'react';
import { RefreshCw, Save } from 'lucide-react';
import { KnowledgeCategory } from '../../types';
import { useI18n } from '../../i18n';

interface KnowledgeEditFormProps {
  editTitle: string;
  setEditTitle: (val: string) => void;
  editCategory: KnowledgeCategory;
  setEditCategory: (val: KnowledgeCategory) => void;
  editTags: string;
  setEditTags: (val: string) => void;
  editSummary: string;
  setEditSummary: (val: string) => void;
  editContent: string;
  setEditContent: (val: string) => void;
  editSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export const KnowledgeEditForm: React.FC<KnowledgeEditFormProps> = React.memo(({
  editTitle,
  setEditTitle,
  editCategory,
  setEditCategory,
  editTags,
  setEditTags,
  editSummary,
  setEditSummary,
  editContent,
  setEditContent,
  editSaving,
  onSave,
  onCancel,
}) => {
  const { t } = useI18n();

  return (
    <div className="space-y-3 pt-2 animate-fadeIn">
      <div>
        <label className="text-xs font-medium text-[var(--theme-text-muted)] block mb-1">{t.knowledge.titleLabel}</label>
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bento-card text-sm font-semibold text-[var(--theme-text)] focus:outline-none bg-black/40"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-[var(--theme-text-muted)] block mb-1">{t.knowledge.category}</label>
          <select
            value={editCategory}
            onChange={(e) => setEditCategory(e.target.value as KnowledgeCategory)}
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

        <div>
          <label className="text-xs font-medium text-[var(--theme-text-muted)] block mb-1">{t.knowledge.tagsLabel}</label>
          <input
            type="text"
            value={editTags}
            onChange={(e) => setEditTags(e.target.value)}
            placeholder="tag1, tag2, tag3"
            className="w-full px-3 py-2 rounded-lg bento-card text-xs text-[var(--theme-text)] focus:outline-none bg-black/40"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-[var(--theme-text-muted)] block mb-1">{t.knowledge.summaryLabel}</label>
        <input
          type="text"
          value={editSummary}
          onChange={(e) => setEditSummary(e.target.value)}
          placeholder={t.knowledge.summaryPlaceholder}
          className="w-full px-3 py-2 rounded-lg bento-card text-xs text-[var(--theme-text)] focus:outline-none bg-black/40"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-[var(--theme-text-muted)] block mb-1">{t.knowledge.contentLabel}</label>
        <textarea
          rows={12}
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          className="w-full p-3 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] focus:outline-none bg-black/40"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3.5 py-1.5 rounded-lg bento-card text-xs font-medium text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer"
        >
          {t.knowledge.cancel}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={editSaving}
          className="px-4 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-[var(--theme-border)] text-xs font-medium text-[var(--theme-text)] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          {editSaving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
          <span>{t.knowledge.saveChanges}</span>
        </button>
      </div>
    </div>
  );
});
