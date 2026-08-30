import React from 'react';

export interface SettingsHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actionSlot?: React.ReactNode;
  className?: string;
}

export const SettingsHeader: React.FC<SettingsHeaderProps> = ({
  title,
  subtitle,
  icon,
  actionSlot,
  className = '',
}) => {
  return (
    <div
      className={`flex items-center justify-between pb-3 border-b border-[var(--theme-border)] gap-4 select-none ${className}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {icon && <span className="text-[var(--theme-text-muted)] shrink-0">{icon}</span>}
          <h1 className="text-base md:text-lg font-bold text-[var(--theme-text)] truncate">{title}</h1>
        </div>
        {subtitle && (
          <p className="text-xs text-[var(--theme-text-muted)] mt-0.5 leading-relaxed">{subtitle}</p>
        )}
      </div>

      {actionSlot && <div className="flex items-center gap-2 shrink-0">{actionSlot}</div>}
    </div>
  );
};
