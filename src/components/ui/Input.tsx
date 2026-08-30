import React, { useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  helperText?: string;
  error?: string;
  prefixIcon?: React.ReactNode;
  suffixIcon?: React.ReactNode;
  mono?: boolean;
  clearable?: boolean;
  onClear?: () => void;
  actionSlot?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      prefixIcon,
      suffixIcon,
      mono = false,
      clearable = false,
      onClear,
      actionSlot,
      type = 'text',
      className = '',
      value,
      onChange,
      disabled,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPasswordField = type === 'password';
    const computedType = isPasswordField ? (showPassword ? 'text' : 'password') : type;

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

          <input
            ref={ref}
            type={computedType}
            value={value}
            onChange={onChange}
            disabled={disabled}
            className={`w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border transition-colors text-xs text-[var(--theme-text)] placeholder-[var(--theme-text-muted)] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
              mono ? 'font-mono' : 'font-sans'
            } ${prefixIcon ? 'pl-9' : ''} ${
              isPasswordField || clearable || suffixIcon ? 'pr-9' : ''
            } ${
              error
                ? 'border-rose-500/60 focus:border-rose-500 ring-1 ring-rose-500/20'
                : 'border-[var(--theme-border)] focus:border-[var(--theme-accent)] focus:ring-1 focus:ring-[var(--theme-accent)]/30'
            } ${className}`}
            {...props}
          />

          {isPasswordField && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-2.5 p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}

          {!isPasswordField && clearable && value && (
            <button
              type="button"
              tabIndex={-1}
              onClick={onClear}
              className="absolute right-2.5 p-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer transition-colors"
              aria-label="Clear input"
            >
              <X size={14} />
            </button>
          )}

          {!isPasswordField && !clearable && suffixIcon && (
            <div className="absolute right-3 flex items-center text-[var(--theme-text-muted)] pointer-events-none shrink-0">
              {suffixIcon}
            </div>
          )}
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

Input.displayName = 'Input';
