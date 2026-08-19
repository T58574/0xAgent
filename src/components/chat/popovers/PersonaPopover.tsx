import React from 'react';
import { User } from 'lucide-react';
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
    <div className="absolute bottom-full mb-3 left-2 w-64 bento-card p-1.5 shadow-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 backdrop-blur-2xl z-50 animate-fadeIn rounded-2xl">
      <div className="px-3 py-1.5 text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider border-b border-[var(--theme-border)] mb-1 font-bold text-[var(--theme-text)]">
        Персона
      </div>
      <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-thin">
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
  );
};
