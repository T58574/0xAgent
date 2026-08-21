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
  Edit3,
  Save,
} from 'lucide-react';
import { KnowledgeEntry, KnowledgeCategory } from '../types';
import * as api from '../services/api';
import { useToast } from '../context/ToastContext';
import { NotionMarkdown } from './NotionMarkdown';
import { useI18n } from '../i18n';

export const KnowledgeVault: React.FC = () => {
  const { t, formatString } = useI18n();
  const { showToast } = useToast();

  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editCategory, setEditCategory] = useState<KnowledgeCategory>('strategy');
  const [editSummary, setEditSummary] = useState<string>('');
  const [editContent, setEditContent] = useState<string>('');
  const [editTags, setEditTags] = useState<string>('');
  const [editSaving, setEditSaving] = useState<boolean>(false);

  // New Entry Modal state
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCategory, setNewCategory] = useState<KnowledgeCategory>('strategy');
  const [newSummary, setNewSummary] = useState<string>('');
  const [newContent, setNewContent] = useState<string>('');
  const [newTags, setNewTags] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  const fetchKnowledge = async () => {
    setLoading(true);
    try {
      const fetchedEntries = await api.get_knowledge_entries({
        query: searchQuery.trim() || undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
      });

      setEntries(fetchedEntries);

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
      showToast(`${t.common.error}: ${err.message || err}`, 'error');
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

  const handleStartEdit = () => {
    if (!selectedEntry) return;
    setEditTitle(selectedEntry.title);
    setEditCategory((selectedEntry.category as KnowledgeCategory) || 'strategy');
    setEditSummary(selectedEntry.summary || '');
    setEditContent(selectedEntry.content);
    setEditTags(selectedEntry.tags.join(', '));
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedEntry || !editTitle.trim() || !editContent.trim()) {
      showToast('Title and content are required', 'error');
      return;
    }

    setEditSaving(true);
    try {
      const tagsArray = editTags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const updated = await api.save_knowledge_entry({
        id: selectedEntry.id,
        title: editTitle.trim(),
        category: editCategory,
        summary: editSummary.trim() || undefined,
        content: editContent.trim(),
        tags: tagsArray,
        source: selectedEntry.source || 'User Directive',
      });

      showToast('Entry updated!', 'success');
      setSelectedEntry(updated);
      setIsEditing(false);
      fetchKnowledge();
    } catch (err: any) {
      showToast(`${t.common.error}: ${err.message || err}`, 'error');
    } finally {
      setEditSaving(false);
    }
  };

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      showToast('Title and content are required', 'error');
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
        source: 'User Directive',
      });

      showToast(`Entry "${created.title}" saved!`, 'success');
      setModalOpen(false);
      setNewTitle('');
      setNewSummary('');
      setNewContent('');
      setNewTags('');
      setSelectedEntry(created);
      fetchKnowledge();
    } catch (err: any) {
      showToast(`${t.common.error}: ${err.message || err}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"?`)) {
      return;
    }

    try {
      await api.delete_knowledge_entry(id);
      showToast(`Entry "${title}" deleted.`, 'success');
      if (selectedEntry?.id === id) {
        setSelectedEntry(null);
        setIsEditing(false);
      }
      fetchKnowledge();
    } catch (err: any) {
      showToast(`${t.common.error}: ${err.message || err}`, 'error');
    }
  };

  const handleCopyContent = () => {
    if (!selectedEntry) return;
    navigator.clipboard.writeText(selectedEntry.content).then(() => {
      setCopied(true);
      showToast(t.common.copied, 'success');
      setTimeout(() => setCopied(false), 2000);
    });
  };

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
    <div className="w-full h-full flex flex-col bg-[var(--theme-bg)] text-[var(--theme-text)] overflow-hidden font-sans select-text">
      {/* Header Bar */}
      <div className="px-5 py-3 border-b border-[var(--theme-border)] bg-[var(--theme-panel)] flex flex-wrap items-center justify-between gap-3 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-white/5 border border-[var(--theme-border)] text-[var(--theme-text-muted)]">
            <BookOpen size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold text-[var(--theme-text)] uppercase tracking-wider">{t.knowledge.title}</h2>
              <span className="text-[10px] px-2 py-0.2 rounded-md bg-white/10 text-[var(--theme-text)] border border-[var(--theme-border)] font-mono">
                {entries.length}
              </span>
            </div>
            <p className="text-[11px] text-[var(--theme-text-muted)]">{t.knowledge.subtitle}</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchKnowledge}
            className="p-1.5 rounded-lg bento-card text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer transition-colors"
            title={t.knowledge.refreshTooltip}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-[var(--theme-border)] text-xs font-medium text-[var(--theme-text)] flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
          >
            <Plus size={14} />
            <span>{t.knowledge.addEntry}</span>
          </button>
        </div>
      </div>

      {/* Main Split Screen */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Filter, Search & Entries List */}
        <div className="w-80 md:w-96 border-r border-[var(--theme-border)] bg-[var(--theme-panel)] flex flex-col shrink-0 overflow-hidden">
          {/* Search bar */}
          <div className="p-3 border-b border-[var(--theme-border)]">
            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t.knowledge.searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bento-card text-xs text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] bg-black/40 focus:outline-none"
              />
              <Search size={13} className="absolute left-2.5 top-2 text-[var(--theme-text-muted)]" />
            </form>
          </div>

          {/* Category Chips */}
          <div className="px-3 py-2 border-b border-[var(--theme-border)] flex items-center gap-1.5 overflow-x-auto scrollbar-none select-none">
            {categoriesList.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
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
              entries.map(item => {
                const isSelected = selectedEntry?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedEntry(item);
                      setIsEditing(false);
                    }}
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
                        {item.tags.slice(0, 3).map(tag => (
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

        {/* Right Pane: Reading & Content View */}
        <div className="flex-1 bg-[var(--theme-bg)] overflow-y-auto p-6 md:p-8 scrollbar-thin">
          {selectedEntry ? (
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
                        onClick={handleStartEdit}
                        className="px-2.5 py-1 rounded-lg bento-card text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] flex items-center gap-1 transition-colors cursor-pointer"
                        title="Edit Entry"
                      >
                        <Edit3 size={13} />
                        <span>{t.knowledge.editBtn}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleCopyContent}
                      className="px-2.5 py-1 rounded-lg bento-card text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] flex items-center gap-1 transition-colors cursor-pointer"
                      title="Copy content"
                    >
                      {copied ? <Check size={13} className="text-[var(--theme-text)]" /> : <Copy size={13} />}
                      <span>{copied ? t.knowledge.copied : t.knowledge.copyBtn}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(selectedEntry.id, selectedEntry.title)}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-[var(--theme-border)] text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] flex items-center gap-1 transition-colors cursor-pointer"
                      title="Delete entry"
                    >
                      <Trash2 size={13} />
                      <span>{t.knowledge.deleteBtn}</span>
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  /* IN-PLACE EDIT MODE */
                  <div className="space-y-3 pt-2 animate-fadeIn">
                    <div>
                      <label className="text-xs font-medium text-[var(--theme-text-muted)] block mb-1">{t.knowledge.titleLabel}</label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bento-card text-sm font-semibold text-[var(--theme-text)] focus:outline-none bg-black/40"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-[var(--theme-text-muted)] block mb-1">{t.knowledge.category}</label>
                        <select
                          value={editCategory}
                          onChange={e => setEditCategory(e.target.value as KnowledgeCategory)}
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
                          onChange={e => setEditTags(e.target.value)}
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
                        onChange={e => setEditSummary(e.target.value)}
                        placeholder={t.knowledge.summaryPlaceholder}
                        className="w-full px-3 py-2 rounded-lg bento-card text-xs text-[var(--theme-text)] focus:outline-none bg-black/40"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-[var(--theme-text-muted)] block mb-1">{t.knowledge.contentLabel}</label>
                      <textarea
                        rows={12}
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        className="w-full p-3 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] focus:outline-none bg-black/40"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-3.5 py-1.5 rounded-lg bento-card text-xs font-medium text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer"
                      >
                        {t.knowledge.cancel}
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        disabled={editSaving}
                        className="px-4 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-[var(--theme-border)] text-xs font-medium text-[var(--theme-text)] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {editSaving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                        <span>{t.knowledge.saveChanges}</span>
                      </button>
                    </div>
                  </div>
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
                        {selectedEntry.tags.map(tag => (
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
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-[var(--theme-text-muted)]">
              <Sparkles size={32} className="text-[var(--theme-text-muted)] mb-3 opacity-60" />
              <span className="text-sm font-medium text-[var(--theme-text)]">{t.knowledge.selectToRead}</span>
              <p className="text-xs text-[var(--theme-text-muted)] mt-1 max-w-sm">{t.knowledge.selectToReadDesc}</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: New Knowledge Entry */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fadeIn">
          <div className="w-full max-w-2xl bento-card border border-[var(--theme-border)] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] bg-[var(--theme-panel)] text-[var(--theme-text)]">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-[var(--theme-border)] flex items-center justify-between bg-black/40">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-[var(--theme-text-muted)]" />
                <h3 className="text-xs font-semibold text-[var(--theme-text)]">{t.knowledge.newEntryTitle}</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-md text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/10 cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateEntry} className="p-5 space-y-3.5 overflow-y-auto flex-1 text-xs">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--theme-text-muted)]">{t.knowledge.titleLabel}</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
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
                    onChange={e => setNewCategory(e.target.value as KnowledgeCategory)}
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
                    onChange={e => setNewTags(e.target.value)}
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
                  onChange={e => setNewSummary(e.target.value)}
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
                  onChange={e => setNewContent(e.target.value)}
                  placeholder={t.knowledge.contentPlaceholder}
                  className="w-full p-3 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] focus:outline-none bg-black/40"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--theme-border)]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
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
      )}
    </div>
  );
};
