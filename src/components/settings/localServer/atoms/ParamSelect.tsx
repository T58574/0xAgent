import React from 'react';
import { InfoTooltip, InfoTooltipProps } from './InfoTooltip';

export interface ParamSelectOption {
  value: string;
  label: string;
}

export interface ParamSelectProps {
  label: string;
  value: string;
  options: ParamSelectOption[];
  onChange: (val: string) => void;
  tooltip?: InfoTooltipProps;
  className?: string;
  compact?: boolean;
}

export const ParamSelect: React.FC<ParamSelectProps> = ({
  label,
  value,
  options,
  onChange,
  tooltip,
  className = '',
  compact = false,
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center">
        <label className={`${compact ? 'text-[10px]' : 'text-[11px]'} font-semibold text-[var(--theme-text-muted)]`}>
          {label}
        </label>
        {tooltip && <InfoTooltip {...tooltip} />}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'} rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none cursor-pointer transition-colors`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};
