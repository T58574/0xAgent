import React, { useState, useEffect } from 'react';
import { Folder, FolderPlus, X, AlertCircle, ArrowRight, Sparkles, Link as LinkIcon } from 'lucide-react';
import * as api from '../services/api';
import { getWorkspaceBaseName } from '../utils/helpers';

interface WorkspacePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWorkspaceDir: (dirPath: string, openInNewChat?: boolean) => Promise<void>;
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
        // Automatically open project in a clean dedicated session
        await onSelectWorkspaceDir(folder, true);
        onClose();
      }
    } catch (err: any) {
      console.error('Native folder select error:', err);
      setErrorMsg(`Не удалось открыть проводник: ${err.message || err}`);
    } finally {
      setIsLoadingNative(false);
    }
  };

  const handleOpenProjectInNewChat = async (targetPath: string) => {
    if (!targetPath.trim()) return;
    setErrorMsg(null);
    try {
      await onSelectWorkspaceDir(targetPath.trim(), true);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка открытия проекта');
    }
  };

  const handleBindToCurrentChat = async (targetPath: string) => {
    if (!targetPath.trim()) return;
    setErrorMsg(null);
    try {
      await onSelectWorkspaceDir(targetPath.trim(), false);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка привязки воркспейса');
    }
  };

  // Combine default & recent workspaces
  const defaultRecent = [
    ...(currentWorkspaceDir ? [currentWorkspaceDir] : []),
    'c:\\Users\\user\\.0xagent\\workspaces\\Jarvis',
    ...recentWorkspaces,
  ];

  const uniqueRecent = Array.from(new Set(defaultRecent.filter(Boolean)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl p-4 font-sans select-none animate-fadeIn">
      <div className="w-full max-w-xl rounded-2xl border border-[var(--theme-border)] shadow-2xl overflow-hidden text-[var(--theme-text)] bg-[var(--theme-panel)]/95 backdrop-blur-2xl">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--theme-border)] flex items-center justify-between bg-[var(--theme-card-bg)]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-[var(--theme-accent)]/15 border border-[var(--theme-accent)]/30 text-[var(--theme-accent)]">
              <FolderPlus size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--theme-text)]">Выбор Рабочего Проекта (Workspace)</h3>
              <p className="text-[11px] text-[var(--theme-text-muted)] font-medium">Открытие папки проекта на диске в чистом контексте</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 font-sans animate-fadeIn">
              <AlertCircle size={15} className="shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Path Input Form */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-[var(--theme-text-muted)] uppercase tracking-wider">
              Путь к папке проекта на диске
            </label>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={inputPath}
                  onChange={(e) => setInputPath(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleOpenProjectInNewChat(inputPath);
                    }
                  }}
                  placeholder="C:\Projects\my-app or ~/projects/my-app"
                  className="w-full pl-3.5 pr-4 py-2.5 rounded-xl border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:outline-none focus:border-[var(--theme-accent)] bg-[var(--theme-input-bg)] shadow-inner transition-colors"
                  autoFocus
                />
              </div>

              <button
                type="button"
                onClick={handleNativeBrowse}
                disabled={isLoadingNative}
                className="px-4 py-2.5 rounded-xl bg-[var(--theme-card-bg)] hover:bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-xs font-semibold text-[var(--theme-text)] flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50 transition-all shadow-sm"
                title="Открыть стандартный Проводник Windows"
              >
                <Folder size={14} className="text-[var(--theme-accent)]" />
                <span>{isLoadingNative ? 'Открытие...' : 'Проводник'}</span>
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleBindToCurrentChat(inputPath)}
                disabled={!inputPath.trim()}
                className="px-3.5 py-2 rounded-xl border border-[var(--theme-border)] text-xs font-semibold text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-all cursor-pointer disabled:opacity-30 flex items-center gap-1.5"
                title="Привязать выбранную папку к текущему открытому диалогу"
              >
                <LinkIcon size={13} />
                <span>Привязать к текущему чату</span>
              </button>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] cursor-pointer transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenProjectInNewChat(inputPath)}
                  disabled={!inputPath.trim()}
                  className="px-4.5 py-2 rounded-xl bg-[var(--theme-accent)] text-[var(--theme-accent-text)] text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-40 flex items-center gap-1.5 hover:opacity-90 active:scale-95"
                >
                  <Sparkles size={13} />
                  <span>Открыть проект (Чистый чат)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Recent Workspaces List */}
          {uniqueRecent.length > 0 && (
            <div className="pt-3 border-t border-[var(--theme-border)] space-y-2">
              <span className="text-[11px] font-semibold text-[var(--theme-text-muted)] uppercase tracking-wider block">
                Недавние проекты и рабочие пространства
              </span>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                {uniqueRecent.map((dir) => {
                  const isActive = currentWorkspaceDir && dir.toLowerCase() === currentWorkspaceDir.toLowerCase();
                  const baseName = getWorkspaceBaseName(dir);
                  const isJarvisSanctuary = dir.toLowerCase().includes('jarvis');

                  return (
                    <div
                      key={dir}
                      className={`group w-full p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 text-left ${
                        isActive
                          ? 'bg-[var(--theme-accent)]/10 border-[var(--theme-accent)]/30 text-[var(--theme-text)]'
                          : 'bg-[var(--theme-card-bg)] border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:border-[var(--theme-text-muted)]/40'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setInputPath(dir);
                          handleOpenProjectInNewChat(dir);
                        }}
                        className="flex-1 flex items-center gap-2.5 truncate cursor-pointer text-left"
                      >
                        <div className={`p-1.5 rounded-lg shrink-0 ${isJarvisSanctuary ? 'bg-[var(--theme-accent)]/20 text-[var(--theme-accent)]' : 'bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)]'}`}>
                          {isJarvisSanctuary ? <Sparkles size={13} /> : <Folder size={13} />}
                        </div>
                        <div className="truncate min-w-0">
                          <div className="text-xs font-bold text-[var(--theme-text)] truncate flex items-center gap-1.5">
                            <span>{baseName}</span>
                            {isJarvisSanctuary && (
                              <span className="text-[9.5px] px-1.5 py-0.2 rounded-md font-mono bg-[var(--theme-accent)]/20 text-[var(--theme-accent)] border border-[var(--theme-accent)]/30">
                                Уголок Jarvis
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-[var(--theme-text-muted)] truncate opacity-80">{dir}</div>
                        </div>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isActive && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md font-mono bg-[var(--theme-accent)]/20 text-[var(--theme-accent)] border border-[var(--theme-accent)]/30">
                            Текущий
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setInputPath(dir);
                            handleOpenProjectInNewChat(dir);
                          }}
                          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-[var(--theme-border-subtle)] text-[var(--theme-text)] transition-all cursor-pointer"
                          title="Открыть проект в чистом диалоге"
                        >
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
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
