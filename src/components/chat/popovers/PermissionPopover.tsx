import React from 'react';
import { Shield, Check, X } from 'lucide-react';
import { PermissionPreset } from '../../../types';

interface PermissionPopoverProps {
  permissionPreset: PermissionPreset;
  onSelectPreset: (preset: PermissionPreset) => void;
  onClose?: () => void;
}

const PRESETS = [
  { id: 'readonly', title: 'Только чтение', desc: 'Запрещены любые изменения файлов и запуск команд' },
  { id: 'workspace-write', title: 'Песочница проекта', desc: 'Разрешено менять файлы только внутри проекта' },
  { id: 'prompt', title: 'Подтверждение', desc: 'Запрашивать одобрение на опасные и модифицирующие действия' },
  { id: 'unrestricted', title: 'Полная автономия', desc: 'Автоматическое выполнение всех действий' },
] as const;

export const PermissionPopover: React.FC<PermissionPopoverProps> = ({
  permissionPreset,
  onSelectPreset,
  onClose,
}) => {
  return (
    <>
      {/* Mobile Backdrop */}
      {onClose && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs sm:hidden animate-fadeIn"
          onClick={onClose}
        />
      )}

      <div className="fixed inset-x-3 bottom-20 sm:absolute sm:inset-auto sm:bottom-full sm:mb-3 sm:right-2 w-auto sm:w-76 max-w-[calc(100vw-24px)] bento-card p-1.5 shadow-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-2xl z-50 animate-fadeIn rounded-2xl">
        <div className="px-3 py-1.5 text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider border-b border-[var(--theme-border)] mb-1 flex items-center justify-between">
          <span className="font-bold text-[var(--theme-text)]">Безопасность (Permission Presets)</span>
          <div className="flex items-center gap-1.5">
            <Shield size={12} className="opacity-60" />
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="sm:hidden p-1 rounded-md text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
        <div className="space-y-1">
          {PRESETS.map((preset) => {
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
                    ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] font-bold shadow-sm'
                    : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border border-transparent'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div className="font-bold text-xs">{preset.title}</div>
                  <div
                    className={`text-[10px] leading-tight ${
                      isActive ? 'opacity-80' : 'text-[var(--theme-text-muted)]'
                    }`}
                  >
                    {preset.desc}
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
    </>
  );
};
