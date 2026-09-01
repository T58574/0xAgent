import React, { useEffect, useCallback } from 'react';
import {
  FolderGit2,
  Calendar,
  Clock,
  Layers,
  Rocket,
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
      label: language === 'ru' ? 'Проекты' : 'Projects',
      icon: FolderGit2,
      prompt: 'Покажи список проектов',
      keyHint: 'Alt+1',
    },
    {
      id: 'today',
      label: language === 'ru' ? 'Сегодня' : 'Today',
      icon: Calendar,
      prompt: 'Что сделано за сегодня?',
      keyHint: 'Alt+2',
    },
    {
      id: 'yesterday',
      label: language === 'ru' ? 'Вчера' : 'Yesterday',
      icon: Clock,
      prompt: 'Что сделано за вчера?',
      keyHint: 'Alt+3',
    },
    {
      id: 'tasks',
      label: language === 'ru' ? 'Задачи' : 'Tasks',
      icon: Layers,
      prompt: '/tasks',
      keyHint: 'Alt+4',
    },
    {
      id: 'spawn',
      label: language === 'ru' ? 'Поставить задачу' : 'Launch Task',
      icon: Rocket,
      action: 'custom_modal',
      keyHint: 'Alt+5',
      primary: true,
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

  // Global hotkeys Alt+1..5
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
      className="w-full pb-1.5 px-0.5 flex items-center flex-wrap gap-1.5 animate-fadeIn select-none font-sans"
      role="group"
      aria-label="Veronica Actions"
    >
      {actions.map((item) => {
        const Icon = item.icon;
        const isPrimary = item.primary;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleTrigger(item)}
            className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-sans transition-all duration-150 cursor-pointer shadow-xs whitespace-nowrap active:scale-[0.98] border ${
              isPrimary
                ? 'bg-[var(--theme-card-bg)] hover:bg-[var(--theme-border-subtle)] border-[var(--theme-border)] hover:border-[var(--theme-accent)] text-[var(--theme-text)] font-semibold ring-1 ring-[var(--theme-border)]'
                : 'bg-[var(--theme-card-bg)]/80 hover:bg-[var(--theme-border-subtle)] border-[var(--theme-border)] hover:border-[var(--theme-accent)]/50 text-[var(--theme-text)] font-medium'
            }`}
            title={`${item.label} (${item.keyHint})`}
          >
            <Icon
              size={12}
              className="text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text)] shrink-0 transition-colors"
            />
            <span className="text-xs">{item.label}</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-[var(--theme-panel)] text-[var(--theme-text-muted)] border border-[var(--theme-border)] group-hover:text-[var(--theme-text)] transition-colors select-none">
              {item.keyHint}
            </span>
          </button>
        );
      })}
    </div>
  );
});

VeronicaActionStrip.displayName = 'VeronicaActionStrip';



