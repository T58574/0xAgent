import React, { useState, useEffect } from 'react';
import { Folder, FolderPlus, X, AlertCircle } from 'lucide-react';
import * as api from '../services/api';

interface WorkspacePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWorkspaceDir: (dirPath: string) => Promise<void>;
  currentWorkspaceDir?: string | null;
  recentWorkspaces?: string[];
}

export const WorkspacePickerModal: React.FC<WorkspacePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectWorkspaceDir,
  currentWorkspaceDir,
  recentWorkspaces = [],
}) => {
  const [inputPath, setInputPath] = useState('');
  const [isLoadingNative, setIsLoadingNative] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setInputPath(currentWorkspaceDir || '');
      setErrorMsg(null);
    }
  }, [isOpen, currentWorkspaceDir]);

  if (!isOpen) return null;

  const handleNativeBrowse = async () => {
    setIsLoadingNative(true);
    setErrorMsg(null);
    try {
      const folder = await api.select_workspace();
      if (folder) {
        setInputPath(folder);
        await onSelectWorkspaceDir(folder);
        onClose();
      }
    } catch (err: any) {
      console.error('Native folder select error:', err);
      setErrorMsg(`Не удалось открыть проводник: ${err.message || err}`);
    } finally {
      setIsLoadingNative(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPath.trim()) return;
    setErrorMsg(null);
    try {
      await onSelectWorkspaceDir(inputPath.trim());
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка выбора директории');
    }
  };

  // Combine default & recent workspaces
  const defaultRecent = [
    'c:\\Users\\user\\Documents\\projects\\0xAgent',
    ...(currentWorkspaceDir ? [currentWorkspaceDir] : []),
    ...recentWorkspaces,
  ];

  const uniqueRecent = Array.from(new Set(defaultRecent.filter(Boolean)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 font-sans select-none animate-fadeIn">
      <div className="w-full max-w-xl glass-panel rounded-2xl border border-white/15 shadow-2xl overflow-hidden text-slate-100 bg-[#12131b]">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <FolderPlus size={18} className="text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-100">Выбор папки Workspace (Проекта)</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 font-sans">
              <AlertCircle size={15} className="shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form with Path Input */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block text-xs font-medium text-slate-300">
              Укажите абсолютный путь к папке проекта на диске:
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                value={inputPath}
                onChange={(e) => setInputPath(e.target.value)}
                placeholder="C:\Users\user\Documents\projects\my-app"
                className="flex-1 px-3.5 py-2.5 rounded-xl flat-input text-xs font-mono text-slate-100 focus:outline-none border border-white/10 bg-black/40"
                autoFocus
              />

              <button
                type="button"
                onClick={handleNativeBrowse}
                disabled={isLoadingNative}
                className="px-3.5 py-2.5 rounded-xl flat-btn text-xs font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
                title="Обзор через проводник Windows"
              >
                <Folder size={14} className="text-emerald-400" />
                <span>{isLoadingNative ? 'Открытие...' : 'Проводник'}</span>
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={!inputPath.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-40"
              >
                Открыть проект
              </button>
            </div>
          </form>

          {/* Recent Workspaces List */}
          {uniqueRecent.length > 0 && (
            <div className="pt-3 border-t border-white/10 space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Недавние воркспейсы
              </span>

              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {uniqueRecent.map((dir) => (
                  <button
                    key={dir}
                    type="button"
                    onClick={async () => {
                      setInputPath(dir);
                      await onSelectWorkspaceDir(dir);
                      onClose();
                    }}
                    className="w-full p-2.5 rounded-xl border border-white/5 hover:border-emerald-500/30 bg-black/20 hover:bg-emerald-500/10 text-left flex items-center justify-between gap-2 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Folder size={15} className="text-slate-400 group-hover:text-emerald-400 shrink-0" />
                      <span className="font-mono text-xs text-slate-200 truncate">{dir}</span>
                    </div>
                    {dir === currentWorkspaceDir && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30 shrink-0">
                        Активный
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
