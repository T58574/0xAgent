import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Folder,
  FolderPlus,
  ChevronDown,
  Terminal,
  Sparkles,
  Unlink,
  Copy,
  Check,
  User,
} from 'lucide-react';
import { ChatSession, PersonaMetadata } from '../../types';
import {
  getWorkspaceBaseName,
  isAutoWorkspace,
  exportSessionLogAsText,
  exportSessionJson,
} from '../../utils/helpers';
import * as api from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface ChatHeaderBarProps {
  currentSession?: ChatSession | null;
  config?: any;
  currentPersona: PersonaMetadata;
  onSelectWorkspace?: () => void;
  onUpdateSessionWorkspace?: (dir: string | null) => void;
}

export const ChatHeaderBar: React.FC<ChatHeaderBarProps> = ({
  currentSession,
  config,
  currentPersona,
  onSelectWorkspace,
  onUpdateSessionWorkspace,
}) => {
  const { showToast } = useToast();
  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const [copiedLog, setCopiedLog] = useState(false);
  const wsMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wsMenuRef.current && !wsMenuRef.current.contains(e.target as Node)) {
        setWsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopySessionLog = (e: React.MouseEvent) => {
    if (!currentSession) {
      showToast('Нет активной сессии для копирования', 'info');
      return;
    }
    try {
      const isAltOrShift = e.altKey || e.shiftKey;
      const textToCopy = isAltOrShift
        ? exportSessionJson(currentSession)
        : exportSessionLogAsText(currentSession, config?.model_name);

      navigator.clipboard.writeText(textToCopy);
      setCopiedLog(true);
      showToast(
        isAltOrShift ? 'Сырой JSON сессии скопирован в буфер' : 'Лог сессии скопирован в буфер обмена',
        'success'
      );
      setTimeout(() => setCopiedLog(false), 2000);
    } catch (err: any) {
      showToast(`Ошибка копирования: ${err.message || err}`, 'error');
    }
  };

  const currentSessionWorkspace =
    currentSession?.workspace_dir !== undefined
      ? currentSession.workspace_dir
      : config?.workspace_dir;
  const hasWs = !!currentSessionWorkspace;
  const isAutoWs = isAutoWorkspace(currentSessionWorkspace);
  const wsName = getWorkspaceBaseName(currentSessionWorkspace);

  return (
    <div className="px-4 py-2.5 border-b border-[var(--theme-border)] bg-[var(--theme-panel)]/90 backdrop-blur-xl flex items-center justify-between shrink-0 select-none text-xs font-mono z-20 shadow-sm">
      {/* Left: Session Title & Workspace Pill */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center gap-1.5 text-[var(--theme-text)] font-bold truncate max-w-[160px] sm:max-w-[260px]">
          <MessageSquare size={14} className="text-[var(--theme-text-muted)] shrink-0" />
          <span className="truncate">{currentSession?.title || 'Диалог'}</span>
        </div>

        {/* Workspace Pill */}
        <div ref={wsMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setWsMenuOpen(!wsMenuOpen)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[var(--theme-card-bg)] hover:bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-[11px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors cursor-pointer shadow-sm font-semibold"
            title="Рабочая папка текущего диалога"
          >
            {isAutoWs ? (
              <>
                <Terminal size={12} className="text-[var(--theme-text-muted)] shrink-0" />
                <span className="truncate max-w-[110px] sm:max-w-[170px]">{wsName}</span>
              </>
            ) : hasWs ? (
              <>
                <Folder size={12} className="text-[var(--theme-text-muted)] shrink-0" />
                <span className="truncate max-w-[110px] sm:max-w-[170px]">{wsName}</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-text-muted)]" />
                <span>Без папки</span>
              </>
            )}
            <ChevronDown
              size={11}
              className={`opacity-60 transition-transform ${wsMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Workspace Switcher Popover */}
          {wsMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-68 bento-card p-1.5 shadow-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-2xl z-50 rounded-2xl space-y-1 animate-fadeIn font-sans text-xs">
              <div className="px-2.5 py-1 text-[10px] font-mono text-[var(--theme-text-muted)] border-b border-[var(--theme-border)] mb-1 font-bold">
                Контекст рабочей директории
              </div>

              <button
                type="button"
                onClick={() => {
                  setWsMenuOpen(false);
                  onSelectWorkspace && onSelectWorkspace();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-[var(--theme-border-subtle)] text-[var(--theme-text)] transition-colors cursor-pointer"
              >
                <FolderPlus size={14} className="text-[var(--theme-text-muted)] shrink-0" />
                <div className="flex flex-col">
                  <span className="font-bold text-xs">Сменить папку проекта...</span>
                  <span className="text-[10px] text-[var(--theme-text-muted)]">Привязать каталог на диске</span>
                </div>
              </button>

              <button
                type="button"
                onClick={async () => {
                  setWsMenuOpen(false);
                  if (onUpdateSessionWorkspace) {
                    try {
                      const autoWs = await api.create_auto_workspace();
                      onUpdateSessionWorkspace(autoWs.path);
                      showToast(`Создан авто-воркспейс: ${autoWs.slug}`, 'success');
                    } catch (e: any) {
                      showToast(`Ошибка: ${e.message}`, 'error');
                    }
                  }
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-[var(--theme-border-subtle)] text-[var(--theme-text)] transition-colors cursor-pointer"
              >
                <Sparkles size={14} className="text-[var(--theme-text-muted)] shrink-0" />
                <div className="flex flex-col">
                  <span className="font-bold text-xs">Создать авто-воркспейс</span>
                  <span className="text-[10px] text-[var(--theme-text-muted)]">Изолированная песочница ~/.0xagent</span>
                </div>
              </button>

              {hasWs && (
                <button
                  type="button"
                  onClick={() => {
                    setWsMenuOpen(false);
                    if (onUpdateSessionWorkspace) {
                      onUpdateSessionWorkspace(null);
                      showToast('Сессия переведена в общий режим (без файлов)', 'info');
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-rose-500/10 text-rose-500 transition-colors cursor-pointer border-t border-[var(--theme-border)] mt-0.5 pt-2"
                >
                  <Unlink size={14} className="shrink-0" />
                  <span className="text-xs font-semibold">Отвязать папку (Без файлов)</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Copy Session Log button & Active Persona pill */}
      <div className="flex items-center gap-2">
        {currentSession && (
          <button
            type="button"
            onClick={handleCopySessionLog}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border transition-all cursor-pointer text-[11px] font-mono select-none shadow-sm ${
              copiedLog
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/40 font-bold'
                : 'bg-[var(--theme-card-bg)] hover:bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] border-[var(--theme-border)] font-semibold'
            }`}
            title="Скопировать лог диалога для отладки (Shift/Alt для JSON)"
          >
            {copiedLog ? (
              <>
                <Check size={12} className="text-emerald-500" />
                <span className="hidden sm:inline text-[10px] font-bold">Скопировано!</span>
              </>
            ) : (
              <>
                <Copy size={12} className="text-[var(--theme-text-muted)]" />
                <span className="hidden sm:inline text-[10px]">Копировать лог</span>
              </>
            )}
          </button>
        )}

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] text-[10px] text-[var(--theme-text-muted)] shadow-sm">
          <User size={12} className="text-[var(--theme-text-muted)]" />
          <span className="truncate max-w-[100px] text-[var(--theme-text)] font-bold">
            {currentPersona.name}
          </span>
        </div>
      </div>
    </div>
  );
};
