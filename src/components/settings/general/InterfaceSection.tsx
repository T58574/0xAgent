import React from 'react';
import { Globe, Check, ExternalLink } from 'lucide-react';
import { AppTheme } from '../../../types';
import { useI18n } from '../../../i18n';
import { Button } from '../../ui/Button';
import { Toggle } from '../../ui/Toggle';
import { Card } from '../../ui/Card';
import { SettingsSection } from '../common';

export interface InterfaceSectionProps {
  currentThemeId: string;
  onSelectTheme?: (theme: AppTheme) => void;
  onLanguageSelect?: (lang: 'en' | 'ru') => void;
  reasoningEnabled: boolean;
  setReasoningEnabled: (val: boolean) => void;
  autoSaveHistory: boolean;
  setAutoSaveHistory: (val: boolean) => void;
  soundNotifications: boolean;
  setSoundNotifications: (val: boolean) => void;
  compactChat: boolean;
  setCompactChat: (val: boolean) => void;
  onOpenMemorySkills?: () => void;
}

export const InterfaceSection: React.FC<InterfaceSectionProps> = ({
  currentThemeId,
  onSelectTheme,
  onLanguageSelect,
  reasoningEnabled,
  setReasoningEnabled,
  autoSaveHistory,
  setAutoSaveHistory,
  soundNotifications,
  setSoundNotifications,
  compactChat,
  setCompactChat,
  onOpenMemorySkills,
}) => {
  const { t, language, setLanguage } = useI18n();

  return (
    <div className="space-y-6">
      <SettingsSection
        title={t.settings.general.themeTitle}
        description={t.settings.general.themeDesc}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card variant="default" className="p-4 space-y-3 rounded-2xl">
            <span className="text-xs font-semibold text-[var(--theme-text-muted)] uppercase tracking-wider block">
              {t.settings.general.themeTitle}
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onSelectTheme?.('graphite')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer select-none ${
                  currentThemeId === 'graphite'
                    ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]/15 text-[var(--theme-text)] shadow-xs font-bold ring-1 ring-[var(--theme-accent)]/30'
                    : 'border-[var(--theme-border)] bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#09090b] border border-white/30" />
                <span>{t.settings.themes.graphiteName}</span>
                {currentThemeId === 'graphite' && <Check size={13} className="text-[var(--theme-accent)]" />}
              </button>

              <button
                type="button"
                onClick={() => onSelectTheme?.('light')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer select-none ${
                  currentThemeId === 'light'
                    ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]/15 text-[var(--theme-text)] shadow-xs font-bold ring-1 ring-[var(--theme-accent)]/30'
                    : 'border-[var(--theme-border)] bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#f8fafc] border border-black/30" />
                <span>{t.settings.themes.lightName}</span>
                {currentThemeId === 'light' && <Check size={13} className="text-[var(--theme-accent)]" />}
              </button>
            </div>
          </Card>

          <Card variant="default" className="p-4 space-y-3 rounded-2xl">
            <span className="text-xs font-semibold text-[var(--theme-text-muted)] uppercase tracking-wider block">
              {t.settings.general.languageTitle}
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setLanguage('en');
                  onLanguageSelect?.('en');
                }}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer select-none ${
                  language === 'en'
                    ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]/15 text-[var(--theme-text)] shadow-xs font-bold ring-1 ring-[var(--theme-accent)]/30'
                    : 'border-[var(--theme-border)] bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                }`}
              >
                <Globe size={13} />
                <span>{t.settings.general.langEn}</span>
                {language === 'en' && <Check size={13} className="text-[var(--theme-accent)]" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setLanguage('ru');
                  onLanguageSelect?.('ru');
                }}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer select-none ${
                  language === 'ru'
                    ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]/15 text-[var(--theme-text)] shadow-xs font-bold ring-1 ring-[var(--theme-accent)]/30'
                    : 'border-[var(--theme-border)] bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                }`}
              >
                <Globe size={13} />
                <span>{t.settings.general.langRu}</span>
                {language === 'ru' && <Check size={13} className="text-[var(--theme-accent)]" />}
              </button>
            </div>
          </Card>
        </div>
      </SettingsSection>

      <SettingsSection
        title={t.settings.general.behaviorTitle}
        description={t.settings.general.subtitle}
      >
        <Card variant="default" className="p-0 overflow-hidden divide-y divide-[var(--theme-border)] rounded-2xl">
          <div className="flex items-center justify-between p-4 sm:px-5">
            <div className="space-y-0.5 min-w-0 pr-4">
              <div className="text-xs font-semibold text-[var(--theme-text)]">
                {t.settings.general.reasoningTitle}
              </div>
              <div className="text-[11.5px] text-[var(--theme-text-muted)] leading-relaxed">
                {t.settings.general.reasoningDesc}
              </div>
            </div>
            <Toggle
              checked={reasoningEnabled}
              onChange={() => setReasoningEnabled(!reasoningEnabled)}
              size="sm"
            />
          </div>

          <div className="flex items-center justify-between p-4 sm:px-5">
            <div className="space-y-0.5 min-w-0 pr-4">
              <div className="text-xs font-semibold text-[var(--theme-text)]">
                {t.settings.general.autoSaveTitle}
              </div>
              <div className="text-[11.5px] text-[var(--theme-text-muted)] leading-relaxed">
                {t.settings.general.autoSaveDesc}
              </div>
            </div>
            <Toggle
              checked={autoSaveHistory}
              onChange={() => setAutoSaveHistory(!autoSaveHistory)}
              size="sm"
            />
          </div>

          <div className="flex items-center justify-between p-4 sm:px-5">
            <div className="space-y-0.5 min-w-0 pr-4">
              <div className="text-xs font-semibold text-[var(--theme-text)]">
                {t.settings.general.soundTitle}
              </div>
              <div className="text-[11.5px] text-[var(--theme-text-muted)] leading-relaxed">
                {t.settings.general.soundDesc}
              </div>
            </div>
            <Toggle
              checked={soundNotifications}
              onChange={() => setSoundNotifications(!soundNotifications)}
              size="sm"
            />
          </div>

          <div className="flex items-center justify-between p-4 sm:px-5">
            <div className="space-y-0.5 min-w-0 pr-4">
              <div className="text-xs font-semibold text-[var(--theme-text)]">
                {t.settings.general.compactTitle}
              </div>
              <div className="text-[11.5px] text-[var(--theme-text-muted)] leading-relaxed">
                {t.settings.general.compactDesc}
              </div>
            </div>
            <Toggle
              checked={compactChat}
              onChange={() => setCompactChat(!compactChat)}
              size="sm"
            />
          </div>
        </Card>
      </SettingsSection>

      {onOpenMemorySkills && (
        <SettingsSection title={t.nav.memorySkills}>
          <Card variant="default" className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl">
            <div className="space-y-1 min-w-0 pr-3">
              <h4 className="text-xs font-bold text-[var(--theme-text)]">
                {t.nav.memorySkills} & AGY Skills
              </h4>
              <p className="text-[11.5px] text-[var(--theme-text-muted)] leading-relaxed">
                {t.settings.general.memorySkillsDesc}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenMemorySkills}
              icon={<ExternalLink size={13} />}
              className="shrink-0"
            >
              {t.settings.general.openSkillsHubBtn}
            </Button>
          </Card>
        </SettingsSection>
      )}
    </div>
  );
};