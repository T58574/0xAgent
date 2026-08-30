import React from 'react';

export interface SettingItemRowProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  badges?: React.ReactNode;
  description?: React.ReactNode;
  actionSlot?: React.ReactNode;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}

export const SettingItemRow: React.FC<SettingItemRowProps> = ({
  icon,
  title,
  badges,
  description,
  actionSlot,
  onClick,
  selected = false,
  className = '',
}) => {
  return (
    <div
      onClick={onClick}
      className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm ${
        onClick ? 'cursor-pointer select-none' : ''
      } ${
        selected
          ? 'bg-[var(--theme-accent)]/10 border-[var(--theme-accent)]/50 ring-1 ring-[var(--theme-accent)]/30'
          : 'bg-[var(--theme-card-bg)] border-[var(--theme-border)] hover:bg-[var(--theme-border-subtle)]'
      } ${className}`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {icon && <div className="shrink-0 mt-0.5">{icon}</div>}
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {typeof title === 'string' ? (
              <span className="text-xs font-bold text-[var(--theme-text)]">{title}</span>
            ) : (
              title
            )}
            {badges}
          </div>
          {description && (
            <div className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed line-clamp-2">
              {description}
            </div>
          )}
        </div>
      </div>

      {actionSlot && (
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {actionSlot}
        </div>
      )}
    </div>
  );
};
