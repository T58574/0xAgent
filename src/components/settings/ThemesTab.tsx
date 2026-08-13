import React from 'react';
import { AppTheme } from '../../types';
import { MaterialIcon } from '../common/MaterialIcon';

interface ThemesTabProps {
  activeTheme: string;
  onSelectTheme: (theme: AppTheme) => void;
}

export const ThemesTab: React.FC<ThemesTabProps> = ({
  activeTheme,
  onSelectTheme,
}) => {
  const themes: {
    id: AppTheme;
    name: string;
    badge?: string;
    desc: string;
    bg: string;
    panel: string;
    accent: string;
    border: string;
    isLight?: boolean;
  }[] = [
    {
      id: 'obsidian',
      name: 'Obsidian Glass',
      desc: 'Темный OLED-фон с благородным изумрудным акцентом',
      bg: '#050507',
      panel: '#07070a',
      accent: '#10b981',
      border: 'rgba(255, 255, 255, 0.08)',
    },
    {
      id: 'light',
      name: 'Monochrome Studio',
      badge: 'Light',
      desc: 'Чистый минималистичный светлый интерфейс с контрастной графикой',
      bg: '#fafafa',
      panel: '#ffffff',
      accent: '#0f172a',
      border: 'rgba(15, 23, 42, 0.12)',
      isLight: true,
    },
    {
      id: 'cyber',
      name: 'Cyber Midnight',
      desc: 'Глубокий полуночно-синий стекломорфизм с неоновым цианом',
      bg: '#050814',
      panel: '#070c1a',
      accent: '#06b6d4',
      border: 'rgba(56, 189, 248, 0.15)',
    },
    {
      id: 'graphite',
      name: 'Graphite Brutal',
      desc: 'Чистый монохромный цинк с кристально-белым акцентом',
      bg: '#09090b',
      panel: '#121215',
      accent: '#e4e4e7',
      border: 'rgba(255, 255, 255, 0.12)',
    },
    {
      id: 'matrix',
      name: 'Emerald Matrix',
      desc: 'Темно-угольный матричный стекломорфизм с мятным свечением',
      bg: '#04120c',
      panel: '#062016',
      accent: '#34d399',
      border: 'rgba(52, 211, 153, 0.15)',
    },
    {
      id: 'saffron_apricot',
      name: 'Sunlit Saffron',
      badge: 'Summer 2026',
      desc: 'Жаркие солнечные оттенки шафрана, выгоревшего оранжевого и абрикоса (Tom Ford / Dries Van Noten)',
      bg: '#0c0a09',
      panel: '#1c1917',
      accent: '#f59e0b',
      border: 'rgba(245, 158, 11, 0.2)',
    },
    {
      id: 'butter_cream',
      name: 'Butter Cream',
      badge: 'Trend',
      desc: 'Нежное сливочное масло на тёмной природной базе',
      bg: '#0f0e0a',
      panel: '#1a1912',
      accent: '#fef08a',
      border: 'rgba(254, 240, 138, 0.18)',
    },
    {
      id: 'cloud_dancer',
      name: 'Cloud Dancer 2026',
      badge: 'Pantone 2026',
      desc: 'Молочно-белый оттенок с сероватым подтоном — ответ на цифровой шум',
      bg: '#f4f4f5',
      panel: '#ffffff',
      accent: '#3f3f46',
      border: 'rgba(24, 24, 27, 0.12)',
      isLight: true,
    },
    {
      id: 'mint_glacier',
      name: 'Mint Glacier',
      badge: 'Chanel & Prada',
      desc: 'Освежающая мятная пастель, приглушенная версия Tiffany и ледяное желе',
      bg: '#041416',
      panel: '#092327',
      accent: '#2dd4bf',
      border: 'rgba(45, 212, 191, 0.18)',
    },
    {
      id: 'sicilian_tomato',
      name: 'Sicilian Tomato',
      badge: 'Loewe & Chanel',
      desc: 'Сочный и жизнерадостный томатно-красный средиземноморский цвет',
      bg: '#140606',
      panel: '#210a0a',
      accent: '#ef4444',
      border: 'rgba(239, 68, 68, 0.2)',
    },
    {
      id: 'sky_industrial',
      name: 'Sky & Industrial',
      desc: 'Пастельный небесно-голубой оттенок на индустриально-графитовом фоне',
      bg: '#080c14',
      panel: '#0e1626',
      accent: '#38bdf8',
      border: 'rgba(56, 189, 248, 0.18)',
    },
    {
      id: 'terracotta_dust',
      name: 'Terracotta Dust',
      desc: 'Пыльный теплый цвет обожженной глины с розовато-коричневым подтоном',
      bg: '#120b08',
      panel: '#1f140f',
      accent: '#e07a5f',
      border: 'rgba(224, 122, 95, 0.2)',
    },
  ];

  return (
    <div className="space-y-4 font-sans text-theme-text max-w-5xl">
      <div>
        <h3 className="text-sm font-semibold text-theme-text flex items-center gap-2">
          <MaterialIcon name="palette" size={18} className="text-theme-accent" />
          <span>Темы оформления (12 вариантов)</span>
        </h3>
        <p className="text-xs text-theme-muted mt-0.5">
          Выберите тему под настроение: от классических OLED и светлых вариантов до модных трендов 2026 года и летних кутюрных палитр
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
        {themes.map((t) => {
          const isSelected = (activeTheme || 'obsidian') === t.id;
          return (
            <div
              key={t.id}
              onClick={() => onSelectTheme(t.id)}
              className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                isSelected
                  ? 'border-[var(--theme-accent)] bg-white/[0.05] shadow-lg ring-1 ring-[var(--theme-accent)]'
                  : 'border-[var(--theme-border)] bg-white/[0.015] hover:border-white/20 hover:bg-white/[0.04]'
              }`}
            >
              {/* Top Header */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm shrink-0"
                      style={{ backgroundColor: t.accent }}
                    />
                    <span className="text-xs font-semibold text-theme-text">{t.name}</span>
                    {t.badge && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-white/10 text-theme-muted border border-white/10">
                        {t.badge}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <div className="flex items-center gap-1 text-[10px] font-medium text-theme-accent bg-theme-accent/10 px-2 py-0.5 rounded-full border border-theme-accent/30">
                      <MaterialIcon name="check" size={12} />
                      <span>Активно</span>
                    </div>
                  )}
                </div>

                {/* Visual Palette Preview Bar */}
                <div
                  className="h-12 rounded-lg border p-2 flex items-center justify-between overflow-hidden relative mb-2.5 shadow-inner"
                  style={{ backgroundColor: t.bg, borderColor: t.border }}
                >
                  <div
                    className="px-2 py-0.5 rounded text-[10px] font-mono border"
                    style={{
                      backgroundColor: t.panel,
                      borderColor: t.border,
                      color: t.isLight ? '#475569' : '#94a3b8',
                    }}
                  >
                    glass-panel
                  </div>
                  <div
                    className="px-2.5 py-0.5 rounded text-[10px] font-medium font-sans shadow-sm"
                    style={{
                      backgroundColor: t.accent,
                      color: t.isLight ? '#ffffff' : '#020617',
                    }}
                  >
                    Accent
                  </div>
                </div>

                <p className="text-[11px] text-theme-muted leading-relaxed">{t.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
