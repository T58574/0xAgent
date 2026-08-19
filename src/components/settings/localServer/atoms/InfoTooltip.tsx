import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

export interface InfoTooltipProps {
  title: string;
  text: string;
  benefit?: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ title, text, benefit }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="relative inline-block ml-1 align-middle"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-0.5 rounded-full text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-colors cursor-pointer"
        title="Справка"
      >
        <HelpCircle size={13} />
      </button>

      {isOpen && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-64 p-3 rounded-2xl bento-card bg-[var(--theme-panel-solid)] border border-[var(--theme-border)] shadow-2xl backdrop-blur-2xl text-left animate-fadeIn pointer-events-none">
          <div className="text-xs font-bold text-[var(--theme-text)] mb-1 flex items-center gap-1.5">
            <span>{title}</span>
          </div>
          <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed mb-1.5">{text}</p>
          {benefit && (
            <div className="pt-1.5 border-t border-[var(--theme-border)] text-[10px] font-semibold text-[var(--theme-accent)] flex items-center gap-1">
              <span>✦ Эффект:</span>
              <span>{benefit}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
