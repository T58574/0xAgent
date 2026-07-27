import React from 'react';
import { Check } from 'lucide-react';

interface ThemesTabProps {
  activeTheme: string;
  onSelectTheme: (theme: 'obsidian' | 'cyber' | 'graphite' | 'matrix') => void;
}

export const ThemesTab: React.FC<ThemesTabProps> = ({
  activeTheme,
  onSelectTheme,
}) => {
  const themes = [
    {
      id: 'obsidian',
      name: 'Obsidian Glass',
      desc: 'Темный графитовый фон с благородным изумрудным акцентом',
      bg: '#090d16',
      panel: '#0f172a',
      accent: '#10b981',
      border: 'rgba(255, 255, 255, 0.08)',
    },
    {
      id: 'cyber',
      name: 'Cyber Midnight',
      desc: 'Глубокий сине-черный стекломорфизм с неоновым цианом',
      bg: '#080e1a',
      panel: '#0f172a',
      accent: '#06b6d4',
      border: 'rgba(56, 189, 248, 0.15)',
    },
    {
      id: 'graphite',
      name: 'Graphite Brutal',
      desc: 'Чистый монохромный цинк с кристально-белым акцентом',
      bg: '#09090b',
      panel: '#18181b',
      accent: '#e4e4e7',
      border: 'rgba(255, 255, 255, 0.12)',
    },
    {
      id: 'matrix',
      name: 'Emerald Matrix',
      desc: 'Темно-угольный стекломорфизм с мятным свечением',
      bg: '#06120e',
      panel: '#062016',
      accent: '#34d399',
      border: 'rgba(52, 211, 153, 0.15)',
    },
  ];

  return (
    <div className="space-y-4 font-sans text-slate-100 max-w-4xl">
      <div>
        <h3 className="text-sm font-semibold text-slate-200">Темы оформления</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Выберите одну из 4 премиальных тем с матовым стекломорфизмом и минимальными скруглениями
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
        {themes.map((t) => {
          const isSelected = (activeTheme || 'obsidian') === t.id;
          return (
            <div
              key={t.id}
              onClick={() => onSelectTheme(t.id as any)}
              className={`p-4 rounded-md border cursor-pointer transition-all ${
                isSelected
                  ? 'border-[var(--theme-accent,#10b981)] bg-white/[0.04] shadow-lg'
                  : 'border-[var(--theme-border)] bg-white/[0.015] hover:border-white/20 hover:bg-white/[0.03]'
              }`}
            >
              {/* Card Top */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-white/20"
                    style={{ backgroundColor: t.accent }}
                  />
                  <span className="text-xs font-semibold text-slate-200">{t.name}</span>
                </div>
                {isSelected && (
                  <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    <Check size={11} />
                    <span>Активно</span>
                  </div>
                )}
              </div>

              {/* Preview Bar */}
              <div
                className="h-14 rounded-md border p-2 flex items-center justify-between overflow-hidden relative mb-2"
                style={{ backgroundColor: t.bg, borderColor: t.border }}
              >
                <div
                  className="px-2.5 py-1 rounded text-[10px] font-mono border"
                  style={{ backgroundColor: t.panel, borderColor: t.border, color: '#94a3b8' }}
                >
                  glass-panel
                </div>
                <div
                  className="px-2 py-0.5 rounded text-[10px] font-medium text-slate-950 font-sans"
                  style={{ backgroundColor: t.accent }}
                >
                  Accent
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-normal">{t.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
