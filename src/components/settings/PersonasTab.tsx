import React, { useState, useEffect } from 'react';
import {
  User,
  Zap,
  Shield,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  FileText,
  Wrench,
  HelpCircle,
  Save,
  RefreshCw,
  Info,
  ToggleLeft,
  ToggleRight,
  Sliders,
  Code,
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
  const [newIcon, setNewIcon] = useState('User');

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

  const loadTools = async () => {
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
    loadTools();
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
      showToast('Личность успешно активирована!', 'success');
    } catch (err: any) {
      showToast(`Ошибка активации личности: ${err.message}`, 'error');
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
      showToast(`Личность "${created.metadata.name}" создана!`, 'success');
    } catch (err: any) {
      showToast(`Ошибка создания личности: ${err.message}`, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (id === 'default') {
      showToast('Базовая личность (0xAgent Core) не может быть удалена!', 'info');
      return;
    }
    if (!confirm('Вы уверены, что хотите удалить эту личность и все её конфигурационные файлы?')) return;
    try {
      await delete_persona(id);
      if (selectedPersonaId === id) {
        setSelectedPersonaId('default');
      }
      await loadPersonas();
      showToast('Личность удалена.', 'success');
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
      showToast(`Ошибка сохранения файла ${activeFileTab.toUpperCase()}.md: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Tools Toggles Handlers
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
      showToast(`Ошибка сохранения параметров инструментов: ${err.message}`, 'error');
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
      showToast('Глобальный файл TOOLS.md успешно сохранен!', 'success');
      setTimeout(() => setToolsSaveSuccess(false), 2000);
    } catch (err: any) {
      showToast(`Ошибка сохранения TOOLS.md: ${err.message}`, 'error');
    } finally {
      setIsToolsSaving(false);
    }
  };

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'Zap':
        return <Zap size={18} className="text-amber-400" />;
      case 'Shield':
        return <Shield size={18} className="text-cyan-400" />;
      case 'Sparkles':
        return <Sparkles size={18} className="text-purple-400" />;
      default:
        return <User size={18} className="text-emerald-400" />;
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 font-sans">
      {/* Top Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 flex-wrap">
        <button
          type="button"
          onClick={() => setSectionTab('personas')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            sectionTab === 'personas'
              ? 'bg-slate-800 text-emerald-400 border border-emerald-500/40 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <User size={15} />
          <span>Личности Агента (Personas)</span>
        </button>

        <button
          type="button"
          onClick={() => setSectionTab('tools')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            sectionTab === 'tools'
              ? 'bg-slate-800 text-amber-400 border border-amber-500/40 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Sliders size={15} />
          <span>Инструменты (TOOLS.md)</span>
        </button>

        <button
          type="button"
          onClick={() => setSectionTab('summarizer')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            sectionTab === 'summarizer'
              ? 'bg-slate-800 text-cyan-400 border border-cyan-500/40 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Sparkles size={15} />
          <span>Системный Суммаризатор (SUMMARIZER.md)</span>
        </button>
      </div>

      {/* 1. TOOLS MANAGEMENT TAB */}
      {sectionTab === 'tools' && (
        <div className="flex flex-col gap-6">
          {/* Header Banner */}
          <div className="glass-panel p-5 rounded-xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                <Sliders size={22} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <span>Система Инструментов Агента</span>
                  <span className="text-amber-400 font-mono text-xs px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                    Единый TOOLS.md
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-1 max-w-3xl">
                  Управляйте активными инструментами Агента. Отключение лишних функций уменьшает объем системного промпта и ускоряет генерацию. На основе переключателей создается единый файл <code className="text-amber-300 font-mono">TOOLS.md</code>, используемый независимо от выбранной личности.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleBulkToggleAll(true)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-white/10 transition-all cursor-pointer"
              >
                Включить все
              </button>
              <button
                type="button"
                onClick={() => handleBulkToggleAll(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-semibold border border-white/10 transition-all cursor-pointer"
              >
                Отключить все
              </button>
            </div>
          </div>

          {/* Interactive Tools Toggles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {toolsList.map((tool) => (
              <div
                key={tool.id}
                onClick={() => handleToggleTool(tool.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  tool.enabled
                    ? 'bg-slate-900/80 border-amber-500/40 shadow-lg shadow-amber-950/10'
                    : 'bg-slate-950/40 border-white/5 opacity-60 hover:opacity-100 hover:bg-slate-900/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-amber-400">&lt;{tool.name}&gt;</span>
                      {tool.requiresApproval ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
                          Подтверждение
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                          Авто
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{tool.description}</p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleTool(tool.id);
                    }}
                    className={`shrink-0 p-1 transition-colors cursor-pointer ${
                      tool.enabled ? 'text-amber-400' : 'text-slate-600'
                    }`}
                  >
                    {tool.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                  </button>
                </div>

                <div className="p-2 rounded bg-slate-950/70 border border-white/5 text-[11px] font-mono text-slate-400 overflow-x-auto">
                  {tool.xmlSpec.split('\n')[0]}
                </div>
              </div>
            ))}
          </div>

          {/* TOOLS.md Markdown Preview / Code Editor */}
          <div className="glass-panel p-5 rounded-xl border border-white/10 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Code size={16} className="text-amber-400" />
                <span>Генерируемый системный файл TOOLS.md</span>
                {toolsSaveSuccess && (
                  <span className="text-emerald-400 text-xs font-medium flex items-center gap-1 animate-pulse ml-2">
                    <CheckCircle2 size={12} />
                    Сохранено!
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleSaveToolsMd}
                disabled={isToolsSaving}
                className="flat-btn bg-amber-600 hover:bg-amber-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isToolsSaving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                <span>Сохранить TOOLS.md</span>
              </button>
            </div>

            <textarea
              value={toolsMdContent}
              onChange={(e) => setToolsMdContent(e.target.value)}
              rows={14}
              className="w-full bg-slate-950/80 text-slate-100 font-mono text-xs p-3.5 rounded-xl border border-white/10 focus:border-amber-500 focus:outline-none scrollbar-thin resize-y"
              placeholder="Сгенерированные инструкции вызова инструментов..."
            />
          </div>
        </div>
      )}

      {/* 2. SUMMARIZER TAB */}
      {sectionTab === 'summarizer' && (
        <div className="glass-panel p-5 rounded-xl border border-white/10 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Инструкции Фонового Суммаризатора (SUMMARIZER.md)</h3>
                <span className="text-xs text-slate-400">
                  Системная инструкция, управляющая логикой фонового сжатия контекста при заполнении окна.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {saveSuccess && (
                <span className="text-emerald-400 text-xs font-medium flex items-center gap-1 animate-pulse">
                  <CheckCircle2 size={12} />
                  Сохранено!
                </span>
              )}
              <button
                type="button"
                onClick={handleSaveSummarizer}
                disabled={isSaving}
                className="flat-btn bg-cyan-600 hover:bg-cyan-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                <span>Сохранить SUMMARIZER.md</span>
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/70 border border-cyan-500/20 flex items-start gap-3 text-xs">
            <Info size={16} className="text-cyan-400 shrink-0 mt-0.5" />
            <div className="text-slate-300 space-y-1">
              <p className="font-semibold text-cyan-300">Как работает Фоновый LLM-Суммаризатор?</p>
              <p className="text-slate-400">
                Когда объем токенов контекста превышает 75% от лимита вашей модели, 0xAgent в фоновом режиме отправляет историю диалога локальному LLM с инструкциями из этого файла. Сжатая сводка заменяет устаревшие средние сообщения, освобождая место для новых вызовов без потери сути задачи.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-cyan-400" />
                <span>Редактирование системного промпта сжатия</span>
                <div className="relative group cursor-pointer">
                  <HelpCircle size={13} className="text-slate-500 hover:text-cyan-400 transition-colors" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 p-2.5 bg-slate-900 text-[11px] text-slate-300 rounded-lg border border-white/10 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                    Укажите здесь правила формата резюме: например, требовать сохранение названий созданных файлов, параметров функций или архитектурных требований.
                  </div>
                </div>
              </div>
            </div>

            <textarea
              value={summarizerPrompt}
              onChange={(e) => setSummarizerPrompt(e.target.value)}
              rows={16}
              className="w-full bg-slate-950/80 text-slate-100 font-mono text-xs p-3.5 rounded-xl border border-white/10 focus:border-cyan-500 focus:outline-none scrollbar-thin resize-y"
              placeholder="Введите правила фонового сжатия контекста..."
            />
          </div>
        </div>
      )}

      {/* 3. PERSONAS TAB */}
      {sectionTab === 'personas' && (
        <>
          {/* Section Header */}
          <div className="glass-panel p-4 rounded-xl border border-white/10 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <User size={20} className="text-emerald-400" />
                <span>Система Личностей Агента (Personas)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Настраивайте характер, поведение и накопленный профиль пользователя для каждой личности.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="flat-btn bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-950/40"
            >
              <Plus size={14} />
              <span>Создать личность</span>
            </button>
          </div>

          {/* Personas Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {personas.map((p) => {
              const isSelected = p.id === selectedPersonaId;
              const isActive = p.id === activePersonaId;

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPersonaId(p.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 relative ${
                    isSelected
                      ? 'bg-slate-800/80 border-emerald-500/60 ring-1 ring-emerald-500/40 shadow-lg shadow-emerald-950/20'
                      : 'bg-slate-900/50 border-white/10 hover:border-white/20 hover:bg-slate-900/80'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-slate-800 border border-white/10">
                          {getIconComponent(p.icon)}
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white">{p.name}</h3>
                          <span className="text-[10px] text-slate-400 font-mono">ID: {p.user_id}</span>
                        </div>
                      </div>

                      {isActive && (
                        <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1">
                          <CheckCircle2 size={10} />
                          АКТИВНА
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-2">{p.description}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    {!isActive ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleActivate(p.id);
                        }}
                        className="text-xs text-slate-300 hover:text-emerald-400 flex items-center gap-1 font-medium transition-colors cursor-pointer"
                      >
                        <Zap size={12} />
                        <span>Активировать</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-emerald-400 font-medium">Текущая модель</span>
                    )}

                    {p.id !== 'default' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(p.id);
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors cursor-pointer"
                        title="Удалить личность"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Modifications Window for Selected Persona */}
          {selectedPersonaId && (
            <div className="glass-panel p-5 rounded-xl border border-white/10 flex flex-col gap-4">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    <Wrench size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <span>Модификация Личности:</span>
                      <span className="text-emerald-400 font-mono font-bold">
                        {personaDetail?.metadata.name || selectedPersonaId}
                      </span>
                    </h3>
                    <span className="text-xs text-slate-400">
                      Идентификатор профиля: <code className="text-slate-300 font-mono">{personaDetail?.metadata.user_id}</code>
                    </span>
                  </div>
                </div>

                {/* File Editor Selector Tabs: SOUL & USER only */}
                <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-white/10">
                  <button
                    type="button"
                    onClick={() => setActiveFileTab('soul')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      activeFileTab === 'soul'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Sparkles size={13} />
                    <span>SOUL.md (Душа)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveFileTab('user')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      activeFileTab === 'user'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <User size={13} />
                    <span>USER.md (Профиль)</span>
                  </button>
                </div>
              </div>

              {/* Interactive Help Tooltip Banner */}
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-emerald-500/20 flex items-start gap-3 text-xs">
                <Info size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 text-slate-300 space-y-1">
                  {activeFileTab === 'soul' && (
                    <>
                      <p className="font-semibold text-emerald-300">SOUL.md — Основная «душа» и харизма Агента</p>
                      <p className="text-slate-400">
                        Определяет мировоззрение, роль, цели и правила общения этой личности.
                      </p>
                    </>
                  )}

                  {activeFileTab === 'user' && (
                    <>
                      <p className="font-semibold text-emerald-300">USER.md — Накопленный профиль пользователя (`{personaDetail?.metadata.user_id}`)</p>
                      <p className="text-slate-400">
                        Агент тихо аккумулирует и записывает сюда сведения о ваших привычках, ОС, стеке и стилях написания кода.
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Editor */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-emerald-400" />
                    <span>Редактирование {activeFileTab.toUpperCase()}.md</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {saveSuccess && (
                      <span className="text-emerald-400 text-xs font-medium flex items-center gap-1 animate-pulse">
                        <CheckCircle2 size={12} />
                        Сохранено!
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleSavePersonaFile}
                      disabled={isSaving}
                      className="flat-btn bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isSaving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                      <span>Сохранить {activeFileTab.toUpperCase()}.md</span>
                    </button>
                  </div>
                </div>

                <textarea
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  rows={14}
                  className="w-full bg-slate-950/80 text-slate-100 font-mono text-xs p-3.5 rounded-xl border border-white/10 focus:border-emerald-500 focus:outline-none scrollbar-thin resize-y"
                  placeholder={`Введите содержание файла ${activeFileTab.toUpperCase()}.md...`}
                />
              </div>
            </div>
          )}

          {/* Modal for Creating New Persona */}
          {isCreateOpen && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
              <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-white/10 shadow-2xl flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Plus size={16} className="text-emerald-400" />
                  <span>Создание Новой Личности</span>
                </h3>

                <form onSubmit={handleCreate} className="flex flex-col gap-4 text-xs">
                  <div className="flex flex-col gap-1">
                    <label className="text-slate-300 font-medium">Название личности *</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Например: Эксперт по React или Кибер-Аудитор"
                      className="bg-slate-900 text-white p-2.5 rounded-lg border border-white/10 focus:border-emerald-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-slate-300 font-medium">Краткое описание</label>
                    <input
                      type="text"
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="Специализация личности и основные задачи"
                      className="bg-slate-900 text-white p-2.5 rounded-lg border border-white/10 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-slate-300 font-medium">Иконка</label>
                    <select
                      value={newIcon}
                      onChange={(e) => setNewIcon(e.target.value)}
                      className="bg-slate-900 text-white p-2.5 rounded-lg border border-white/10 focus:border-emerald-500 focus:outline-none cursor-pointer"
                    >
                      <option value="User">User (Пользователь)</option>
                      <option value="Zap">Zap (Молния)</option>
                      <option value="Shield">Shield (Щит)</option>
                      <option value="Sparkles">Sparkles (Искры)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setIsCreateOpen(false)}
                      className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      className="flat-btn bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg font-semibold cursor-pointer"
                    >
                      Создать
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
