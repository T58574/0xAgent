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
  save_tools_md,
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
  const [toolsMdContent, setToolsMdContent] = useState<string>('');
  const [isToolsSaving, setIsToolsSaving] = useState<boolean>(false);
  const [toolsSaveSuccess, setToolsSaveSuccess] = useState<boolean>(false);

  // Persona file state (SOUL.md & USER.md)
  const [activeFileTab, setActiveFileTab] = useState<'soul' | 'user'>('soul');
  const [fileContent, setFileContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // New Persona Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIcon] = useState('User');

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
      setToolsMdContent(state.content);
    } catch (err) {
      console.error('Failed to load tools state:', err);
    }
  };

  useEffect(() => {
    loadPersonas();
    loadSummarizer();
    loadToolsState();
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
      const created = await create_persona(newName.trim(), newDesc.trim(), newIcon);
      setIsCreateOpen(false);
      setNewName('');
      setNewDesc('');
      await loadPersonas();
      setSelectedPersonaId(created.metadata.id);
      showToast(`Персона "${created.metadata.name}" создана!`, 'success');
    } catch (err: any) {
      showToast(`Ошибка создания: ${err.message}`, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (id === 'default') {
      showToast('Базовая персона не может быть удалена!', 'info');
      return;
    }
    if (!confirm('Вы уверены, что хотите удалить эту персону?')) return;
    try {
      await delete_persona(id);
      if (selectedPersonaId === id) {
        setSelectedPersonaId('default');
      }
      await loadPersonas();
      showToast('Персона удалена.', 'success');
    } catch (err: any) {
      showToast(`Ошибка удаления: ${err.message}`, 'error');
    }
  };

  const handleSavePersonaFile = async () => {
    if (!selectedPersonaId) return;
    try {
      setIsSaving(true);
      const filename = activeFileTab === 'soul' ? 'SOUL.md' : 'USER.md';
      const updated = await save_persona_file(selectedPersonaId, filename, fileContent);
      setPersonaDetail(updated);
      setSaveSuccess(true);
      showToast(`Файл ${filename} сохранен!`, 'success');
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      showToast(`Ошибка сохранения: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleTool = async (id: string) => {
    const updated = toolsList.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t));
    setToolsList(updated);

    const togglesMap: Record<string, boolean> = {};
    updated.forEach((t) => {
      togglesMap[t.id] = t.enabled;
    });

    try {
      setIsToolsSaving(true);
      const state = await save_tools_toggles(togglesMap);
      setToolsMdContent(state.content);
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
      const state = await save_tools_toggles(togglesMap);
      setToolsMdContent(state.content);
      showToast(enabledState ? 'Все инструменты включены!' : 'Все инструменты отключены!', 'info');
    } catch (err: any) {
      showToast(`Ошибка группового изменения: ${err.message}`, 'error');
    } finally {
      setIsToolsSaving(false);
    }
  };

  const handleSaveToolsMd = async () => {
    try {
      setIsToolsSaving(true);
      const state = await save_tools_md(toolsMdContent);
      setToolsMdContent(state.content);
      setToolsSaveSuccess(true);
      showToast('TOOLS.md успешно сохранен!', 'success');
      setTimeout(() => setToolsSaveSuccess(false), 2000);
    } catch (err: any) {
      showToast(`Ошибка сохранения TOOLS.md: ${err.message}`, 'error');
    } finally {
      setIsToolsSaving(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-4 font-sans text-[var(--theme-text)]">
      {/* Top Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-[var(--theme-border)] pb-2 flex-wrap">
        <button
          type="button"
          onClick={() => setSectionTab('personas')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer border ${
            sectionTab === 'personas'
              ? 'bg-white/10 text-[var(--theme-text)] border-[var(--theme-border)] font-semibold shadow-sm'
              : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5'
          }`}
        >
          <User size={14} className="text-[var(--theme-text-muted)]" />
          <span>Персоны (Personas)</span>
        </button>

        <button
          type="button"
          onClick={() => setSectionTab('tools')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer border ${
            sectionTab === 'tools'
              ? 'bg-white/10 text-[var(--theme-text)] border-[var(--theme-border)] font-semibold shadow-sm'
              : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5'
          }`}
        >
          <Sliders size={14} className="text-[var(--theme-text-muted)]" />
          <span>Инструменты (TOOLS.md)</span>
        </button>

        <button
          type="button"
          onClick={() => setSectionTab('summarizer')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer border ${
            sectionTab === 'summarizer'
              ? 'bg-white/10 text-[var(--theme-text)] border-[var(--theme-border)] font-semibold shadow-sm'
              : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5'
          }`}
        >
          <Sparkles size={14} className="text-[var(--theme-text-muted)]" />
          <span>Суммаризатор (SUMMARIZER.md)</span>
        </button>
      </div>

      {/* 1. TOOLS MANAGEMENT TAB */}
      {sectionTab === 'tools' && (
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-xl bento-card flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-white/5 border border-[var(--theme-border)] text-[var(--theme-text-muted)] shrink-0">
                <Sliders size={18} />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-[var(--theme-text)] flex items-center gap-2">
                  <span>Система инструментов Агента</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-white/5 border border-[var(--theme-border)] text-[var(--theme-text-muted)]">
                    TOOLS.md
                  </span>
                </h2>
                <p className="text-xs text-[var(--theme-text-muted)] mt-0.5 max-w-2xl">
                  Управляйте активными инструментами ИИ. Отключение лишних функций сокращает системный промпт.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleBulkToggleAll(true)}
                className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[var(--theme-text)] text-xs font-medium border border-[var(--theme-border)] transition-colors cursor-pointer"
              >
                Включить все
              </button>
              <button
                type="button"
                onClick={() => handleBulkToggleAll(false)}
                className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] text-xs font-medium border border-[var(--theme-border)] transition-colors cursor-pointer"
              >
                Отключить все
              </button>
            </div>
          </div>

          {/* Tools Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {toolsList.map((tool) => (
              <div
                key={tool.id}
                onClick={() => handleToggleTool(tool.id)}
                className={`p-3.5 rounded-xl bento-card cursor-pointer transition-all flex flex-col justify-between gap-2.5 border ${
                  tool.enabled
                    ? 'bg-white/10 border-[var(--theme-border)]'
                    : 'opacity-50 hover:opacity-80 border-transparent bg-white/5'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-[var(--theme-text)]">&lt;{tool.name}&gt;</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-white/10 text-[var(--theme-text-muted)] font-mono">
                        {tool.requiresApproval ? 'Подтверждение' : 'Авто'}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--theme-text-muted)] mt-1">{tool.description}</p>
                  </div>

                  <div
                    className={`w-8 h-4.5 rounded-md p-0.5 flex items-center shrink-0 transition-colors ${
                      tool.enabled ? 'bg-white/30' : 'bg-white/10'
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-sm bg-white transition-transform ${tool.enabled ? 'translate-x-3.5' : 'translate-x-0'}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Editor of global TOOLS.md */}
          <div className="p-4 rounded-xl bento-card flex flex-col gap-2.5">
            <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-2">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-[var(--theme-text-muted)]" />
                <span className="text-xs font-medium text-[var(--theme-text)]">Редактирование TOOLS.md</span>
              </div>
              <button
                type="button"
                onClick={handleSaveToolsMd}
                disabled={isToolsSaving}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-[var(--theme-border)] text-xs font-medium text-[var(--theme-text)] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
              >
                {toolsSaveSuccess ? <Check size={13} /> : <Save size={13} />}
                <span>{toolsSaveSuccess ? 'Сохранено' : 'Сохранить'}</span>
              </button>
            </div>
            <textarea
              value={toolsMdContent}
              onChange={(e) => setToolsMdContent(e.target.value)}
              rows={12}
              className="w-full p-3 rounded-lg bento-card font-mono text-xs text-[var(--theme-text)] focus:outline-none resize-y"
            />
          </div>
        </div>
      )}

      {/* 2. SUMMARIZER PROMPT TAB */}
      {sectionTab === 'summarizer' && (
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-xl bento-card flex items-start gap-3">
            <div className="p-2 rounded-lg bg-white/5 border border-[var(--theme-border)] text-[var(--theme-text-muted)] shrink-0">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-xs font-semibold text-[var(--theme-text)] flex items-center gap-2">
                <span>Системный суммаризатор контекста</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-white/5 border border-[var(--theme-border)] text-[var(--theme-text-muted)]">
                  SUMMARIZER.md
                </span>
              </h2>
              <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">
                Этот промпт используется при фоновом сжатии контекста диалога при переполнении контекстного окна.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bento-card flex flex-col gap-2.5">
            <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-2">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-[var(--theme-text-muted)]" />
                <span className="text-xs font-medium text-[var(--theme-text)]">Промпт сжатия</span>
              </div>
              <button
                type="button"
                onClick={handleSaveSummarizer}
                disabled={isSaving}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-[var(--theme-border)] text-xs font-medium text-[var(--theme-text)] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
              >
                {saveSuccess ? <Check size={13} /> : <Save size={13} />}
                <span>{saveSuccess ? 'Сохранено' : 'Сохранить'}</span>
              </button>
            </div>
            <textarea
              value={summarizerPrompt}
              onChange={(e) => setSummarizerPrompt(e.target.value)}
              rows={16}
              className="w-full p-3 rounded-lg bento-card font-mono text-xs text-[var(--theme-text)] focus:outline-none resize-y"
            />
          </div>
        </div>
      )}

      {/* 3. PERSONAS LIST & EDITOR TAB */}
      {sectionTab === 'personas' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Personas List Column */}
          <div className="lg:col-span-4 space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-medium text-[var(--theme-text-muted)] uppercase tracking-wider">
                Список персон ({personas.length})
              </span>
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 border border-[var(--theme-border)] text-xs font-medium text-[var(--theme-text)] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus size={13} />
                <span>Создать</span>
              </button>
            </div>

            <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
              {personas.map((p) => {
                const isSelected = p.id === selectedPersonaId;
                const isActive = p.id === activePersonaId;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPersonaId(p.id)}
                    className={`p-3 rounded-xl bento-card cursor-pointer transition-all flex flex-col gap-1.5 border ${
                      isSelected
                        ? 'bg-white/10 border-[var(--theme-border)] shadow-sm'
                        : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-[var(--theme-text-muted)]" />
                        <span className="font-semibold text-xs text-[var(--theme-text)]">{p.name}</span>
                      </div>
                      {isActive && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-md bg-white/10 text-[var(--theme-text)]">
                          активна
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--theme-text-muted)] line-clamp-1">{p.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Persona Details Column */}
          <div className="lg:col-span-8 space-y-3">
            {personaDetail ? (
              <div className="p-4 rounded-xl bento-card space-y-3">
                <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--theme-text)]">{personaDetail.metadata.name}</h3>
                    <p className="text-xs text-[var(--theme-text-muted)]">{personaDetail.metadata.description}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {personaDetail.metadata.id !== activePersonaId && (
                      <button
                        type="button"
                        onClick={() => handleActivate(personaDetail.metadata.id)}
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-[var(--theme-border)] text-xs font-medium text-[var(--theme-text)] cursor-pointer transition-colors"
                      >
                        Активировать
                      </button>
                    )}
                    {personaDetail.metadata.id !== 'default' && (
                      <button
                        type="button"
                        onClick={() => handleDelete(personaDetail.metadata.id)}
                        className="p-1.5 rounded-lg text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/10 cursor-pointer transition-colors"
                        title="Удалить персону"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* File Subtabs */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-[var(--theme-border)]">
                    <button
                      type="button"
                      onClick={() => setActiveFileTab('soul')}
                      className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition-all ${
                        activeFileTab === 'soul'
                          ? 'bg-white/15 text-[var(--theme-text)] border border-[var(--theme-border)]'
                          : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                      }`}
                    >
                      SOUL.md
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFileTab('user')}
                      className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition-all ${
                        activeFileTab === 'user'
                          ? 'bg-white/15 text-[var(--theme-text)] border border-[var(--theme-border)]'
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
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-[var(--theme-border)] text-xs font-medium text-[var(--theme-text)] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    {saveSuccess ? <Check size={13} /> : <Save size={13} />}
                    <span>{saveSuccess ? 'Сохранено' : 'Сохранить'}</span>
                  </button>
                </div>

                <textarea
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  rows={14}
                  className="w-full p-3 rounded-lg bento-card font-mono text-xs text-[var(--theme-text)] focus:outline-none resize-y"
                />
              </div>
            ) : (
              <div className="p-8 rounded-xl bento-card text-center text-xs text-[var(--theme-text-muted)]">
                Выберите персону для редактирования
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal for Creating New Persona */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md p-5 rounded-xl bento-card bg-[var(--theme-panel)] border border-[var(--theme-border)] shadow-2xl space-y-4">
            <h3 className="text-sm font-semibold text-[var(--theme-text)]">Новая персона</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--theme-text-muted)]">Имя персоны</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Например: Архитектор"
                  className="w-full px-3 py-2 rounded-lg bento-card text-xs text-[var(--theme-text)] focus:outline-none"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--theme-text-muted)]">Краткое описание</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Например: Эксперт по чистому коду и паттернам"
                  className="w-full px-3 py-2 rounded-lg bento-card text-xs text-[var(--theme-text)] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3 py-1.5 rounded-lg bento-card text-xs font-medium text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-[var(--theme-border)] text-xs font-medium text-[var(--theme-text)] cursor-pointer transition-colors"
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
