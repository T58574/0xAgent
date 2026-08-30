import React, { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, Circle, Clock } from 'lucide-react';
import { TodoItem } from '../../types';
import { useI18n } from '../../i18n';

interface PlanProgressStripProps {
  todos?: TodoItem[];
}

export const PlanProgressStrip: React.FC<PlanProgressStripProps> = ({ todos = [] }) => {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!todos || todos.length === 0) return null;

  const total = todos.length;
  const completed = todos.filter((t) => t.status === 'completed').length;
  const inProgress = todos.find((t) => t.status === 'in_progress');
  const pending = todos.filter((t) => t.status === 'pending').length;
  const percent = Math.round((completed / total) * 100);

  return (
    <div className="w-full mb-3 select-none animate-fadeIn font-sans text-xs">
      <div className="bento-card p-2.5 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/90 backdrop-blur-2xl shadow-xl transition-all">
        {/* Header Strip */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between gap-2 cursor-pointer group"
        >
          {/* Left Title & Status */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="px-2 py-0.5 rounded-md bg-[var(--theme-border-subtle)] text-[10px] font-mono font-semibold text-[var(--theme-text)] shrink-0 border border-[var(--theme-border)]">
              :: {t.chat.planProgress.toUpperCase()} [{completed}/{total}]
            </span>

            {inProgress ? (
              <div className="flex items-center gap-1.5 min-w-0 text-[var(--theme-text)]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="truncate font-medium text-xs">{inProgress.content}</span>
              </div>
            ) : completed === total ? (
              <span className="text-xs text-emerald-400 font-medium">{t.chat.planComplete}</span>
            ) : (
              <span className="text-xs text-[var(--theme-text-muted)]">{t.chat.planProgress} ({pending} {t.tools.pendingApproval})</span>
            )}
          </div>

          {/* Right Progress bar & expand button */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-1.5 w-20 sm:w-28">
              <div className="flex-1 bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-400 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-[var(--theme-text-muted)]">{percent}%</span>
            </div>

            <button
              type="button"
              className="p-1 rounded-lg hover:bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text)] transition-colors cursor-pointer"
              aria-label={isExpanded ? t.tools.hideDetails : t.tools.viewDetails}
            >
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {/* Expanded Checklist */}
        {isExpanded && (
          <div className="mt-2.5 pt-2.5 border-t border-[var(--theme-border)]/50 space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
            {todos.map((todo, idx) => {
              const isDone = todo.status === 'completed';
              const isCurrent = todo.status === 'in_progress';

              return (
                <div
                  key={idx}
                  className={`flex items-start gap-2 px-2 py-1.5 rounded-xl text-xs transition-colors ${
                    isCurrent
                      ? 'bg-emerald-500/10 text-[var(--theme-text)] border border-emerald-500/20 font-medium'
                      : isDone
                      ? 'text-[var(--theme-text-muted)] line-through opacity-70'
                      : 'text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {isDone ? (
                      <CheckCircle2 size={13} className="text-emerald-400" />
                    ) : isCurrent ? (
                      <Circle size={13} className="text-emerald-400 animate-spin" />
                    ) : (
                      <Clock size={13} className="text-[var(--theme-text-muted)] opacity-80" />
                    )}
                  </div>

                  <span className="flex-1 leading-tight break-words">{todo.content}</span>

                  <span className="text-[10px] font-mono shrink-0 uppercase opacity-75">
                    {isDone ? '[OK]' : isCurrent ? '[>]' : '[..]'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
