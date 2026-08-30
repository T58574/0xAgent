import React from 'react';

export type CardVariant = 'default' | 'recessed' | 'interactive' | 'solid';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  selected?: boolean;
  padded?: boolean;
}

const variantStyles: Record<CardVariant, string> = {
  default:
    'rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card-bg)]',
  recessed:
    'rounded-xl border border-[var(--theme-border)] bg-[var(--theme-input-bg)]',
  interactive:
    'rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card-bg)] hover:bg-[var(--theme-border-subtle)] hover:border-[var(--theme-text-muted)] cursor-pointer transition-all select-none',
  solid:
    'rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      selected = false,
      padded = true,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const paddingClass = padded ? (variant === 'recessed' ? 'p-3.5' : 'p-5') : '';
    const selectedClass = selected
      ? 'border-[var(--theme-accent)] ring-1 ring-[var(--theme-accent)]/40 bg-[var(--theme-accent)]/5 shadow-md'
      : '';

    return (
      <div
        ref={ref}
        className={`${variantStyles[variant]} ${paddingClass} ${selectedClass} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
