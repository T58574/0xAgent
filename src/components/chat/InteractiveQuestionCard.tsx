import React, { useState } from 'react';
import { AskUserQuestionItem, AskUserQuestionAnswerItem } from '../../types';
import { Check, Send, HelpCircle } from 'lucide-react';

interface InteractiveQuestionCardProps {
  toolCallId: string;
  questions: AskUserQuestionItem[];
  onSubmitAnswers: (answers: AskUserQuestionAnswerItem[]) => void;
  disabled?: boolean;
}

export const InteractiveQuestionCard: React.FC<InteractiveQuestionCardProps> = ({
  toolCallId: _toolCallId,
  questions,
  onSubmitAnswers,
  disabled = false,
}) => {
  // State: questionId -> selected labels
  const [selectedMap, setSelectedMap] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    for (const q of questions) {
      initial[q.id] = [];
    }
    return initial;
  });

  // State: questionId -> custom write-in text
  const [customMap, setCustomMap] = useState<Record<string, string>>({});

  const handleToggleOption = (qId: string, label: string, multiSelect?: boolean) => {
    if (disabled) return;
    setSelectedMap((prev) => {
      const current = prev[qId] || [];
      if (multiSelect) {
        if (current.includes(label)) {
          return { ...prev, [qId]: current.filter((l) => l !== label) };
        } else {
          return { ...prev, [qId]: [...current, label] };
        }
      } else {
        // Single select toggles or replaces
        return { ...prev, [qId]: current.includes(label) ? [] : [label] };
      }
    });
  };

  const handleCustomChange = (qId: string, val: string) => {
    if (disabled) return;
    setCustomMap((prev) => ({ ...prev, [qId]: val }));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (disabled) return;

    const answers: AskUserQuestionAnswerItem[] = questions.map((q) => ({
      id: q.id,
      selected: selectedMap[q.id] || [],
      custom: customMap[q.id]?.trim() || undefined,
    }));

    onSubmitAnswers(answers);
  };

  const handlePlanAction = (qId: string, approveLabel: string, isApprove: boolean) => {
    if (disabled) return;
    const answers: AskUserQuestionAnswerItem[] = [
      {
        id: qId,
        selected: isApprove ? [approveLabel] : ['Decline Plan'],
        custom: isApprove ? undefined : customMap[qId]?.trim() || 'Declined by user',
      },
    ];
    onSubmitAnswers(answers);
  };

  return (
    <div className="w-full my-3 p-4 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-2xl shadow-2xl animate-fadeIn text-xs font-sans select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--theme-border)]/50">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-mono font-semibold text-[var(--theme-text)] border border-white/10">
            :: ВОПРОС АГЕНТА
          </span>
          <span className="text-[11px] text-[var(--theme-text-muted)]">
            {disabled ? 'Вопрос завершен' : 'Агенту требуется ваше уточнение для продолжения задачи'}
          </span>
        </div>
        {disabled && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
            [OK] ОТВЕЧЕНО
          </span>
        )}
      </div>

      {/* Question Items */}
      <div className="space-y-4 pt-3">
        {questions.map((q) => {
          const isPlanReview = q.intent?.kind === 'plan-review';
          const selected = selectedMap[q.id] || [];

          return (
            <div key={q.id} className="space-y-2">
              {q.header && (
                <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--theme-text-muted)] font-bold">
                  {q.header}
                </div>
              )}

              <div className="text-xs font-medium text-[var(--theme-text)] flex items-start gap-1.5">
                <HelpCircle size={14} className="text-[var(--theme-text-muted)] shrink-0 mt-0.5" />
                <span>{q.question}</span>
              </div>

              {q.detail && (
                <div className="p-2.5 rounded-xl bg-black/20 border border-[var(--theme-border)]/40 text-[11px] text-[var(--theme-text-muted)] leading-relaxed whitespace-pre-wrap font-mono">
                  {q.detail}
                </div>
              )}

              {/* Options */}
              {q.options && q.options.length > 0 && !isPlanReview && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {q.options.map((opt, optIdx) => {
                    const isChecked = selected.includes(opt.label);
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => handleToggleOption(q.id, opt.label, q.multiSelect)}
                        disabled={disabled}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                          isChecked
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-[var(--theme-text)] shadow-sm'
                            : 'bg-white/5 border-white/10 hover:bg-white/10 text-[var(--theme-text)]'
                        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div
                          className={`w-4 h-4 rounded mt-0.5 shrink-0 flex items-center justify-center border transition-colors ${
                            isChecked
                              ? 'bg-emerald-500 border-emerald-400 text-black'
                              : 'border-white/30 bg-black/30'
                          } ${!q.multiSelect && 'rounded-full'}`}
                        >
                          {isChecked && <Check size={11} strokeWidth={3} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-xs leading-tight">{opt.label}</div>
                          {opt.description && (
                            <div className="text-[10px] text-[var(--theme-text-muted)] mt-0.5 leading-snug">
                              {opt.description}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Plan Review Intent Quick Buttons */}
              {isPlanReview && q.intent && (
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handlePlanAction(q.id, q.intent!.approve, true)}
                    disabled={disabled}
                    className="flex-1 py-2 px-4 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-medium text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                  >
                    <Check size={14} />
                    <span>{q.intent.approve || 'Утвердить план и продолжить'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePlanAction(q.id, q.intent!.approve, false)}
                    disabled={disabled}
                    className="py-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 font-medium text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    <span>Отклонить</span>
                  </button>
                </div>
              )}

              {/* Custom Free Text Input */}
              {!isPlanReview && (
                <div className="pt-1">
                  <input
                    type="text"
                    placeholder="Или напишите свой вариант ответа..."
                    value={customMap[q.id] || ''}
                    onChange={(e) => handleCustomChange(q.id, e.target.value)}
                    disabled={disabled}
                    className="w-full px-3 py-1.5 rounded-xl bg-black/30 border border-[var(--theme-border)] text-xs text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] focus:outline-none focus:border-white/40 transition-colors"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit Button */}
      {!questions.some((q) => q.intent?.kind === 'plan-review') && (
        <div className="mt-4 pt-3 border-t border-[var(--theme-border)]/50 flex justify-end">
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={disabled}
            className="px-4 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-[var(--theme-text)] border border-white/20 font-medium text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            <Send size={12} />
            <span>Отправить ответ</span>
          </button>
        </div>
      )}
    </div>
  );
};
