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
      <div className="w-full max-w-xl bento-card rounded-xl border border-[var(--theme-border)] shadow-2xl overflow-hidden text-[var(--theme-text)] bg-[var(--theme-panel)]">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--theme-border)] flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-2">
            <FolderPlus size={16} className="text-[var(--theme-text-muted)]" />
            <h3 className="text-xs font-semibold text-[var(--theme-text)]">Выбор папки Workspace (Проекта)</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/10 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          
          {errorMsg && (
            <div className="p-3 rounded-lg bg-white/5 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 font-sans">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form with Path Input */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block text-xs font-medium text-[var(--theme-text-muted)]">
              Укажите абсолютный путь к папке проекта на диске:
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                value={inputPath}
                onChange={(e) => setInputPath(e.target.value)}
                placeholder="C:\Users\user\Documents\projects\my-app"
                className="flex-1 px-3.5 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] focus:outline-none bg-black/40"
                autoFocus
              />

              <button
                type="button"
                onClick={handleNativeBrowse}
                disabled={isLoadingNative}
                className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-[var(--theme-border)] text-xs font-medium text-[var(--theme-text)] flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50 transition-colors"
                title="Обзор через проводник Windows"
              >
                <Folder size={14} className="text-[var(--theme-text-muted)]" />
                <span>{isLoadingNative ? 'Открытие...' : 'Проводник'}</span>
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5 cursor-pointer transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={!inputPath.trim()}
                className="px-4 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-[var(--theme-border)] text-[var(--theme-text)] text-xs font-medium transition-colors shadow-sm cursor-pointer disabled:opacity-40"
              >
                Открыть проект
              </button>
            </div>
          </form>

          {/* Recent Workspaces List */}
          {uniqueRecent.length > 0 && (
            <div className="pt-3 border-t border-[var(--theme-border)] space-y-2">
              <span className="text-[11px] font-medium text-[var(--theme-text-muted)] uppercase tracking-wider block">
                Недавние воркспейсы
              </span>

              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {uniqueRecent.map((dir) => {
                  const isActive = currentWorkspaceDir && dir.toLowerCase() === currentWorkspaceDir.toLowerCase();
                  return (
                    <button
                      key={dir}
                      type="button"
                      onClick={async () => {
                        setInputPath(dir);
                        await onSelectWorkspaceDir(dir);
                        onClose();
                      }}
                      className={`w-full p-2.5 rounded-lg bento-card text-left text-xs font-mono transition-all flex items-center justify-between gap-2 border cursor-pointer ${
                        isActive
                          ? 'bg-white/10 border-[var(--theme-border)] text-[var(--theme-text)]'
                          : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Folder size={13} className="shrink-0 text-[var(--theme-text-muted)]" />
                        <span className="truncate">{dir}</span>
                      </div>

                      {isActive && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md font-mono bg-white/10 text-[var(--theme-text)] border border-[var(--theme-border)] shrink-0">
                          Активный
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
