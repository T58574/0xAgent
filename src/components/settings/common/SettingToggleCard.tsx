import React from 'react';
import { Toggle } from '../../ui/Toggle';
import { Badge } from '../../ui/Badge';

export interface SettingToggleCardProps {
  icon?: React.ReactNode;
  title: string;
  desc?: string;
  active: boolean;
  onToggle: () => void;
  statusOnText?: string;
  statusOffText?: string;
  badge?: string;
  disabled?: boolean;
  className?: string;
}

export const SettingToggleCard: React.FC<SettingToggleCardProps> = ({
  icon,
  title,
  desc,
  active,
  onToggle,
  statusOnText,
  statusOffText,
  badge,
  disabled = false,
  className = '',
}) => {
  return (
    <div
      onClick={() => !disabled && onToggle()}
      className={`p-4 rounded-2xl bento-card flex items-center justify-between cursor-pointer transition-all border select-none ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      } ${
        active
          ? 'border-[var(--theme-accent)]/50 bg-[var(--theme-card-bg)] shadow-sm ring-1 ring-[var(--theme-accent)]/20'
          : 'border-[var(--theme-border)] bg-[var(--theme-input-bg)] hover:border-[var(--theme-text-muted)]'
      } ${className}`}
    >
      <div className="flex items-center gap-3.5 min-w-0 pr-3">
        {icon && (
          <div
            className={`p-2.5 rounded-xl shrink-0 transition-colors border ${
              active
                ? 'bg-[var(--theme-accent)]/15 border-[var(--theme-accent)]/30 text-[var(--theme-text)]'
                : 'bg-[var(--theme-card-bg)] border-[var(--theme-border)] text-[var(--theme-text-muted)]'
            }`}
          >
            {icon}
          </div>
        )}

        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-[var(--theme-text)] truncate">{title}</span>
            {badge && (
              <Badge variant="neutral" size="xs">
                {badge}
              </Badge>
            )}
            {(statusOnText || statusOffText) && (
              <Badge variant={active ? 'accent' : 'neutral'} size="xs">
                {active ? statusOnText : statusOffText}
              </Badge>
            )}
          </div>
          {desc && (
            <div className="text-[11px] text-[var(--theme-text-muted)] leading-tight">{desc}</div>
          )}
        </div>
      </div>

      <Toggle checked={active} onChange={onToggle} disabled={disabled} size="md" />
    </div>
  );
};
