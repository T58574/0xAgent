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
  badge,
  disabled = false,
  className = '',
}) => {
  return (
    <div
      onClick={() => !disabled && onToggle()}
      className={`p-3.5 rounded-xl flex items-center justify-between cursor-pointer transition-all border select-none ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      } ${
        active
          ? 'border-[var(--theme-border)] bg-[var(--theme-card-bg)]'
          : 'border-[var(--theme-border)] bg-[var(--theme-input-bg)] opacity-80 hover:opacity-100 hover:border-[var(--theme-text-muted)]'
      } ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0 pr-3">
        {icon && (
          <div className="text-[var(--theme-text-muted)] shrink-0">
            {icon}
          </div>
        )}

        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-[var(--theme-text)] truncate">{title}</span>
            {badge && (
              <Badge variant="neutral" size="xs">
                {badge}
              </Badge>
            )}
          </div>
          {desc && (
            <div className="text-[11px] text-[var(--theme-text-muted)] leading-tight">{desc}</div>
          )}
        </div>
      </div>

      <Toggle checked={active} onChange={onToggle} disabled={disabled} size="sm" />
    </div>
  );
};

