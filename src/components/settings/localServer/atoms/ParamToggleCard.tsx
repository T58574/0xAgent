import React from 'react';
import { InfoTooltip, InfoTooltipProps } from './InfoTooltip';

export interface ParamToggleCardProps {
  label: string;
  sub: string;
  value: boolean;
  onToggle: () => void;
  tooltip?: InfoTooltipProps;
}

export const ParamToggleCard: React.FC<ParamToggleCardProps> = ({
  label,
  sub,
  value,
  onToggle,
  tooltip,
}) => {
  return (
    <div
      onClick={onToggle}
      className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
        value
          ? 'border-[var(--theme-accent)] bg-[var(--theme-card-bg)] shadow-sm'
          : 'border-[var(--theme-border)] bg-[var(--theme-input-bg)] hover:border-[var(--theme-text-muted)]'
      }`}
    >
      <div className="space-y-0.5 pr-2">
        <div className="flex items-center">
          <span className="text-[11px] font-bold text-[var(--theme-text)]">{label}</span>
          {tooltip && <InfoTooltip {...tooltip} />}
        </div>
        <p className="text-[10px] text-[var(--theme-text-muted)] line-clamp-1">{sub}</p>
      </div>

      <div
        className={`w-8 h-4.5 rounded-full p-0.5 flex items-center transition-colors shrink-0 ${
          value ? 'bg-[var(--theme-accent)]' : 'bg-zinc-300 dark:bg-zinc-700'
        }`}
      >
        <div
          className={`w-3.5 h-3.5 rounded-full transition-transform ${
            value ? 'translate-x-3.5 bg-[var(--theme-accent-text)]' : 'translate-x-0 bg-white'
          }`}
        />
      </div>
    </div>
  );
};
