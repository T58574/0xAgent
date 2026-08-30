import React from 'react';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  id?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  className = '',
  id,
}) => {
  const isSm = size === 'sm';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!disabled) onChange(!checked);
    }
  };

  const switchElement = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      onKeyDown={handleKeyDown}
      className={`relative inline-flex items-center rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)]/50 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 border ${
        isSm ? 'w-8 h-4.5 p-0.5' : 'w-10 h-5.5 p-0.5'
      } ${
        checked
          ? 'bg-[var(--theme-accent)]/20 border-[var(--theme-accent)]/60'
          : 'bg-[var(--theme-input-bg)] border-[var(--theme-border)]'
      }`}
    >
      <span
        className={`inline-block rounded-full transition-transform duration-200 shadow-sm ${
          isSm ? 'w-3.5 h-3.5' : 'w-4 h-4'
        } ${
          checked
            ? `${isSm ? 'translate-x-3.5' : 'translate-x-4.5'} bg-[var(--theme-text)]`
            : 'translate-x-0 bg-[var(--theme-text-muted)]'
        }`}
      />
    </button>
  );

  if (!label && !description) {
    return <div className={`inline-flex items-center ${className}`}>{switchElement}</div>;
  }

  return (
    <div
      onClick={() => !disabled && onChange(!checked)}
      className={`flex items-start justify-between gap-3 cursor-pointer select-none ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      } ${className}`}
    >
      <div className="space-y-0.5 pr-2">
        {label && <div className="text-xs font-semibold text-[var(--theme-text)]">{label}</div>}
        {description && (
          <div className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed">{description}</div>
        )}
      </div>
      {switchElement}
    </div>
  );
};
