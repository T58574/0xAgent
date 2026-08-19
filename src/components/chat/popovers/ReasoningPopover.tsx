import React from 'react';
import { Sparkles, Check } from 'lucide-react';
import { ReasoningEffortLevel } from '../../../types';

interface ReasoningPopoverProps {
  reasoningEffort: ReasoningEffortLevel;
  recommendedEffort: ReasoningEffortLevel;
  supportsReasoning: boolean;
  onSelectEffort: (effort: ReasoningEffortLevel) => void;
}

export const ReasoningPopover: React.FC<ReasoningPopoverProps> = ({
  reasoningEffort,
  recommendedEffort,
  supportsReasoning,
  onSelectEffort,
}) => {
  const items = [
    {
      id: 'auto',
      title: `Авто (Рекомендовано: ${recommendedEffort.toUpperCase()})`,
      desc: supportsReasoning
        ? `Авто-подбор под модель (${recommendedEffort.toUpperCase()})`
        : 'Модель без глубокого CoT (прямой ответ)',
    },
    { id: 'off', title: 'Отключено (Off)', desc: 'Прямой быстрый ответ без генерации мыслей <think>' },
    { id: 'low', title: 'Низкая (Low)', desc: 'Лаконичный ход мыслей, экономия токенов и времени' },
    { id: 'medium', title: 'Средняя (Medium)', desc: 'Сбалансированное мышление (Gemma 4 / Gemini standard)' },
    { id: 'high', title: 'Высокая (High)', desc: 'Глубокий анализ задач и алгоритмов (DeepSeek-R1 standard)' },
    { id: 'xhigh', title: 'Максимальная (X-High)', desc: 'Максимальная глубина рассуждений (Qwen 3.8 default)' },
  ];

  return (
    <div className="absolute bottom-full mb-3 left-64 sm:left-80 w-80 bento-card p-1.5 shadow-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-xl z-50 animate-fadeIn rounded-2xl">
      <div className="px-3 py-1.5 text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider border-b border-[var(--theme-border)] mb-1 flex items-center justify-between">
        <span className="font-bold text-[var(--theme-text)]">Степень рассуждений &lt;think&gt;</span>
        <Sparkles size={12} className="opacity-60 text-sky-400" />
      </div>
      <div className="space-y-1">
        {items.map((item) => {
          const isActive = reasoningEffort === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectEffort(item.id as ReasoningEffortLevel)}
              className={`w-full flex items-start justify-between p-2.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] font-bold shadow-sm'
                  : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border border-transparent'
              }`}
            >
              <div className="min-w-0 pr-2">
                <div className="font-bold text-xs">{item.title}</div>
                <div
                  className={`text-[10px] leading-tight ${
                    isActive ? 'opacity-80' : 'text-[var(--theme-text-muted)]'
                  }`}
                >
                  {item.desc}
                </div>
              </div>
              {isActive && (
                <Check size={14} className="text-[var(--theme-accent-text)] shrink-0 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
