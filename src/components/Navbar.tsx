import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Code,
  Settings as SettingsIcon,
  BarChart2,
  BookOpen,
  Brain,
  Terminal,
  Wifi,
  Copy,
  Check,
  X,
  Bot,
  RefreshCw,
} from 'lucide-react';
import { AppConfig } from '../types';
import * as api from '../services/api';
import { useToast } from '../context/ToastContext';

interface NavbarProps {
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  activeView: 'chat' | 'workspace' | 'settings' | 'analytics' | 'knowledge';
  onChangeView: (view: 'chat' | 'workspace' | 'settings' | 'analytics' | 'knowledge') => void;
  config: AppConfig | null;
  onSelectWorkspace: () => void;
  has0xAgentMd?: boolean;
  onToggleLogs?: () => void;
  isServerOffline?: boolean;
  onStartServer?: () => Promise<void>;
  onModelChanged?: (newModelId: string) => void;
  onOpenJarvis?: () => void;
  activeJulesCount?: number;
  onNewChat?: () => void;
  onOpenMemorySkills?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  sidebarOpen: _sidebarOpen,
  onToggleSidebar: _onToggleSidebar,
  activeView,
  onChangeView,
  config: _config,
  onSelectWorkspace: _onSelectWorkspace,
  has0xAgentMd: _has0xAgentMd = false,
  onToggleLogs,
  onModelChanged: _onModelChanged,
  onOpenJarvis,
  activeJulesCount,
  onNewChat: _onNewChat,
  onOpenMemorySkills,
}) => {
  const { showToast } = useToast();

  // LAN Sharing state
  const [lanOpen, setLanOpen] = useState(false);
  const [lanUrls, setLanUrls] = useState<string[]>([]);
  const [lanLoading, setLanLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const lanRef = useRef<HTMLDivElement>(null);

  // Handle LAN menu
  const handleToggleLan = async () => {
    if (!lanOpen) {
      setLanLoading(true);
      setLanOpen(true);
      try {
        const info = await api.get_lan_info();
        setLanUrls(info.urls || []);
      } catch (err: any) {
        showToast('Не удалось получить LAN IP адреса', 'error');
      } finally {
        setLanLoading(false);
      }
    } else {
      setLanOpen(false);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    showToast('Ссылка скопирована в буфер обмена', 'success');
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (lanRef.current && !lanRef.current.contains(event.target as Node)) {
        setLanOpen(false);
      }
    };
    if (lanOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [lanOpen]);

  return (
    <header className="h-12 border-b border-[var(--theme-border)] bg-[var(--theme-panel)]/90 backdrop-blur-xl px-3 flex items-center justify-between select-none z-30 shrink-0 font-sans">
      
      {/* Left Section: 0xAGENT Brand Logo */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-1.5 font-mono font-bold text-xs tracking-wider text-[var(--theme-text)]">
          <Terminal size={14} className="text-[var(--theme-text-muted)] shrink-0" />
          <span>0xAGENT</span>
        </div>
      </div>

      {/* Right Section: View Switcher Bento Tabs + Utilities */}
      <div className="flex items-center gap-2">
        {/* View Switcher Bento Tabs */}
        <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-[var(--theme-border)]">
          <button
            type="button"
            onClick={() => onChangeView('chat')}
            className={`px-2.5 py-1 rounded-md font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              activeView === 'chat'
                ? 'bg-white/15 text-[var(--theme-text)] border border-[var(--theme-border)] shadow-sm'
                : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5 border border-transparent'
            }`}
          >
            <MessageSquare size={13} />
            <span className="hidden md:inline">Чат</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeView('workspace')}
            className={`px-2.5 py-1 rounded-md font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              activeView === 'workspace'
                ? 'bg-white/15 text-[var(--theme-text)] border border-[var(--theme-border)] shadow-sm'
                : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5 border border-transparent'
            }`}
          >
            <Code size={13} />
            <span className="hidden md:inline">Редактор</span>
          </button>

          {/* Memory & Skills Tab Trigger in Header */}
          {onOpenMemorySkills && (
            <button
              type="button"
              onClick={onOpenMemorySkills}
              className="px-2.5 py-1 rounded-md font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5 border border-transparent"
              title="Память & Скиллы ИИ"
            >
              <Brain size={13} />
              <span className="hidden lg:inline">Память</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onChangeView('knowledge')}
            className={`px-2.5 py-1 rounded-md font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              activeView === 'knowledge'
                ? 'bg-white/15 text-[var(--theme-text)] border border-[var(--theme-border)] shadow-sm'
                : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5 border border-transparent'
            }`}
          >
            <BookOpen size={13} />
            <span className="hidden md:inline">Знания</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeView('analytics')}
            className={`px-2.5 py-1 rounded-md font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              activeView === 'analytics'
                ? 'bg-white/15 text-[var(--theme-text)] border border-[var(--theme-border)] shadow-sm'
                : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5 border border-transparent'
            }`}
          >
            <BarChart2 size={13} />
            <span className="hidden md:inline">Аналитика</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeView('settings')}
            className={`px-2.5 py-1 rounded-md font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              activeView === 'settings'
                ? 'bg-white/15 text-[var(--theme-text)] border border-[var(--theme-border)] shadow-sm'
                : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5 border border-transparent'
            }`}
          >
            <SettingsIcon size={13} />
            <span className="hidden md:inline">Настройки</span>
          </button>

          {onOpenJarvis && (
            <button
              type="button"
              onClick={onOpenJarvis}
              className="px-2.5 py-1 rounded-md font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5 border border-transparent"
              title="Jarvis Orchestrator"
            >
              <Bot size={13} />
              <span className="hidden lg:inline">Jarvis</span>
              {activeJulesCount !== undefined && activeJulesCount > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-white/20 text-[var(--theme-text)]">
                  {activeJulesCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* LAN Wi-Fi Sharing */}
        <div className="relative" ref={lanRef}>
          <button
            type="button"
            onClick={handleToggleLan}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-medium ${
              lanOpen
                ? 'bg-white/15 border-[var(--theme-border)] text-[var(--theme-text)]'
                : 'bento-card text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
            }`}
            title="Раздача в локальную сеть Wi-Fi"
          >
            <Wifi size={14} />
            <span className="hidden xl:inline">LAN</span>
          </button>

          {lanOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl bento-card p-2 shadow-2xl z-50 border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-2xl animate-fadeIn space-y-1">
              <div className="px-2.5 py-1 text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider border-b border-[var(--theme-border)]/50 mb-1 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Wifi size={12} />
                  <span>Раздача в LAN</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLanOpen(false)}
                  className="p-0.5 rounded-md hover:bg-white/10 text-[var(--theme-text-muted)] hover:text-white transition-colors cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>

              <div className="p-1">
                {lanLoading ? (
                  <div className="flex items-center justify-center gap-2 py-3">
                    <RefreshCw size={13} className="text-[var(--theme-text-muted)] animate-spin" />
                    <span className="text-xs text-[var(--theme-text-muted)]">Определение IP...</span>
                  </div>
                ) : lanUrls.length === 0 ? (
                  <div className="text-center py-3">
                    <span className="text-xs text-[var(--theme-text-muted)]">Нет доступных адресов</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-[10px] text-[var(--theme-text-muted)] font-mono mb-1">Адреса для подключения:</p>
                    {lanUrls.map((url) => (
                      <div
                        key={url}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-white/5 border border-[var(--theme-border)] transition-colors"
                      >
                        <span className="text-xs font-mono text-[var(--theme-text)] truncate">{url}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyUrl(url)}
                          className="shrink-0 p-1 rounded-md bg-white/10 hover:bg-white/20 text-[var(--theme-text)] transition-all cursor-pointer"
                          title="Скопировать"
                        >
                          {copiedUrl === url ? <Check size={12} className="text-[var(--theme-text)]" /> : <Copy size={12} />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Console Logs Button */}
        {onToggleLogs && (
          <button
            type="button"
            onClick={onToggleLogs}
            className="p-1.5 rounded-lg bento-card text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors cursor-pointer hidden md:flex"
            title="Логи терминала"
          >
            <Terminal size={14} />
          </button>
        )}
      </div>
    </header>
  );
};
