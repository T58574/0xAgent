import React from 'react';
import { InfoTooltip, InfoTooltipProps } from './InfoTooltip';
import { Toggle } from '../../../ui/Toggle';

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
      className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all select-none ${
        value
          ? 'border-[var(--theme-accent)]/50 bg-[var(--theme-card-bg)] shadow-xs ring-1 ring-[var(--theme-accent)]/20'
          : 'border-[var(--theme-border)] bg-[var(--theme-input-bg)] hover:border-[var(--theme-text-muted)]'
      }`}
    >
      <div className="space-y-0.5 pr-2 min-w-0">
        <div className="flex items-center">
          <span className="text-xs font-bold text-[var(--theme-text)] truncate">{label}</span>
          {tooltip && <InfoTooltip {...tooltip} />}
        </div>
        <p className="text-[11px] text-[var(--theme-text-muted)] line-clamp-1">{sub}</p>
      </div>

      <Toggle checked={value} onChange={onToggle} size="sm" />
    </div>
  );
};
