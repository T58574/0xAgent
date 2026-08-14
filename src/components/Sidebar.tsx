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
}) => {
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [searchFilter, setSearchFilter] = useState('');
  const [isHoveringHistory, setIsHoveringHistory] = useState(false);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Collect unique workspace folders
  const allWorkspaceDirsSet = new Set<string>();
  if (workspaceDir) allWorkspaceDirsSet.add(workspaceDir);
  sessions.forEach((s) => {
    if (s.workspace_dir) allWorkspaceDirsSet.add(s.workspace_dir);
  });
  const workspaceDirs = Array.from(allWorkspaceDirsSet);

  // Filter sessions
  const filteredSessions = searchFilter.trim()
    ? sessions.filter((s) => s.title.toLowerCase().includes(searchFilter.toLowerCase()))
    : sessions;

  const standaloneSessions = filteredSessions.filter((s) => !s.workspace_dir);

  if (!isOpen) return null;

  return (
    <aside className="relative w-64 md:w-68 h-full bg-[var(--theme-panel)]/95 border-r border-[var(--theme-border)] flex flex-col justify-between z-20 shrink-0 font-sans text-xs select-none backdrop-blur-2xl text-[var(--theme-text)]">
      
      {/* Outer Edge Middle Collapse Arrow Button */}
      <button
        type="button"
        onClick={onToggleOpen}
        className="absolute -right-3 top-1/2 -translate-y-1/2 z-40 w-6 h-10 rounded-full bg-[var(--theme-panel-solid,#0a0c12)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/15 flex items-center justify-center shadow-2xl transition-all cursor-pointer backdrop-blur-2xl group hover:scale-110"
        title="Свернуть боковое меню"
      >
        <ChevronLeft size={13} className="transition-transform group-hover:-translate-x-0.5" />
      </button>

      {/* 1. TOP QUICK SEARCH BAR & WORKSPACE PICKER */}
      <div className="p-2.5 border-b border-[var(--theme-border)] shrink-0 bg-black/20 flex items-center gap-1.5">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Поиск по диалогам..."
            className="w-full pl-7 pr-2 py-1.5 rounded-lg bg-black/30 border border-[var(--theme-border)] text-xs text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] focus:outline-none focus:border-white/20 transition-all font-sans"
          />
          <Search size={12} className="absolute left-2.5 top-2.5 text-[var(--theme-text-muted)]" />
        </div>

        <button
          type="button"
          onClick={onSelectWorkspace}
          className="p-1.5 rounded-lg bento-card text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:border-[var(--theme-border)] transition-colors cursor-pointer shrink-0"
          title="Открыть рабочую папку"
        >
          <FolderPlus size={14} />
        </button>
      </div>

      {/* 2. CHATS TREE WITH VECTOR CONNECTORS */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-3 min-h-0 scrollbar-thin">
        
        {/* WORKSPACE PROJECT FOLDERS */}
        {workspaceDirs.map((dir) => {
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
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors text-xs font-medium ${
                  isCurrentActiveWs
                    ? 'bg-white/10 border border-[var(--theme-border)] text-[var(--theme-text)]'
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
                  <span className="truncate font-semibold">{folderName}</span>
                </div>

                <div className="flex items-center gap-1">
                  {isCurrentActiveWs && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-mono bg-white/10 text-[var(--theme-text-muted)] border border-[var(--theme-border)]">
                      <GitBranch size={9} />
                      <span>main</span>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateSession(`Чат (${folderName})`, dir);
                    }}
                    className="p-1 rounded-md hover:text-[var(--theme-text)] hover:bg-white/10 transition-colors cursor-pointer text-[var(--theme-text-muted)]"
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
                          onClick={() => onSelectSession(session.id)}
                          className={`relative group px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-all flex items-center justify-between gap-1.5 border before:absolute before:-left-3 before:top-1/2 before:w-2.5 before:h-px before:bg-[var(--theme-border)]/70 ${
                            isActive
                              ? 'bg-white/15 text-[var(--theme-text)] font-semibold border-[var(--theme-border)] shadow-sm'
                              : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <MessageSquare size={12} className="shrink-0 text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text)]" />
                            <span className="truncate">{session.title}</span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {relTime && (
                              <span className="text-[10px] text-[var(--theme-text-muted)] font-mono group-hover:hidden opacity-75">
                                {relTime}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => onDeleteSession(session.id, e)}
                              className="p-1 rounded-md text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
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

        {/* STANDALONE GENERAL CHATS */}
        {standaloneSessions.length > 0 && (
          <div className="space-y-1">
            <div
              onClick={() => toggleGroup('standalone')}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bento-card text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer font-medium text-xs"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {collapsedGroups['standalone'] ? (
                  <ChevronRight size={13} className="shrink-0" />
                ) : (
                  <ChevronDown size={13} className="shrink-0" />
                )}
                <span className="font-semibold">Общие диалоги</span>
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
                      onClick={() => onSelectSession(session.id)}
                      className={`relative group px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-all flex items-center justify-between gap-1.5 border before:absolute before:-left-3 before:top-1/2 before:w-2.5 before:h-px before:bg-[var(--theme-border)]/70 ${
                        isActive
                          ? 'bg-white/15 text-[var(--theme-text)] font-semibold border-[var(--theme-border)] shadow-sm'
                          : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <MessageSquare size={12} className="shrink-0 text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text)]" />
                        <span className="truncate">{session.title}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {relTime && (
                          <span className="text-[10px] text-[var(--theme-text-muted)] font-mono group-hover:hidden opacity-75">
                            {relTime}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => onDeleteSession(session.id, e)}
                          className="p-1 rounded-md text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
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
              className="w-full py-1.5 px-2 rounded-lg bento-card text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] font-medium text-[11px] flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FolderTree size={13} className="text-[var(--theme-text-muted)]" />
                <span>Дерево файлов проекта</span>
              </div>
              {showFileExplorer ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>

            {showFileExplorer && (
              <div className="mt-1.5 max-h-52 overflow-y-auto border border-[var(--theme-border)] rounded-lg p-1.5 bg-black/40">
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

      {/* 3. BOTTOM FOOTER: SESSION HISTORY & ASCII RISING PARTICLES ON HOVER */}
      <div
        onMouseEnter={() => setIsHoveringHistory(true)}
        onMouseLeave={() => setIsHoveringHistory(false)}
        className="p-2.5 border-t border-[var(--theme-border)] shrink-0 bg-black/30 relative overflow-hidden group transition-all"
      >
        {/* Interactive ASCII Particle Canvas (starts on hover, flows bottom to top) */}
        <AsciiParticleFlow isActive={isHoveringHistory} />

        <div className="relative z-10 flex items-center justify-between text-[11px] font-mono text-[var(--theme-text-muted)]">
          <div className="flex items-center gap-2">
            <History size={13} className="text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text)] transition-colors" />
            <span className="group-hover:text-[var(--theme-text)] transition-colors">История сессий</span>
          </div>
          <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-[var(--theme-text)] font-semibold text-[10px] border border-[var(--theme-border)]">
            {sessions.length}
          </span>
        </div>
      </div>

    </aside>
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
