import React, { useState, useEffect } from 'react';
import { FileText, Plus, Check, Trash2, Save, RefreshCw, Star, ShieldAlert } from 'lucide-react';
import { PromptFileInfo, AppConfig } from '../../types';
import * as api from '../../services/api';

interface PromptsTabProps {
  onConfigUpdated?: (config: AppConfig) => void;
}

export const PromptsTab: React.FC<PromptsTabProps> = ({ onConfigUpdated }) => {
  const [promptsList, setPromptsList] = useState<PromptFileInfo[]>([]);
  const [selectedFilename, setSelectedFilename] = useState<string>('default.md');
  const [currentContent, setCurrentContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [newFilenameInput, setNewFilenameInput] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    loadPromptsList();
  }, []);

  const loadPromptsList = async () => {
    setIsLoading(true);
    try {
      const list = await api.get_prompts();
      setPromptsList(list);

      const active = list.find((p) => p.is_active) || list[0];
      if (active) {
        setSelectedFilename(active.filename);
        const content = await api.get_prompt_content(active.filename);
        setCurrentContent(content);
      }
    } catch (err: any) {
      console.error('Failed to load prompts list:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectFile = async (filename: string) => {
    setSelectedFilename(filename);
    try {
      const content = await api.get_prompt_content(filename);
      setCurrentContent(content);
    } catch (err: any) {
      console.error('Failed to read prompt content:', err);
    }
  };

  const handleSaveContent = async () => {
    if (!selectedFilename) return;
    setIsSaving(true);
    try {
      await api.save_prompt_file(selectedFilename, currentContent);
      showStatus('Инструкция успешно сохранена!');
      await loadPromptsList();
    } catch (err: any) {
      alert(`Ошибка сохранения: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMakeActive = async () => {
    if (!selectedFilename) return;
    try {
      const updatedConfig = await api.select_prompt_file(selectedFilename);
      showStatus(`Инструкция "${selectedFilename}" установлена как активный системный промпт!`);
      if (onConfigUpdated) onConfigUpdated(updatedConfig);
      await loadPromptsList();
    } catch (err: any) {
      alert(`Ошибка активации: ${err.message || err}`);
    }
  };

  const handleCreateNewFile = async () => {
    if (!newFilenameInput.trim()) return;
    let name = newFilenameInput.trim().toLowerCase().replace(/\s+/g, '_');
    if (!name.endsWith('.md')) name += '.md';

    try {
      const initialTemplate = `# ${name.replace(/\.md$/, '').replace(/_/g, ' ')}\n\nНапишите здесь системные инструкции для 0xAgent...`;
      await api.save_prompt_file(name, initialTemplate);
      setIsCreating(false);
      setNewFilenameInput('');
      showStatus(`Создан новый промпт: ${name}`);
      await loadPromptsList();
      await handleSelectFile(name);
    } catch (err: any) {
      alert(`Ошибка создания файла: ${err.message || err}`);
    }
  };

  const handleDeleteFile = async (filename: string) => {
    if (filename.toLowerCase() === 'default.md') {
      alert('Заводской промпт default.md нельзя удалить.');
      return;
    }

    if (!confirm(`Удалить файл системной инструкции "${filename}"?`)) return;

    try {
      await api.delete_prompt_file(filename);
      showStatus(`Файл ${filename} удален.`);
      await loadPromptsList();
    } catch (err: any) {
      alert(`Ошибка удаления: ${err.message || err}`);
    }
  };

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const activePrompt = promptsList.find((p) => p.filename === selectedFilename);

  return (
    <div className="space-y-5 font-sans text-slate-100 max-w-5xl h-full flex flex-col">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <FileText size={16} className="text-emerald-400" />
            <span>Системные инструкции Агента (System Prompts)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Все инструкции сохраняются как `.md` файлы во внутренней папке <span className="font-mono text-emerald-400">~/.0xagent/prompts/</span>
          </p>
        </div>

        {statusMessage && (
          <div className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded border border-emerald-500/30 flex items-center gap-1.5 animate-pulse">
            <Check size={12} />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Main Grid: Left Files Sidebar & Right Editor Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-[460px]">
        {/* Left Files List Panel */}
        <div className="p-3.5 rounded-md glass-card border border-white/10 flex flex-col justify-between space-y-3">
          <div className="space-y-2 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs font-semibold text-slate-300">Файлы инструкций ({promptsList.length})</span>
              <button
                type="button"
                onClick={() => setIsCreating(!isCreating)}
                className="flat-btn px-2 py-1 rounded text-[11px] font-medium text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 cursor-pointer flex items-center gap-1"
              >
                <Plus size={11} />
                <span>Создать</span>
              </button>
            </div>

            {/* Create Prompt Input Form */}
            {isCreating && (
              <div className="p-2 rounded bg-slate-900 border border-white/10 space-y-2">
                <input
                  type="text"
                  value={newFilenameInput}
                  onChange={(e) => setNewFilenameInput(e.target.value)}
                  placeholder="name.md (e.g. architect.md)"
                  className="w-full px-2 py-1 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
                />
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-2 py-0.5 rounded text-[10px] text-slate-400 hover:text-white"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateNewFile}
                    className="flat-btn px-2 py-0.5 rounded text-[10px] text-emerald-400 border-emerald-500/40 font-medium"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            )}

            {/* List Items */}
            <div className="space-y-1 overflow-y-auto flex-1 scrollbar-none pr-1">
              {isLoading ? (
                <div className="text-xs text-slate-500 py-6 text-center italic">Загрузка файлов...</div>
              ) : (
                promptsList.map((item) => {
                  const isSelected = item.filename === selectedFilename;
                  return (
                    <div
                      key={item.filename}
                      onClick={() => handleSelectFile(item.filename)}
                      className={`p-2.5 rounded border text-xs cursor-pointer transition-all flex items-center justify-between gap-2 select-none ${
                        isSelected
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-white font-medium'
                          : 'border-white/5 bg-slate-900/40 text-slate-300 hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <FileText size={13} className={item.is_active ? 'text-emerald-400' : 'text-slate-400'} />
                          <span className="font-mono text-xs truncate">{item.filename}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">{item.title}</div>
                      </div>

                      {item.is_active && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0 font-medium flex items-center gap-1">
                          <Star size={9} className="fill-emerald-400" />
                          <span>Активный</span>
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="text-[10px] text-slate-400 pt-2 border-t border-white/10">
            Изменения в файлах сразу вступают в силу при вызовах LLM агента.
          </div>
        </div>

        {/* Right Editor Panel */}
        <div className="md:col-span-2 p-4 rounded-md glass-card border border-white/10 flex flex-col justify-between space-y-3">
          {/* Editor Header Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2.5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs text-slate-200">{selectedFilename}</span>
              {activePrompt?.is_active ? (
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium flex items-center gap-1">
                  <Check size={10} />
                  <span>Выбран как текущий системный промпт</span>
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-white/10 font-medium">
                  Неактивный
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!activePrompt?.is_active && (
                <button
                  type="button"
                  onClick={handleMakeActive}
                  className="flat-btn px-3 py-1 rounded text-xs font-medium text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 cursor-pointer flex items-center gap-1.5"
                >
                  <Star size={12} />
                  <span>Сделать активным</span>
                </button>
              )}

              {selectedFilename.toLowerCase() !== 'default.md' && (
                <button
                  type="button"
                  onClick={() => handleDeleteFile(selectedFilename)}
                  className="flat-btn p-1.5 rounded text-rose-400 border-rose-500/30 hover:bg-rose-500/10 cursor-pointer"
                  title="Удалить файл"
                >
                  <Trash2 size={13} />
                </button>
              )}

              <button
                type="button"
                onClick={handleSaveContent}
                disabled={isSaving}
                className="flat-btn px-3.5 py-1 rounded text-xs font-medium text-sky-400 border-sky-500/40 hover:bg-sky-500/10 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSaving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                <span>Сохранить файл</span>
              </button>
            </div>
          </div>

          {/* Textarea Editor */}
          <div className="flex-1 flex flex-col min-h-[360px]">
            <textarea
              value={currentContent}
              onChange={(e) => setCurrentContent(e.target.value)}
              placeholder="Системные инструкции..."
              className="w-full flex-1 p-3 rounded flat-input font-mono text-xs text-slate-100 focus:outline-none leading-relaxed resize-none"
            />
          </div>

          {/* Notice info */}
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
            <ShieldAlert size={12} className="text-amber-400 shrink-0" />
            <span>
              Системные инструкции задают логику поведения агента, форматы тегов (`&lt;read_file&gt;`, `&lt;write_file&gt;`) и роль.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
