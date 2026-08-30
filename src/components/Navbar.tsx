import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Settings as SettingsIcon,
  BarChart2,
  BookOpen,
  Copy,
  Check,
  X,
  Folder,
  FolderPlus,
  Unlink,
  ChevronDown,
  Sparkles,
  Menu,
  Plus,
} from 'lucide-react';
import { AppConfig, ChatSession, LiveTelemetry } from '../types';
import * as api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useI18n } from '../i18n';
import { ContextBudgetGauge } from './chat/ContextBudgetGauge';
import {
  getWorkspaceBaseName,
  isAutoWorkspace,
  exportSessionLogAsText,
  exportSessionJson,
} from '../utils/helpers';

interface NavbarProps {
  onToggleSidebar?: () => void;
  activeView: 'chat' | 'workspace' | 'jarvis' | 'settings' | 'analytics' | 'knowledge';
  onChangeView: (view: 'chat' | 'workspace' | 'jarvis' | 'settings' | 'analytics' | 'knowledge') => void;
  config: AppConfig | null;
  currentSession?: ChatSession | null;
  workspaceDir?: string | null;
  onSelectWorkspace?: () => void;
  onUpdateSessionWorkspace?: (dir: string | null) => void;
  isServerOffline?: boolean;
  onStartServer?: () => Promise<void>;
  onNewChat?: () => void;
  liveTelemetry?: LiveTelemetry | null;
}

export const Navbar: React.FC<NavbarProps> = React.memo(({
  onToggleSidebar,
  activeView,
  onChangeView,
  config,
  currentSession,
  workspaceDir,
  onSelectWorkspace,
  onUpdateSessionWorkspace,
  isServerOffline,
  onStartServer,
  onNewChat,
  liveTelemetry,
}) => {
  const { showToast } = useToast();
  const { t } = useI18n();

  // Workspace Popover state
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
    <header className="h-13 sm:h-14 border-b sm:border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 sm:bg-[var(--theme-panel)]/90 backdrop-blur-2xl px-2.5 sm:px-4 rounded-none sm:rounded-[22px] flex items-center justify-between select-none z-30 shrink-0 font-sans shadow-sm gap-2 sm:gap-4">
      
      {/* 1. LEFT SECTION: Mobile Burger + 0xAgent Title + Separator + Session Title & Workspace */}
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 shrink-0">
        
        {/* Mobile-only Burger Menu Button (hidden on desktop) */}
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="md:hidden p-1.5 rounded-xl text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] active:scale-95 transition-all cursor-pointer flex items-center justify-center shrink-0"
            title={t.nav.toggleSidebar}
          >
            <Menu size={18} className="text-[var(--theme-text)]" />
          </button>
        )}

        {/* 0xAgent Text Logo (Icon removed) */}
        <span className="font-extrabold text-sm sm:text-base tracking-tight text-[var(--theme-text)] select-none shrink-0">
          0xAgent
        </span>

        <span className="text-[var(--theme-text-muted)] opacity-30 font-light select-none hidden xs:inline shrink-0">
          |
        </span>

        {/* Current Chat Title & Workspace Pill */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 overflow-hidden">
          <div className="flex items-center gap-1.5 text-[var(--theme-text)] font-semibold text-xs sm:text-sm truncate max-w-[120px] xs:max-w-[160px] sm:max-w-[200px] md:max-w-[240px]">
            <span className="truncate">{currentSession?.title || t.nav.newChat}</span>
          </div>

          {/* Workspace Pill Dropdown */}
          <div ref={wsMenuRef} className="relative shrink-0 hidden sm:block">
            <button
              type="button"
              onClick={() => setWsMenuOpen(!wsMenuOpen)}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-[var(--theme-card-bg)] hover:bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-[11px] sm:text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors cursor-pointer shadow-sm font-semibold"
              title={t.nav.workspaceMenu}
            >
              {isAutoWs ? (
                <>
                  <Sparkles size={11} className="text-[var(--theme-accent)]" />
                  <span className="truncate max-w-[90px]">{wsName}</span>
                </>
              ) : hasWs ? (
                <>
                  <Folder size={11} className="text-[var(--theme-text)]" />
                  <span className="truncate max-w-[90px]">{wsName}</span>
                </>
              ) : (
                <>
                  <Folder size={11} />
                  <span>{t.sidebar.standalone}</span>
                </>
              )}
              <ChevronDown size={11} className={`transition-transform duration-200 ${wsMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Workspace Switcher Popover */}
            {wsMenuOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 rounded-2xl bento-card p-2 shadow-2xl z-50 border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-2xl animate-fadeIn space-y-1">
                <div className="px-2.5 py-1 text-[11px] font-semibold text-[var(--theme-text-muted)] uppercase tracking-wider border-b border-[var(--theme-border)] mb-1 flex items-center justify-between">
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
                  className="w-full px-2.5 py-2 rounded-xl text-xs font-semibold text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] flex items-center gap-2 transition-colors cursor-pointer text-left"
                >
                  <FolderPlus size={14} className="text-[var(--theme-text)]" />
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
                  className="w-full px-2.5 py-2 rounded-xl text-xs font-semibold text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] flex items-center gap-2 transition-colors cursor-pointer text-left"
                >
                  <Sparkles size={14} className="text-[var(--theme-accent)]" />
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
                    className="w-full px-2.5 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 flex items-center gap-2 transition-colors cursor-pointer text-left"
                  >
                    <Unlink size={14} />
                    <span>{t.nav.unlinkWorkspace}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Copy Session Log Button */}
          {currentSession && (
            <button
              type="button"
              onClick={handleCopySessionLog}
              className="p-1.5 rounded-full text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-colors cursor-pointer hidden md:flex items-center"
              title={t.nav.copyLogs}
            >
              {copiedLog ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            </button>
          )}
        </div>
      </div>

      {/* 2. CENTER SECTION: Clean Minimalist Nav Links (No Heavy Button Box, Hover Highlight + Indicator) */}
      <nav className="hidden md:flex items-center justify-center gap-6 lg:gap-8 flex-1 select-none">
        {[
          { id: 'chat', label: t.nav.chat, icon: MessageSquare },
          { id: 'knowledge', label: t.nav.knowledge, icon: BookOpen },
          { id: 'analytics', label: t.nav.analytics, icon: BarChart2 },
          { id: 'settings', label: t.nav.settings, icon: SettingsIcon },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeView === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeView(tab.id as any)}
              className={`relative py-1 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'text-[var(--theme-text)] font-bold'
                  : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-text-muted)]'} />
              <span>{tab.label}</span>
              {isActive && (
                <span className="absolute -bottom-1.5 left-0 right-0 h-0.5 bg-[var(--theme-accent)] rounded-full animate-in fade-in zoom-in-95 duration-150" />
              )}
            </button>
          );
        })}
      </nav>

      {/* 3. RIGHT SECTION: Context Budget Pill + Mobile Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        
        {/* Mobile New Chat Button */}
        {onNewChat && (
          <button
            type="button"
            onClick={onNewChat}
            className="md:hidden p-2 rounded-xl bg-[var(--theme-accent)] text-[var(--theme-accent-text)] font-bold text-xs flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
            title={t.nav.newChat}
          >
            <Plus size={16} />
            <span className="hidden xs:inline text-[11px]">{t.common.ok}</span>
          </button>
        )}

        {/* Start Server Quick Action Button if offline */}
        {isServerOffline && onStartServer && (
          <button
            type="button"
            onClick={() => onStartServer()}
            className="px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-500/25 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
            title={t.nav.startServer}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="hidden xl:inline">{t.nav.startServer}</span>
          </button>
        )}

        {/* Real-time Context Budget Gauge (Контекстная пилюля) */}
        <ContextBudgetGauge
          liveTelemetry={liveTelemetry}
          currentSession={currentSession}
          config={config}
        />
      </div>

    </header>
  );
});

Navbar.displayName = 'Navbar';
