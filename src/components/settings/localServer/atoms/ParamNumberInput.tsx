import React from 'react';
import { InfoTooltip, InfoTooltipProps } from './InfoTooltip';

export interface ParamNumberInputProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  tooltip?: InfoTooltipProps;
  badge?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const ParamNumberInput: React.FC<ParamNumberInputProps> = ({
  label,
  value,
  onChange,
  tooltip,
  badge,
  min,
  max,
  step,
  placeholder,
  disabled,
  className = '',
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex justify-between items-center text-xs">
        <div className="flex items-center">
          <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">{label}</label>
          {tooltip && <InfoTooltip {...tooltip} />}
        </div>
        {badge !== undefined && (
          <span className="text-[10px] font-mono text-[var(--theme-text-muted)] font-bold">{badge}</span>
        )}
      </div>
      <input
        type="number"
        value={Number.isNaN(value) ? '' : value}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors disabled:opacity-50"
      />
    </div>
  );
};
