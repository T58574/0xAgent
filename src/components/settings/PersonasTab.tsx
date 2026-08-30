import React, { useState, useEffect } from 'react';
import {
  User,
  Sparkles,
  Plus,
  Trash2,
  FileText,
  Save,
  Sliders,
  Check,
} from 'lucide-react';
import { PersonaMetadata, PersonaDetail, ToolDefinition } from '../../types';
import {
  get_personas,
  get_persona_detail,
  activate_persona,
  create_persona,
  save_persona_file,
  delete_persona,
  get_summarizer_prompt,
  save_summarizer_prompt,
  get_tools_state,
  save_tools_toggles,
  listen,
} from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useI18n } from '../../i18n';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { Toggle } from '../ui/Toggle';
import { Modal } from '../ui/Modal';
import { SettingsHeader, SettingsSection } from './common';

export const PersonasTab: React.FC = () => {
  const { t, formatString } = useI18n();
  const { showToast } = useToast();
  const [personas, setPersonas] = useState<PersonaMetadata[]>([]);
  const [activePersonaId, setActivePersonaId] = useState<string>('default');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('default');
  const [personaDetail, setPersonaDetail] = useState<PersonaDetail | null>(null);

  const [sectionTab, setSectionTab] = useState<'personas' | 'tools' | 'summarizer'>('personas');

  // Summarizer state
  const [summarizerPrompt, setSummarizerPrompt] = useState<string>('');

  // Tools state
  const [toolsList, setToolsList] = useState<ToolDefinition[]>([]);
  const [isToolsSaving, setIsToolsSaving] = useState<boolean>(false);

  // Persona file state (SOUL.md & USER.md)
  const [activeFileTab, setActiveFileTab] = useState<'soul' | 'user'>('soul');
  const [fileContent, setFileContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // New Persona Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const loadPersonas = async () => {
    try {
      const list = await get_personas();
      setPersonas(list);
      const active = list.find((p) => p.is_active) || list[0];
      if (active) {
        setActivePersonaId(active.id);
        if (!selectedPersonaId || !list.some((p) => p.id === selectedPersonaId)) {
          setSelectedPersonaId(active.id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch personas:', err);
    }
  };

  const loadDetail = async (id: string) => {
    try {
      const detail = await get_persona_detail(id);
      setPersonaDetail(detail);
      if (detail) {
        if (activeFileTab === 'soul') setFileContent(detail.soul);
        else if (activeFileTab === 'user') setFileContent(detail.user);
      }
    } catch (err) {
      console.error('Failed to load persona detail:', err);
    }
  };

  const loadSummarizer = async () => {
    try {
      const text = await get_summarizer_prompt();
      setSummarizerPrompt(text);
    } catch (err) {
      console.error('Failed to load summarizer prompt:', err);
    }
  };

  const loadToolsState = async () => {
    try {
      const state = await get_tools_state();
      setToolsList(state.tools);
    } catch (err) {
      console.error('Failed to load tools state:', err);
    }
  };

  useEffect(() => {
    loadPersonas();
    loadSummarizer();
    loadToolsState();

    const unsub = listen<{ activePersonaId?: string; personas: PersonaMetadata[] }>(
      'persona-changed',
      (e) => {
        if (e.payload?.personas) {
          setPersonas(e.payload.personas);
        }
        if (e.payload?.activePersonaId) {
          setActivePersonaId(e.payload.activePersonaId);
        }
      }
    );

    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    if (selectedPersonaId) {
      loadDetail(selectedPersonaId);
    }
  }, [selectedPersonaId]);

  useEffect(() => {
    if (personaDetail) {
      if (activeFileTab === 'soul') setFileContent(personaDetail.soul);
      else if (activeFileTab === 'user') setFileContent(personaDetail.user);
    }
  }, [activeFileTab, personaDetail]);

  const handleSaveSummarizer = async () => {
    try {
      setIsSaving(true);
      await save_summarizer_prompt(summarizerPrompt);
      setSaveSuccess(true);
      showToast(formatString(t.toasts.personaFileSaved, { file: 'SUMMARIZER.md' }), 'success');
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      showToast(err.message || t.common.error, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleTool = async (toolId: string) => {
    const updated = toolsList.map((t) => (t.id === toolId ? { ...t, enabled: !t.enabled } : t));
    setToolsList(updated);

    const toggles: Record<string, boolean> = {};
    for (const t of updated) {
      toggles[t.id] = t.enabled;
    }

    try {
      setIsToolsSaving(true);
      await save_tools_toggles(toggles);
    } catch (err: any) {
      console.error('Failed to save tool toggle:', err);
    } finally {
      setIsToolsSaving(false);
    }
  };

  const handleBulkToggleAll = async (enabled: boolean) => {
    const updated = toolsList.map((t) => ({ ...t, enabled }));
    setToolsList(updated);

    const toggles: Record<string, boolean> = {};
    for (const tool of updated) {
      toggles[tool.id] = enabled;
    }

    try {
      setIsToolsSaving(true);
      await save_tools_toggles(toggles);
      showToast(enabled ? t.settings.personas.enableAll : t.settings.personas.disableAll, 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to update tools', 'error');
    } finally {
      setIsToolsSaving(false);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await activate_persona(id);
      setActivePersonaId(id);
      const p = personas.find((item) => item.id === id);
      showToast(formatString(t.toasts.personaActivated, { name: p?.name || id }), 'success');
    } catch (err: any) {
      showToast(err.message || t.common.error, 'error');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const created = await create_persona(newName.trim(), newDesc.trim());
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

  const handleSavePersonaFile = async () => {
    if (!personaDetail) return;
    try {
      setIsSaving(true);
      const targetFile: 'SOUL.md' | 'TOOLS.md' | 'USER.md' =
        activeFileTab === 'soul' ? 'SOUL.md' : 'USER.md';
      await save_persona_file(personaDetail.metadata.id, targetFile, fileContent);
      setSaveSuccess(true);
      showToast(
        formatString(t.toasts.personaFileSaved, { file: `${activeFileTab.toUpperCase()}.md` }),
        'success'
      );
      setTimeout(() => setSaveSuccess(false), 2000);
      loadDetail(personaDetail.metadata.id);
    } catch (err: any) {
      showToast(err.message || t.common.error, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (id === 'default') return;
    try {
      await delete_persona(id);
      await loadPersonas();
      if (selectedPersonaId === id) {
        setSelectedPersonaId('default');
      }
      showToast(t.toasts.personaDeleted, 'info');
    } catch (err: any) {
      showToast(err.message || t.common.error, 'error');
    }
  };

  return (
    <div className="w-full space-y-6 font-sans text-[var(--theme-text)]">
      {/* 1. Standard Top Header + Subtab Navigation */}
      <SettingsHeader
        title={t.settings.personas.title || 'Персоны & Инструкции'}
        subtitle={
          t.settings.personas.subtitle ||
          'Конфигурация характера агента, промптов SOUL.md и системного суммаризатора'
        }
        icon={<User size={18} />}
        actionSlot={
          <div className="flex items-center gap-1.5 select-none">
            <Button
              variant={sectionTab === 'personas' ? 'accent' : 'secondary'}
              size="sm"
              onClick={() => setSectionTab('personas')}
              icon={<User size={13} />}
            >
              {t.settings.personas.personasTab}
            </Button>
            <Button
              variant={sectionTab === 'tools' ? 'accent' : 'secondary'}
              size="sm"
              onClick={() => setSectionTab('tools')}
              icon={<Sliders size={13} />}
            >
              {t.settings.personas.toolsTab}
            </Button>
            <Button
              variant={sectionTab === 'summarizer' ? 'accent' : 'secondary'}
              size="sm"
              onClick={() => setSectionTab('summarizer')}
              icon={<Sparkles size={13} />}
            >
              {t.settings.personas.summarizerTab}
            </Button>
          </div>
        }
      />

      {/* 2. SUBTAB: PERSONAS LIST & EDITOR */}
      {sectionTab === 'personas' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Personas List */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-[var(--theme-text-muted)] uppercase tracking-wider">
                {formatString(t.settings.personas.personasCount, { count: personas.length })}
              </span>
              <Button
                variant="secondary"
                size="xs"
                onClick={() => setIsCreateOpen(true)}
                icon={<Plus size={13} />}
              >
                {t.settings.personas.createBtn}
              </Button>
            </div>

            <div className="space-y-2">
              {personas.map((p) => {
                const isSelected = p.id === selectedPersonaId;
                const isActive = p.id === activePersonaId;
                return (
                  <Card
                    key={p.id}
                    variant="interactive"
                    selected={isSelected}
                    onClick={() => setSelectedPersonaId(p.id)}
                    padded={false}
                    className="p-3.5 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <User size={14} className="text-[var(--theme-text-muted)] shrink-0" />
                        <span className="font-bold text-xs text-[var(--theme-text)] truncate">
                          {p.name}
                        </span>
                      </div>
                      {isActive && (
                        <Badge variant="accent" size="xs">
                          {t.settings.personas.activeBadge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--theme-text-muted)] line-clamp-2 leading-relaxed">
                      {p.description}
                    </p>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Right Column: Persona Details & Markdown Editor */}
          <div className="lg:col-span-8 space-y-3">
            {personaDetail ? (
              <Card variant="default" className="space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-3 gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[var(--theme-text)] truncate">
                      {personaDetail.metadata.name}
                    </h3>
                    <p className="text-xs text-[var(--theme-text-muted)] mt-0.5 leading-relaxed">
                      {personaDetail.metadata.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {personaDetail.metadata.id !== activePersonaId && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleActivate(personaDetail.metadata.id)}
                      >
                        {t.settings.personas.activateBtn}
                      </Button>
                    )}
                    {personaDetail.metadata.id !== 'default' && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(personaDetail.metadata.id)}
                        icon={<Trash2 size={13} />}
                        title={t.settings.personas.deleteTooltip}
                      />
                    )}
                  </div>
                </div>

                {/* Subtab Files: SOUL.md vs USER.md */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center bg-[var(--theme-input-bg)] p-1 rounded-xl border border-[var(--theme-border)]">
                    <button
                      type="button"
                      onClick={() => setActiveFileTab('soul')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                        activeFileTab === 'soul'
                          ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] shadow-sm border border-[var(--theme-border)]'
                          : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                      }`}
                    >
                      SOUL.md
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFileTab('user')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                        activeFileTab === 'user'
                          ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] shadow-sm border border-[var(--theme-border)]'
                          : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                      }`}
                    >
                      USER.md
                    </button>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleSavePersonaFile}
                    disabled={isSaving}
                    loading={isSaving}
                    icon={saveSuccess ? <Check size={13} className="text-emerald-500" /> : <Save size={13} />}
                  >
                    {saveSuccess ? t.settings.personas.saved : t.settings.personas.save}
                  </Button>
                </div>

                <textarea
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  rows={14}
                  className="w-full p-3.5 rounded-xl bg-[var(--theme-code-bg)] text-[var(--theme-code-text)] border border-[var(--theme-border)] font-mono text-xs focus:outline-none focus:border-[var(--theme-accent)] resize-y leading-relaxed"
                />
              </Card>
            ) : (
              <Card variant="default" className="p-8 text-center text-xs text-[var(--theme-text-muted)]">
                {t.settings.personas.selectPersonaPrompt}
              </Card>
            )}
          </div>
        </div>
      )}

      {/* 3. SUBTAB: TOOLS MANAGEMENT */}
      {sectionTab === 'tools' && (
        <SettingsSection
          title={t.settings.personas.toolsTitle}
          badge="TOOLS.md"
          description={t.settings.personas.toolsDesc}
          actionSlot={
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="xs"
                onClick={() => handleBulkToggleAll(true)}
                disabled={isToolsSaving}
              >
                {t.settings.personas.enableAll}
              </Button>
              <Button
                variant="secondary"
                size="xs"
                onClick={() => handleBulkToggleAll(false)}
                disabled={isToolsSaving}
              >
                {t.settings.personas.disableAll}
              </Button>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {toolsList.map((tool) => (
              <Card
                key={tool.id}
                variant="interactive"
                selected={tool.enabled}
                onClick={() => handleToggleTool(tool.id)}
                className="flex items-start justify-between gap-3"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[var(--theme-text)]">
                      &lt;{tool.name}&gt;
                    </span>
                    <Badge variant="neutral" size="xs">
                      {tool.requiresApproval ? t.settings.personas.requiresApproval : t.settings.personas.auto}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--theme-text-muted)] leading-relaxed">
                    {tool.description}
                  </p>
                </div>

                <Toggle
                  checked={tool.enabled}
                  onChange={() => handleToggleTool(tool.id)}
                  size="sm"
                />
              </Card>
            ))}
          </div>
        </SettingsSection>
      )}

      {/* 4. SUBTAB: SUMMARIZER TAB */}
      {sectionTab === 'summarizer' && (
        <SettingsSection
          title={t.settings.personas.summarizerTitle}
          badge="SUMMARIZER.md"
          description={t.settings.personas.summarizerDesc}
        >
          <Card variant="default" className="space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-2.5">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-[var(--theme-text-muted)]" />
                <span className="text-xs font-bold text-[var(--theme-text)]">
                  {t.settings.personas.summarizerPromptTitle}
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSaveSummarizer}
                disabled={isSaving}
                loading={isSaving}
                icon={saveSuccess ? <Check size={13} className="text-emerald-500" /> : <Save size={13} />}
              >
                {saveSuccess ? t.settings.personas.saved : t.settings.personas.save}
              </Button>
            </div>

            <textarea
              value={summarizerPrompt}
              onChange={(e) => setSummarizerPrompt(e.target.value)}
              rows={16}
              className="w-full p-3.5 rounded-xl bg-[var(--theme-code-bg)] text-[var(--theme-code-text)] border border-[var(--theme-border)] font-mono text-xs focus:outline-none focus:border-[var(--theme-accent)] resize-y leading-relaxed"
            />
          </Card>
        </SettingsSection>
      )}

      {/* 5. Create New Persona Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={t.settings.personas.newPersonaTitle}
        subtitle="Создайте изолированный профиль поведения и инструкций"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setIsCreateOpen(false)}>
              {t.settings.personas.cancelBtn}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleCreate}>
              {t.settings.personas.createConfirmBtn}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-3.5">
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
    </div>
  );
};
