import React from 'react';
import { BookOpen, Search, RefreshCw } from 'lucide-react';
import { KnowledgeEntry } from '../../types';
import { useI18n } from '../../i18n';

interface KnowledgeListProps {
  entries: KnowledgeEntry[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  selectedEntryId: string | null;
  onSelectEntry: (entry: KnowledgeEntry) => void;
  loading: boolean;
}

export const KnowledgeList: React.FC<KnowledgeListProps> = React.memo(({
  entries,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  selectedEntryId,
  onSelectEntry,
  loading,
}) => {
  const { t } = useI18n();

  const categoriesList = [
    { id: 'all', label: t.knowledge.catAll },
    { id: 'strategy', label: t.knowledge.catStrategy },
    { id: 'architecture', label: t.knowledge.catArchitecture },
    { id: 'research', label: t.knowledge.catResearch },
    { id: 'user_directive', label: t.knowledge.catDirective },
    { id: 'market_insight', label: t.knowledge.catMarket },
    { id: 'general', label: t.knowledge.catGeneral },
  ];

  return (
    <div className="w-80 md:w-96 border-r border-[var(--theme-border)] bg-[var(--theme-panel)] flex flex-col shrink-0 overflow-hidden">
      {/* Search bar */}
      <div className="p-3 border-b border-[var(--theme-border)]">
        <form onSubmit={onSearchSubmit} className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t.knowledge.searchPlaceholder}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bento-card text-xs text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] bg-black/40 focus:outline-none"
          />
          <Search size={13} className="absolute left-2.5 top-2 text-[var(--theme-text-muted)]" />
        </form>
      </div>

      {/* Category Chips */}
      <div className="px-3 py-2 border-b border-[var(--theme-border)] flex items-center gap-1.5 overflow-x-auto scrollbar-none select-none">
        {categoriesList.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelectCategory(cat.id)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer border ${
              selectedCategory === cat.id
                ? 'bg-white/15 text-[var(--theme-text)] border-[var(--theme-border)] font-semibold shadow-sm'
                : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* List of Entries */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 scrollbar-thin">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-[var(--theme-text-muted)] text-xs">
            <RefreshCw size={16} className="animate-spin text-[var(--theme-text-muted)]" />
            <span>{t.common.loading}</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center p-4">
            <BookOpen size={24} className="text-[var(--theme-text-muted)] mb-2" />
            <span className="text-xs text-[var(--theme-text)] font-medium">{t.knowledge.emptyVault}</span>
            <p className="text-[11px] text-[var(--theme-text-muted)] mt-1">{t.knowledge.emptyVaultDesc}</p>
          </div>
        ) : (
          entries.map((item) => {
            const isSelected = selectedEntryId === item.id;
            return (
              <div
                key={item.id}
                onClick={() => onSelectEntry(item)}
                className={`p-3 rounded-lg bento-card cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-white/10 border-[var(--theme-border)] text-[var(--theme-text)] shadow-sm'
                    : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/10 text-[var(--theme-text)] border border-[var(--theme-border)] uppercase font-mono">
                    {item.category.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] text-[var(--theme-text-muted)] font-mono">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <h4 className="text-xs font-semibold text-[var(--theme-text)] line-clamp-1 mb-1">{item.title}</h4>
                {item.summary && (
                  <p className="text-[11px] text-[var(--theme-text-muted)] line-clamp-2 leading-relaxed mb-2">{item.summary}</p>
                )}

                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[9px] px-1.5 py-0.2 rounded-md bg-white/5 text-[var(--theme-text-muted)] font-mono">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});
