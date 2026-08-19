import React, { ReactNode } from 'react';
import { InfoTooltip, InfoTooltipProps } from './InfoTooltip';

export interface ParamTextInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  tooltip?: InfoTooltipProps;
  placeholder?: string;
  actionButton?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export const ParamTextInput: React.FC<ParamTextInputProps> = ({
  label,
  value,
  onChange,
  tooltip,
  placeholder,
  actionButton,
  disabled,
  className = '',
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">{label}</label>
          {tooltip && <InfoTooltip {...tooltip} />}
        </div>
        {actionButton}
      </div>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors disabled:opacity-50"
      />
    </div>
  );
};
