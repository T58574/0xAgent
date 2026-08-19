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
  Folder,
  FolderPlus,
  Unlink,
  ChevronDown,
  Sparkles,
  Menu,
  Plus,
} from 'lucide-react';
import { AppConfig, ChatSession, PersonaMetadata } from '../types';
import * as api from '../services/api';
import { useToast } from '../context/ToastContext';
import { MaterialIcon } from './common/MaterialIcon';
import {
  getWorkspaceBaseName,
  isAutoWorkspace,
  exportSessionLogAsText,
  exportSessionJson,
} from '../utils/helpers';

interface NavbarProps {
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  activeView: 'chat' | 'workspace' | 'jarvis' | 'settings' | 'analytics' | 'knowledge';
  onChangeView: (view: 'chat' | 'workspace' | 'jarvis' | 'settings' | 'analytics' | 'knowledge') => void;
  config: AppConfig | null;
  currentSession?: ChatSession | null;
  workspaceDir?: string | null;
  onSelectWorkspace?: () => void;
  onUpdateSessionWorkspace?: (dir: string | null) => void;
  currentPersona?: PersonaMetadata;
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
  onToggleSidebar,
  activeView,
  onChangeView,
  config,
  currentSession,
  workspaceDir,
  onSelectWorkspace,
  onUpdateSessionWorkspace,
  currentPersona: _currentPersona,
  has0xAgentMd: _has0xAgentMd = false,
  onToggleLogs,
  onModelChanged: _onModelChanged,
  onOpenJarvis: _onOpenJarvis,
  onNewChat,
  onOpenMemorySkills,
}) => {
  const { showToast } = useToast();

  // LAN Sharing state
  const [lanOpen, setLanOpen] = useState(false);
  const [lanUrls, setLanUrls] = useState<string[]>([]);
  const [lanLoading, setLanLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const lanRef = useRef<HTMLDivElement>(null);

  // Workspace Popover state
  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const [copiedLog, setCopiedLog] = useState(false);
  const wsMenuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (lanRef.current && !lanRef.current.contains(event.target as Node)) {
        setLanOpen(false);
      }
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
    <header className="h-13 sm:h-14 border-b sm:border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 sm:bg-[var(--theme-panel)]/90 backdrop-blur-2xl px-2.5 sm:px-4 rounded-none sm:rounded-[22px] flex items-center justify-between select-none z-30 shrink-0 font-sans shadow-sm gap-2 sm:gap-3">
      
      {/* Left Section: Mobile Burger Menu + 0xAGENT Brand + Chat Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        
        {/* Mobile Burger Menu Button */}
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-2 -ml-1 rounded-xl text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] active:scale-95 transition-all cursor-pointer flex items-center justify-center shrink-0"
            title="Открыть список диалогов"
          >
            <Menu size={19} className="text-[var(--theme-text)]" />
          </button>
        )}

        {/* Brand */}
        <div className="flex items-center gap-1.5 font-bold text-sm tracking-wider text-[var(--theme-text)] shrink-0">
          <Terminal size={15} className="text-[var(--theme-text-muted)] shrink-0 hidden xs:inline" />
          <span className="hidden sm:inline">0xAGENT</span>
        </div>

        <span className="w-px h-4 bg-[var(--theme-border)] shrink-0 hidden sm:inline-block" />

        {/* Current Chat Title & Workspace Pill */}
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          <div className="flex items-center gap-1.5 text-[var(--theme-text)] font-semibold text-xs sm:text-sm truncate max-w-[140px] xs:max-w-[180px] sm:max-w-[240px] md:max-w-[320px]">
            <MessageSquare size={13} className="text-[var(--theme-text-muted)] shrink-0 hidden sm:inline" />
            <span className="truncate">{currentSession?.title || 'Новый диалог'}</span>
          </div>

          {/* Workspace Pill Dropdown */}
          <div ref={wsMenuRef} className="relative shrink-0 hidden sm:block">
            <button
              type="button"
              onClick={() => setWsMenuOpen(!wsMenuOpen)}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-[var(--theme-card-bg)] hover:bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-[11px] sm:text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors cursor-pointer shadow-sm font-semibold"
              title="Рабочая папка текущего диалога"
            >
              {isAutoWs ? (
                <>
                  <Sparkles size={11} className="text-[var(--theme-accent)]" />
                  <span className="truncate max-w-[100px]">{wsName}</span>
                </>
              ) : hasWs ? (
                <>
                  <Folder size={11} className="text-[var(--theme-text)]" />
                  <span className="truncate max-w-[100px]">{wsName}</span>
                </>
              ) : (
                <>
                  <Folder size={11} />
                  <span>Без воркспейса</span>
                </>
              )}
              <ChevronDown size={11} className={`transition-transform duration-200 ${wsMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Workspace Switcher Popover */}
            {wsMenuOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 rounded-2xl bento-card p-2 shadow-2xl z-50 border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-2xl animate-fadeIn space-y-1">
                <div className="px-2.5 py-1 text-[11px] font-semibold text-[var(--theme-text-muted)] uppercase tracking-wider border-b border-[var(--theme-border)] mb-1 flex items-center justify-between">
                  <span>Воркспейс Диалога</span>
                  <button
                    type="button"
                    onClick={() => setWsMenuOpen(false)}
                    className="p-0.5 rounded-md hover:bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </div>

                <div className="px-2.5 py-1.5 text-xs text-[var(--theme-text)] bg-[var(--theme-input-bg)] rounded-xl border border-[var(--theme-border)] truncate font-mono">
                  {currentSessionWorkspace || 'Изолированная авто-песочница'}
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
                  <span>Выбрать локальную папку проекта</span>
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
                          showToast(`Создана изолированная песочница ${res.slug}`, 'success');
                        }
                      } catch (err: any) {
                        showToast(`Ошибка создания песочницы: ${err.message || err}`, 'error');
                      }
                    }
                  }}
                  className="w-full px-2.5 py-2 rounded-xl text-xs font-semibold text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] flex items-center gap-2 transition-colors cursor-pointer text-left"
                >
                  <Sparkles size={14} className="text-[var(--theme-accent)]" />
                  <span>Создать новую авто-песочницу</span>
                </button>

                {hasWs && (
                  <button
                    type="button"
                    onClick={() => {
                      setWsMenuOpen(false);
                      onUpdateSessionWorkspace?.(null);
                      showToast('Диалог отвязан от воркспейса', 'info');
                    }}
                    className="w-full px-2.5 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 flex items-center gap-2 transition-colors cursor-pointer text-left"
                  >
                    <Unlink size={14} />
                    <span>Отвязать от папки (Авто-режим)</span>
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
              title="Скопировать лог диалога (Shift+Клик для полного JSON)"
            >
              {copiedLog ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            </button>
          )}
        </div>
      </div>

      {/* Right Section: Mobile Quick Actions & Desktop View Switcher */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        
        {/* Mobile New Chat Button */}
        {onNewChat && (
          <button
            type="button"
            onClick={onNewChat}
            className="md:hidden p-2 rounded-xl bg-[var(--theme-accent)] text-[var(--theme-accent-text)] font-bold text-xs flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
            title="Новый диалог"
          >
            <Plus size={16} />
            <span className="hidden xs:inline text-[11px]">Новый</span>
          </button>
        )}

        {/* Desktop View Switcher Bento Tabs */}
        <div className="hidden md:flex items-center bg-[var(--theme-card-bg)] p-1 rounded-full border border-[var(--theme-border)] shadow-sm">
          {[
            { id: 'chat', label: 'Чат', icon: MessageSquare },
            { id: 'workspace', label: 'Редактор', icon: Code },
            { id: 'jarvis', label: 'Jarvis', icon: Bot },
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
            className="p-2 rounded-full bento-card text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-all cursor-pointer flex items-center gap-1.5 text-xs font-mono border border-[var(--theme-border)] shadow-sm"
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
            className={`p-2 rounded-full border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-sm ${
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
            <div className="fixed inset-x-3 bottom-20 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-76 max-w-[calc(100vw-24px)] rounded-2xl bento-card p-2 shadow-2xl z-50 border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-2xl animate-fadeIn space-y-1">
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
            className="p-2 rounded-full bento-card text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold border border-[var(--theme-border)] shadow-sm"
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
