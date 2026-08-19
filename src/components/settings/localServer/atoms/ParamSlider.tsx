import React from 'react';
import { InfoTooltip, InfoTooltipProps } from './InfoTooltip';

export interface ParamSliderProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min: number;
  max: number;
  step?: number;
  tooltip?: InfoTooltipProps;
  valueFormatter?: (val: number) => string;
  presets?: { label: string; value: number }[];
  className?: string;
}

export const ParamSlider: React.FC<ParamSliderProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  tooltip,
  valueFormatter = (v) => String(v),
  presets,
  className = '',
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex justify-between items-center text-xs">
        <div className="flex items-center">
          <label className="font-bold text-xs text-[var(--theme-text)]">{label}</label>
          {tooltip && <InfoTooltip {...tooltip} />}
        </div>
        {presets && presets.length > 0 ? (
          <div className="flex gap-1.5">
            {presets.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => onChange(p.value)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-mono cursor-pointer transition-all border ${
                  value === p.value
                    ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] border-[var(--theme-accent)] font-bold shadow-sm'
                    : 'bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] border-[var(--theme-border)] hover:text-[var(--theme-text)]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-[10px] font-mono text-[var(--theme-text-muted)] font-bold">
            {valueFormatter(value)}
          </span>
        )}
      </div>
      <input
        type="number"
        value={Number.isNaN(value) ? '' : value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
      />
    </div>
  );
};
