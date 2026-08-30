import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  sublabel?: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  helperText?: string;
  error?: string;
  prefixIcon?: React.ReactNode;
  options?: SelectOption[];
  mono?: boolean;
  actionSlot?: React.ReactNode;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      helperText,
      error,
      prefixIcon,
      options,
      mono = false,
      actionSlot,
      className = '',
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <div className="w-full space-y-1.5 font-sans">
        {(label || actionSlot) && (
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--theme-text)] select-none">
            {label && <span>{label}</span>}
            {actionSlot && <div>{actionSlot}</div>}
          </div>
        )}

        <div className="relative flex items-center w-full">
          {prefixIcon && (
            <div className="absolute left-3 flex items-center text-[var(--theme-text-muted)] pointer-events-none shrink-0">
              {prefixIcon}
            </div>
          )}

          <select
            ref={ref}
            disabled={disabled}
            className={`w-full px-3 py-2 pr-8 rounded-xl bg-[var(--theme-input-bg)] border transition-colors text-xs text-[var(--theme-text)] focus:outline-none cursor-pointer appearance-none disabled:opacity-50 disabled:cursor-not-allowed ${
              mono ? 'font-mono' : 'font-sans'
            } ${prefixIcon ? 'pl-9' : ''} ${
              error
                ? 'border-rose-500/60 focus:border-rose-500 ring-1 ring-rose-500/20'
                : 'border-[var(--theme-border)] focus:border-[var(--theme-accent)] focus:ring-1 focus:ring-[var(--theme-accent)]/30'
            } ${className}`}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                    className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)] py-1"
                  >
                    {opt.label} {opt.sublabel ? `(${opt.sublabel})` : ''}
                  </option>
                ))
              : children}
          </select>

          <div className="absolute right-2.5 flex items-center text-[var(--theme-text-muted)] pointer-events-none shrink-0">
            <ChevronDown size={14} />
          </div>
        </div>

        {error ? (
          <p className="text-[11px] text-rose-500 font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
