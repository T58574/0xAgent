import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Check,
  RefreshCw,
  Copy,
  Search,
  Pencil,
  X,
  Database,
} from 'lucide-react';
import { MemoryItem } from '../../../types';
import { useI18n } from '../../../i18n';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Badge } from '../../ui/Badge';
import { Card } from '../../ui/Card';
import { SettingsSection } from '../common';

interface MemoryManagerSectionProps {
  memories: MemoryItem[];
  isLoading: boolean;
  onRefresh: () => void;
  onAddMemory: (key: string, value: string, category: string, scope: 'user' | 'project') => Promise<void>;
  onUpdateMemory: (id: string, updates: { key: string; value: string; category: string; scope: string }) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
}

export const MemoryManagerSection: React.FC<MemoryManagerSectionProps> = ({
  memories,
  isLoading,
  onRefresh,
  onAddMemory,
  onUpdateMemory,
  onDeleteMemory,
}) => {
  const { t } = useI18n();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'global' | 'project'>('all');

  // Add Form state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [newCategory, setNewCategory] = useState<string>('fact');
  const [newScope, setNewScope] = useState<'user' | 'project'>('user');
  const [isAdding, setIsAdding] = useState(false);

  // Inline Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editVal, setEditVal] = useState('');
  const [editCategory, setEditCategory] = useState<string>('fact');
  const [editScope, setEditScope] = useState<'user' | 'project'>('user');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredMemories = useMemo(() => {
    return memories.filter((mem) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        mem.key.toLowerCase().includes(q) ||
        mem.value.toLowerCase().includes(q) ||
        mem.category.toLowerCase().includes(q);

      const matchesCat = categoryFilter === 'all' || mem.category === categoryFilter;
      const isProjectScope = mem.scope === 'project';
      const matchesScope =
        scopeFilter === 'all' ||
        (scopeFilter === 'project' && isProjectScope) ||
        (scopeFilter === 'global' && !isProjectScope);

      return matchesSearch && matchesCat && matchesScope;
    });
  }, [memories, searchQuery, categoryFilter, scopeFilter]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newVal.trim()) return;
    setIsAdding(true);
    try {
      await onAddMemory(newKey.trim(), newVal.trim(), newCategory, newScope);
      setNewKey('');
      setNewVal('');
      setIsAddOpen(false);
    } finally {
      setIsAdding(false);
    }
  };

  const handleStartEdit = (mem: MemoryItem) => {
    setEditingId(mem.id);
    setEditKey(mem.key);
    setEditVal(mem.value);
    setEditCategory(mem.category || 'fact');
    setEditScope((mem.scope as any) || 'user');
  };

  const handleSaveEdit = async (id: string) => {
    if (!editKey.trim() || !editVal.trim()) return;
    setIsSavingEdit(true);
    try {
      await onUpdateMemory(id, {
        key: editKey.trim(),
        value: editVal.trim(),
        category: editCategory,
        scope: editScope,
      });
      setEditingId(null);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCopy = (mem: MemoryItem) => {
    navigator.clipboard.writeText(`${mem.key}: ${mem.value}`);
    setCopiedId(mem.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getBadgeColor = (cat: string) => {
    switch (cat) {
      case 'user_preference':
        return 'border-pink-500/30 text-pink-400 bg-pink-500/10';
      case 'architecture':
        return 'border-purple-500/30 text-purple-400 bg-purple-500/10';
      case 'project_convention':
        return 'border-indigo-500/30 text-indigo-400 bg-indigo-500/10';
      case 'profile':
        return 'border-amber-500/30 text-amber-400 bg-amber-500/10';
      default:
        return 'border-sky-500/30 text-sky-400 bg-sky-500/10';
    }
  };

  return (
    <SettingsSection
      title={t.settings.personas.memorySectionTitle}
      description={t.settings.personas.memorySectionDesc}
      badge="SQLite WAL"
      actionSlot={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="xs"
            onClick={() => setIsAddOpen(!isAddOpen)}
            icon={<Plus size={12} />}
          >
            {t.settings.personas.addFactTitle}
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={onRefresh}
            loading={isLoading}
            icon={<RefreshCw size={12} />}
          >
            {t.common.refresh}
          </Button>
        </div>
      }
    >
      <Card variant="default" className="p-6 space-y-5 rounded-2xl">
        {/* Collapsible Add Form */}
        {isAddOpen && (
          <form onSubmit={handleAddSubmit} className="p-4 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold flex items-center gap-1.5 text-[var(--theme-text)]">
                <Database size={13} className="text-[var(--theme-accent)]" />
                <span>{t.settings.personas.addFactTitle}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-4">
                <Input
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder={t.settings.personas.keyPlaceholder}
                  required
                  className="text-xs font-mono"
                />
              </div>
              <div className="sm:col-span-5">
                <Input
                  value={newVal}
                  onChange={(e) => setNewVal(e.target.value)}
                  placeholder={t.settings.personas.valPlaceholder}
                  required
                  className="text-xs font-mono"
                />
              </div>
              <div className="sm:col-span-3 flex gap-2">
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-input-bg)] text-xs font-mono text-[var(--theme-text)] focus:outline-none cursor-pointer"
                >
                  <option value="fact">Fact</option>
                  <option value="user_preference">User Preference</option>
                  <option value="architecture">Architecture</option>
                  <option value="project_convention">Convention</option>
                  <option value="profile">Profile</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--theme-text-muted)]">Scope:</span>
                <button
                  type="button"
                  onClick={() => setNewScope('user')}
                  className={`px-2.5 py-0.5 rounded-lg text-xs font-mono cursor-pointer border ${
                    newScope === 'user'
                      ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]/15 text-[var(--theme-text)] font-bold'
                      : 'border-transparent text-[var(--theme-text-muted)] hover:bg-[var(--theme-border-subtle)]'
                  }`}
                >
                  Global
                </button>
                <button
                  type="button"
                  onClick={() => setNewScope('project')}
                  className={`px-2.5 py-0.5 rounded-lg text-xs font-mono cursor-pointer border ${
                    newScope === 'project'
                      ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]/15 text-[var(--theme-text)] font-bold'
                      : 'border-transparent text-[var(--theme-text-muted)] hover:bg-[var(--theme-border-subtle)]'
                  }`}
                >
                  Project
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="xs" onClick={() => setIsAddOpen(false)}>
                  {t.settings.personas.cancelEdit}
                </Button>
                <Button variant="accent" size="xs" type="submit" loading={isAdding}>
                  {t.settings.personas.saveFact}
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* Search & Scope Filters Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-0.5">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--theme-text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.settings.personas.searchPlaceholder}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-input-bg)] text-xs text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] focus:outline-none focus:border-[var(--theme-accent)] transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center bg-[var(--theme-input-bg)] p-1 rounded-xl border border-[var(--theme-border)] gap-0.5">
              {(['all', 'global', 'project'] as const).map((sc) => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => setScopeFilter(sc)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-mono capitalize cursor-pointer transition-all ${
                    scopeFilter === sc
                      ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] font-bold shadow-xs border border-[var(--theme-border)]'
                      : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                  }`}
                >
                  {sc === 'all' ? t.settings.personas.scopeAll : sc === 'global' ? t.settings.personas.scopeGlobal : t.settings.personas.scopeProject}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Category Chips Bar */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 text-xs">
          {[
            { id: 'all', label: t.settings.personas.catAll },
            { id: 'fact', label: t.settings.personas.catFact },
            { id: 'user_preference', label: t.settings.personas.catUserPref },
            { id: 'architecture', label: t.settings.personas.catArch },
            { id: 'project_convention', label: t.settings.personas.catProjectConv },
            { id: 'profile', label: t.settings.personas.catProfile },
          ].map((cat) => {
            const isSelected = categoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium shrink-0 cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] border-[var(--theme-accent)] shadow-xs font-semibold'
                    : 'bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] border-[var(--theme-border)]'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Fact Cards List */}
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {filteredMemories.length === 0 ? (
            <div className="py-12 px-6 text-center text-xs text-[var(--theme-text-muted)] rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-input-bg)] space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] flex items-center justify-center mx-auto mb-1 text-[var(--theme-accent)]">
                <Database size={16} className="opacity-70" />
              </div>
              <p className="font-bold text-[var(--theme-text)]">{t.settings.personas.noMemoriesFound}</p>
              <p className="text-[11.5px] max-w-sm mx-auto leading-relaxed opacity-75">
                Добавьте новый факт кнопкой выше или попросите агента в чате запомнить информацию.
              </p>
            </div>
          ) : (
            filteredMemories.map((mem) => {
              const isEditing = editingId === mem.id;
              const isProject = mem.scope === 'project';

              if (isEditing) {
                return (
                  <div
                    key={mem.id}
                    className="p-4 rounded-xl border border-[var(--theme-accent)] bg-[var(--theme-card-bg)] space-y-3 animate-fadeIn"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      <div className="sm:col-span-4">
                        <Input
                          value={editKey}
                          onChange={(e) => setEditKey(e.target.value)}
                          placeholder="Key"
                          className="text-xs font-mono"
                        />
                      </div>
                      <div className="sm:col-span-5">
                        <Input
                          value={editVal}
                          onChange={(e) => setEditVal(e.target.value)}
                          placeholder="Value"
                          className="text-xs font-mono"
                        />
                      </div>
                      <div className="sm:col-span-3 flex gap-2">
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-input-bg)] text-xs font-mono text-[var(--theme-text)] focus:outline-none"
                        >
                          <option value="fact">fact</option>
                          <option value="user_preference">user_preference</option>
                          <option value="architecture">architecture</option>
                          <option value="project_convention">project_convention</option>
                          <option value="profile">profile</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditScope('user')}
                          className={`px-2.5 py-0.5 rounded text-xs font-mono cursor-pointer ${
                            editScope === 'user' ? 'bg-[var(--theme-accent)] text-white font-bold' : 'text-[var(--theme-text-muted)]'
                          }`}
                        >
                          Global
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditScope('project')}
                          className={`px-2.5 py-0.5 rounded text-xs font-mono cursor-pointer ${
                            editScope === 'project' ? 'bg-[var(--theme-accent)] text-white font-bold' : 'text-[var(--theme-text-muted)]'
                          }`}
                        >
                          Project
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="xs" onClick={() => setEditingId(null)}>
                          {t.settings.personas.cancelEdit}
                        </Button>
                        <Button
                          variant="accent"
                          size="xs"
                          onClick={() => handleSaveEdit(mem.id)}
                          loading={isSavingEdit}
                          icon={<Check size={12} />}
                        >
                          {t.settings.personas.saveEdit}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={mem.id}
                  className="p-3.5 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] flex items-center justify-between gap-3.5 hover:border-[var(--theme-border)]/80 transition-all group"
                >
                  <div className="min-w-0 space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs text-[var(--theme-text)]">
                        {mem.key}
                      </span>
                      <span className={`text-[9px] font-mono px-2.5 py-0.5 rounded-full border ${getBadgeColor(mem.category)}`}>
                        {mem.category}
                      </span>
                      <Badge variant="neutral" size="xs">
                        {isProject ? 'Project' : 'Global'}
                      </Badge>
                    </div>
                    <p className="text-[11.5px] font-mono text-[var(--theme-text-muted)] line-clamp-2 select-text leading-relaxed">
                      {mem.value}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(mem)}
                      className="p-1.5 rounded-lg text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-colors cursor-pointer"
                      title={t.settings.personas.editFactTooltip}
                    >
                      <Pencil size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopy(mem)}
                      className="p-1.5 rounded-lg text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-colors cursor-pointer"
                      title={t.common.copy}
                    >
                      {copiedId === mem.id ? (
                        <Check size={13} className="text-emerald-500" />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteMemory(mem.id)}
                      className="p-1.5 rounded-lg text-[var(--theme-text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title={t.settings.personas.deleteFactTooltip}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </SettingsSection>
  );
};
