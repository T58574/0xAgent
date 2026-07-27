import React, { useState, useEffect, useRef } from 'react';
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
  Wifi,
  Copy,
  Check,
  X,
} from 'lucide-react';
import { AppConfig } from '../types';
import { getWorkspaceBaseName } from '../utils/helpers';
import * as api from '../services/api';
import { useToast } from '../context/ToastContext';

interface NavbarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  activeView: 'chat' | 'workspace' | 'settings' | 'analytics';
  onChangeView: (view: 'chat' | 'workspace' | 'settings' | 'analytics') => void;
  config: AppConfig | null;
  onSelectWorkspace: () => void;
  has0xAgentMd?: boolean;
  onToggleLogs?: () => void;
  isServerOffline?: boolean;
  onStartServer?: () => Promise<void>;
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
  isServerOffline: isServerOfflineProp,
  onStartServer: onStartServerProp,
}) => {
  const { showToast } = useToast();
  const [internalIsServerOffline, setInternalIsServerOffline] = useState(true);
  const [isStartingServer, setIsStartingServer] = useState(false);

  // LAN Sharing state
  const [lanOpen, setLanOpen] = useState(false);
  const [lanUrls, setLanUrls] = useState<string[]>([]);
  const [lanLoading, setLanLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const lanRef = useRef<HTMLDivElement>(null);

  const isServerOffline = isServerOfflineProp !== undefined ? isServerOfflineProp : internalIsServerOffline;

  useEffect(() => {
    const checkServer = async () => {
      try {
        const host = config?.local_server?.host || '127.0.0.1';
        const port = config?.local_server?.port || 11434;
        const h = await api.get_server_health(host, port);
        setInternalIsServerOffline(!h.ok);
      } catch {
        setInternalIsServerOffline(true);
      }
    };

    checkServer();
    const timer = setInterval(checkServer, 3000);

    const un = api.listen<{ status: string }>('llama-server-status', (event) => {
      if (event.payload.status === 'running') {
        setInternalIsServerOffline(false);
      } else if (event.payload.status === 'stopped') {
        setInternalIsServerOffline(true);
      }
    });

    return () => {
      clearInterval(timer);
      un();
    };
  }, [config]);

  const handleStartServer = async () => {
    if (onStartServerProp) {
      setIsStartingServer(true);
      try {
        await onStartServerProp();
      } finally {
        setIsStartingServer(false);
      }
      return;
    }

    setIsStartingServer(true);
    try {
      let currentCfg = config;
      if (!currentCfg) {
        try {
          currentCfg = await api.get_config();
        } catch {}
      }

      const ls = currentCfg?.local_server;
      const serverConfig = ls ? {
        exePath: ls.exe_path || undefined,
        modelPath: ls.model_path || undefined,
        host: ls.host || '127.0.0.1',
        port: ls.port || 11434,
        ctxSize: ls.ctx_size,
        gpuLayers: ls.gpu_layers,
        threads: ls.threads,
        batchSize: ls.batch_size,
        ubatchSize: ls.ubatch_size,
        temp: ls.temp,
        repeatPenalty: ls.repeat_penalty,
        minP: ls.min_p,
        flashAttn: ls.flash_attn,
        mmap: ls.mmap,
        mlock: ls.mlock,
        embedding: ls.embedding,
        contBatching: ls.cont_batching,
      } : {};

      const res = await api.start_local_server(serverConfig);
      if (res && res.success) {
        setInternalIsServerOffline(false);
        showToast('Сервер llama.cpp успешно запущен!', 'success');
      }
    } catch (err: any) {
      console.error('Failed to start server from Navbar:', err);
      const errMsg = err.message || String(err);
      showToast(errMsg, 'error');

      if (errMsg.includes('не найден') || errMsg.includes('не задан') || errMsg.includes('GGUF')) {
        onChangeView('settings');
      }
    } finally {
      setIsStartingServer(false);
    }
  };

  // LAN Sharing handlers
  const handleToggleLan = async () => {
    if (lanOpen) {
      setLanOpen(false);
      return;
    }
    setLanOpen(true);
    setLanLoading(true);
    try {
      const data = await api.get_local_ips();
      setLanUrls(data.urls || []);
    } catch (err) {
      console.error('Failed to get local IPs:', err);
      setLanUrls([]);
    } finally {
      setLanLoading(false);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(url);
      showToast(`Скопировано: ${url}`, 'success');
      setTimeout(() => setCopiedUrl(null), 2000);
    });
  };

  // Close LAN dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (lanRef.current && !lanRef.current.contains(e.target as Node)) {
        setLanOpen(false);
      }
    };
    if (lanOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [lanOpen]);

  return (
    <header className="w-full bg-[#0b0c10] border-b border-white/10 px-3 py-1.5 flex items-center justify-between select-none z-30 shrink-0 font-sans text-xs text-slate-200 backdrop-blur-xl">
      
      {/* Left Section: App Brand & Workspace Badge */}
      <div className="flex items-center gap-2.5">
        {/* Sidebar Toggle Button */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
            sidebarOpen
              ? 'bg-white/10 border-white/20 text-white'
              : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
          }`}
          title={sidebarOpen ? 'Скрыть панель' : 'Показать панель'}
        >
          <PanelLeft size={15} />
        </button>

        {/* 0xAgent Brand Header */}
        <span className="font-bold text-white tracking-wide text-xs">0xAgent</span>

        {/* Active Workspace Badge Button */}
        <button
          type="button"
          onClick={onSelectWorkspace}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-[11px] text-slate-200 hover:border-white/20 transition-colors cursor-pointer"
          title={config?.workspace_dir || 'Выбрать папку Workspace'}
        >
          <Folder size={12} className="text-emerald-400" />
          <span className="truncate max-w-[150px] font-mono text-[11px] font-medium">
            {getWorkspaceBaseName(config?.workspace_dir)}
          </span>
        </button>

        {has0xAgentMd && (
          <span
            className="hidden lg:flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 text-[10px] text-sky-300 font-mono"
            title="Автоматический контекст 0xagent.md загружен"
          >
            <FileText size={10} className="text-sky-400" />
            <span>0xagent.md</span>
          </span>
        )}
      </div>

      {/* Right Section: LLM Server Status, View Switcher Tabs, Open IDE button */}
      <div className="flex items-center gap-2">
        {/* Compact Llama Server Status Indicator */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-[11px]">
          {isServerOffline ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                <span className="text-slate-400 font-medium hidden sm:inline">Offline</span>
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
              <span className="text-emerald-300 font-medium font-mono text-[10px]">LLM Ready</span>
            </div>
          )}
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/10">
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

        {/* LAN Share Button & Dropdown */}
        <div className="relative" ref={lanRef}>
          <button
            type="button"
            onClick={handleToggleLan}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 text-[11px] font-semibold ${
              lanOpen
                ? 'bg-violet-500/20 border-violet-500/40 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.25)]'
                : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-violet-300 hover:bg-violet-500/10 hover:border-violet-500/30'
            }`}
            title="Раздача в локальную сеть (Wi-Fi)"
          >
            <Wifi size={14} />
            <span className="hidden lg:inline">LAN</span>
          </button>

          {/* LAN Dropdown */}
          {lanOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-white/15 bg-[#12131a]/95 backdrop-blur-2xl shadow-2xl shadow-black/50 z-50 overflow-hidden"
              style={{ animation: 'fadeSlideDown 0.2s ease-out' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10">
                <div className="flex items-center gap-2">
                  <Wifi size={14} className="text-violet-400" />
                  <span className="text-xs font-bold text-white tracking-wide">Раздача в LAN</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLanOpen(false)}
                  className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>

              {/* Content */}
              <div className="p-4">
                {lanLoading ? (
                  <div className="flex items-center justify-center gap-2 py-4">
                    <RefreshCw size={14} className="text-violet-400 animate-spin" />
                    <span className="text-xs text-slate-400">Определение IP-адресов...</span>
                  </div>
                ) : lanUrls.length === 0 ? (
                  <div className="text-center py-4">
                    <span className="text-xs text-slate-500">Нет доступных адресов</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500 mb-3">Откройте любой из этих адресов на другом устройстве в вашей Wi-Fi сети:</p>
                    {lanUrls.map((url) => (
                      <div
                        key={url}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 hover:border-violet-500/30 transition-colors group"
                      >
                        <span className="text-[11px] font-mono text-emerald-300 truncate">{url}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyUrl(url)}
                          className="shrink-0 p-1.5 rounded-md bg-white/[0.06] hover:bg-violet-500/20 text-slate-400 hover:text-violet-300 border border-transparent hover:border-violet-500/30 transition-all cursor-pointer"
                          title="Скопировать"
                        >
                          {copiedUrl === url ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer hint */}
              <div className="px-4 py-2.5 border-t border-white/10 bg-white/[0.02]">
                <p className="text-[9px] text-slate-600 text-center">Устройства должны быть в одной Wi-Fi сети • Порт 5173</p>
              </div>
            </div>
          )}
        </div>

        {/* Top Right "Open IDE" Action Button */}
        <button
          type="button"
          onClick={() => onChangeView('workspace')}
          className="flat-btn px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
          title="Открыть окно Редактора IDE"
        >
          <Code size={13} className="text-sky-400" />
          <span className="hidden sm:inline">Open IDE</span>
        </button>

        {/* Console Logs Trigger */}
        {onToggleLogs && (
          <button
            type="button"
            onClick={onToggleLogs}
            className="p-1.5 rounded-lg bg-black/40 border border-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer hidden md:flex"
            title="Логи консоли"
          >
            <Terminal size={14} />
          </button>
        )}
      </div>
    </header>
  );
};
