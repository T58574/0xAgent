import React, { useState } from 'react';
import {
  Plus,
  MessageSquare,
  FolderPlus,
  Folder,
  Trash2,
  Brain,
  ChevronRight,
  ChevronDown,
  FolderTree,
  PanelLeftClose,
  Sparkles,
} from 'lucide-react';
import { ChatSession, FileNode } from '../types';
import { WorkspaceTree } from './WorkspaceTree';
import { getWorkspaceBaseName } from '../utils/helpers';

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
  onOpenMemorySkills?: () => void;
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
  onOpenMemorySkills,
}) => {
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});


  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const currentWorkspaceSessions = sessions.filter(
    (s) => workspaceDir && s.workspace_dir && s.workspace_dir.toLowerCase() === workspaceDir.toLowerCase()
  );

  const standaloneSessions = sessions.filter((s) => !s.workspace_dir);

  const otherWorkspaceMap = new Map<string, ChatSession[]>();
  sessions.forEach((s) => {
    if (s.workspace_dir && (!workspaceDir || s.workspace_dir.toLowerCase() !== workspaceDir.toLowerCase())) {
      const existing = otherWorkspaceMap.get(s.workspace_dir) || [];
      otherWorkspaceMap.set(s.workspace_dir, [...existing, s]);
    }
  });

  if (!isOpen) {
    return (
      <aside className="w-12 h-full bg-[var(--theme-panel)] border-r border-[var(--theme-border)] flex flex-col items-center justify-between py-3 z-20 shrink-0 font-sans select-none">
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onToggleOpen}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Развернуть боковую панель"
          >
            <ChevronRight size={16} />
          </button>

          <button
            type="button"
            onClick={() => onCreateSession('Новый чат', null)}
            className="p-2 rounded-lg bg-white/10 text-white border border-[var(--theme-border)] hover:bg-white/20 cursor-pointer"
            title="Новый чат (без Workspace)"
          >
            <Plus size={16} />
          </button>

          {workspaceDir && (
            <button
              type="button"
              onClick={() => onCreateSession(`Чат (${getWorkspaceBaseName(workspaceDir)})`, workspaceDir)}
              className="p-2 rounded-lg bg-white/10 text-white border border-[var(--theme-border)] hover:bg-white/20 cursor-pointer"
              title={`Чат в Workspace: ${getWorkspaceBaseName(workspaceDir)}`}
            >
              <FolderPlus size={16} />
            </button>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          {onOpenMemorySkills && (
            <button
              type="button"
              onClick={onOpenMemorySkills}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              title="Память & Скиллы"
            >
              <Brain size={16} />
            </button>
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-64 h-full bg-[var(--theme-panel)] border-r border-[var(--theme-border)] flex flex-col justify-between z-20 shrink-0 font-sans text-xs select-none backdrop-blur-md text-[var(--theme-text)]">
      
      {/* 1. TOP CREATION BUTTONS */}
      <div className="p-3 border-b border-[var(--theme-border)] space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-theme-muted uppercase tracking-wider flex items-center gap-1.5 font-sans">
            <MessageSquare size={13} className="text-[var(--theme-accent)]" />
            <span>Сессии и Чат</span>
          </span>

          <button
            type="button"
            onClick={onToggleOpen}
            className="p-1 rounded text-theme-muted hover:text-theme-text hover:bg-white/10 transition-colors cursor-pointer"
            title="Свернуть боковое меню"
          >
            <PanelLeftClose size={15} />
          </button>
        </div>

        {/* Primary Unified New Chat Button */}
        <button
          type="button"
          onClick={() =>
            onCreateSession(
              workspaceDir ? `Чат (${getWorkspaceBaseName(workspaceDir)})` : 'Новый чат',
              workspaceDir || null
            )
          }
          className="w-full btn-primary py-2 px-3 text-xs flex items-center justify-center gap-2 shadow-md"
        >
          <Plus size={15} />
          <span>{workspaceDir ? `Чат в ${getWorkspaceBaseName(workspaceDir)}` : 'Создать новый чат'}</span>
        </button>

        {/* Sub-Action: Open Workspace Directory if not set */}
        {!workspaceDir && (
          <button
            type="button"
            onClick={onSelectWorkspace}
            className="w-full flat-btn py-1.5 px-3 rounded-lg text-xs font-medium text-theme-muted hover:text-theme-text flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Folder size={13} />
            <span>Открыть воркспейс...</span>
          </button>
        )}
      </div>

      {/* 2. MIDDLE SESSIONS LIST (SCROLLABLE) */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-3 min-h-0 scrollbar-thin">
        
        {/* GROUP A: Active Workspace Sessions */}
        {workspaceDir && (
          <div className="space-y-1">
            <div
              onClick={() => toggleGroup('current_ws')}
              className="flex items-center justify-between px-2 py-1 rounded hover:bg-white/5 cursor-pointer text-slate-300 font-semibold text-[11px]"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {collapsedGroups['current_ws'] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                <Folder size={13} className="text-[var(--theme-accent)] shrink-0" />
                <span className="truncate">{getWorkspaceBaseName(workspaceDir)}</span>
                <span className="text-[10px] text-slate-500 font-mono">({currentWorkspaceSessions.length})</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateSession(`Чат (${getWorkspaceBaseName(workspaceDir)})`, workspaceDir);
                }}
                className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-white/10"
                title="Создать чат в этом Workspace"
              >
                <Plus size={12} />
              </button>
            </div>

            {!collapsedGroups['current_ws'] && (
              <div className="pl-2 space-y-0.5 border-l border-white/10 ml-2">
                {currentWorkspaceSessions.length > 0 ? (
                  currentWorkspaceSessions.map((session) => {
                    const isActive = session.id === currentSessionId;
                    return (
                      <div
                        key={session.id}
                        onClick={() => onSelectSession(session.id)}
                        className={`group p-2 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                          isActive
                            ? 'bg-white/15 text-white font-medium border-white/30 shadow-md'
                            : 'bg-black/20 text-slate-300 border-transparent hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-[var(--theme-accent)] animate-pulse' : 'bg-slate-600'}`} />
                          <span className="truncate font-sans text-xs">{session.title}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => onDeleteSession(session.id, e)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/20 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          title="Удалить сессию"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-[11px] text-slate-500 italic py-1 px-2">Нет чатов в этой папке.</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* GROUP B: Standalone General Chats (Without Workspace) */}
        <div className="space-y-1">
          <div
            onClick={() => toggleGroup('standalone')}
            className="flex items-center justify-between px-2 py-1 rounded hover:bg-white/5 cursor-pointer text-slate-300 font-semibold text-[11px]"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {collapsedGroups['standalone'] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              <Sparkles size={13} className="text-[var(--theme-accent)] shrink-0" />
              <span>Общие чаты (Без Workspace)</span>
              <span className="text-[10px] text-slate-500 font-mono">({standaloneSessions.length})</span>
            </div>
          </div>

          {!collapsedGroups['standalone'] && (
            <div className="pl-2 space-y-0.5 border-l border-white/10 ml-2">
              {standaloneSessions.length > 0 ? (
                standaloneSessions.map((session) => {
                  const isActive = session.id === currentSessionId;
                  return (
                    <div
                      key={session.id}
                      onClick={() => onSelectSession(session.id)}
                      className={`group p-2 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                        isActive
                          ? 'bg-white/15 text-white font-medium border-white/30 shadow-md'
                          : 'bg-black/20 text-slate-300 border-transparent hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-[var(--theme-accent)] animate-pulse' : 'bg-slate-600'}`} />
                        <span className="truncate font-sans text-xs">{session.title}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => onDeleteSession(session.id, e)}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/20 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        title="Удалить сессию"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="text-[11px] text-slate-500 italic py-1 px-2">Нет общих чатов.</div>
              )}
            </div>
          )}
        </div>

        {/* GROUP C: Other Workspace Folders */}
        {Array.from(otherWorkspaceMap.entries()).map(([dir, sessList]) => (
          <div key={dir} className="space-y-1">
            <div
              onClick={() => toggleGroup(dir)}
              className="flex items-center justify-between px-2 py-1 rounded hover:bg-white/5 cursor-pointer text-slate-400 font-medium text-[11px]"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {collapsedGroups[dir] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                <Folder size={12} className="text-slate-500 shrink-0" />
                <span className="truncate">{getWorkspaceBaseName(dir)}</span>
                <span className="text-[10px] text-slate-500 font-mono">({sessList.length})</span>
              </div>
            </div>

            {!collapsedGroups[dir] && (
              <div className="pl-2 space-y-0.5 border-l border-white/10 ml-2">
                {sessList.map((session) => {
                  const isActive = session.id === currentSessionId;
                  return (
                    <div
                      key={session.id}
                      onClick={() => onSelectSession(session.id)}
                      className={`group p-2 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                        isActive
                          ? 'bg-white/15 text-white font-medium border-white/30 shadow-md'
                          : 'bg-black/20 text-slate-400 border-transparent hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-[var(--theme-accent)] animate-pulse' : 'bg-slate-600'}`} />
                        <span className="truncate font-sans text-xs">{session.title}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => onDeleteSession(session.id, e)}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/20 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        title="Удалить сессию"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {/* TOGGLE WORKSPACE FILE EXPLORER SECTION */}
        {workspaceDir && workspaceTreeNodes.length > 0 && (
          <div className="pt-2 border-t border-[var(--theme-border)]">
            <button
              type="button"
              onClick={() => setShowFileExplorer(!showFileExplorer)}
              className="w-full py-1.5 px-2 rounded hover:bg-white/5 text-slate-300 font-semibold text-[11px] flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <FolderTree size={13} className="text-[var(--theme-accent)]" />
                <span>Дерево файлов Workspace</span>
              </div>
              {showFileExplorer ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>

            {showFileExplorer && (
              <div className="mt-1.5 max-h-56 overflow-y-auto border border-[var(--theme-border)] rounded-lg p-1.5 bg-black/40">
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

      {/* 3. BOTTOM PANEL CONTROLS */}
      <div className="p-3 border-t border-[var(--theme-border)] shrink-0 bg-black/40">
        {onOpenMemorySkills && (
          <button
            type="button"
            onClick={onOpenMemorySkills}
            className="w-full flat-btn py-1.5 px-3 rounded-lg text-xs font-medium text-[var(--theme-text)] bg-white/[0.04] border-[var(--theme-border)] hover:bg-white/10 cursor-pointer flex items-center justify-center gap-2 transition-all"
          >
            <Brain size={14} className="text-[var(--theme-accent)]" />
            <span>Память и скиллы</span>
          </button>
        )}
      </div>
    </aside>
  );
};
