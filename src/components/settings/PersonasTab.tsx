import React, { useState, useEffect, useCallback } from 'react';
import { Brain, Plus, GitPullRequest, Database, Sparkles, Activity, Terminal, Layers } from 'lucide-react';
import {
  PersonaMetadata,
  PersonaDetail,
  ContextBreakdownReport,
  MemoryItem,
} from '../../types';
import * as api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useI18n } from '../../i18n';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { SettingsHeader } from './common';
import { PersonaProposalsModal } from './PersonaProposalsModal';
import { MemoryManagerSection } from './personas/MemoryManagerSection';
import { PersonaEditorSection } from './personas/PersonaEditorSection';
import { TokenTelemetrySection } from './personas/TokenTelemetrySection';
import { SystemPromptsModal } from './personas/SystemPromptsModal';

interface PersonasTabProps {
  currentSessionId?: string | null;
}

type PersonasSubtab = 'personas' | 'memory' | 'tokens';

export const PersonasTab: React.FC<PersonasTabProps> = ({ currentSessionId }) => {
  const { t, formatString } = useI18n();
  const { showToast } = useToast();

  // Active Subtab View
  const [activeSubtab, setActiveSubtab] = useState<PersonasSubtab>('personas');

  // 1. Long-Term Memory State
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [isLoadingMemories, setIsLoadingMemories] = useState(false);

  // 2. Personas & File Editor State
  const [personas, setPersonas] = useState<PersonaMetadata[]>([]);
  const [activePersonaId, setActivePersonaId] = useState<string>('default');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('default');
  const [personaDetail, setPersonaDetail] = useState<PersonaDetail | null>(null);
  const [activeFile, setActiveFile] = useState<'soul' | 'user'>('soul');
  const [fileContent, setFileContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 3. Modals State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isProposalsOpen, setIsProposalsOpen] = useState(false);
  const [isSystemPromptsOpen, setIsSystemPromptsOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // 4. Token Breakdown Telemetry
  const [tokenReport, setTokenReport] = useState<ContextBreakdownReport | null>(null);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);

  // Data Fetchers
  const loadMemories = async () => {
    setIsLoadingMemories(true);
    try {
      const list = await api.get_memories();
      setMemories(list);
    } catch (err) {
      console.error('Failed to fetch memories:', err);
    } finally {
      setIsLoadingMemories(false);
    }
  };

  const loadPersonas = async () => {
    try {
      const list = await api.get_personas();
      setPersonas(list);
      if (list.length > 0) {
        const active = list.find((p) => p.is_active) || list[0];
        setActivePersonaId(active.id);
        if (!selectedPersonaId || !list.some((p) => p.id === selectedPersonaId)) {
          setSelectedPersonaId(active.id);
        }
      } else {
        setActivePersonaId('');
        setSelectedPersonaId('');
        setPersonaDetail(null);
        setFileContent('');
      }
    } catch (err) {
      console.error('Failed to fetch personas:', err);
    }
  };

  const loadDetail = async (id: string) => {
    if (!id) {
      setPersonaDetail(null);
      setFileContent('');
      return;
    }
    try {
      const detail = await api.get_persona_detail(id);
      setPersonaDetail(detail);
      if (detail) {
        if (activeFile === 'soul') setFileContent(detail.soul);
        else if (activeFile === 'user') setFileContent(detail.user);
      }
    } catch (err) {
      console.error('Failed to load persona detail:', err);
    }
  };

  const fetchTokenBreakdown = useCallback(async () => {
    setIsLoadingTokens(true);
    try {
      const data = await api.get_context_breakdown(currentSessionId);
      setTokenReport(data);
    } catch (err) {
      console.error('Failed to load token breakdown:', err);
    } finally {
      setIsLoadingTokens(false);
    }
  }, [currentSessionId]);

  useEffect(() => {
    loadMemories();
    loadPersonas();
    fetchTokenBreakdown();

    const unsub = api.listen<{ activePersonaId?: string; personas: PersonaMetadata[] }>(
      'persona-changed',
      (e) => {
        if (e.payload?.personas) setPersonas(e.payload.personas);
        if (e.payload?.activePersonaId) setActivePersonaId(e.payload.activePersonaId);
      }
    );

    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    if (selectedPersonaId) {
      loadDetail(selectedPersonaId);
    } else {
      setPersonaDetail(null);
      setFileContent('');
    }
  }, [selectedPersonaId]);

  useEffect(() => {
    if (activeFile === 'soul' && personaDetail) {
      setFileContent(personaDetail.soul);
    } else if (activeFile === 'user' && personaDetail) {
      setFileContent(personaDetail.user);
    }
  }, [activeFile, personaDetail]);

  // Memory Handlers
  const handleAddMemory = async (key: string, value: string, category: string, scope: 'user' | 'project') => {
    try {
      await api.add_memory(key, value, category, scope);
      showToast(t.toasts.factAdded || 'Факт добавлен в память', 'success');
      await loadMemories();
      fetchTokenBreakdown();
    } catch (err: any) {
      showToast(`${t.common.error}: ${err.message || err}`, 'error');
    }
  };

  const handleUpdateMemory = async (id: string, updates: { key: string; value: string; category: string; scope: string }) => {
    try {
      await api.update_memory(id, updates);
      showToast(t.settings.personas.saved || 'Факт обновлен', 'success');
      await loadMemories();
      fetchTokenBreakdown();
    } catch (err: any) {
      showToast(`${t.common.error}: ${err.message || err}`, 'error');
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      await api.delete_memory(id);
      showToast(t.toasts.factDeleted || 'Факт удален', 'info');
      await loadMemories();
      fetchTokenBreakdown();
    } catch (err: any) {
      showToast(`${t.common.error}: ${err.message || err}`, 'error');
    }
  };

  // Persona Handlers
  const handleActivatePersona = async (id: string) => {
    try {
      await api.activate_persona(id);
      setActivePersonaId(id);
      const p = personas.find((item) => item.id === id);
      showToast(formatString(t.toasts.personaActivated, { name: p?.name || id }), 'success');
      fetchTokenBreakdown();
    } catch (err: any) {
      showToast(err.message || t.common.error, 'error');
    }
  };

  const handleCreatePersona = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const created = await api.create_persona(newName.trim(), newDesc.trim());
      setIsCreateOpen(false);
      setNewName('');
      setNewDesc('');
      await loadPersonas();
      setSelectedPersonaId(created.metadata.id);
      showToast(t.toasts.personaCreated, 'success');
    } catch (err: any) {
      showToast(err.message || t.common.error, 'error');
    }
  };

  const handleSaveActiveFile = async () => {
    if (!personaDetail) return;
    try {
      setIsSaving(true);
      const targetFile: 'SOUL.md' | 'USER.md' = activeFile === 'soul' ? 'SOUL.md' : 'USER.md';
      await api.save_persona_file(personaDetail.metadata.id, targetFile, fileContent);
      setSaveSuccess(true);
      showToast(
        formatString(t.toasts.personaFileSaved, { file: `${activeFile.toUpperCase()}.md` }),
        'success'
      );
      loadDetail(personaDetail.metadata.id);
      setTimeout(() => setSaveSuccess(false), 2000);
      fetchTokenBreakdown();
    } catch (err: any) {
      showToast(err.message || t.common.error, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePersona = async (id: string) => {
    try {
      await api.delete_persona(id);
      const list = await api.get_personas();
      setPersonas(list);
      if (list.length > 0) {
        const next = list.find((p) => p.is_active) || list[0];
        setSelectedPersonaId(next.id);
        setActivePersonaId(next.id);
        await loadDetail(next.id);
      } else {
        setSelectedPersonaId('');
        setActivePersonaId('');
        setPersonaDetail(null);
        setFileContent('');
      }
      showToast(t.toasts.personaDeleted, 'info');
      fetchTokenBreakdown();
    } catch (err: any) {
      showToast(err.message || t.common.error, 'error');
    }
  };

  return (
    <div className="w-full space-y-6 pb-10 font-sans text-[var(--theme-text)]">
      {/* Top Header */}
      <SettingsHeader
        title={t.settings.personas.title}
        subtitle={t.settings.personas.subtitle}
        icon={<Brain size={18} />}
        actionSlot={
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsProposalsOpen(true)}
              icon={<GitPullRequest size={13} />}
            >
              {t.settings.personas.evolutionStudioBtn}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              icon={<Plus size={13} />}
            >
              {t.settings.personas.createBtn}
            </Button>
          </div>
        }
      />

      {/* Sub-Navigation Tabs Bar (Segmented Pills) */}
      <div className="flex items-center gap-2 border-b border-[var(--theme-border)] pb-3">
        <button
          type="button"
          onClick={() => setActiveSubtab('personas')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
            activeSubtab === 'personas'
              ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] border-[var(--theme-border)] shadow-xs ring-1 ring-[var(--theme-accent)]/30 font-bold'
              : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
          }`}
        >
          <Sparkles size={14} className={activeSubtab === 'personas' ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-text-muted)]'} />
          <span>{t.settings.personas.subtabPersonas}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] border border-[var(--theme-border)]">
            {personas.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubtab('memory')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
            activeSubtab === 'memory'
              ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] border-[var(--theme-border)] shadow-xs ring-1 ring-[var(--theme-accent)]/30 font-bold'
              : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
          }`}
        >
          <Database size={14} className={activeSubtab === 'memory' ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-text-muted)]'} />
          <span>{t.settings.personas.subtabMemory}</span>
          {memories.length > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] border border-[var(--theme-border)]">
              {memories.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubtab('tokens')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
            activeSubtab === 'tokens'
              ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] border-[var(--theme-border)] shadow-xs ring-1 ring-[var(--theme-accent)]/30 font-bold'
              : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
          }`}
        >
          <Activity size={14} className={activeSubtab === 'tokens' ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-text-muted)]'} />
          <span>{t.settings.personas.subtabTokens}</span>
          {tokenReport && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] border border-[var(--theme-border)]">
              {tokenReport.totalUsed.toLocaleString()} tok
            </span>
          )}
        </button>
      </div>

      {/* Active Subtab Content */}
      {activeSubtab === 'personas' && (
        <div className="space-y-6">
          <PersonaEditorSection
            personas={personas}
            activePersonaId={activePersonaId}
            selectedPersonaId={selectedPersonaId}
            personaDetail={personaDetail}
            activeFile={activeFile}
            fileContent={fileContent}
            isSaving={isSaving}
            saveSuccess={saveSuccess}
            onSelectPersona={setSelectedPersonaId}
            onActivatePersona={handleActivatePersona}
            onDeletePersona={handleDeletePersona}
            onChangeActiveFile={setActiveFile}
            onChangeFileContent={setFileContent}
            onSaveActiveFile={handleSaveActiveFile}
            onCreatePersonaClick={() => setIsCreateOpen(true)}
          />

          {/* Bottom Interface: System Prompts Inspector Trigger */}
          <div className="p-4 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card-bg)]/60 backdrop-blur-xs flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] flex items-center justify-center shrink-0">
                <Terminal size={15} />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--theme-text)]">
                    {t.settings.personas.systemPromptsTitle || 'Системные промпты проекта'}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] border border-[var(--theme-border)]">
                    SUMMARIZER, TOOLS, DIRECTIVES
                  </span>
                </div>
                <p className="text-[11px] text-[var(--theme-text-muted)]">
                  {t.settings.personas.systemPromptsFooterDesc || 'Просмотр и настройка встроенных инструкций ядра и сжатия контекста'}
                </p>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsSystemPromptsOpen(true)}
              icon={<Layers size={13} />}
              className="text-xs shrink-0"
            >
              {t.settings.personas.viewSystemPromptsBtn || 'Открыть промпты проекта'}
            </Button>
          </div>
        </div>
      )}

      {activeSubtab === 'memory' && (
        <MemoryManagerSection
          memories={memories}
          isLoading={isLoadingMemories}
          onRefresh={loadMemories}
          onAddMemory={handleAddMemory}
          onUpdateMemory={handleUpdateMemory}
          onDeleteMemory={handleDeleteMemory}
        />
      )}

      {activeSubtab === 'tokens' && tokenReport && (
        <TokenTelemetrySection
          tokenReport={tokenReport}
          isLoading={isLoadingTokens}
          onRefresh={fetchTokenBreakdown}
        />
      )}

      {/* Modal: Create Persona */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={t.settings.personas.newPersonaTitle}
        subtitle={t.settings.personas.newPersonaSubtitle}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setIsCreateOpen(false)}>
              {t.settings.personas.cancelBtn}
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreatePersona}>
              {t.settings.personas.createConfirmBtn}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreatePersona} className="space-y-4">
          <Input
            label={t.settings.personas.personaNameLabel}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t.settings.personas.personaNamePlaceholder}
            required
            autoFocus
          />
          <Input
            label={t.settings.personas.personaDescLabel}
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder={t.settings.personas.personaDescPlaceholder}
          />
        </form>
      </Modal>

      {/* Modal: Evolution Studio */}
      {personaDetail && (
        <PersonaProposalsModal
          isOpen={isProposalsOpen}
          onClose={() => setIsProposalsOpen(false)}
          persona={personaDetail.metadata}
          onPersonaUpdated={() => {
            loadDetail(personaDetail.metadata.id);
            loadMemories();
            fetchTokenBreakdown();
          }}
        />
      )}

      {/* Modal: Project System Prompts Inspector */}
      <SystemPromptsModal
        isOpen={isSystemPromptsOpen}
        onClose={() => setIsSystemPromptsOpen(false)}
      />
    </div>
  );
};
