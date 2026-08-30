import React from 'react';

export type BadgeVariant = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
export type BadgeSize = 'xs' | 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  icon?: React.ReactNode;
  mono?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  neutral:
    'bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] border-[var(--theme-border)]',
  accent:
    'bg-[var(--theme-accent)]/15 text-[var(--theme-text)] border-[var(--theme-accent)]/30 font-bold',
  success:
    'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  warning:
    'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  danger:
    'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
  info:
    'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
};

const dotColors: Record<BadgeVariant, string> = {
  neutral: 'bg-[var(--theme-text-muted)]',
  accent: 'bg-[var(--theme-accent)]',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-sky-500',
};

const sizeStyles: Record<BadgeSize, string> = {
  xs: 'text-[9px] px-1.5 py-0.5 rounded-md gap-1 font-semibold',
  sm: 'text-[10px] px-2 py-0.5 rounded-lg gap-1.5 font-semibold',
  md: 'text-xs px-2.5 py-1 rounded-xl gap-2 font-bold',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'xs',
  dot = false,
  icon,
  mono = true,
  className = '',
  children,
  ...props
}) => {
  return (
    <span
      className={`inline-flex items-center border select-none shrink-0 ${
        mono ? 'font-mono' : 'font-sans'
      } ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]} shrink-0`} />}
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      {children && <span>{children}</span>}
    </span>
  );
};
