import React, { useState, useMemo } from 'react';
import {
  Clock,
  MessageSquare,
  Folder,
  Trash2,
  ArrowRight,
  Search,
  Copy,
  Check,
} from 'lucide-react';
import { ChatSession } from '../../types';
import { Modal } from '../ui/Modal';
import { useI18n } from '../../i18n';
import { getWorkspaceBaseName, formatRelativeTime, exportSessionJson, exportSessionLogAsText } from '../../utils/helpers';
import { useToast } from '../../context/ToastContext';

interface SessionTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
}

export function formatDialogCount(count: number, lang: 'ru' | 'en' = 'ru'): string {
  if (lang === 'en') {
    return `${count} ${count === 1 ? 'conversation' : 'conversations'}`;
  }
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) {
    return `${count} диалогов`;
  }
  if (mod10 === 1) {
    return `${count} диалог`;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return `${count} диалога`;
  }
  return `${count} диалогов`;
}

export const SessionTimelineModal: React.FC<SessionTimelineModalProps> = ({
  isOpen,
  onClose,
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
}) => {
  const { language, t } = useI18n();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.workspace_dir && s.workspace_dir.toLowerCase().includes(q))
    );
  }, [sessions, search]);

  // Group by date period
  const grouped = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const thisWeek = today - 86400000 * 7;

    const groups: {
      label: string;
      items: ChatSession[];
    }[] = [
      { label: language === 'ru' ? 'Сегодня' : 'Today', items: [] },
      { label: language === 'ru' ? 'Вчера' : 'Yesterday', items: [] },
      { label: language === 'ru' ? 'На этой неделе' : 'This Week', items: [] },
      { label: language === 'ru' ? 'Ранее' : 'Older', items: [] },
    ];

    filteredSessions.forEach((s) => {
      const ts = s.updated_at || s.created_at || Date.now();
      if (ts >= today) {
        groups[0].items.push(s);
      } else if (ts >= yesterday) {
        groups[1].items.push(s);
      } else if (ts >= thisWeek) {
        groups[2].items.push(s);
      } else {
        groups[3].items.push(s);
      }
    });

    return groups.filter((g) => g.items.length > 0);
  }, [filteredSessions, language]);

  const handleCopy = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const isAltOrShift = e.altKey || e.shiftKey;
      const text = isAltOrShift ? exportSessionJson(session) : exportSessionLogAsText(session);
      navigator.clipboard.writeText(text);
      setCopiedId(session.id);
      showToast(isAltOrShift ? t.nav.exportSessionJson : t.nav.logsCopied, 'success');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast(t.common.error, 'error');
    }
  };

  const handleSelect = (id: string) => {
    onSelectSession(id);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={language === 'ru' ? 'Хронология сессий' : 'Session Timeline'}
      subtitle={formatDialogCount(sessions.length, language)}
      maxWidth="lg"
    >
      <div className="space-y-4 font-sans select-text">
        {/* Search Bar */}
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--theme-text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.sidebar.searchPlaceholder}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
          />
        </div>

        {/* Timeline Container */}
        {grouped.length === 0 ? (
          <div className="py-12 text-center text-xs text-[var(--theme-text-muted)] space-y-2">
            <MessageSquare size={24} className="mx-auto opacity-30" />
            <p>{t.sidebar.noSessionsFound}</p>
          </div>
        ) : (
          <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
            {grouped.map((group, gIdx) => (
              <div key={gIdx} className="space-y-3">
                {/* Period Badge Header */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--theme-accent)] bg-[var(--theme-card-bg)] px-2.5 py-0.5 rounded-md border border-[var(--theme-border)]">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-[var(--theme-border)]" />
                </div>

                {/* Timeline Items */}
                <div className="relative pl-5 space-y-2.5 border-l-2 border-[var(--theme-border)] ml-2">
                  {group.items.map((session) => {
                    const isSelected = session.id === currentSessionId;
                    const dateObj = new Date(session.updated_at || session.created_at || Date.now());
                    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const wsName = session.workspace_dir ? getWorkspaceBaseName(session.workspace_dir) : null;
                    const msgCount = session.messages?.length || 0;

                    return (
                      <div
                        key={session.id}
                        onClick={() => handleSelect(session.id)}
                        className={`group relative p-3 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--theme-card-bg)] border-[var(--theme-accent)] shadow-md ring-1 ring-[var(--theme-accent)]/40'
                            : 'bg-[var(--theme-input-bg)]/80 hover:bg-[var(--theme-card-bg)] border-[var(--theme-border)] hover:border-[var(--theme-border-subtle)]'
                        }`}
                      >
                        {/* Timeline Node Dot */}
                        <div
                          className={`absolute -left-[27px] top-4 w-3 h-3 rounded-full border-2 transition-all ${
                            isSelected
                              ? 'bg-[var(--theme-accent)] border-[var(--theme-panel-solid)] ring-2 ring-[var(--theme-accent)]/50 scale-110'
                              : 'bg-[var(--theme-panel)] border-[var(--theme-border)] group-hover:border-[var(--theme-accent)]'
                          }`}
                        />

                        {/* Card Header: Title & Time */}
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-bold text-[var(--theme-text)] truncate max-w-[280px] sm:max-w-[380px]">
                              {session.title || t.nav.newChat}
                            </span>
                            {isSelected && (
                              <span className="shrink-0 text-[10px] font-mono font-bold text-[var(--theme-accent)] bg-[var(--theme-accent)]/10 px-1.5 py-0.2 rounded border border-[var(--theme-accent)]/20">
                                {language === 'ru' ? 'Активен' : 'Active'}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-[var(--theme-text-muted)] shrink-0 flex items-center gap-1">
                            <Clock size={11} />
                            {timeStr}
                          </span>
                        </div>

                        {/* Card Meta & Actions */}
                        <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--theme-text-muted)]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-1 font-mono">
                              <MessageSquare size={12} className="text-[var(--theme-text-muted)]" />
                              {msgCount}
                            </span>

                            {wsName && (
                              <span className="flex items-center gap-1 font-mono bg-[var(--theme-panel)] px-2 py-0.5 rounded-md border border-[var(--theme-border)] text-[10px]">
                                <Folder size={11} className="text-[var(--theme-accent)]" />
                                <span className="truncate max-w-[120px]">{wsName}</span>
                              </span>
                            )}

                            <span className="text-[10px] text-[var(--theme-text-muted)] opacity-70">
                              {formatRelativeTime(session.updated_at || session.created_at)}
                            </span>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => handleCopy(session, e)}
                              className="p-1 rounded-lg text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-colors cursor-pointer"
                              title={t.nav.copyLogs}
                            >
                              {copiedId === session.id ? (
                                <Check size={13} className="text-emerald-500" />
                              ) : (
                                <Copy size={13} />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={(e) => onDeleteSession(session.id, e)}
                              className="p-1 rounded-lg text-[var(--theme-text-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title={t.sidebar.deleteSession}
                            >
                              <Trash2 size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSelect(session.id)}
                              className="p-1 rounded-lg text-[var(--theme-accent)] hover:bg-[var(--theme-accent)]/10 transition-colors cursor-pointer"
                              title="Open session"
                            >
                              <ArrowRight size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
