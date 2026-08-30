import React from 'react';
import { Check, X } from 'lucide-react';
import { PermissionPreset } from '../../../types';
import { useI18n } from '../../../i18n';

interface PermissionPopoverProps {
  permissionPreset: PermissionPreset;
  onSelectPreset: (preset: PermissionPreset) => void;
  onClose?: () => void;
}

export const PermissionPopover: React.FC<PermissionPopoverProps> = ({
  permissionPreset,
  onSelectPreset,
  onClose,
}) => {
  const { language } = useI18n();

  const presets = [
    {
      id: 'prompt',
      title: language === 'ru' ? 'Частичная автоматизация' : 'Partial Automation',
      desc: language === 'ru'
        ? 'Авто-одобрение чтения, поиска и памяти. Запись и команды требуют подтверждения.'
        : 'Auto-run read, search, and memory. Writes and shell commands require approval.',
    },
    {
      id: 'unrestricted',
      title: language === 'ru' ? 'Полная автоматизация' : 'Full Automation',
      desc: language === 'ru'
        ? 'Автономное выполнение всех действий, включая запись и терминал, под фоновой защитой.'
        : 'Autonomous execution of all actions including writes and shell commands under guard protection.',
    },
  ] as const;

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
          <span className="font-bold text-[var(--theme-text)]">
            {language === 'ru' ? 'Режим безопасности' : 'Security Mode'}
          </span>
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
        <div className="space-y-1">
          {presets.map((preset) => {
            const isActive = permissionPreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  onSelectPreset(preset.id as PermissionPreset);
                  onClose?.();
                }}
                className={`w-full flex items-start justify-between p-2.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                  isActive
                    ? 'session-item-active text-[var(--theme-text)] font-semibold border border-[var(--theme-border)] shadow-xs'
                    : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border border-transparent'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div className="font-semibold text-xs text-[var(--theme-text)]">{preset.title}</div>
                  <div className="text-[10px] leading-tight text-[var(--theme-text-muted)] mt-0.5">
                    {preset.desc}
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
