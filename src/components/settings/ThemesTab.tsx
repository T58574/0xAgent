import React from 'react';
import { AppTheme } from '../../types';
import { MaterialIcon } from '../common/MaterialIcon';
import { useI18n } from '../../i18n';

interface ThemesTabProps {
  activeTheme: string;
  onSelectTheme: (theme: AppTheme) => void;
}

export const ThemesTab: React.FC<ThemesTabProps> = ({
  activeTheme,
  onSelectTheme,
}) => {
  const { t } = useI18n();
  const currentThemeId = (activeTheme === 'light' || activeTheme === 'cloud_dancer') ? 'light' : 'graphite';

  const themes: {
    id: AppTheme;
    name: string;
    badge: string;
    desc: string;
    bg: string;
    panel: string;
    accent: string;
    border: string;
    textColor: string;
    isLight: boolean;
  }[] = [
    {
      id: 'graphite',
      name: t.settings.themes.graphiteName,
      badge: 'Dark Default',
      desc: t.settings.themes.graphiteDesc,
      bg: '#09090b',
      panel: '#121216',
      accent: '#f4f4f5',
      border: 'rgba(255, 255, 255, 0.12)',
      textColor: '#f4f4f5',
      isLight: false,
    },
    {
      id: 'light',
      name: t.settings.themes.lightName,
      badge: 'Light Studio',
      desc: t.settings.themes.lightDesc,
      bg: '#f8fafc',
      panel: '#ffffff',
      accent: '#09090b',
      border: 'rgba(15, 23, 42, 0.12)',
      textColor: '#09090b',
      isLight: true,
    },
  ];

  return (
    <div className="space-y-5 font-sans text-theme-text max-w-4xl">
      <div>
        <h3 className="text-sm font-semibold text-theme-text flex items-center gap-2">
          <MaterialIcon name="palette" size={18} className="text-theme-accent" />
          <span>{t.settings.themes.title}</span>
        </h3>
        <p className="text-xs text-theme-muted mt-0.5">
          {t.settings.themes.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
        {themes.map((themeItem) => {
          const isSelected = currentThemeId === themeItem.id;
          return (
            <div
              key={themeItem.id}
              onClick={() => onSelectTheme(themeItem.id)}
              className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between select-none ${
                isSelected
                  ? 'border-[var(--theme-accent)] bg-white/[0.04] shadow-xl ring-2 ring-[var(--theme-accent)]/40'
                  : 'border-[var(--theme-border)] bg-[var(--theme-card-bg)] hover:border-[var(--theme-text-muted)] hover:bg-white/[0.02]'
              }`}
            >
              {/* Top Header */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-4 h-4 rounded-full border border-black/10 shadow-sm shrink-0"
                      style={{ backgroundColor: themeItem.accent }}
                    />
                    <span className="text-sm font-bold text-theme-text">{themeItem.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-white/10 text-theme-muted border border-[var(--theme-border)]">
                      {themeItem.badge}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-theme-text bg-[var(--theme-accent)]/15 px-2.5 py-1 rounded-full border border-[var(--theme-accent)]/30">
                      <MaterialIcon name="check" size={13} />
                      <span>{t.settings.themes.activeBadge}</span>
                    </div>
                  )}
                </div>

                {/* Visual Palette Preview Container */}
                <div
                  className="h-24 rounded-xl border p-3 flex flex-col justify-between overflow-hidden relative mb-3.5 shadow-sm"
                  style={{ backgroundColor: themeItem.bg, borderColor: themeItem.border }}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className="px-2.5 py-1 rounded-md text-[10px] font-mono border"
                      style={{
                        backgroundColor: themeItem.panel,
                        borderColor: themeItem.border,
                        color: themeItem.textColor,
                      }}
                    >
                      {themeItem.name}
                    </div>
                    <div
                      className="px-3 py-1 rounded-md text-[11px] font-semibold font-sans shadow-sm"
                      style={{
                        backgroundColor: themeItem.accent,
                        color: themeItem.isLight ? '#ffffff' : '#09090b',
                      }}
                    >
                      {t.settings.themes.buttonSample}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-16 rounded-full"
                      style={{ backgroundColor: themeItem.isLight ? '#cbd5e1' : '#27272a' }}
                    />
                    <div
                      className="h-2 w-8 rounded-full"
                      style={{ backgroundColor: themeItem.isLight ? '#e2e8f0' : '#3f3f46' }}
                    />
                  </div>
                </div>

                <p className="text-xs text-theme-muted leading-relaxed">{themeItem.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
