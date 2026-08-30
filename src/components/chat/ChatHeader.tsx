import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Folder,
  FolderPlus,
  Unlink,
  ChevronDown,
  Sparkles,
  Copy,
  Check,
  X,
} from 'lucide-react';
import { AppConfig, ChatSession } from '../../types';
import * as api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useI18n } from '../../i18n';
import {
  getWorkspaceBaseName,
  isAutoWorkspace,
  exportSessionLogAsText,
  exportSessionJson,
} from '../../utils/helpers';

interface ChatHeaderProps {
  currentSession?: ChatSession | null;
  workspaceDir?: string | null;
  config?: AppConfig | null;
  onSelectWorkspace?: () => void;
  onUpdateSessionWorkspace?: (dir: string | null) => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = React.memo(({
  currentSession,
  workspaceDir,
  config,
  onSelectWorkspace,
  onUpdateSessionWorkspace,
}) => {
  const { showToast } = useToast();
  const { t } = useI18n();

  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const [copiedLog, setCopiedLog] = useState(false);
  const wsMenuRef = useRef<HTMLDivElement>(null);

  const handleCopySessionLog = (e: React.MouseEvent) => {
    if (!currentSession) {
      showToast(t.sidebar.noSessionsFound, 'info');
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
        isAltOrShift ? t.nav.exportSessionJson : t.nav.logsCopied,
        'success'
      );
      setTimeout(() => setCopiedLog(false), 2000);
    } catch (err: any) {
      showToast(`${t.common.error}: ${err.message || err}`, 'error');
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wsMenuRef.current && !wsMenuRef.current.contains(event.target as Node)) {
        setWsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentSessionWorkspace =
    currentSession?.workspace_dir !== undefined
      ? currentSession.workspace_dir
      : workspaceDir || config?.workspace_dir;
  const hasWs = !!currentSessionWorkspace;
  const isAutoWs = isAutoWorkspace(currentSessionWorkspace);
  const wsName = getWorkspaceBaseName(currentSessionWorkspace);

  return (
    <div className="w-full h-11 px-3 sm:px-4 border-b border-[var(--theme-border)] bg-[var(--theme-panel)] flex items-center justify-between select-none shrink-0 z-20 transition-colors">
      
      {/* LEFT: Session Title & Workspace Pill */}
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 overflow-hidden">
        
        {/* Session Icon & Title */}
        <div className="flex items-center gap-1.5 min-w-0">
          <MessageSquare size={13} className="text-[var(--theme-text-muted)] shrink-0 hidden xs:block" />
          <span
            className="font-semibold text-xs sm:text-sm text-[var(--theme-text)] truncate max-w-[140px] xs:max-w-[200px] sm:max-w-[280px] md:max-w-[360px]"
            title={currentSession?.title || t.nav.newChat}
          >
            {currentSession?.title || t.nav.newChat}
          </span>
        </div>

        <span className="text-[var(--theme-text-muted)] opacity-30 font-light select-none shrink-0">
          /
        </span>

        {/* Workspace Pill Dropdown */}
        <div ref={wsMenuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setWsMenuOpen(!wsMenuOpen)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--theme-card-bg)] hover:bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-[11px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-all cursor-pointer shadow-xs font-medium group active:scale-95"
            title={t.nav.workspaceMenu}
          >
            {isAutoWs ? (
              <>
                <Sparkles size={11} className="text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text)]" />
                <span className="truncate max-w-[100px] sm:max-w-[140px]">{wsName}</span>
              </>
            ) : hasWs ? (
              <>
                <Folder size={11} className="text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text)]" />
                <span className="truncate max-w-[100px] sm:max-w-[140px]">{wsName}</span>
              </>
            ) : (
              <>
                <Folder size={11} className="text-[var(--theme-text-muted)]" />
                <span>{t.sidebar.standalone}</span>
              </>
            )}
            <ChevronDown size={10} className={`transition-transform duration-200 ${wsMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Workspace Switcher Popover */}
          {wsMenuOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-72 rounded-2xl p-2 shadow-2xl z-50 border border-[var(--theme-border)] bg-[var(--theme-panel-solid)] backdrop-blur-2xl animate-fadeIn space-y-1">
              <div className="px-2.5 py-1 text-[10px] font-semibold text-[var(--theme-text-muted)] uppercase tracking-wider border-b border-[var(--theme-border)] mb-1 flex items-center justify-between">
                <span>{t.nav.workspaceMenu}</span>
                <button
                  type="button"
                  onClick={() => setWsMenuOpen(false)}
                  className="p-0.5 rounded-md hover:bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>

              <div className="px-2.5 py-1.5 text-xs text-[var(--theme-text)] bg-[var(--theme-input-bg)] rounded-xl border border-[var(--theme-border)] truncate font-mono">
                {currentSessionWorkspace || t.sidebar.autoWorkspace}
              </div>

              <button
                type="button"
                onClick={() => {
                  setWsMenuOpen(false);
                  onSelectWorkspace?.();
                }}
                className="w-full px-2.5 py-2 rounded-xl text-xs font-medium text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] flex items-center gap-2 transition-colors cursor-pointer text-left"
              >
                <FolderPlus size={13} className="text-[var(--theme-text)]" />
                <span>{t.nav.changeWorkspace}</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  setWsMenuOpen(false);
                  if (currentSession?.id) {
                    try {
                      const res = await api.create_auto_workspace();
                      if (res.path && onUpdateSessionWorkspace) {
                        onUpdateSessionWorkspace(res.path);
                        showToast(`${t.sidebar.autoWorkspace} ${res.slug}`, 'success');
                      }
                    } catch (err: any) {
                      showToast(`${t.common.error}: ${err.message || err}`, 'error');
                    }
                  }
                }}
                className="w-full px-2.5 py-2 rounded-xl text-xs font-medium text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] flex items-center gap-2 transition-colors cursor-pointer text-left"
              >
                <Sparkles size={13} className="text-[var(--theme-text-muted)]" />
                <span>{t.sidebar.autoWorkspace}</span>
              </button>

              {hasWs && (
                <button
                  type="button"
                  onClick={() => {
                    setWsMenuOpen(false);
                    onUpdateSessionWorkspace?.(null);
                    showToast(t.nav.unlinkWorkspace, 'info');
                  }}
                  className="w-full px-2.5 py-2 rounded-xl text-xs font-medium text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] flex items-center gap-2 transition-colors cursor-pointer text-left"
                >
                  <Unlink size={13} />
                  <span>{t.nav.unlinkWorkspace}</span>
                </button>
              )}
            </div>
          )}
        </div>

      </div>

      {/* RIGHT: Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {currentSession && (
          <button
            type="button"
            onClick={handleCopySessionLog}
            className="px-2.5 py-1 rounded-lg text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border border-transparent hover:border-[var(--theme-border)] transition-all cursor-pointer flex items-center gap-1.5 text-[11px] font-medium"
            title={t.nav.copyLogs}
          >
            {copiedLog ? (
              <>
                <Check size={12} className="text-[var(--theme-text)]" />
                <span className="text-[var(--theme-text)] text-[10px]">Copied</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span className="hidden sm:inline text-[11px]">Log</span>
              </>
            )}
          </button>
        )}
      </div>

    </div>
  );
});

ChatHeader.displayName = 'ChatHeader';
