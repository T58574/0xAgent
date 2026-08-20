import React, { useState, useEffect, useRef } from 'react';
import {
  FolderPlus,
  Folder,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FolderTree,
  History,
  Search,
  MessageSquare,
  GitBranch,
  Plus,
  Sparkles,
  Terminal,
  X,
  Code,
  Settings as SettingsIcon,
  BarChart2,
  BookOpen,
  Bot,
} from 'lucide-react';
import { ChatSession, FileNode } from '../types';
import { WorkspaceTree } from './WorkspaceTree';
import { getWorkspaceBaseName, formatRelativeTime, isAutoWorkspace } from '../utils/helpers';

interface SidebarProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCreateSession: (title?: string, workspace_dir?: string | null) => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  workspaceDir?: string | null;
  onSelectWorkspace: () => void;
  workspaceTreeNodes?: FileNode[];
  onFileClick?: (path: string, name: string) => void;
  activeView?: 'chat' | 'workspace' | 'jarvis' | 'settings' | 'analytics' | 'knowledge';
  onChangeView?: (view: 'chat' | 'workspace' | 'jarvis' | 'settings' | 'analytics' | 'knowledge') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggleOpen,
  sessions,
  currentSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  workspaceDir,
  onSelectWorkspace,
  workspaceTreeNodes = [],
  onFileClick,
  activeView,
  onChangeView,
}) => {
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [searchFilter, setSearchFilter] = useState('');
  const [isHoveringHistory, setIsHoveringHistory] = useState(false);
  const [showNewChatMenu, setShowNewChatMenu] = useState(false);
  const newChatMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (newChatMenuRef.current && !newChatMenuRef.current.contains(e.target as Node)) {
        setShowNewChatMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Filter sessions
  const filteredSessions = searchFilter.trim()
    ? sessions.filter((s) => s.title.toLowerCase().includes(searchFilter.toLowerCase()))
    : sessions;

  // Separate sessions into Project Folders, Auto-Workspaces, and Standalone
  const projectWorkspaceDirsSet = new Set<string>();
  if (workspaceDir && !isAutoWorkspace(workspaceDir)) {
    projectWorkspaceDirsSet.add(workspaceDir);
  }
  sessions.forEach((s) => {
    if (s.workspace_dir && !isAutoWorkspace(s.workspace_dir)) {
      projectWorkspaceDirsSet.add(s.workspace_dir);
    }
  });
  const projectWorkspaceDirs = Array.from(projectWorkspaceDirsSet);

  const autoWorkspaceSessions = filteredSessions.filter((s) => s.workspace_dir && isAutoWorkspace(s.workspace_dir));
  const standaloneSessions = filteredSessions.filter((s) => !s.workspace_dir);

  const handleSelectAndCloseOnMobile = (id: string) => {
    onSelectSession(id);
    if (window.innerWidth < 768) {
      onToggleOpen();
    }
  };

  const handleCreateAndCloseOnMobile = (title?: string, wsDir?: string | null) => {
    onCreateSession(title, wsDir);
    if (window.innerWidth < 768) {
      onToggleOpen();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 md:hidden animate-fadeIn"
        onClick={onToggleOpen}
        aria-hidden="true"
      />

      <aside className="fixed inset-y-0 left-0 z-50 w-[84vw] max-w-[310px] h-[100dvh] md:relative md:w-64 md:w-68 md:h-full md:z-20 shrink-0 font-sans text-xs select-none text-[var(--theme-text)] animate-in slide-in-from-left duration-200 md:animate-none">
        
        {/* Desktop Outer Edge Middle Collapse Arrow Button */}
        <button
          type="button"
          onClick={onToggleOpen}
          className="hidden md:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-50 w-7 h-12 rounded-full bg-[var(--theme-panel-solid)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] items-center justify-center shadow-xl transition-all cursor-pointer group hover:scale-110 opacity-100"
          style={{ backgroundColor: 'var(--theme-panel-solid)' }}
          title="Свернуть боковое меню"
        >
          <ChevronLeft size={15} className="transition-transform group-hover:-translate-x-0.5" />
        </button>

        <div className="w-full h-full bg-[var(--theme-panel)]/98 md:bg-[var(--theme-panel)]/95 border-r md:border border-[var(--theme-border)] rounded-none md:rounded-[26px] flex flex-col justify-between overflow-hidden backdrop-blur-2xl shadow-2xl md:shadow-sm">
          
          {/* 1. TOP HEADER: PROMINENT NEW CHAT & QUICK SEARCH */}
          <div className="p-3 border-b border-[var(--theme-border)] shrink-0 bg-[var(--theme-panel)] space-y-2.5">
            
            {/* Mobile Header Title & Close Button */}
            <div className="flex md:hidden items-center justify-between pb-1">
              <div className="flex items-center gap-2 font-bold text-sm tracking-wider text-[var(--theme-text)]">
                <img
                  src="/0xAgent-icon.jpg"
                  alt="0xAgent Logo"
                  className="w-5 h-5 rounded-md object-cover border border-[var(--theme-border)] shrink-0"
                />
                <span>0xAGENT</span>
              </div>
              <button
                type="button"
                onClick={onToggleOpen}
                className="p-1.5 rounded-xl text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-colors"
                title="Закрыть меню"
              >
                <X size={18} />
              </button>
            </div>

            {/* Primary Action Button: New Chat with Split dropdown */}
            <div ref={newChatMenuRef} className="relative flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (workspaceDir && !isAutoWorkspace(workspaceDir)) {
                    const folderName = getWorkspaceBaseName(workspaceDir);
                    handleCreateAndCloseOnMobile(`Чат (${folderName})`, workspaceDir);
                  } else {
                    handleCreateAndCloseOnMobile('Новый диалог', 'auto');
                  }
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[var(--theme-accent)] text-[var(--theme-accent-text)] hover:opacity-90 font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer group"
                title="Создать новый диалог (Ctrl+N)"
              >
                <Plus size={15} className="transition-transform group-hover:rotate-90 text-[var(--theme-accent-text)]" />
                <span>Новый диалог</span>
              </button>

              <button
                type="button"
                onClick={() => setShowNewChatMenu(!showNewChatMenu)}
                className="p-2.5 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] hover:bg-[var(--theme-panel)] transition-colors cursor-pointer shadow-sm"
                title="Параметры создания диалога"
              >
                <ChevronDown size={14} className={`transition-transform duration-200 ${showNewChatMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* New Chat Dropdown Popover */}
              {showNewChatMenu && (
                <div className="absolute top-full left-0 right-0 mt-2 bento-card p-1.5 shadow-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-2xl z-50 rounded-2xl space-y-1 animate-fadeIn">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewChatMenu(false);
                      handleCreateAndCloseOnMobile('Быстрый чат', 'auto');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs hover:bg-[var(--theme-border-subtle)] text-[var(--theme-text)] transition-colors cursor-pointer"
                  >
                    <Sparkles size={14} className="text-[var(--theme-text-muted)] shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-bold">Авто-воркспейс</span>
                      <span className="text-[10px] text-[var(--theme-text-muted)]">Изолированная песочница ~/.0xagent</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowNewChatMenu(false);
                      handleCreateAndCloseOnMobile('Общий диалог', null);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs hover:bg-[var(--theme-border-subtle)] text-[var(--theme-text)] transition-colors cursor-pointer"
                  >
                    <MessageSquare size={14} className="text-[var(--theme-text-muted)] shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-bold">Общий диалог</span>
                      <span className="text-[10px] text-[var(--theme-text-muted)]">Без привязки к папке на диске</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowNewChatMenu(false);
                      onSelectWorkspace();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs hover:bg-[var(--theme-border-subtle)] text-[var(--theme-text)] transition-colors cursor-pointer border-t border-[var(--theme-border)] mt-0.5 pt-2"
                  >
                    <FolderPlus size={14} className="text-[var(--theme-text-muted)] shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-bold">Открыть проект с диска...</span>
                      <span className="text-[10px] text-[var(--theme-text-muted)]">Выбрать локальную папку</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Search filter input */}
            <div className="relative">
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Поиск по диалогам..."
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] focus:outline-none focus:border-[var(--theme-accent)] transition-all font-sans"
              />
              <Search size={13} className="absolute left-2.5 top-2.5 text-[var(--theme-text-muted)]" />
            </div>
          </div>

          {/* 2. CHATS TREE WITH VECTOR CONNECTORS */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-3 min-h-0 scrollbar-thin">
            
            {/* WORKSPACE PROJECT FOLDERS */}
            {projectWorkspaceDirs.map((dir) => {
              const isCurrentActiveWs = workspaceDir && dir.toLowerCase() === workspaceDir.toLowerCase();
              const projSessions = filteredSessions.filter(
                (s) => s.workspace_dir && s.workspace_dir.toLowerCase() === dir.toLowerCase()
              );
              const isCollapsed = collapsedGroups[dir];
              const folderName = getWorkspaceBaseName(dir);

              return (
                <div key={dir} className="space-y-1">
                  
                  {/* Folder Node Header */}
                  <div
                    onClick={() => toggleGroup(dir)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer transition-colors text-xs font-medium ${
                      isCurrentActiveWs
                        ? 'bg-[var(--theme-accent)]/10 border border-[var(--theme-accent)]/30 text-[var(--theme-text)] font-bold'
                        : 'bento-card text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isCollapsed ? (
                        <ChevronRight size={13} className="shrink-0 text-[var(--theme-text-muted)]" />
                      ) : (
                        <ChevronDown size={13} className="shrink-0 text-[var(--theme-text-muted)]" />
                      )}
                      <Folder size={13} className="shrink-0 text-[var(--theme-text-muted)]" />
                      <span className="truncate font-bold">{folderName}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {isCurrentActiveWs && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-mono bg-[var(--theme-accent)]/10 text-[var(--theme-text)] border border-[var(--theme-border)]">
                          <GitBranch size={9} />
                          <span>main</span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCreateAndCloseOnMobile(`Чат (${folderName})`, dir);
                        }}
                        className="p-1 rounded-lg hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-colors cursor-pointer text-[var(--theme-text-muted)]"
                        title="Новый диалог в этой папке"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Sessions Branch Tree */}
                  {!isCollapsed && (
                    <div className="relative pl-3 ml-3 border-l border-[var(--theme-border)]/70 space-y-0.5 mt-1">
                      {projSessions.length > 0 ? (
                        projSessions.map((session) => {
                          const isActive = session.id === currentSessionId;
                          const relTime = formatRelativeTime(session.updated_at);
                          return (
                            <div
                              key={session.id}
                              onClick={() => handleSelectAndCloseOnMobile(session.id)}
                              className={`relative group px-2.5 py-2 sm:py-1.5 rounded-xl text-xs cursor-pointer transition-all flex items-center justify-between gap-1.5 border before:absolute before:-left-3 before:top-1/2 before:w-2.5 before:h-px before:bg-[var(--theme-border)]/70 ${
                                isActive
                                  ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] font-bold border-[var(--theme-accent)] shadow-sm'
                                  : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <MessageSquare size={12} className={isActive ? 'text-[var(--theme-accent-text)] shrink-0' : 'text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text)] shrink-0'} />
                                <span className="truncate">{session.title}</span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {relTime && (
                                  <span className={`text-[10px] font-mono group-hover:hidden ${isActive ? 'text-[var(--theme-accent-text)]/80' : 'text-[var(--theme-text-muted)]'}`}>
                                    {relTime}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => onDeleteSession(session.id, e)}
                                  className={`p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${isActive ? 'text-[var(--theme-accent-text)] hover:bg-black/20' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'}`}
                                  title="Удалить"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-[10px] text-[var(--theme-text-muted)] italic py-1 px-2 font-mono">
                          нет диалогов
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* AUTO-WORKSPACE SESSIONS */}
            {autoWorkspaceSessions.length > 0 && (
              <div className="space-y-1">
                <div
                  onClick={() => toggleGroup('auto_workspaces')}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bento-card text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer font-bold text-xs"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {collapsedGroups['auto_workspaces'] ? (
                      <ChevronRight size={13} className="shrink-0" />
                    ) : (
                      <ChevronDown size={13} className="shrink-0" />
                    )}
                    <Sparkles size={13} className="shrink-0 text-[var(--theme-text-muted)]" />
                    <span>Авто-воркспейсы</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-60">({autoWorkspaceSessions.length})</span>
                </div>

                {!collapsedGroups['auto_workspaces'] && (
                  <div className="relative pl-3 ml-3 border-l border-[var(--theme-border)]/70 space-y-0.5 mt-1">
                    {autoWorkspaceSessions.map((session) => {
                      const isActive = session.id === currentSessionId;
                      const relTime = formatRelativeTime(session.updated_at);
                      return (
                        <div
                          key={session.id}
                          onClick={() => handleSelectAndCloseOnMobile(session.id)}
                          className={`relative group px-2.5 py-2 sm:py-1.5 rounded-xl text-xs cursor-pointer transition-all flex items-center justify-between gap-1.5 border before:absolute before:-left-3 before:top-1/2 before:w-2.5 before:h-px before:bg-[var(--theme-border)]/70 ${
                            isActive
                              ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] font-bold border-[var(--theme-accent)] shadow-sm'
                              : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <Terminal size={12} className={isActive ? 'text-[var(--theme-accent-text)] shrink-0' : 'text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text)] shrink-0'} />
                            <span className="truncate">{session.title}</span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {relTime && (
                              <span className={`text-[10px] font-mono group-hover:hidden ${isActive ? 'text-[var(--theme-accent-text)]/80' : 'text-[var(--theme-text-muted)]'}`}>
                                {relTime}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => onDeleteSession(session.id, e)}
                              className={`p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${isActive ? 'text-[var(--theme-accent-text)] hover:bg-black/20' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'}`}
                              title="Удалить"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* STANDALONE GENERAL CHATS */}
            {standaloneSessions.length > 0 && (
              <div className="space-y-1">
                <div
                  onClick={() => toggleGroup('standalone')}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bento-card text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer font-bold text-xs"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {collapsedGroups['standalone'] ? (
                      <ChevronRight size={13} className="shrink-0" />
                    ) : (
                      <ChevronDown size={13} className="shrink-0" />
                    )}
                    <MessageSquare size={13} className="shrink-0 text-[var(--theme-text-muted)]" />
                    <span>Общие диалоги</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-60">({standaloneSessions.length})</span>
                </div>

                {!collapsedGroups['standalone'] && (
                  <div className="relative pl-3 ml-3 border-l border-[var(--theme-border)]/70 space-y-0.5 mt-1">
                    {standaloneSessions.map((session) => {
                      const isActive = session.id === currentSessionId;
                      const relTime = formatRelativeTime(session.updated_at);
                      return (
                        <div
                          key={session.id}
                          onClick={() => handleSelectAndCloseOnMobile(session.id)}
                          className={`relative group px-2.5 py-2 sm:py-1.5 rounded-xl text-xs cursor-pointer transition-all flex items-center justify-between gap-1.5 border before:absolute before:-left-3 before:top-1/2 before:w-2.5 before:h-px before:bg-[var(--theme-border)]/70 ${
                            isActive
                              ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] font-bold border-[var(--theme-accent)] shadow-sm'
                              : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <MessageSquare size={12} className={isActive ? 'text-[var(--theme-accent-text)] shrink-0' : 'text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text)] shrink-0'} />
                            <span className="truncate">{session.title}</span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {relTime && (
                              <span className={`text-[10px] font-mono group-hover:hidden ${isActive ? 'text-[var(--theme-accent-text)]/80' : 'text-[var(--theme-text-muted)]'}`}>
                                {relTime}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => onDeleteSession(session.id, e)}
                              className={`p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${isActive ? 'text-[var(--theme-accent-text)] hover:bg-black/20' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'}`}
                              title="Удалить"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* WORKSPACE FILE EXPLORER */}
            {workspaceDir && workspaceTreeNodes.length > 0 && (
              <div className="pt-2 border-t border-[var(--theme-border)]">
                <button
                  type="button"
                  onClick={() => setShowFileExplorer(!showFileExplorer)}
                  className="w-full py-2 px-2.5 rounded-xl bento-card text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] font-bold text-[11px] flex items-center justify-between cursor-pointer shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <FolderTree size={14} className="text-[var(--theme-text-muted)]" />
                    <span>Дерево файлов проекта</span>
                  </div>
                  {showFileExplorer ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>

                {showFileExplorer && (
                  <div className="mt-2 max-h-52 overflow-y-auto border border-[var(--theme-border)] rounded-xl p-2 bg-[var(--theme-card-bg)] shadow-inner">
                    <WorkspaceTree
                      workspaceDir={workspaceDir}
                      treeNodes={workspaceTreeNodes}
                      onSelectWorkspace={onSelectWorkspace}
                      onFileClick={(path, name) => onFileClick && onFileClick(path, name)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. MOBILE VIEWS QUICK NAVIGATION DRAWER SECTION */}
          {onChangeView && (
            <div className="p-2 border-t border-[var(--theme-border)] shrink-0 bg-[var(--theme-card-bg)] md:hidden space-y-1">
              <div className="px-2 py-1 text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider font-bold">
                Навигация
              </div>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'chat', label: 'Чат', icon: MessageSquare },
                  { id: 'workspace', label: 'Код', icon: Code },
                  { id: 'jarvis', label: 'Jarvis', icon: Bot },
                  { id: 'knowledge', label: 'Знания', icon: BookOpen },
                  { id: 'analytics', label: 'Аналитика', icon: BarChart2 },
                  { id: 'settings', label: 'Опции', icon: SettingsIcon },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeView === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        onChangeView(tab.id as any);
                        if (window.innerWidth < 768) {
                          onToggleOpen();
                        }
                      }}
                      className={`py-2 px-1 rounded-xl text-center flex flex-col items-center justify-center gap-1 transition-colors ${
                        isActive
                          ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] font-bold shadow-sm'
                          : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
                      }`}
                    >
                      <Icon size={14} />
                      <span className="text-[10px] truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. BOTTOM FOOTER: SESSION HISTORY & ASCII RISING PARTICLES ON HOVER */}
          <div
            onMouseEnter={() => setIsHoveringHistory(true)}
            onMouseLeave={() => setIsHoveringHistory(false)}
            className="p-3 border-t border-[var(--theme-border)] shrink-0 bg-[var(--theme-panel)] relative overflow-hidden group transition-all"
          >
            {/* Interactive ASCII Particle Canvas */}
            <AsciiParticleFlow isActive={isHoveringHistory} />

            <div className="relative z-10 flex items-center justify-between text-xs text-[var(--theme-text-muted)] font-medium">
              <div className="flex items-center gap-2">
                <History size={15} className="text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text)] transition-colors" />
                <span className="group-hover:text-[var(--theme-text)] transition-colors font-semibold">История сессий</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-md bg-[var(--theme-border-subtle)] text-[var(--theme-text)] font-bold text-xs border border-[var(--theme-border)]">
                {sessions.length}
              </span>
            </div>
          </div>

        </div>

      </aside>
    </>
  );
};

// Interactive Rising ASCII Particle Flow Canvas Component
const AsciiParticleFlow: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const chars = ['·', '°', '⁺', '*', '‧', '•', '∘'];
    const particles: Array<{ x: number; y: number; char: string; speed: number; opacity: number }> = [];

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 200;
      canvas.height = canvas.parentElement?.clientHeight || 40;
    };
    resize();

    const spawn = () => {
      if (particles.length < 18) {
        particles.push({
          x: Math.random() * canvas.width,
          y: canvas.height + 5,
          char: chars[Math.floor(Math.random() * chars.length)],
          speed: 0.6 + Math.random() * 0.9,
          opacity: 0.15 + Math.random() * 0.5,
        });
      }
    };

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (isActive) {
        spawn();
        spawn();
      }

      ctx.font = '10px monospace';

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.y -= p.speed;
        p.opacity -= 0.012;

        if (p.y < -5 || p.opacity <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, p.opacity)})`;
        ctx.fillText(p.char, p.x, p.y);
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isActive]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
        isActive ? 'opacity-90' : 'opacity-0'
      }`}
    />
  );
};
