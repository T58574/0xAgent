import React from 'react';
import { Check } from 'lucide-react';

export interface SpeedPresetButtonProps {
  title: string;
  subtitle: string;
  active: boolean;
  onClick: () => void;
}

export const SpeedPresetButton: React.FC<SpeedPresetButtonProps> = ({
  title,
  subtitle,
  active,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-2 px-3 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
        active
          ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] shadow-sm border border-[var(--theme-border)] font-bold'
          : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
      }`}
    >
      <div className="flex items-center gap-1">
        <span>{title}</span>
        {active && <Check size={12} className="text-[var(--theme-accent)]" />}
      </div>
      <span className="text-[9px] opacity-70 font-normal">{subtitle}</span>
    </button>
  );
};
