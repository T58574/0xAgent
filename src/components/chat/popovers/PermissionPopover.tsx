import React from 'react';
import { Shield, Check } from 'lucide-react';
import { PermissionPreset } from '../../../types';

interface PermissionPopoverProps {
  permissionPreset: PermissionPreset;
  onSelectPreset: (preset: PermissionPreset) => void;
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
}) => {
  return (
    <div className="absolute bottom-full mb-3 left-48 sm:left-64 w-76 bento-card p-1.5 shadow-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-2xl z-50 animate-fadeIn rounded-2xl">
      <div className="px-3 py-1.5 text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider border-b border-[var(--theme-border)] mb-1 flex items-center justify-between">
        <span className="font-bold text-[var(--theme-text)]">Безопасность (DeepSeek Presets)</span>
        <Shield size={12} className="opacity-60" />
      </div>
      <div className="space-y-1">
        {PRESETS.map((preset) => {
          const isActive = permissionPreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPreset(preset.id as PermissionPreset)}
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
  );
};
