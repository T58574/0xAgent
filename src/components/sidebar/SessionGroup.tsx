import React from 'react';
import { ChevronRight, ChevronDown, Plus, Trash2, GitBranch } from 'lucide-react';
import { ChatSession } from '../../types';
import { formatRelativeTime } from '../../utils/helpers';
import { useI18n } from '../../i18n';

interface SessionGroupProps {
  title: string;
  count?: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onCreateSession?: () => void;
  isCurrentActiveWs?: boolean;
}

export const SessionGroup: React.FC<SessionGroupProps> = ({
  title,
  count,
  isCollapsed,
  onToggleCollapse,
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onCreateSession,
  isCurrentActiveWs,
}) => {
  const { t } = useI18n();

  return (
    <div className="space-y-1 w-full">
      <div
        onClick={onToggleCollapse}
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
          <span className="truncate font-semibold">{title}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {isCurrentActiveWs && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-mono bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)] border border-[var(--theme-border)]">
              <GitBranch size={9} />
              <span>main</span>
            </span>
          )}
          {typeof count === 'number' && (
            <span className="text-[10px] font-mono opacity-60">({count})</span>
          )}
          {onCreateSession && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCreateSession();
              }}
              className="p-1 rounded-lg hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-colors cursor-pointer text-[var(--theme-text-muted)]"
              title={t.sidebar.newChatTooltip}
            >
              <Plus size={12} />
            </button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="relative pl-3.5 ml-2.5 border-l border-[var(--theme-border)]/70 space-y-0.5 mt-1 w-[calc(100%-0.625rem)]">
          {sessions.length > 0 ? (
            sessions.map((session) => {
              const isActive = session.id === currentSessionId;
              const relTime = formatRelativeTime(session.updated_at);
              return (
                <div
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
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
};
