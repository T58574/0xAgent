import React from 'react';
import { User, X } from 'lucide-react';
import { PersonaMetadata } from '../../../types';

interface PersonaPopoverProps {
  personas: PersonaMetadata[];
  activePersonaId: string;
  onSelectPersona: (id: string) => void;
  onClose: () => void;
}

export const PersonaPopover: React.FC<PersonaPopoverProps> = ({
  personas,
  activePersonaId,
  onSelectPersona,
  onClose,
}) => {
  if (personas.length === 0) return null;

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs sm:hidden animate-fadeIn"
        onClick={onClose}
      />

      <div className="fixed inset-x-3 bottom-20 sm:absolute sm:inset-auto sm:bottom-full sm:mb-3 sm:left-2 w-auto sm:w-64 max-w-[calc(100vw-24px)] bento-card p-1.5 shadow-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-2xl z-50 animate-fadeIn rounded-2xl">
        <div className="px-3 py-1.5 text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider border-b border-[var(--theme-border)] mb-1 font-bold text-[var(--theme-text)] flex items-center justify-between">
          <span>Персона</span>
          <button
            type="button"
            onClick={onClose}
            className="sm:hidden p-1 rounded-md text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]"
          >
            <X size={12} />
          </button>
        </div>
        <div className="max-h-56 sm:max-h-48 overflow-y-auto space-y-1 scrollbar-thin">
          {personas.map((p) => {
            const isActive = p.id === activePersonaId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelectPersona(p.id);
                  onClose();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] font-bold shadow-sm'
                    : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] border border-transparent'
                }`}
              >
                <User
                  size={14}
                  className={isActive ? 'text-[var(--theme-accent-text)]' : 'text-[var(--theme-text-muted)]'}
                />
                <span className="truncate">{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
