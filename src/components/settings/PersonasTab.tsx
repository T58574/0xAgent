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

export const PersonasTab: React.FC = () => {
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
  const [_toolsSaveSuccess, setToolsSaveSuccess] = useState<boolean>(false);

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

    const unsub = listen<{ activePersonaId?: string; personas: PersonaMetadata[] }>('persona-changed', (e) => {
      if (e.payload?.personas) {
        setPersonas(e.payload.personas);
      }
      if (e.payload?.activePersonaId) {
        setActivePersonaId(e.payload.activePersonaId);
      }
    });

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
      showToast('SUMMARIZER.md успешно сохранен!', 'success');
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      showToast(`Ошибка сохранения SUMMARIZER.md: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      const updatedList = await activate_persona(id);
      setPersonas(updatedList);
      setActivePersonaId(id);
      showToast('Персона успешно активирована!', 'success');
    } catch (err: any) {
      showToast(`Ошибка активации: ${err.message}`, 'error');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const created = await create_persona(newName.trim(), newDesc.trim(), 'User');
      setPersonas((prev) => [...prev, created.metadata]);
      setSelectedPersonaId(created.metadata.id);
      setIsCreateOpen(false);
      setNewName('');
      setNewDesc('');
      showToast(`Персона "${created.metadata.name}" создана!`, 'success');
    } catch (err: any) {
      showToast(`Ошибка создания: ${err.message}`, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (id === 'default') {
      showToast('Нельзя удалить стандартную персону', 'error');
      return;
    }
    if (!confirm('Вы уверены, что хотите удалить эту персону?')) return;
    try {
      await delete_persona(id);
      setPersonas((prev) => prev.filter((p) => p.id !== id));
      if (selectedPersonaId === id) setSelectedPersonaId('default');
      showToast('Персона удалена', 'info');
    } catch (err: any) {
      showToast(`Ошибка удаления: ${err.message}`, 'error');
    }
  };

  const handleSavePersonaFile = async () => {
    if (!personaDetail) return;
    const filename = activeFileTab === 'soul' ? 'SOUL.md' : 'USER.md';
    try {
      setIsSaving(true);
      await save_persona_file(personaDetail.metadata.id, filename, fileContent);
      setSaveSuccess(true);
      showToast(`${filename} успешно сохранен!`, 'success');
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      showToast(`Ошибка сохранения: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleTool = async (toolId: string) => {
    const updated = toolsList.map((t) => (t.id === toolId ? { ...t, enabled: !t.enabled } : t));
    setToolsList(updated);

    const togglesMap: Record<string, boolean> = {};
    updated.forEach((t) => {
      togglesMap[t.id] = t.enabled;
    });

    try {
      setIsToolsSaving(true);
      await save_tools_toggles(togglesMap);
      setToolsSaveSuccess(true);
      setTimeout(() => setToolsSaveSuccess(false), 1500);
    } catch (err: any) {
      showToast(`Ошибка сохранения: ${err.message}`, 'error');
    } finally {
      setIsToolsSaving(false);
    }
  };

  const handleBulkToggleAll = async (enabledState: boolean) => {
    const updated = toolsList.map((t) => ({ ...t, enabled: enabledState }));
    setToolsList(updated);

    const togglesMap: Record<string, boolean> = {};
    updated.forEach((t) => {
      togglesMap[t.id] = enabledState;
    });

    try {
      setIsToolsSaving(true);
      await save_tools_toggles(togglesMap);
      showToast(enabledState ? 'Все инструменты включены!' : 'Все инструменты отключены!', 'info');
    } catch (err: any) {
      showToast(`Ошибка группового изменения: ${err.message}`, 'error');
    } finally {
      setIsToolsSaving(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-5 font-sans text-[var(--theme-text)]">
      {/* Top Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--theme-border)] pb-3 flex-wrap">
        <button
          type="button"
          onClick={() => setSectionTab('personas')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border ${
            sectionTab === 'personas'
              ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] border-[var(--theme-accent)] shadow-sm'
              : 'border-[var(--theme-border)] bg-[var(--theme-card-bg)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
          }`}
        >
          <User size={14} />
          <span>Персоны и роли</span>
        </button>

        <button
          type="button"
          onClick={() => setSectionTab('tools')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border ${
            sectionTab === 'tools'
              ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] border-[var(--theme-accent)] shadow-sm'
              : 'border-[var(--theme-border)] bg-[var(--theme-card-bg)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
          }`}
        >
          <Sliders size={14} />
          <span>Инструменты (TOOLS.md)</span>
        </button>

        <button
          type="button"
          onClick={() => setSectionTab('summarizer')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border ${
            sectionTab === 'summarizer'
              ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] border-[var(--theme-accent)] shadow-sm'
              : 'border-[var(--theme-border)] bg-[var(--theme-card-bg)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
          }`}
        >
          <Sparkles size={14} />
          <span>Суммаризатор (SUMMARIZER.md)</span>
        </button>
      </div>

      {/* 1. TOOLS MANAGEMENT TAB */}
      {sectionTab === 'tools' && (
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-2xl bento-card flex flex-col md:flex-row md:items-center justify-between gap-3 border border-[var(--theme-border)]">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] shrink-0">
                <Sliders size={18} />
              </div>
              <div>
                <h2 className="text-xs font-bold text-[var(--theme-text)] flex items-center gap-2">
                  <span>Система инструментов Агента</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] font-semibold">
                    TOOLS.md
                  </span>
                </h2>
                <p className="text-xs text-[var(--theme-text-muted)] mt-0.5 max-w-2xl">
                  Управляйте активными инструментами ИИ. Отключение лишних функций сокращает системный промпт и экономит контекст.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleBulkToggleAll(true)}
                disabled={isToolsSaving}
                className="px-3 py-1.5 rounded-xl bg-[var(--theme-card-bg)] hover:bg-[var(--theme-border-subtle)] text-[var(--theme-text)] text-xs font-bold border border-[var(--theme-border)] transition-colors cursor-pointer"
              >
                Включить все
              </button>
              <button
                type="button"
                onClick={() => handleBulkToggleAll(false)}
                disabled={isToolsSaving}
                className="px-3 py-1.5 rounded-xl bg-[var(--theme-card-bg)] hover:bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] text-xs font-bold border border-[var(--theme-border)] transition-colors cursor-pointer"
              >
                Отключить все
              </button>
            </div>
          </div>

          {/* Tools Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {toolsList.map((tool) => (
              <div
                key={tool.id}
                onClick={() => handleToggleTool(tool.id)}
                className={`p-4 rounded-2xl bento-card cursor-pointer transition-all flex flex-col justify-between gap-3 border ${
                  tool.enabled
                    ? 'border-[var(--theme-accent)] bg-[var(--theme-card-bg)]'
                    : 'opacity-60 hover:opacity-90 border-[var(--theme-border)] bg-[var(--theme-card-bg)]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[var(--theme-text)]">&lt;{tool.name}&gt;</span>
                      <span className="text-[9px] px-2 py-0.5 rounded-md bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] font-mono border border-[var(--theme-border)]">
                        {tool.requiresApproval ? 'Подтверждение' : 'Авто'}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--theme-text-muted)] mt-1.5 leading-relaxed">{tool.description}</p>
                  </div>

                  <div
                    className={`w-9 h-5 rounded-full p-0.5 flex items-center shrink-0 transition-colors border ${
                      tool.enabled
                        ? 'bg-[var(--theme-accent)] border-[var(--theme-accent)] justify-end'
                        : 'bg-[var(--theme-input-bg)] border-[var(--theme-border)] justify-start'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full transition-transform ${
                        tool.enabled ? 'bg-[var(--theme-accent-text)]' : 'bg-[var(--theme-text-muted)]'
                      }`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. SUMMARIZER TAB */}
      {sectionTab === 'summarizer' && (
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-2xl bento-card flex items-start gap-3 border border-[var(--theme-border)]">
            <div className="p-2.5 rounded-xl bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] shrink-0">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-[var(--theme-text)] flex items-center gap-2">
                <span>Системный суммаризатор контекста</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] font-semibold">
                  SUMMARIZER.md
                </span>
              </h2>
              <p className="text-xs text-[var(--theme-text-muted)] mt-0.5 leading-relaxed">
                Этот промпт используется при фоновом сжатии контекста диалога при переполнении контекстного окна.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bento-card flex flex-col gap-3 border border-[var(--theme-border)]">
            <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-2.5">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-[var(--theme-text-muted)]" />
                <span className="text-xs font-bold text-[var(--theme-text)]">Промпт сжатия</span>
              </div>
              <button
                type="button"
                onClick={handleSaveSummarizer}
                disabled={isSaving}
                className="px-3.5 py-1.5 rounded-xl bg-[var(--theme-accent)] text-[var(--theme-accent-text)] border border-[var(--theme-accent)] text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors shadow-sm"
              >
                {saveSuccess ? <Check size={13} /> : <Save size={13} />}
                <span>{saveSuccess ? 'Сохранено' : 'Сохранить'}</span>
              </button>
            </div>
            <textarea
              value={summarizerPrompt}
              onChange={(e) => setSummarizerPrompt(e.target.value)}
              rows={16}
              className="w-full p-3.5 rounded-xl bg-[var(--theme-code-bg)] text-[var(--theme-code-text)] border border-[var(--theme-border)] font-mono text-xs focus:outline-none resize-y"
            />
          </div>
        </div>
      )}

      {/* 3. PERSONAS LIST & EDITOR TAB */}
      {sectionTab === 'personas' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Personas List Column */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-[var(--theme-text-muted)] uppercase tracking-wider">
                Список персон ({personas.length})
              </span>
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="px-2.5 py-1 rounded-xl bg-[var(--theme-card-bg)] hover:bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-xs font-bold text-[var(--theme-text)] flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
              >
                <Plus size={13} />
                <span>Создать</span>
              </button>
            </div>

            <div className="space-y-2">
              {personas.map((p) => {
                const isSelected = p.id === selectedPersonaId;
                const isActive = p.id === activePersonaId;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPersonaId(p.id)}
                    className={`p-3.5 rounded-2xl bento-card cursor-pointer transition-all flex flex-col gap-1.5 border ${
                      isSelected
                        ? 'border-[var(--theme-accent)] bg-[var(--theme-border-subtle)] ring-1 ring-[var(--theme-accent)]'
                        : 'border-[var(--theme-border)] bg-[var(--theme-card-bg)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-[var(--theme-text-muted)]" />
                        <span className="font-bold text-xs text-[var(--theme-text)]">{p.name}</span>
                      </div>
                      {isActive && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[var(--theme-accent)] text-[var(--theme-accent-text)]">
                          активна
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--theme-text-muted)] line-clamp-2 leading-relaxed">{p.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Persona Details Column */}
          <div className="lg:col-span-8 space-y-3">
            {personaDetail ? (
              <div className="p-4.5 rounded-2xl bento-card space-y-4 border border-[var(--theme-border)]">
                <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--theme-text)]">{personaDetail.metadata.name}</h3>
                    <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">{personaDetail.metadata.description}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {personaDetail.metadata.id !== activePersonaId && (
                      <button
                        type="button"
                        onClick={() => handleActivate(personaDetail.metadata.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-[var(--theme-accent)] text-[var(--theme-accent-text)] border border-[var(--theme-accent)] text-xs font-bold cursor-pointer transition-colors shadow-sm"
                      >
                        Активировать
                      </button>
                    )}
                    {personaDetail.metadata.id !== 'default' && (
                      <button
                        type="button"
                        onClick={() => handleDelete(personaDetail.metadata.id)}
                        className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 cursor-pointer transition-colors"
                        title="Удалить персону"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {/* File Subtabs */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center bg-[var(--theme-input-bg)] p-1 rounded-xl border border-[var(--theme-border)]">
                    <button
                      type="button"
                      onClick={() => setActiveFileTab('soul')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                        activeFileTab === 'soul'
                          ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] shadow-sm'
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
                          ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] shadow-sm'
                          : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                      }`}
                    >
                      USER.md
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSavePersonaFile}
                    disabled={isSaving}
                    className="px-3.5 py-1.5 rounded-xl bg-[var(--theme-accent)] text-[var(--theme-accent-text)] border border-[var(--theme-accent)] text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {saveSuccess ? <Check size={13} /> : <Save size={13} />}
                    <span>{saveSuccess ? 'Сохранено' : 'Сохранить'}</span>
                  </button>
                </div>

                <textarea
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  rows={14}
                  className="w-full p-3.5 rounded-xl bg-[var(--theme-code-bg)] text-[var(--theme-code-text)] border border-[var(--theme-border)] font-mono text-xs focus:outline-none resize-y"
                />
              </div>
            ) : (
              <div className="p-8 rounded-2xl bento-card text-center text-xs text-[var(--theme-text-muted)] border border-[var(--theme-border)] font-medium">
                Выберите персону для редактирования
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal for Creating New Persona */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md p-6 rounded-2xl bento-card bg-[var(--theme-panel-solid)] border border-[var(--theme-border)] shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-[var(--theme-text)]">Новая персона</h3>
            <form onSubmit={handleCreate} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[var(--theme-text-muted)]">Имя персоны</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Например: Архитектор"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs text-[var(--theme-text)] focus:outline-none"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[var(--theme-text-muted)]">Краткое описание</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Например: Эксперт по чистому коду и паттернам"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs text-[var(--theme-text)] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] text-xs font-bold text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-[var(--theme-accent)] text-[var(--theme-accent-text)] border border-[var(--theme-accent)] text-xs font-bold cursor-pointer transition-colors shadow-sm"
                >
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
