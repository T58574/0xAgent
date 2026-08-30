import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'accent';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  active?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--theme-text)] text-[var(--theme-bg)] hover:opacity-90 active:scale-[0.98] border border-transparent shadow-sm font-bold',
  secondary:
    'bg-[var(--theme-card-bg)] hover:bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-[var(--theme-text)] shadow-xs hover:border-[var(--theme-text-muted)] font-semibold',
  ghost:
    'bg-transparent hover:bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] border border-transparent font-medium',
  danger:
    'bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 dark:text-rose-400 border border-rose-500/30 hover:border-rose-500/50 font-semibold',
  outline:
    'bg-transparent hover:bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-[var(--theme-text)] font-semibold',
  accent:
    'bg-[var(--theme-accent)]/15 border border-[var(--theme-accent)]/40 text-[var(--theme-text)] font-bold shadow-xs hover:bg-[var(--theme-accent)]/25',
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: 'px-2 py-0.5 text-[10px] rounded-lg gap-1 min-h-[22px]',
  sm: 'px-2.5 py-1 text-xs rounded-xl gap-1.5 min-h-[28px]',
  md: 'px-3.5 py-1.5 text-xs rounded-xl gap-2 min-h-[34px]',
  lg: 'px-4.5 py-2.5 text-sm rounded-2xl gap-2.5 min-h-[42px]',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      icon,
      iconPosition = 'left',
      loading = false,
      active = false,
      disabled,
      className = '',
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const computedVariant = active ? 'accent' : variant;
    const baseClasses =
      'inline-flex items-center justify-center transition-all select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)]/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none shrink-0';

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={`${baseClasses} ${variantStyles[computedVariant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {loading ? (
          <Loader2 size={size === 'lg' ? 16 : 13} className="animate-spin shrink-0" />
        ) : (
          icon && iconPosition === 'left' && <span className="shrink-0 flex items-center">{icon}</span>
        )}

        {children && <span>{children}</span>}

        {!loading && icon && iconPosition === 'right' && (
          <span className="shrink-0 flex items-center">{icon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
