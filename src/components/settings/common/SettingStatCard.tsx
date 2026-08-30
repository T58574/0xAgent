import React from 'react';

export interface SettingStatCardProps {
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const SettingStatCard: React.FC<SettingStatCardProps> = ({
  label,
  value,
  sublabel,
  icon,
  className = '',
}) => {
  return (
    <div
      className={`p-3.5 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] flex flex-col shadow-xs ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase font-bold text-[var(--theme-text-muted)] tracking-wider">
          {label}
        </span>
        {icon && <span className="text-[var(--theme-text-muted)]">{icon}</span>}
      </div>

      <div className="text-base sm:text-lg font-bold text-[var(--theme-text)] font-mono mt-1">
        {value}
      </div>

      {sublabel && (
        <span className="text-[10px] text-[var(--theme-text-muted)] mt-0.5 leading-tight">
          {sublabel}
        </span>
      )}
    </div>
  );
};
