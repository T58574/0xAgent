import React, { useState } from 'react';
import {
  Plus,
  FolderPlus,
  Folder,
  Trash2,
  Brain,
  ChevronRight,
  ChevronDown,
  FolderTree,
  PanelLeftClose,
  History,
  Settings as SettingsIcon,
  Search,
  Sparkles,
} from 'lucide-react';
import { ChatSession, FileNode } from '../types';
import { WorkspaceTree } from './WorkspaceTree';
import { getWorkspaceBaseName, formatRelativeTime } from '../utils/helpers';

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
  onOpenSettings?: () => void;
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
  onOpenSettings,
}) => {
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [searchFilter, setSearchFilter] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Collect unique project directories
  const allWorkspaceDirsSet = new Set<string>();
  if (workspaceDir) {
    allWorkspaceDirsSet.add(workspaceDir);
  }
  sessions.forEach((s) => {
    if (s.workspace_dir) {
      allWorkspaceDirsSet.add(s.workspace_dir);
    }
  });

  const workspaceDirs = Array.from(allWorkspaceDirsSet);

  // Filter sessions by search query if search filter active
  const filteredSessions = searchFilter.trim()
    ? sessions.filter((s) => s.title.toLowerCase().includes(searchFilter.toLowerCase()))
    : sessions;

  const standaloneSessions = filteredSessions.filter((s) => !s.workspace_dir);

  // Render Collapsed Bar Mode
  if (!isOpen) {
    return (
      <aside className="w-12 h-full bg-[#0b0c10] border-r border-white/10 flex flex-col items-center justify-between py-3 z-20 shrink-0 font-sans select-none">
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
            onClick={() => onCreateSession('Новый чат', workspaceDir || null)}
            className="p-2 rounded-lg bg-white/10 text-white border border-white/10 hover:bg-white/20 cursor-pointer shadow-sm"
            title="Новый чат"
          >
            <Plus size={16} />
          </button>

          <button
            type="button"
            onClick={onSelectWorkspace}
            className="p-2 rounded-lg text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 cursor-pointer"
            title="Открыть / выбрать воркспейс"
          >
            <FolderPlus size={16} />
          </button>

          {onOpenMemorySkills && (
            <button
              type="button"
              onClick={onOpenMemorySkills}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              title="Память & Скиллы ИИ"
            >
              <Brain size={16} />
            </button>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              title="Настройки"
            >
              <SettingsIcon size={16} />
            </button>
          )}
        </div>
      </aside>
    );
  }

  // Render Full Expanded Sidebar Mode
  return (
    <aside className="w-64 md:w-72 h-full bg-[#0d0e12] border-r border-white/10 flex flex-col justify-between z-20 shrink-0 font-sans text-xs select-none backdrop-blur-xl text-slate-200">
      
      {/* 1. TOP CREATION & QUICK NAV SECTION */}
      <div className="p-3 border-b border-white/10 space-y-2 shrink-0 bg-slate-950/40">
        
        <div className="flex items-center justify-between">
          <span className="font-bold text-[13px] tracking-wide text-white">0xAgent</span>

          <button
            type="button"
            onClick={onToggleOpen}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Свернуть боковое меню"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>

        {/* Primary "+ Новый чат" Capsule Button */}
        <button
          type="button"
          onClick={() =>
            onCreateSession(
              workspaceDir ? `Чат (${getWorkspaceBaseName(workspaceDir)})` : 'Новый чат',
              workspaceDir || null
            )
          }
          className="w-full bg-[#1b1c24] hover:bg-[#252632] border border-white/10 text-white py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-start gap-2.5 transition-all shadow-sm cursor-pointer"
        >
          <Plus size={15} className="text-slate-300" />
          <span>Новый чат</span>
        </button>

        {/* Quick Links Menu */}
        <div className="space-y-0.5 pt-1">
          {/* Conversation History Toggle */}
          <button
            type="button"
            onClick={() => setShowSearchInput(!showSearchInput)}
            className="w-full px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2.5 transition-colors cursor-pointer text-xs font-medium"
            title="Поиск по истории сессий"
          >
            <History size={14} className="text-slate-400" />
            <span>История сессий</span>
          </button>

          {/* Memory & Skills Link */}
          {onOpenMemorySkills && (
            <button
              type="button"
              onClick={onOpenMemorySkills}
              className="w-full px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2.5 transition-colors cursor-pointer text-xs font-medium"
              title="Долгосрочная память и реестр скиллов ИИ"
            >
              <Brain size={14} className="text-purple-400" />
              <span>Память & Скиллы</span>
            </button>
          )}
        </div>

        {/* Search Filter Input */}
        {showSearchInput && (
          <div className="pt-1 relative animate-fadeIn">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Поиск по чатам..."
              className="w-full pl-7 pr-2 py-1 rounded flat-input text-[11px] text-white focus:outline-none"
              autoFocus
            />
            <Search size={12} className="absolute left-2 top-2.5 text-slate-400" />
          </div>
        )}
      </div>

      {/* 2. PROJECTS SECTION (SCROLLABLE LIST) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 scrollbar-thin">
        
        {/* PROJECTS SECTION HEADER */}
        <div className="flex items-center justify-between text-slate-400 font-semibold text-[11px] tracking-wider uppercase px-1">
          <span>Проекты (Воркспейсы)</span>

          <div className="flex items-center gap-1 text-slate-400">
            <button
              type="button"
              onClick={() => setShowSearchInput(!showSearchInput)}
              className="p-1 rounded hover:text-white hover:bg-white/10 cursor-pointer"
              title="Фильтр диалогов"
            >
              <Search size={13} />
            </button>
            <button
              type="button"
              onClick={onSelectWorkspace}
              className="p-1 rounded text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
              title="Добавить / открыть воркспейс"
            >
              <FolderPlus size={14} />
            </button>
          </div>
        </div>

        {/* WORKSPACE PROJECT FOLDERS HIERARCHY */}
        {workspaceDirs.map((dir) => {
          const isCurrentActiveWs = workspaceDir && dir.toLowerCase() === workspaceDir.toLowerCase();
          const projSessions = filteredSessions.filter(
            (s) => s.workspace_dir && s.workspace_dir.toLowerCase() === dir.toLowerCase()
          );
          const isCollapsed = collapsedGroups[dir];
          const folderName = getWorkspaceBaseName(dir);

          return (
            <div key={dir} className="space-y-1">
              
              {/* Folder Accordion Header */}
              <div
                onClick={() => toggleGroup(dir)}
                className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-xs font-semibold ${
                  isCurrentActiveWs
                    ? 'bg-white/[0.08] text-white'
                    : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isCollapsed ? <ChevronRight size={13} className="text-slate-500 shrink-0" /> : <ChevronDown size={13} className="text-slate-400 shrink-0" />}
                  <Folder size={14} className={isCurrentActiveWs ? 'text-emerald-400 shrink-0' : 'text-slate-400 shrink-0'} />
                  <span className="truncate">{folderName}</span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateSession(`Чат (${folderName})`, dir);
                  }}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Создать чат в этом проекте"
                >
                  <Plus size={12} />
                </button>
              </div>

              {/* Folder Sessions List */}
              {!isCollapsed && (
                <div className="pl-3 space-y-0.5 border-l border-white/10 ml-3">
                  {projSessions.length > 0 ? (
                    projSessions.map((session) => {
                      const isActive = session.id === currentSessionId;
                      const relTime = formatRelativeTime(session.updated_at);
                      return (
                        <div
                          key={session.id}
                          onClick={() => onSelectSession(session.id)}
                          className={`group p-2 rounded-lg text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                            isActive
                              ? 'bg-white/15 text-white font-medium shadow-sm border border-white/20'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />}
                            <span className="truncate text-xs font-sans">{session.title}</span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {relTime && (
                              <span className="text-[10px] text-slate-500 font-mono group-hover:hidden">
                                {relTime}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => onDeleteSession(session.id, e)}
                              className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/20 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                              title="Удалить сессию"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-[11px] text-slate-500 italic py-1 px-2">Нет чатов в этом проекте</div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* STANDALONE GENERAL CHATS (WITHOUT WORKSPACE) */}
        {standaloneSessions.length > 0 && (
          <div className="space-y-1 pt-1">
            <div
              onClick={() => toggleGroup('standalone')}
              className="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer text-slate-300 font-semibold text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                {collapsedGroups['standalone'] ? <ChevronRight size={13} className="text-slate-500 shrink-0" /> : <ChevronDown size={13} className="text-slate-400 shrink-0" />}
                <Sparkles size={13} className="text-cyan-400 shrink-0" />
                <span>Общие чаты (без проекта)</span>
              </div>
            </div>

            {!collapsedGroups['standalone'] && (
              <div className="pl-3 space-y-0.5 border-l border-white/10 ml-3">
                {standaloneSessions.map((session) => {
                  const isActive = session.id === currentSessionId;
                  const relTime = formatRelativeTime(session.updated_at);
                  return (
                    <div
                      key={session.id}
                      onClick={() => onSelectSession(session.id)}
                      className={`group p-2 rounded-lg text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                        isActive
                          ? 'bg-white/15 text-white font-medium shadow-sm border border-white/20'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />}
                        <span className="truncate text-xs font-sans">{session.title}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {relTime && (
                          <span className="text-[10px] text-slate-500 font-mono group-hover:hidden">
                            {relTime}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => onDeleteSession(session.id, e)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/20 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="Удалить сессию"
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

        {/* WORKSPACE FILE EXPLORER SECTION */}
        {workspaceDir && workspaceTreeNodes.length > 0 && (
          <div className="pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => setShowFileExplorer(!showFileExplorer)}
              className="w-full py-1.5 px-2 rounded-lg hover:bg-white/5 text-slate-300 font-semibold text-[11px] flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FolderTree size={13} className="text-emerald-400" />
                <span>Дерево файлов Workspace</span>
              </div>
              {showFileExplorer ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>

            {showFileExplorer && (
              <div className="mt-1.5 max-h-56 overflow-y-auto border border-white/10 rounded-lg p-1.5 bg-black/40">
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

      {/* 3. BOTTOM SIDEBAR FOOTER (SETTINGS BUTTON ANCHORED AT BOTTOM LEFT) */}
      <div className="p-3 border-t border-white/10 shrink-0 bg-slate-950/60 flex items-center justify-between">
        <button
          type="button"
          onClick={onOpenSettings}
          className="w-full px-2.5 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 flex items-center gap-2.5 transition-colors cursor-pointer text-xs font-semibold"
        >
          <SettingsIcon size={16} className="text-slate-400" />
          <span>Настройки</span>
        </button>
      </div>

    </aside>
  );
};
