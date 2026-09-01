import React, { useEffect, useCallback } from 'react';
import {
  FolderGit2,
  Calendar,
  Clock,
  Layers,
  Rocket,
  RotateCcw,
} from 'lucide-react';
import { sounds } from '../../services/soundEffects';
import { useI18n } from '../../i18n';

interface VeronicaActionStripProps {
  onSelectAction: (actionText: string) => void;
  onOpenTaskModal: () => void;
  agentStatus: 'idle' | 'thinking' | 'waiting_approval' | 'executing_tool';
  disabled?: boolean;
}

export const VeronicaActionStrip: React.FC<VeronicaActionStripProps> = React.memo(({
  onSelectAction,
  onOpenTaskModal,
  agentStatus,
  disabled = false,
}) => {
  const { language } = useI18n();
  const isBusy = agentStatus !== 'idle';

  const actions = [
    {
      id: 'projects',
      label: language === 'ru' ? '📁 Проекты' : '📁 Projects',
      icon: FolderGit2,
      prompt: 'Покажи список проектов',
      keyHint: 'Alt+1',
    },
    {
      id: 'today',
      label: language === 'ru' ? '📊 Сводка за сегодня' : '📊 Today Digest',
      icon: Calendar,
      prompt: 'Что сделано за сегодня?',
      keyHint: 'Alt+2',
    },
    {
      id: 'yesterday',
      label: language === 'ru' ? '📈 Сводка за вчера' : '📈 Yesterday Digest',
      icon: Clock,
      prompt: 'Что сделано за вчера?',
      keyHint: 'Alt+3',
    },
    {
      id: 'tasks',
      label: language === 'ru' ? '⚡ Активные задачи' : '⚡ Active Tasks',
      icon: Layers,
      prompt: '/tasks',
      keyHint: 'Alt+4',
    },
    {
      id: 'spawn',
      label: language === 'ru' ? '🚀 Поставить задачу' : '🚀 Launch Task',
      icon: Rocket,
      action: 'custom_modal',
      keyHint: 'Alt+5',
    },
    {
      id: 'reset',
      label: language === 'ru' ? '🔄 Новая сессия' : '🔄 New Session',
      icon: RotateCcw,
      prompt: '/reset',
      keyHint: 'Alt+6',
    },
  ];

  const handleTrigger = useCallback(
    (item: (typeof actions)[0]) => {
      if (disabled || isBusy) return;
      sounds.playChipClick();
      if (item.action === 'custom_modal') {
        onOpenTaskModal();
      } else if (item.prompt) {
        onSelectAction(item.prompt);
      }
    },
    [disabled, isBusy, onOpenTaskModal, onSelectAction]
  );

  // Global hotkeys Alt+1..6
  useEffect(() => {
    if (disabled || isBusy) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const num = parseInt(e.key, 10);
        if (!isNaN(num) && num >= 1 && num <= actions.length) {
          e.preventDefault();
          const target = actions[num - 1];
          if (target) {
            handleTrigger(target);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, isBusy, handleTrigger, actions]);

  if (isBusy) return null;

  return (
    <div
      className="w-full pb-1.5 px-0.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth animate-fadeIn select-none"
      role="group"
      aria-label="Veronica Orchestrator Quick Actions"
    >
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 font-bold px-1.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 mr-0.5">
          Veronica
        </span>

        {actions.map((item) => {
          const Icon = item.icon;
          const isModal = item.action === 'custom_modal';
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTrigger(item)}
              className={`group shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-sans transition-all duration-150 cursor-pointer shadow-xs whitespace-nowrap border ${
                isModal
                  ? 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20 hover:from-blue-500/30 hover:to-indigo-500/30 border-blue-500/40 text-blue-300 font-semibold'
                  : 'bg-[var(--theme-card-bg)] hover:bg-[var(--theme-border-subtle)] border-[var(--theme-border)] hover:border-[var(--theme-accent)]/50 text-[var(--theme-text)]'
              }`}
              title={`${item.label} (${item.keyHint})`}
            >
              <Icon size={12} className={isModal ? 'text-blue-400' : 'text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text)]'} />
              <span className="font-medium">{item.label}</span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-[var(--theme-panel)] text-[var(--theme-text-muted)] border border-[var(--theme-border)] select-none">
                {item.keyHint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

VeronicaActionStrip.displayName = 'VeronicaActionStrip';
