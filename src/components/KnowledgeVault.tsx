import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { BookOpen, Plus, RefreshCw } from 'lucide-react';
import { KnowledgeEntry, KnowledgeCategory } from '../types';
import * as api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useI18n } from '../i18n';
import { KnowledgeList } from './knowledge/KnowledgeList';
import { KnowledgeViewer } from './knowledge/KnowledgeViewer';
import { KnowledgeEditForm } from './knowledge/KnowledgeEditForm';
import { NewKnowledgeModal } from './knowledge/NewKnowledgeModal';

export const KnowledgeVault: React.FC = React.memo(() => {
  const { t, formatString } = useI18n();
  const { showToast } = useToast();
  const [, startTransition] = useTransition();

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

  const fetchKnowledge = useCallback(async (customQuery?: string, customCategory?: string) => {
    setLoading(true);
    const q = customQuery !== undefined ? customQuery : searchQuery;
    const cat = customCategory !== undefined ? customCategory : selectedCategory;
    try {
      const fetchedEntries = await api.get_knowledge_entries({
        query: q.trim() || undefined,
        category: cat !== 'all' ? cat : undefined,
      });

      startTransition(() => {
        setEntries(fetchedEntries);

        if (fetchedEntries.length > 0) {
          setSelectedEntry((prev) => {
            if (!prev || !fetchedEntries.some((e) => e.id === prev.id)) {
              return fetchedEntries[0];
            }
            return fetchedEntries.find((e) => e.id === prev.id) || fetchedEntries[0];
          });
        } else {
          setSelectedEntry(null);
        }
      });
    } catch (err: any) {
      console.error('Failed to load Knowledge Vault:', err);
      showToast(`${t.common.error}: ${err.message || err}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory, showToast, t]);

  useEffect(() => {
    fetchKnowledge(searchQuery, selectedCategory);
  }, [selectedCategory]);

  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    fetchKnowledge();
  }, [fetchKnowledge]);

  const handleStartEdit = useCallback(() => {
    if (!selectedEntry) return;
    setEditTitle(selectedEntry.title);
    setEditCategory((selectedEntry.category as KnowledgeCategory) || 'strategy');
    setEditSummary(selectedEntry.summary || '');
    setEditContent(selectedEntry.content);
    setEditTags(selectedEntry.tags.join(', '));
    setIsEditing(true);
  }, [selectedEntry]);

  const handleSaveEdit = useCallback(async () => {
    if (!selectedEntry || !editTitle.trim() || !editContent.trim()) {
      showToast(t.toasts.titleContentRequired, 'error');
      return;
    }

    setEditSaving(true);
    try {
      const tagsArray = editTags
        .split(',')
        .map((tag) => tag.trim())
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

      showToast(t.toasts.entryUpdated, 'success');
      setSelectedEntry(updated);
      setIsEditing(false);
      fetchKnowledge();
    } catch (err: any) {
      showToast(`${t.common.error}: ${err.message || err}`, 'error');
    } finally {
      setEditSaving(false);
    }
  }, [selectedEntry, editTitle, editContent, editTags, editCategory, editSummary, showToast, t, fetchKnowledge]);

  const handleCreateEntry = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      showToast(t.toasts.titleContentRequired, 'error');
      return;
    }

    setSaving(true);
    try {
      const tagsArray = newTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

      const created = await api.save_knowledge_entry({
        title: newTitle.trim(),
        category: newCategory,
        summary: newSummary.trim() || undefined,
        content: newContent.trim(),
        tags: tagsArray,
        source: 'User Directive',
      });

      showToast(formatString(t.toasts.entrySaved, { title: created.title }), 'success');
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
  }, [newTitle, newContent, newTags, newCategory, newSummary, showToast, formatString, t, fetchKnowledge]);

  const handleDelete = useCallback(async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"?`)) {
      return;
    }

    try {
      await api.delete_knowledge_entry(id);
      showToast(formatString(t.toasts.entryDeleted, { title }), 'success');
      if (selectedEntry?.id === id) {
        setSelectedEntry(null);
        setIsEditing(false);
      }
      fetchKnowledge();
    } catch (err: any) {
      showToast(`${t.common.error}: ${err.message || err}`, 'error');
    }
  }, [selectedEntry, showToast, formatString, t, fetchKnowledge]);

  const handleCopyContent = useCallback(() => {
    if (!selectedEntry) return;
    navigator.clipboard.writeText(selectedEntry.content).then(() => {
      setCopied(true);
      showToast(t.common.copied, 'success');
      setTimeout(() => setCopied(false), 2000);
    });
  }, [selectedEntry, showToast, t]);

  const handleSelectEntry = useCallback((entry: KnowledgeEntry) => {
    setSelectedEntry(entry);
    setIsEditing(false);
  }, []);

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
            onClick={() => fetchKnowledge()}
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
        <KnowledgeList
          entries={entries}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchSubmit={handleSearchSubmit}
          selectedEntryId={selectedEntry?.id || null}
          onSelectEntry={handleSelectEntry}
          loading={loading}
        />

        {/* Right Pane: Reading & Content View */}
        <div className="flex-1 bg-[var(--theme-bg)] overflow-y-auto p-6 md:p-8 scrollbar-thin">
          <KnowledgeViewer
            selectedEntry={selectedEntry}
            isEditing={isEditing}
            copied={copied}
            onStartEdit={handleStartEdit}
            onCopyContent={handleCopyContent}
            onDelete={handleDelete}
          >
            <KnowledgeEditForm
              editTitle={editTitle}
              setEditTitle={setEditTitle}
              editCategory={editCategory}
              setEditCategory={setEditCategory}
              editTags={editTags}
              setEditTags={setEditTags}
              editSummary={editSummary}
              setEditSummary={setEditSummary}
              editContent={editContent}
              setEditContent={setEditContent}
              editSaving={editSaving}
              onSave={handleSaveEdit}
              onCancel={() => setIsEditing(false)}
            />
          </KnowledgeViewer>
        </div>
      </div>

      {/* Modal: New Knowledge Entry */}
      <NewKnowledgeModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        newTitle={newTitle}
        setNewTitle={setNewTitle}
        newCategory={newCategory}
        setNewCategory={setNewCategory}
        newTags={newTags}
        setNewTags={setNewTags}
        newSummary={newSummary}
        setNewSummary={setNewSummary}
        newContent={newContent}
        setNewContent={setNewContent}
        saving={saving}
        onSubmit={handleCreateEntry}
      />
    </div>
  );
});
