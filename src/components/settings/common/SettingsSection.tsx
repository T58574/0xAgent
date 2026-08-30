import React from 'react';

export interface SettingsSectionProps {
  title?: string;
  badge?: string;
  actionSlot?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  badge,
  actionSlot,
  description,
  children,
  className = '',
}) => {
  return (
    <section className={`space-y-3 font-sans ${className}`}>
      {(title || actionSlot || badge) && (
        <div className="flex items-center justify-between gap-3 select-none">
          <div className="flex items-center gap-2">
            {title && (
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text-muted)]">
                {title}
              </h2>
            )}
            {badge && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] font-semibold">
                {badge}
              </span>
            )}
          </div>

          {actionSlot && <div className="flex items-center gap-2 shrink-0">{actionSlot}</div>}
        </div>
      )}

      {description && (
        <p className="text-xs text-[var(--theme-text-muted)] leading-relaxed">{description}</p>
      )}

      {children}
    </section>
  );
};
