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
} from 'lucide-react';
import { PersonaMetadata, PersonaDetail } from '../../types';
import {
  get_personas,
  get_persona_detail,
  activate_persona,
  create_persona,
  save_persona_file,
  delete_persona,
  get_summarizer_prompt,
  save_summarizer_prompt,
} from '../../services/api';

export const PersonasTab: React.FC = () => {
  const [personas, setPersonas] = useState<PersonaMetadata[]>([]);
  const [activePersonaId, setActivePersonaId] = useState<string>('default');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('default');
  const [personaDetail, setPersonaDetail] = useState<PersonaDetail | null>(null);

  const [sectionTab, setSectionTab] = useState<'personas' | 'summarizer'>('personas');
  const [summarizerPrompt, setSummarizerPrompt] = useState<string>('');

  const [activeFileTab, setActiveFileTab] = useState<'soul' | 'tools' | 'user'>('soul');
  const [fileContent, setFileContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // New Persona Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIcon, setNewIcon] = useState('User');

  // Fetch personas list
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

  // Fetch detail for selected persona
  const loadDetail = async (id: string) => {
    try {
      const detail = await get_persona_detail(id);
      setPersonaDetail(detail);
      if (detail) {
        if (activeFileTab === 'soul') setFileContent(detail.soul);
        else if (activeFileTab === 'tools') setFileContent(detail.tools);
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

  useEffect(() => {
    loadPersonas();
    loadSummarizer();
  }, []);

  const handleSaveSummarizer = async () => {
    try {
      setIsSaving(true);
      await save_summarizer_prompt(summarizerPrompt);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      alert(`Ошибка сохранения SUMMARIZER.md: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (selectedPersonaId) {
      loadDetail(selectedPersonaId);
    }
  }, [selectedPersonaId]);

  useEffect(() => {
    if (personaDetail) {
      if (activeFileTab === 'soul') setFileContent(personaDetail.soul);
      else if (activeFileTab === 'tools') setFileContent(personaDetail.tools);
      else if (activeFileTab === 'user') setFileContent(personaDetail.user);
    }
  }, [activeFileTab, personaDetail]);

  const handleActivate = async (id: string) => {
    try {
      const updatedList = await activate_persona(id);
      setPersonas(updatedList);
      setActivePersonaId(id);
    } catch (err: any) {
      alert(` Ошибка активации личности: ${err.message}`);
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
    } catch (err: any) {
      alert(` Ошибка создания личности: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (id === 'default') {
      alert('Базовая личность (0xAgent Core) не может быть удалена!');
      return;
    }
    if (!confirm('Вы уверены, что хотите удалить эту личность и все её конфигурационные файлы?')) return;
    try {
      await delete_persona(id);
      if (selectedPersonaId === id) {
        setSelectedPersonaId('default');
      }
      await loadPersonas();
    } catch (err: any) {
      alert(` Ошибка удаления: ${err.message}`);
    }
  };

  const handleSaveFile = async () => {
    if (!selectedPersonaId) return;
    try {
      setIsSaving(true);
      const filename = activeFileTab === 'soul' ? 'SOUL.md' : activeFileTab === 'tools' ? 'TOOLS.md' : 'USER.md';
      const updated = await save_persona_file(selectedPersonaId, filename, fileContent);
      setPersonaDetail(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      alert(` Ошибка сохранения файла ${activeFileTab.toUpperCase()}.md: ${err.message}`);
    } finally {
      setIsSaving(false);
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
      {/* Top Sub-Tab Switcher: Personas vs System Summarizer */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
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
          <span>🎭 Личности Агента (Personas)</span>
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
          <span>⚙️ Системный Суммаризатор (SUMMARIZER.md)</span>
        </button>
      </div>

      {sectionTab === 'summarizer' ? (
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
              <p className="font-semibold text-cyan-300">⚙️ Как работает Фоновый LLM-Суммаризатор?</p>
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
      ) : (
        <>
          {/* Section Header */}
          <div className="glass-panel p-4 rounded-xl border border-white/10 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <User size={20} className="text-emerald-400" />
                <span>Система Личностей Агента (Personas)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Настраивайте характер, специфику работы с инструментами и накапливаемый профиль пользователя для каждой личности.
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
          {/* Modifications Window Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <Wrench size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>Окно Модификаций Личности:</span>
                  <span className="text-emerald-400 font-mono font-bold">
                    {personaDetail?.metadata.name || selectedPersonaId}
                  </span>
                </h3>
                <span className="text-xs text-slate-400">
                  Уникальный идентификатор профиля пользователя: <code className="text-slate-300 font-mono">{personaDetail?.metadata.user_id}</code>
                </span>
              </div>
            </div>

            {/* File Editor Selector Tabs */}
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
                onClick={() => setActiveFileTab('tools')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeFileTab === 'tools'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Wrench size={13} />
                <span>TOOLS.md (Инструменты)</span>
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
                  <p className="font-semibold text-emerald-300">✨ SOUL.md — Основная «душа» и харизма Агента</p>
                  <p className="text-slate-400">
                    Определяет мировоззрение, роль, цели и правила общения этой личности. Пользователь может свободно менять характер (например, сделать Агента саркастичным программистом или строгим архитектором).
                  </p>
                </>
              )}

              {activeFileTab === 'tools' && (
                <>
                  <p className="font-semibold text-emerald-300">🛠️ TOOLS.md — Инструкции вызова инструментов</p>
                  <p className="text-slate-400">
                    Задает индивидуальные предпочтения личности по работе с файлами и консолью (например, заставлять ли Агента запускать тесты перед патчами или запрещать перезапись определенных файлов).
                  </p>
                </>
              )}

              {activeFileTab === 'user' && (
                <>
                  <p className="font-semibold text-emerald-300">👤 USER.md — Накопленный профиль пользователя (`{personaDetail?.metadata.user_id}`)</p>
                  <p className="text-slate-400">
                    Агент тихо аккумулирует и записывает сюда сведения о ваших привычках, ОС, стеке и стилях написания кода во время общения. Данные привязаны к этой конкретной личности, и вы можете редактировать их вручную.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Code & Markdown Editor */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-emerald-400" />
                <span>Редактирование {activeFileTab.toUpperCase()}.md</span>
                {/* Interactive Tooltip Helper Badge */}
                <div className="relative group cursor-pointer">
                  <HelpCircle size={13} className="text-slate-500 hover:text-emerald-400 transition-colors" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-2.5 bg-slate-900 text-[11px] text-slate-300 rounded-lg border border-white/10 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                    Поддерживает стандартную разметку Markdown. Все изменения вступают в силу немедленно после сохранения.
                  </div>
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
                  onClick={handleSaveFile}
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
