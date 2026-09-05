import React, { useState, useMemo, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FolderTree,
  MessageSquare,
  X,
  Settings as SettingsIcon,
  BarChart2,
  BookOpen,
  Bot,
} from 'lucide-react';
import { ChatSession, FileNode, ActiveView } from '../types';
import { WorkspaceTree } from './WorkspaceTree';
import { getWorkspaceBaseName, isAutoWorkspace } from '../utils/helpers';
import { useI18n } from '../i18n';
import { SessionTimelineModal, formatDialogCount } from './chat/SessionTimelineModal';
import { AsciiParticleFlow } from './sidebar/AsciiParticleFlow';
import { SessionGroup } from './sidebar/SessionGroup';
import { SidebarNewChatMenu } from './sidebar/SidebarNewChatMenu';

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
  activeView?: ActiveView;
  onChangeView?: (view: ActiveView) => void;
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
    if (title !== undefined) {
      onCreateSession(title, wsDir);
    } else if (workspaceDir && !isAutoWorkspace(workspaceDir)) {
      const folderName = getWorkspaceBaseName(workspaceDir);
      onCreateSession(`${t.nav.chat} (${folderName})`, workspaceDir);
    } else {
      onCreateSession(t.nav.newChat, 'auto');
    }
    if (window.innerWidth < 768) {
      onToggleOpen();
    }
  }, [onCreateSession, onToggleOpen, workspaceDir, t]);

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
          
          {/* 1. TOP HEADER: DARK STYLISH NEW CHAT BUTTON */}
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
            <SidebarNewChatMenu
              onCreateChat={handleCreateAndCloseOnMobile}
              onSelectWorkspace={onSelectWorkspace}
              workspaceDir={workspaceDir}
            />
          </div>

          {/* 2. CHATS TREE WITH VECTOR CONNECTORS & PIXEL-PERFECT ALIGNMENT */}
          <div className="flex-1 overflow-y-auto px-3 py-1 space-y-3 min-h-0 scrollbar-thin">
            
            {/* WORKSPACE PROJECT FOLDERS */}
            {projectWorkspaceDirs.map((dir) => {
              const isCurrentActiveWs = workspaceDir ? dir.toLowerCase() === workspaceDir.toLowerCase() : false;
              const projSessions = filteredSessions.filter(
                (s) => s.workspace_dir && s.workspace_dir.toLowerCase() === dir.toLowerCase()
              );
              const isCollapsed = Boolean(collapsedGroups[dir]);
              const folderName = getWorkspaceBaseName(dir);

              return (
                <SessionGroup
                  key={dir}
                  title={folderName}
                  isCollapsed={isCollapsed}
                  onToggleCollapse={() => toggleGroup(dir)}
                  sessions={projSessions}
                  currentSessionId={currentSessionId}
                  onSelectSession={handleSelectAndCloseOnMobile}
                  onDeleteSession={onDeleteSession}
                  onCreateSession={() => handleCreateAndCloseOnMobile(`${t.nav.chat} (${folderName})`, dir)}
                  isCurrentActiveWs={isCurrentActiveWs}
                />
              );
            })}

            {/* AUTO-WORKSPACE SESSIONS */}
            {autoWorkspaceSessions.length > 0 && (
              <SessionGroup
                title={t.sidebar.autoWorkspace}
                count={autoWorkspaceSessions.length}
                isCollapsed={Boolean(collapsedGroups['auto_workspaces'])}
                onToggleCollapse={() => toggleGroup('auto_workspaces')}
                sessions={autoWorkspaceSessions}
                currentSessionId={currentSessionId}
                onSelectSession={handleSelectAndCloseOnMobile}
                onDeleteSession={onDeleteSession}
              />
            )}

            {/* STANDALONE GENERAL CHATS */}
            {standaloneSessions.length > 0 && (
              <SessionGroup
                title={t.sidebar.standalone}
                count={standaloneSessions.length}
                isCollapsed={Boolean(collapsedGroups['standalone'])}
                onToggleCollapse={() => toggleGroup('standalone')}
                sessions={standaloneSessions}
                currentSessionId={currentSessionId}
                onSelectSession={handleSelectAndCloseOnMobile}
                onDeleteSession={onDeleteSession}
              />
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
              <div className="grid grid-cols-5 gap-1">
                {[
                  { id: 'chat', label: t.nav.chat, icon: MessageSquare },
                  { id: 'knowledge', label: t.nav.knowledge, icon: BookOpen },
                  { id: 'veronica', label: t.nav.veronica, icon: Bot },
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
