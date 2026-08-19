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
import { MaterialIcon } from './common/MaterialIcon';

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
  onNewChat?: () => void;
  onOpenMemorySkills?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  sidebarOpen: _sidebarOpen,
  onToggleSidebar: _onToggleSidebar,
  activeView,
  onChangeView,
  config,
  onSelectWorkspace: _onSelectWorkspace,
  has0xAgentMd: _has0xAgentMd = false,
  onToggleLogs,
  onModelChanged: _onModelChanged,
  onOpenJarvis,
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
    <header className="h-14 border border-[var(--theme-border)] bg-[var(--theme-panel)]/90 backdrop-blur-2xl px-4 rounded-[22px] flex items-center justify-between select-none z-30 shrink-0 font-sans shadow-sm">
      
      {/* Left Section: 0xAGENT Brand Logo */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 font-bold text-sm tracking-wider text-[var(--theme-text)]">
          <Terminal size={16} className="text-[var(--theme-text-muted)] shrink-0" />
          <span>0xAGENT</span>
        </div>
      </div>

      {/* Right Section: View Switcher Bento Tabs + Utilities */}
      <div className="flex items-center gap-2.5">
        {/* View Switcher Bento Tabs */}
        <div className="flex items-center bg-[var(--theme-card-bg)] p-1 rounded-full border border-[var(--theme-border)] shadow-sm">
          {[
            { id: 'chat', label: 'Чат', icon: MessageSquare },
            { id: 'workspace', label: 'Редактор', icon: Code },
            { id: 'knowledge', label: 'Знания', icon: BookOpen },
            { id: 'analytics', label: 'Аналитика', icon: BarChart2 },
            { id: 'settings', label: 'Настройки', icon: SettingsIcon },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeView(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-full font-bold text-sm flex items-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] shadow-sm'
                    : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-[var(--theme-accent-text)]' : 'text-[var(--theme-text-muted)]'} />
                <span className="hidden md:inline">{tab.label}</span>
              </button>
            );
          })}

          {/* Memory & Skills Tab Trigger in Header */}
          {onOpenMemorySkills && (
            <button
              type="button"
              onClick={onOpenMemorySkills}
              className="px-3.5 py-1.5 rounded-full font-bold text-sm flex items-center gap-2 transition-all cursor-pointer text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]"
              title="Память & Скиллы ИИ"
            >
              <Brain size={14} />
              <span className="hidden lg:inline">Память</span>
            </button>
          )}

          {onOpenJarvis && (
            <button
              type="button"
              onClick={onOpenJarvis}
              className="px-3.5 py-1.5 rounded-full font-bold text-sm flex items-center gap-2 transition-all cursor-pointer text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]"
              title="Jarvis Telemetry & Workspace"
            >
              <Bot size={14} />
              <span className="hidden lg:inline">Jarvis</span>
            </button>
          )}
        </div>

        {/* Voice Intercom Quick Trigger */}
        {config?.tts_config?.enabled && (
          <button
            type="button"
            onClick={async () => {
              try {
                await api.speak_category('greeting');
              } catch (err) {
                console.error(err);
              }
            }}
            className="p-2 rounded-xl bento-card text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-all cursor-pointer flex items-center gap-1.5 text-xs font-mono border border-[var(--theme-border)] shadow-sm"
            title="Голосовой интерком Jarvis. Клик — проверить связь."
          >
            <MaterialIcon name="volume_up" size={15} />
            <span className="hidden xl:inline text-xs font-bold">:: [VOICE]</span>
          </button>
        )}

        {/* LAN Wi-Fi Sharing */}
        <div className="relative" ref={lanRef}>
          <button
            type="button"
            onClick={handleToggleLan}
            className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-sm ${
              lanOpen
                ? 'bg-[var(--theme-accent)] border-[var(--theme-accent)] text-[var(--theme-accent-text)]'
                : 'bento-card text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] border-[var(--theme-border)]'
            }`}
            title="Раздача в локальную сеть Wi-Fi"
          >
            <Wifi size={14} />
            <span className="hidden xl:inline">LAN</span>
          </button>

          {lanOpen && (
            <div className="absolute right-0 top-full mt-2 w-76 rounded-2xl bento-card p-2 shadow-2xl z-50 border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-2xl animate-fadeIn space-y-1">
              <div className="px-3 py-1.5 text-xs font-mono text-[var(--theme-text-muted)] uppercase tracking-wider border-b border-[var(--theme-border)] mb-1 flex items-center justify-between font-bold">
                <div className="flex items-center gap-1.5">
                  <Wifi size={13} />
                  <span>Раздача в LAN</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLanOpen(false)}
                  className="p-1 rounded-md hover:bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>

              <div className="p-1">
                {lanLoading ? (
                  <div className="flex items-center justify-center gap-2 py-3">
                    <RefreshCw size={13} className="text-[var(--theme-text-muted)] animate-spin" />
                    <span className="text-xs text-[var(--theme-text-muted)]">Определение IP...</span>
                  </div>
                ) : lanUrls.length === 0 ? (
                  <div className="py-2 px-1 text-xs text-[var(--theme-text-muted)] text-center">
                    Нет доступных сетевых интерфейсов
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {lanUrls.map((url, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] gap-2 hover:border-[var(--theme-accent)] transition-colors"
                      >
                        <span className="font-mono text-xs text-[var(--theme-text)] truncate select-all font-semibold">
                          {url}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyUrl(url)}
                          className="p-1 rounded-md text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-colors cursor-pointer"
                          title="Скопировать ссылку"
                        >
                          {copiedUrl === url ? (
                            <Check size={13} className="text-emerald-500" />
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Server Logs Toggle Button */}
        {onToggleLogs && (
          <button
            type="button"
            onClick={onToggleLogs}
            className="p-2 rounded-xl bento-card text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold border border-[var(--theme-border)] shadow-sm"
            title="Открыть / закрыть логи LLM сервера"
          >
            <Terminal size={14} />
            <span className="hidden sm:inline">Логи</span>
          </button>
        )}
      </div>

    </header>
  );
};
