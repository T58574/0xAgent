import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Sparkles,
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
import { PERSONA_ASCII_GLYPHS } from '../../utils/asciiAnimations';

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
      showToast(`Личность переключена: ${p.name}`, 'success');
      if (onPersonaChanged) {
        onPersonaChanged(p);
      }
    } catch (err: any) {
      console.error('Failed to switch persona:', err);
      showToast(`Ошибка смены личности: ${err.message || err}`, 'error');
    }
  };

  const getPersonaIcon = (iconName: string) => {
    switch (iconName.toLowerCase()) {
      case 'shield':
        return <Shield size={14} className="text-purple-400" />;
      case 'zap':
        return <Zap size={14} className="text-amber-400" />;
      case 'book':
      case 'bookopen':
        return <BookOpen size={14} className="text-sky-400" />;
      case 'code':
        return <Code size={14} className="text-emerald-400" />;
      case 'layers':
        return <Layers size={14} className="text-cyan-400" />;
      default:
        return <Sparkles size={14} className="text-pink-400" />;
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 rounded-xl transition-all cursor-pointer select-none ${
          compact
            ? 'px-2.5 py-1 bg-white/[0.04] border border-white/10 hover:border-purple-500/40 text-xs text-slate-200'
            : 'px-3 py-1.5 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 hover:border-purple-500/60 shadow-lg text-xs font-semibold text-white'
        }`}
        title="Сменить активную личность (Persona)"
      >
        <span className="shrink-0">
          {activePersona ? getPersonaIcon(activePersona.icon) : <User size={13} />}
        </span>

        <span className="font-semibold text-xs truncate max-w-[120px]">
          {activePersona ? activePersona.name : 'Личность'}
        </span>

        <ChevronDown size={12} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-72 sm:w-80 rounded-2xl glass-panel shadow-2xl z-50 overflow-hidden border border-white/15 animate-fadeIn p-2 space-y-1">
          
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 text-xs font-bold text-slate-200">
            <span className="flex items-center gap-1.5">
              <Sparkles size={13} className="text-purple-400" />
              <span>Выберите личность ИИ</span>
            </span>
            {loading && <RefreshCw size={11} className="animate-spin text-slate-400" />}
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1 p-1 scrollbar-thin">
            {personas.map((p) => {
              const isCurrent = activePersona?.id === p.id;
              const glyph = PERSONA_ASCII_GLYPHS[p.id] || null;

              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectPersona(p)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                    isCurrent
                      ? 'bg-purple-500/20 border-purple-500/50 text-white shadow-md'
                      : 'bg-white/[0.02] border-transparent hover:bg-white/[0.06] hover:border-white/10 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getPersonaIcon(p.icon)}
                      <span className="font-bold text-xs">{p.name}</span>
                    </div>
                    {isCurrent && <Check size={14} className="text-purple-400 shrink-0" />}
                  </div>

                  <p className="text-[11px] text-slate-400 leading-tight">
                    {p.description || 'Пользовательская личность'}
                  </p>

                  {glyph && (
                    <div className="mt-1 p-1 rounded bg-black/40 text-[9px] font-mono text-purple-300/80 leading-none overflow-x-hidden">
                      <pre className="m-0 select-none">{glyph}</pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="px-3 py-1.5 border-t border-white/10 text-[10px] text-slate-500 text-center font-mono">
            Настроить SOUL.md и USER.md можно во вкладке «Личности» в Настройках.
          </div>
        </div>
      )}
    </div>
  );
};
