import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Check,
  ChevronDown,
  RefreshCw,
  Shield,
  Zap,
  BookOpen,
  Code,
  Layers,
} from 'lucide-react';
import { PersonaMetadata } from '../../types';
import * as api from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface PersonaChatSelectorProps {
  activePersonaId?: string | null;
  onPersonaChanged?: (persona: PersonaMetadata) => void;
  compact?: boolean;
}

export const PersonaChatSelector: React.FC<PersonaChatSelectorProps> = ({
  activePersonaId: activePersonaIdProp,
  onPersonaChanged,
  compact = false,
}) => {
  const { showToast } = useToast();
  const [personas, setPersonas] = useState<PersonaMetadata[]>([]);
  const [activePersona, setActivePersona] = useState<PersonaMetadata | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchPersonas = async () => {
    setLoading(true);
    try {
      const list = await api.get_personas();
      setPersonas(list);
      const active = list.find((p) => (activePersonaIdProp ? p.id === activePersonaIdProp : p.is_active)) || list[0];
      if (active) {
        setActivePersona(active);
      }
    } catch (err) {
      console.error('Failed to fetch personas in chat selector:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPersonas();
  }, [activePersonaIdProp]);

  // Outside click listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelectPersona = async (p: PersonaMetadata) => {
    try {
      await api.activate_persona(p.id);
      setActivePersona(p);
      setIsOpen(false);
      showToast(`Персона: ${p.name}`, 'success');
      if (onPersonaChanged) {
        onPersonaChanged(p);
      }
    } catch (err: any) {
      console.error('Failed to switch persona:', err);
      showToast(`Ошибка смены личности: ${err.message || err}`, 'error');
    }
  };

  const getPersonaIcon = (iconName: string) => {
    switch (iconName?.toLowerCase()) {
      case 'shield':
        return <Shield size={13} className="text-[var(--theme-text-muted)]" />;
      case 'zap':
        return <Zap size={13} className="text-[var(--theme-text-muted)]" />;
      case 'book':
      case 'bookopen':
        return <BookOpen size={13} className="text-[var(--theme-text-muted)]" />;
      case 'code':
        return <Code size={13} className="text-[var(--theme-text-muted)]" />;
      case 'layers':
        return <Layers size={13} className="text-[var(--theme-text-muted)]" />;
      default:
        return <User size={13} className="text-[var(--theme-text-muted)]" />;
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 rounded-lg transition-all cursor-pointer select-none bento-card text-xs ${
          compact
            ? 'px-2.5 py-1 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
            : 'px-2.5 py-1 text-[var(--theme-text)] font-medium'
        }`}
        title="Сменить персону"
      >
        <span className="shrink-0">
          {activePersona ? getPersonaIcon(activePersona.icon) : <User size={13} className="text-[var(--theme-text-muted)]" />}
        </span>

        <span className="font-medium text-xs truncate max-w-[120px] text-[var(--theme-text)]">
          {activePersona ? activePersona.name : 'Персона'}
        </span>

        <ChevronDown size={12} className={`text-[var(--theme-text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-72 sm:w-80 rounded-xl bento-card shadow-2xl z-50 overflow-hidden border border-[var(--theme-border)] bg-[var(--theme-panel)]/95 p-2 space-y-1 animate-fadeIn">
          
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--theme-border)] text-xs font-medium text-[var(--theme-text)]">
            <span className="flex items-center gap-1.5">
              <User size={13} className="text-[var(--theme-text-muted)]" />
              <span>Выбор персоны</span>
            </span>
            {loading && <RefreshCw size={11} className="animate-spin text-[var(--theme-text-muted)]" />}
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1 p-1 scrollbar-thin">
            {personas.map((p) => {
              const isSelected = activePersona?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectPersona(p)}
                  className={`p-2 rounded-lg cursor-pointer transition-colors flex items-start justify-between gap-2 border ${
                    isSelected
                      ? 'bg-white/10 border-[var(--theme-border)] text-[var(--theme-text)]'
                      : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div className="mt-0.5 shrink-0 p-1 rounded-md bg-black/40">
                      {getPersonaIcon(p.icon)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-[var(--theme-text)] truncate">{p.name}</span>
                        {p.is_active && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-white/10 font-mono">
                            active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--theme-text-muted)] line-clamp-1 mt-0.5">
                        {p.description || 'Пользовательская персона ИИ'}
                      </p>
                    </div>
                  </div>

                  {isSelected && (
                    <Check size={14} className="text-[var(--theme-text)] shrink-0 mt-1" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
