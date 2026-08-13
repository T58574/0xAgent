import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Search,
  Plus,
  Trash2,
  Calendar,
  Layers,
  X,
  Check,
  Copy,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { KnowledgeEntry, KnowledgeCategory } from '../types';
import * as api from '../services/api';
import { useToast } from '../context/ToastContext';

export const KnowledgeVault: React.FC = () => {
  const { showToast } = useToast();

  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [_categories, setCategories] = useState<{ category: string; count: number }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  // New Entry Modal state
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCategory, setNewCategory] = useState<KnowledgeCategory>('strategy');
  const [newSummary, setNewSummary] = useState<string>('');
  const [newContent, setNewContent] = useState<string>('');
  const [newTags, setNewTags] = useState<string>('');
  const [newSource, _setNewSource] = useState<string>('User Directive');
  const [saving, setSaving] = useState<boolean>(false);

  const fetchKnowledge = async () => {
    setLoading(true);
    try {
      const [fetchedEntries, fetchedCategories] = await Promise.all([
        api.get_knowledge_entries({
          query: searchQuery.trim() || undefined,
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
        }),
        api.get_knowledge_categories(),
      ]);

      setEntries(fetchedEntries);
      setCategories(fetchedCategories);

      if (fetchedEntries.length > 0) {
        if (!selectedEntry || !fetchedEntries.some(e => e.id === selectedEntry.id)) {
          setSelectedEntry(fetchedEntries[0]);
        } else {
          const updated = fetchedEntries.find(e => e.id === selectedEntry.id);
          if (updated) setSelectedEntry(updated);
        }
      } else {
        setSelectedEntry(null);
      }
    } catch (err: any) {
      console.error('Failed to load Knowledge Vault:', err);
      showToast('Ошибка загрузки Архива Знаний: ' + (err.message || err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKnowledge();
  }, [selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchKnowledge();
  };

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      showToast('Заголовок и содержимое обязательны для заполнения', 'error');
      return;
    }

    setSaving(true);
    try {
      const tagsArray = newTags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const created = await api.save_knowledge_entry({
        title: newTitle.trim(),
        category: newCategory,
        summary: newSummary.trim() || undefined,
        content: newContent.trim(),
        tags: tagsArray,
        source: newSource.trim() || 'User Directive',
      });

      showToast(`Запись "${created.title}" успешно сохранена в Архив!`, 'success');
      setModalOpen(false);
      setNewTitle('');
      setNewSummary('');
      setNewContent('');
      setNewTags('');
      setSelectedEntry(created);
      fetchKnowledge();
    } catch (err: any) {
      showToast('Ошибка при сохранении статьи: ' + (err.message || err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Вы уверены, что хотите удалить статью "${title}" из Архива Знаний?`)) {
      return;
    }

    try {
      await api.delete_knowledge_entry(id);
      showToast(`Статья "${title}" удалена.`, 'success');
      if (selectedEntry?.id === id) {
        setSelectedEntry(null);
      }
      fetchKnowledge();
    } catch (err: any) {
      showToast('Ошибка при удалении: ' + (err.message || err), 'error');
    }
  };

  const handleCopyContent = () => {
    if (!selectedEntry) return;
    navigator.clipboard.writeText(selectedEntry.content).then(() => {
      setCopied(true);
      showToast('Текст скопирован в буфер обмена!', 'success');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const getCategoryColor = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'strategy':
        return 'bg-amber-500/15 border-amber-500/30 text-amber-300';
      case 'architecture':
        return 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300';
      case 'research':
        return 'bg-violet-500/15 border-violet-500/30 text-violet-300';
      case 'user_directive':
        return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300';
      case 'market_insight':
        return 'bg-rose-500/15 border-rose-500/30 text-rose-300';
      default:
        return 'bg-slate-500/15 border-slate-500/30 text-slate-300';
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-theme-bg text-theme-text overflow-hidden font-sans">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.08] bg-black/40 backdrop-blur-xl flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-400">
            <BookOpen size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
              <span>Knowledge Vault</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/40 font-mono">
                {entries.length} записей
              </span>
            </h1>
            <p className="text-xs text-slate-400">Внешний мозг и архив стратегических инсайтов 0xAgent</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchKnowledge}
            className="p-2 rounded-lg bg-white/[0.05] border border-white/10 hover:border-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Обновить список"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-lg shadow-violet-600/25 transition-all cursor-pointer"
          >
            <Plus size={15} />
            <span>Добавить запись</span>
          </button>
        </div>
      </div>

      {/* Main Area: Split Screen */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Filter, Search & Entries List */}
        <div className="w-80 md:w-96 border-r border-white/[0.08] bg-black/20 flex flex-col shrink-0 overflow-hidden">
          {/* Search bar */}
          <div className="p-3 border-b border-white/[0.08]">
            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Поиск по статьям и тегам..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition-colors"
              />
              <Search size={14} className="absolute left-3 top-2 text-slate-400" />
            </form>
          </div>

          {/* Category Tabs */}
          <div className="px-3 py-2 border-b border-white/[0.08] flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-violet-500/25 text-violet-300 border border-violet-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              Все
            </button>
            {['strategy', 'architecture', 'research', 'user_directive', 'market_insight', 'general'].map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium capitalize whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-violet-500/25 text-violet-300 border border-violet-500/40'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                {cat.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* List of Entries */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-500 text-xs">
                <RefreshCw size={18} className="animate-spin text-violet-400" />
                <span>Загрузка записей...</span>
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center p-4">
                <BookOpen size={28} className="text-slate-600 mb-2" />
                <span className="text-xs text-slate-400 font-medium">Архив пока пуст</span>
                <p className="text-[11px] text-slate-500 mt-1">Добавьте первую статью или попросите 0xAgent сохранить инсайт</p>
              </div>
            ) : (
              entries.map(item => {
                const isSelected = selectedEntry?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedEntry(item)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-violet-500/10 border-violet-500/40 shadow-lg shadow-violet-500/5'
                        : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded border uppercase font-mono font-semibold ${getCategoryColor(item.category)}`}>
                        {item.category.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="text-xs font-semibold text-white line-clamp-1 mb-1">{item.title}</h3>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-2">{item.summary}</p>

                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="text-[9px] px-1.5 py-0.2 rounded bg-white/[0.05] text-slate-400 border border-white/[0.05]">
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

        {/* Right Pane: Reading & Content View */}
        <div className="flex-1 bg-theme-bg overflow-y-auto p-6">
          {selectedEntry ? (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Header section */}
              <div className="border-b border-white/[0.08] pb-4">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-md border font-mono font-semibold uppercase ${getCategoryColor(selectedEntry.category)}`}>
                      {selectedEntry.category.replace('_', ' ')}
                    </span>
                    {selectedEntry.source && (
                      <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                        <Layers size={12} className="text-slate-500" />
                        <span>{selectedEntry.source}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyContent}
                      className="px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/10 hover:border-white/20 text-slate-300 hover:text-white text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Скопировать контент"
                    >
                      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      <span>Копировать</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(selectedEntry.id, selectedEntry.title)}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-300 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Удалить статью"
                    >
                      <Trash2 size={13} />
                      <span>Удалить</span>
                    </button>
                  </div>
                </div>

                <h1 className="text-xl font-bold text-white tracking-tight leading-snug mb-2">{selectedEntry.title}</h1>

                <div className="flex items-center gap-4 text-xs text-slate-400 font-mono">
                  <span className="flex items-center gap-1">
                    <Calendar size={13} className="text-slate-500" />
                    <span>Добавлено: {new Date(selectedEntry.createdAt).toLocaleString()}</span>
                  </span>
                </div>

                {selectedEntry.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {selectedEntry.tags.map(tag => (
                      <span key={tag} className="text-xs px-2 py-0.5 rounded-md bg-white/[0.04] text-slate-300 border border-white/[0.08]">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Summary Box */}
              {selectedEntry.summary && (
                <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-200 text-xs leading-relaxed">
                  <span className="font-bold text-violet-300 block mb-1 uppercase text-[10px] tracking-wider font-mono">Резюме статьи:</span>
                  {selectedEntry.summary}
                </div>
              )}

              {/* Article Markdown Body */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 text-slate-200 text-xs sm:text-sm leading-relaxed font-sans whitespace-pre-wrap selection:bg-violet-500/30">
                {selectedEntry.content}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
              <Sparkles size={36} className="text-slate-600 mb-3" />
              <span className="text-sm font-semibold text-slate-400">Выберите запись для чтения</span>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">Или сохраните новый инсайт через ИИ-агента или форму добавления</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: New Knowledge Entry */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl glass-panel border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <BookOpen size={18} className="text-violet-400" />
                <h2 className="text-sm font-bold text-white">Добавить запись в Архив Знаний</h2>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form Form */}
            <form onSubmit={handleCreateEntry} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Заголовок статьи / инсайта *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Например: Парадигма AI как усилителя стратегического оператора..."
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Категория</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value as KnowledgeCategory)}
                    className="w-full px-3 py-2 rounded-lg flat-input text-theme-text focus:outline-none"
                  >
                    <option value="strategy">Strategy (Стратегия)</option>
                    <option value="architecture">Architecture (Архитектура)</option>
                    <option value="research">Research (Исследования)</option>
                    <option value="user_directive">User Directive (Указание пользователя)</option>
                    <option value="market_insight">Market Insight (Анализ рынка)</option>
                    <option value="general">General (Общее)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Теги (через запятую)</label>
                  <input
                    type="text"
                    value={newTags}
                    onChange={e => setNewTags(e.target.value)}
                    placeholder="strategy, hitl, telegram, 0xagent"
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Краткое резюме / Summary</label>
                <input
                  type="text"
                  value={newSummary}
                  onChange={e => setNewSummary(e.target.value)}
                  placeholder="Краткое описание сути для списков и поиска..."
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Полный контент статьи (Markdown) *</label>
                <textarea
                  required
                  rows={8}
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  placeholder="Вставьте полный текст статьи, выводы или стратегический план..."
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 font-mono text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white/[0.05] hover:bg-white/10 text-slate-300 font-medium cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium shadow-lg shadow-violet-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>Сохранить в Архив</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
