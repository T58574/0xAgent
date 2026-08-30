import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  FolderPlus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FolderTree,
  MessageSquare,
  GitBranch,
  Plus,
  Sparkles,
  X,
  Settings as SettingsIcon,
  BarChart2,
  BookOpen,
} from 'lucide-react';
import { ChatSession, FileNode } from '../types';
import { WorkspaceTree } from './WorkspaceTree';
import { getWorkspaceBaseName, formatRelativeTime, isAutoWorkspace } from '../utils/helpers';
import { useI18n } from '../i18n';
import { SessionTimelineModal, formatDialogCount } from './chat/SessionTimelineModal';

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

export const Sidebar: React.FC<SidebarProps> = React.memo(({
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
  const { language, t } = useI18n();
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [isHoveringHistory, setIsHoveringHistory] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
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

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Filtered sessions
  const filteredSessions = sessions;

  // Separate sessions into Project Folders, Auto-Workspaces, and Standalone
  const projectWorkspaceDirs = useMemo(() => {
    const projectWorkspaceDirsSet = new Set<string>();
    if (workspaceDir && !isAutoWorkspace(workspaceDir)) {
      projectWorkspaceDirsSet.add(workspaceDir);
    }
    sessions.forEach((s) => {
      if (s.workspace_dir && !isAutoWorkspace(s.workspace_dir)) {
        projectWorkspaceDirsSet.add(s.workspace_dir);
      }
    });
    return Array.from(projectWorkspaceDirsSet);
  }, [workspaceDir, sessions]);

  const autoWorkspaceSessions = useMemo(() => {
    return filteredSessions.filter((s) => s.workspace_dir && isAutoWorkspace(s.workspace_dir));
  }, [filteredSessions]);

  const standaloneSessions = useMemo(() => {
    return filteredSessions.filter((s) => !s.workspace_dir);
  }, [filteredSessions]);

  const handleSelectAndCloseOnMobile = useCallback((id: string) => {
    onSelectSession(id);
    if (window.innerWidth < 768) {
      onToggleOpen();
    }
  }, [onSelectSession, onToggleOpen]);

  const handleCreateAndCloseOnMobile = useCallback((title?: string, wsDir?: string | null) => {
    onCreateSession(title, wsDir);
    if (window.innerWidth < 768) {
      onToggleOpen();
    }
  }, [onCreateSession, onToggleOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 md:hidden animate-fadeIn"
        onClick={onToggleOpen}
        aria-hidden="true"
      />

      <aside className="fixed inset-y-0 left-0 z-50 w-[84vw] max-w-[320px] h-[100dvh] md:relative md:w-72 lg:w-80 md:h-full md:z-20 shrink-0 font-sans text-xs select-none text-[var(--theme-text)] animate-in slide-in-from-left duration-200 md:animate-none">
        
        {/* Desktop Outer Edge Middle Collapse Arrow Button */}
        <button
          type="button"
          onClick={onToggleOpen}
          className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-50 w-6 h-11 rounded-full bg-[var(--theme-panel-solid)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] items-center justify-center shadow-lg transition-all cursor-pointer group hover:scale-105 active:scale-95"
          style={{ backgroundColor: 'var(--theme-panel-solid)' }}
          title={t.nav.toggleSidebar}
        >
          <ChevronLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
        </button>

        {/* Unified Dark Floating Sidebar Container */}
        <div className="w-full h-full bg-[var(--theme-panel)] border border-[var(--theme-border)] rounded-2xl sm:rounded-[26px] flex flex-col justify-between overflow-hidden shadow-sm">
          
          {/* 1. TOP HEADER: DARK STYLISH NEW CHAT BUTTON (No search bar, no hard separator line) */}
          <div className="p-3 shrink-0 space-y-2">
            
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
                title={t.common.close}
              >
                <X size={18} />
              </button>
            </div>

            {/* Primary Action Button: Dark Subtle Tactile New Chat with Split dropdown */}
            <div ref={newChatMenuRef} className="relative flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (workspaceDir && !isAutoWorkspace(workspaceDir)) {
                    const folderName = getWorkspaceBaseName(workspaceDir);
                    handleCreateAndCloseOnMobile(`${t.nav.chat} (${folderName})`, workspaceDir);
                  } else {
                    handleCreateAndCloseOnMobile(t.nav.newChat, 'auto');
                  }
                }}
                className="flex-1 py-2 px-3.5 rounded-xl bg-[var(--theme-card-bg)] hover:bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-[var(--theme-text)] font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-all duration-150 cursor-pointer group active:scale-[0.98]"
                title={t.sidebar.newChatTooltip}
              >
                <Plus size={14} className="transition-transform group-hover:rotate-90 text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text)]" />
                <span>{t.nav.newChat}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowNewChatMenu(!showNewChatMenu)}
                className="p-2 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                title={t.nav.workspaceMenu}
              >
                <ChevronDown size={14} className={`transition-transform duration-200 ${showNewChatMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* New Chat Dropdown Popover */}
              {showNewChatMenu && (
                <div className="absolute top-full left-0 right-0 mt-1.5 p-1.5 shadow-2xl border border-[var(--theme-border)] bg-[var(--theme-panel-solid)] backdrop-blur-2xl z-50 rounded-2xl space-y-1 animate-fadeIn">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewChatMenu(false);
                      handleCreateAndCloseOnMobile(t.sidebar.autoWorkspace, 'auto');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs hover:bg-[var(--theme-border-subtle)] text-[var(--theme-text)] transition-colors cursor-pointer"
                  >
                    <Sparkles size={14} className="text-[var(--theme-text-muted)] shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-semibold">{t.sidebar.autoWorkspace}</span>
                      <span className="text-[10px] text-[var(--theme-text-muted)]">~/.0xagent/workspaces</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowNewChatMenu(false);
                      handleCreateAndCloseOnMobile(t.sidebar.standalone, null);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs hover:bg-[var(--theme-border-subtle)] text-[var(--theme-text)] transition-colors cursor-pointer"
                  >
                    <MessageSquare size={14} className="text-[var(--theme-text-muted)] shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-semibold">{t.sidebar.standalone}</span>
                      <span className="text-[10px] text-[var(--theme-text-muted)]">{t.chat.context}</span>
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
                      <span className="font-semibold">{t.sidebar.openWorkspace}...</span>
                      <span className="text-[10px] text-[var(--theme-text-muted)]">{t.nav.changeWorkspace}</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 2. CHATS TREE WITH VECTOR CONNECTORS & PIXEL-PERFECT ALIGNMENT */}
          <div className="flex-1 overflow-y-auto px-3 py-1 space-y-3 min-h-0 scrollbar-thin">
            
            {/* WORKSPACE PROJECT FOLDERS */}
            {projectWorkspaceDirs.map((dir) => {
              const isCurrentActiveWs = workspaceDir && dir.toLowerCase() === workspaceDir.toLowerCase();
              const projSessions = filteredSessions.filter(
                (s) => s.workspace_dir && s.workspace_dir.toLowerCase() === dir.toLowerCase()
              );
              const isCollapsed = collapsedGroups[dir];
              const folderName = getWorkspaceBaseName(dir);

              return (
                <div key={dir} className="space-y-1 w-full">
                  
                  {/* Folder Node Header */}
                  <div
                    onClick={() => toggleGroup(dir)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer transition-colors text-xs font-medium w-full ${
                      isCurrentActiveWs
                        ? 'bg-[var(--theme-card-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] font-semibold shadow-2xs'
                        : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {isCollapsed ? (
                        <ChevronRight size={13} className="shrink-0 text-[var(--theme-text-muted)]" />
                      ) : (
                        <ChevronDown size={13} className="shrink-0 text-[var(--theme-text-muted)]" />
                      )}
                      <span className="truncate font-semibold">{folderName}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-auto">
                      {isCurrentActiveWs && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-mono bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)] border border-[var(--theme-border)]">
                          <GitBranch size={9} />
                          <span>main</span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCreateAndCloseOnMobile(`${t.nav.chat} (${folderName})`, dir);
                        }}
                        className="p-1 rounded-lg hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-colors cursor-pointer text-[var(--theme-text-muted)]"
                        title={t.sidebar.newChatTooltip}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Sessions Branch Tree */}
                  {!isCollapsed && (
                    <div className="relative pl-3.5 ml-2.5 border-l border-[var(--theme-border)]/70 space-y-0.5 mt-1 w-[calc(100%-0.625rem)]">
                      {projSessions.length > 0 ? (
                        projSessions.map((session) => {
                          const isActive = session.id === currentSessionId;
                          const relTime = formatRelativeTime(session.updated_at);
                          return (
                            <div
                              key={session.id}
                              onClick={() => handleSelectAndCloseOnMobile(session.id)}
                              className={`relative group w-full px-2.5 py-2 rounded-xl text-xs cursor-pointer transition-all duration-150 flex items-center justify-between gap-1.5 border before:absolute before:-left-3.5 before:top-1/2 before:w-3 before:h-px before:bg-[var(--theme-border)]/70 ${
                                isActive
                                  ? 'session-item-active text-[var(--theme-text)] font-semibold border-[var(--theme-border)]'
                                  : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
                              }`}
                            >
                              <span className="truncate flex-1 text-left font-medium">{session.title}</span>

                              <div className="flex items-center gap-1 shrink-0 ml-auto pl-1">
                                {relTime && (
                                  <span className={`text-[10px] font-mono group-hover:hidden ${isActive ? 'text-[var(--theme-text-muted)]' : 'text-[var(--theme-text-muted)] opacity-60'}`}>
                                    {relTime}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => onDeleteSession(session.id, e)}
                                  className="p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]"
                                  title={t.sidebar.deleteSession}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-[10px] text-[var(--theme-text-muted)] italic py-1 px-2 font-mono">
                          {t.sidebar.noSessionsFound}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* AUTO-WORKSPACE SESSIONS (Песочница чата) */}
            {autoWorkspaceSessions.length > 0 && (
              <div className="space-y-1 w-full">
                <div
                  onClick={() => toggleGroup('auto_workspaces')}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] cursor-pointer font-semibold text-xs transition-colors w-full"
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {collapsedGroups['auto_workspaces'] ? (
                      <ChevronRight size={13} className="shrink-0 text-[var(--theme-text-muted)]" />
                    ) : (
                      <ChevronDown size={13} className="shrink-0 text-[var(--theme-text-muted)]" />
                    )}
                    <span className="truncate">{t.sidebar.autoWorkspace}</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-60 ml-auto shrink-0">({autoWorkspaceSessions.length})</span>
                </div>

                {!collapsedGroups['auto_workspaces'] && (
                  <div className="relative pl-3.5 ml-2.5 border-l border-[var(--theme-border)]/70 space-y-0.5 mt-1 w-[calc(100%-0.625rem)]">
                    {autoWorkspaceSessions.map((session) => {
                      const isActive = session.id === currentSessionId;
                      const relTime = formatRelativeTime(session.updated_at);
                      return (
                        <div
                          key={session.id}
                          onClick={() => handleSelectAndCloseOnMobile(session.id)}
                          className={`relative group w-full px-2.5 py-2 rounded-xl text-xs cursor-pointer transition-all duration-150 flex items-center justify-between gap-1.5 border before:absolute before:-left-3.5 before:top-1/2 before:w-3 before:h-px before:bg-[var(--theme-border)]/70 ${
                            isActive
                              ? 'session-item-active text-[var(--theme-text)] font-semibold border-[var(--theme-border)]'
                              : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
                          }`}
                        >
                          <span className="truncate flex-1 text-left font-medium">{session.title}</span>

                          <div className="flex items-center gap-1 shrink-0 ml-auto pl-1">
                            {relTime && (
                              <span className={`text-[10px] font-mono group-hover:hidden ${isActive ? 'text-[var(--theme-text-muted)]' : 'text-[var(--theme-text-muted)] opacity-60'}`}>
                                {relTime}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => onDeleteSession(session.id, e)}
                              className="p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]"
                              title={t.sidebar.deleteSession}
                            >
                              <Trash2 size={12} />
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
              <div className="space-y-1 w-full">
                <div
                  onClick={() => toggleGroup('standalone')}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] cursor-pointer font-semibold text-xs transition-colors w-full"
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {collapsedGroups['standalone'] ? (
                      <ChevronRight size={13} className="shrink-0 text-[var(--theme-text-muted)]" />
                    ) : (
                      <ChevronDown size={13} className="shrink-0 text-[var(--theme-text-muted)]" />
                    )}
                    <span className="truncate">{t.sidebar.standalone}</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-60 ml-auto shrink-0">({standaloneSessions.length})</span>
                </div>

                {!collapsedGroups['standalone'] && (
                  <div className="relative pl-3.5 ml-2.5 border-l border-[var(--theme-border)]/70 space-y-0.5 mt-1 w-[calc(100%-0.625rem)]">
                    {standaloneSessions.map((session) => {
                      const isActive = session.id === currentSessionId;
                      const relTime = formatRelativeTime(session.updated_at);
                      return (
                        <div
                          key={session.id}
                          onClick={() => handleSelectAndCloseOnMobile(session.id)}
                          className={`relative group w-full px-2.5 py-2 rounded-xl text-xs cursor-pointer transition-all duration-150 flex items-center justify-between gap-1.5 border before:absolute before:-left-3.5 before:top-1/2 before:w-3 before:h-px before:bg-[var(--theme-border)]/70 ${
                            isActive
                              ? 'session-item-active text-[var(--theme-text)] font-semibold border-[var(--theme-border)]'
                              : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
                          }`}
                        >
                          <span className="truncate flex-1 text-left font-medium">{session.title}</span>

                          <div className="flex items-center gap-1 shrink-0 ml-auto pl-1">
                            {relTime && (
                              <span className={`text-[10px] font-mono group-hover:hidden ${isActive ? 'text-[var(--theme-text-muted)]' : 'text-[var(--theme-text-muted)] opacity-60'}`}>
                                {relTime}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => onDeleteSession(session.id, e)}
                              className="p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]"
                              title={t.sidebar.deleteSession}
                            >
                              <Trash2 size={12} />
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
                  className="w-full py-2 px-2.5 rounded-xl text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] font-semibold text-[11px] flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FolderTree size={14} className="text-[var(--theme-text-muted)]" />
                    <span>{t.editor.workspaceFiles}</span>
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
              <div className="grid grid-cols-4 gap-1">
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
                      onClick={() => {
                        onChangeView(tab.id as any);
                        if (window.innerWidth < 768) {
                          onToggleOpen();
                        }
                      }}
                      className={`py-2 px-1 rounded-xl text-center flex flex-col items-center justify-center gap-1 transition-colors ${
                        isActive
                          ? 'bg-[var(--theme-card-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] font-semibold shadow-xs'
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

          {/* 4. BOTTOM FOOTER: SESSION TIMELINE TRIGGER & ASCII RISING PARTICLES ON HOVER */}
          <button
            type="button"
            onClick={() => setIsTimelineOpen(true)}
            onMouseEnter={() => setIsHoveringHistory(true)}
            onMouseLeave={() => setIsHoveringHistory(false)}
            className="w-full p-3 border-t border-[var(--theme-border)] shrink-0 bg-[var(--theme-panel)] hover:bg-[var(--theme-border-subtle)] relative overflow-hidden group transition-all text-center cursor-pointer select-none"
            title={language === 'ru' ? 'Открыть хронологию всех диалогов' : 'Open session timeline'}
          >
            {/* Interactive ASCII Particle Canvas */}
            <AsciiParticleFlow isActive={isHoveringHistory} />

            <div className="relative z-10 flex items-center justify-center text-xs font-mono text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text)] font-semibold transition-colors">
              <span>{formatDialogCount(sessions.length, language)}</span>
            </div>
          </button>

        </div>

      </aside>

      {/* Session Timeline Popover Modal */}
      <SessionTimelineModal
        isOpen={isTimelineOpen}
        onClose={() => setIsTimelineOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={onSelectSession}
        onDeleteSession={onDeleteSession}
      />
    </>
  );
});

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
