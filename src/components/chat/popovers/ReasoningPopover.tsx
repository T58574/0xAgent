import React from 'react';
import { Check, X } from 'lucide-react';
import { ReasoningEffortLevel } from '../../../types';

interface ReasoningPopoverProps {
  reasoningEffort: ReasoningEffortLevel;
  recommendedEffort: ReasoningEffortLevel;
  supportsReasoning: boolean;
  onSelectEffort: (effort: ReasoningEffortLevel) => void;
  onClose?: () => void;
}

export const ReasoningPopover: React.FC<ReasoningPopoverProps> = ({
  reasoningEffort,
  onSelectEffort,
  onClose,
}) => {
  const items: { id: ReasoningEffortLevel; title: string; desc: string }[] = [
    { id: 'high', title: 'Высокая (High)', desc: 'Глубокий анализ, решение сложных задач и архитектуры' },
    { id: 'medium', title: 'Средняя (Medium)', desc: 'Сбалансированные рассуждения для большинства задач' },
    { id: 'low', title: 'Низкая (Low)', desc: 'Краткий ход мыслей, быстрый ответ' },
    { id: 'off', title: 'Отключено (Off)', desc: 'Прямой ответ без генерации мыслей' },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {onClose && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs sm:hidden animate-fadeIn"
          onClick={onClose}
        />
      )}

      <div className="fixed inset-x-3 bottom-20 sm:absolute sm:inset-auto sm:bottom-full sm:mb-3 sm:right-2 w-auto sm:w-80 max-w-[calc(100vw-24px)] bento-card p-1.5 shadow-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)] z-50 animate-fadeIn rounded-2xl">
        <div className="px-3 py-1.5 text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider border-b border-[var(--theme-border)] mb-1 flex items-center justify-between">
          <span className="font-bold text-[var(--theme-text)]">Степень рассуждений</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="sm:hidden p-1 rounded-md text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <div className="max-h-56 sm:max-h-72 overflow-y-auto space-y-1 scrollbar-thin">
          {items.map((item) => {
            const isActive = reasoningEffort === item.id || (reasoningEffort === 'auto' && item.id === 'high') || (reasoningEffort === 'xhigh' && item.id === 'high');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectEffort(item.id);
                  onClose?.();
                }}
                className={`w-full flex items-start justify-between p-2.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                  isActive
                    ? 'session-item-active text-[var(--theme-text)] font-semibold border border-[var(--theme-border)] shadow-xs'
                    : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border border-transparent'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div className="font-semibold text-xs text-[var(--theme-text)]">{item.title}</div>
                  <div className="text-[10px] leading-tight text-[var(--theme-text-muted)] mt-0.5">
                    {item.desc}
                  </div>
                </div>
                {isActive && (
                  <Check size={14} className="text-[var(--theme-text)] shrink-0 mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
