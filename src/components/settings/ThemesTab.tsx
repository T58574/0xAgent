import React from 'react';
import { Palette, Check } from 'lucide-react';
import { AppTheme } from '../../types';
import { useI18n } from '../../i18n';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { SettingsHeader, SettingsSection } from './common';

interface ThemesTabProps {
  activeTheme: string;
  onSelectTheme: (theme: AppTheme) => void;
}

export const ThemesTab: React.FC<ThemesTabProps> = ({
  activeTheme,
  onSelectTheme,
}) => {
  const { t } = useI18n();
  const currentThemeId =
    activeTheme === 'light' || activeTheme === 'cloud_dancer' ? 'light' : 'graphite';

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
    <div className="w-full space-y-6 font-sans text-[var(--theme-text)]">
      {/* 1. Standard Top Header */}
      <SettingsHeader
        title={t.settings.themes.title}
        subtitle={t.settings.themes.subtitle}
        icon={<Palette size={18} />}
      />

      {/* 2. Theme Presets Grid */}
      <SettingsSection
        title={t.settings.themes.selectTheme}
        badge="Theme System"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {themes.map((themeItem) => {
            const isSelected = currentThemeId === themeItem.id;
            return (
              <Card
                key={themeItem.id}
                variant="interactive"
                selected={isSelected}
                onClick={() => onSelectTheme(themeItem.id)}
                className="flex flex-col justify-between space-y-4"
              >
                {/* Header info */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-sm shrink-0"
                        style={{ backgroundColor: themeItem.accent }}
                      />
                      <span className="text-sm font-bold text-[var(--theme-text)]">
                        {themeItem.name}
                      </span>
                      <Badge variant="neutral" size="xs">
                        {themeItem.badge}
                      </Badge>
                    </div>

                    {isSelected && (
                      <Badge variant="accent" size="xs" icon={<Check size={11} />}>
                        {t.settings.themes.activeBadge}
                      </Badge>
                    )}
                  </div>

                  {/* Visual Palette Preview Container */}
                  <div
                    className="h-24 rounded-xl border p-3 flex flex-col justify-between overflow-hidden relative mb-3 shadow-inner"
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

                  <p className="text-xs text-[var(--theme-text-muted)] leading-relaxed">
                    {themeItem.desc}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      </SettingsSection>
    </div>
  );
};
