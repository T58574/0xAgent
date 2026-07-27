import React, { useState, useEffect } from 'react';
import {
  PanelLeft,
  Folder,
  MessageSquare,
  Code,
  Settings as SettingsIcon,
  BarChart2,
  Play,
  RefreshCw,
  FileText,
  Terminal,
} from 'lucide-react';
import { AppConfig } from '../types';
import * as api from '../services/api';

interface NavbarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  activeView: 'chat' | 'workspace' | 'settings' | 'analytics';
  onChangeView: (view: 'chat' | 'workspace' | 'settings' | 'analytics') => void;
  config: AppConfig | null;
  onSelectWorkspace: () => void;
  has0xAgentMd?: boolean;
  onToggleLogs?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  sidebarOpen,
  onToggleSidebar,
  activeView,
  onChangeView,
  config,
  onSelectWorkspace,
  has0xAgentMd = false,
  onToggleLogs,
}) => {
  const [isServerOffline, setIsServerOffline] = useState(true);
  const [isStartingServer, setIsStartingServer] = useState(false);

  useEffect(() => {
    const checkServer = async () => {
      try {
        const host = config?.local_server?.host || '127.0.0.1';
        const port = config?.local_server?.port || 11434;
        const h = await api.get_server_health(host, port);
        setIsServerOffline(!h.ok);
      } catch {
        setIsServerOffline(true);
      }
    };

    checkServer();
    const timer = setInterval(checkServer, 3000);

    const un = api.listen<{ status: string }>('llama-server-status', (event) => {
      if (event.payload.status === 'running') {
        setIsServerOffline(false);
      } else if (event.payload.status === 'stopped') {
        setIsServerOffline(true);
      }
    });

    return () => {
      clearInterval(timer);
      un();
    };
  }, [config]);

  const handleStartServer = async () => {
    setIsStartingServer(true);
    try {
      const res = await api.start_local_server();
      if (res && res.success) {
        setIsServerOffline(false);
      }
    } catch (err) {
      console.error('Failed to start server:', err);
    } finally {
      setIsStartingServer(false);
    }
  };

  const getWorkspaceBaseName = (dirPath?: string | null) => {
    if (!dirPath) return 'Без папки';
    const parts = dirPath.split(/[/\\]/).filter(Boolean);
    return parts[parts.length - 1] || dirPath;
  };

  return (
    <header className="w-full bg-[var(--theme-panel)] border-b border-[var(--theme-border)] backdrop-blur-md px-3 py-2 flex items-center justify-between select-none z-30 shrink-0 font-sans text-xs text-[var(--theme-text)]">
      {/* Left Section: Sidebar Trigger & Workspace Badge */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleSidebar}
          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
            sidebarOpen
              ? 'bg-white/10 border-white/20 text-[var(--theme-text)]'
              : 'bg-white/[0.03] border-[var(--theme-border)] text-slate-400 hover:text-white hover:bg-white/10'
          }`}
          title={sidebarOpen ? 'Скрыть боковую панель' : 'Показать боковую панель'}
        >
          <PanelLeft size={16} />
        </button>

        {/* Active Workspace Badge */}
        <button
          type="button"
          onClick={onSelectWorkspace}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-[var(--theme-border)] text-[11px] text-[var(--theme-text)] hover:border-white/20 transition-colors cursor-pointer"
          title={config?.workspace_dir || 'Выбрать папку Workspace'}
        >
          <Folder size={12} className="text-[var(--theme-accent)]" />
          <span className="truncate max-w-[150px] font-mono text-[11px] font-medium">
            {getWorkspaceBaseName(config?.workspace_dir)}
          </span>
        </button>

        {has0xAgentMd && (
          <span
            className="hidden md:flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 text-[10px] text-sky-300 font-mono"
            title="Автоматический контекст 0xagent.md загружен"
          >
            <FileText size={10} className="text-sky-400" />
            <span>0xagent.md</span>
          </span>
        )}
      </div>

      {/* Center/Right Section: Navigation View Switcher Tabs & Server Indicator */}
      <div className="flex items-center gap-2">
        {/* Compact Llama Server Status Indicator */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/40 border border-[var(--theme-border)] text-[11px]">
          {isServerOffline ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                <span className="text-slate-400 font-medium hidden sm:inline">Сервер не запущен</span>
              </div>
              <button
                type="button"
                onClick={handleStartServer}
                disabled={isStartingServer}
                className="flat-btn px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-semibold cursor-pointer flex items-center gap-1 text-[10px] disabled:opacity-50"
              >
                {isStartingServer ? <RefreshCw size={10} className="animate-spin" /> : <Play size={10} />}
                <span>Запустить</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-emerald-300 font-medium font-mono text-[10px]">LLM запущен</span>
            </div>
          )}
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-[var(--theme-border)]">
          <button
            type="button"
            onClick={() => onChangeView('chat')}
            className={`px-2.5 py-1 rounded-md font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              activeView === 'chat'
                ? 'bg-white/15 text-white border border-white/20 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <MessageSquare size={13} />
            <span className="hidden sm:inline">Чат</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeView('workspace')}
            className={`px-2.5 py-1 rounded-md font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              activeView === 'workspace'
                ? 'bg-white/15 text-white border border-white/20 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Code size={13} />
            <span className="hidden sm:inline">Редактор</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeView('settings')}
            className={`px-2.5 py-1 rounded-md font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              activeView === 'settings'
                ? 'bg-white/15 text-white border border-white/20 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <SettingsIcon size={13} />
            <span className="hidden sm:inline">Настройки</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeView('analytics')}
            className={`px-2.5 py-1 rounded-md font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              activeView === 'analytics'
                ? 'bg-white/15 text-white border border-white/20 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <BarChart2 size={13} />
            <span className="hidden sm:inline">Аналитика</span>
          </button>
        </div>

        {/* Logs Drawer Trigger */}
        {onToggleLogs && (
          <button
            type="button"
            onClick={onToggleLogs}
            className="p-1.5 rounded-lg bg-black/40 border border-[var(--theme-border)] text-slate-400 hover:text-white transition-colors cursor-pointer hidden md:flex"
            title="Логи консоли"
          >
            <Terminal size={14} />
          </button>
        )}
      </div>
    </header>
  );
};
