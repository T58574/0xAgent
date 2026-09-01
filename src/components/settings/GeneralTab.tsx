import React, { useState, useEffect, useCallback } from 'react';
import {
  Sliders,
  Globe,
  KeyRound,
  LogOut,
  Copy,
  Check,
  ExternalLink,
  Volume2,
  Palette,
  Mic,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { AppTheme } from '../../types';
import * as api from '../../services/api';
import { useI18n } from '../../i18n';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Toggle } from '../ui/Toggle';
import { Card } from '../ui/Card';
import { SettingsHeader, SettingsSection } from './common';

interface GeneralTabProps {
  onLanguageSelect?: (lang: 'en' | 'ru') => void;
  onOpenMemorySkills?: () => void;
  activeTheme?: string;
  onSelectTheme?: (theme: AppTheme) => void;
  apiUrl: string;
  setApiUrl: (val: string) => void;
  groqApiKey: string;
  setGroqApiKey: (val: string) => void;
  reasoningEnabled: boolean;
  setReasoningEnabled: (val: boolean) => void;
  autoSaveHistory: boolean;
  setAutoSaveHistory: (val: boolean) => void;
  soundNotifications: boolean;
  setSoundNotifications: (val: boolean) => void;
  compactChat: boolean;
  setCompactChat: (val: boolean) => void;
  ttsVoiceEnabled?: boolean;
  setTtsVoiceEnabled?: (val: boolean) => void;
  ttsVoice?: string;
  setTtsVoice?: (val: string) => void;
  ttsRate?: string;
  setTtsRate?: (val: string) => void;
  ttsPlayOnSpeaker?: boolean;
  setTtsPlayOnSpeaker?: (val: boolean) => void;
  ttsPlayInBrowser?: boolean;
  setTtsPlayInBrowser?: (val: boolean) => void;
  wakeWordEnabled?: boolean;
  setWakeWordEnabled?: (val: boolean) => void;
  proactiveCompanionEnabled?: boolean;
  setProactiveCompanionEnabled?: (val: boolean) => void;
}

type GeneralSubtab = 'interface' | 'voice' | 'security';

export const GeneralTab: React.FC<GeneralTabProps> = React.memo(({
  onLanguageSelect,
  onOpenMemorySkills,
  activeTheme = 'graphite',
  onSelectTheme,
  reasoningEnabled,
  setReasoningEnabled,
  autoSaveHistory,
  setAutoSaveHistory,
  soundNotifications,
  setSoundNotifications,
  compactChat,
  setCompactChat,
  ttsVoiceEnabled = true,
  setTtsVoiceEnabled,
  ttsVoice = 'ru-RU-DmitryNeural',
  setTtsVoice,
  ttsRate = '+15%',
  setTtsRate,
  ttsPlayOnSpeaker = true,
  setTtsPlayOnSpeaker,
  ttsPlayInBrowser = true,
  setTtsPlayInBrowser,
  wakeWordEnabled = false,
  setWakeWordEnabled,
  proactiveCompanionEnabled = true,
  setProactiveCompanionEnabled,
}) => {
  const { t, language, setLanguage } = useI18n();

  // Active Sub-Navigation Tab
  const [activeSubtab, setActiveSubtab] = useState<GeneralSubtab>('interface');

  // Network State
  const [lanIp, setLanIp] = useState<string | null>(null);
  const [copiedLan, setCopiedLan] = useState(false);

  // Voice test state
  const [testingVoice, setTestingVoice] = useState(false);

  // Security & Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchLanInfo = useCallback(async () => {
    try {
      const data = await api.get_lan_info();
      if (data?.urls?.[0]) {
        const url = new URL(data.urls[0]);
        setLanIp(url.hostname);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchLanInfo();
  }, [fetchLanInfo]);

  const handleCopyLan = () => {
    if (!lanIp) return;
    const url = `https://${lanIp}:3001`;
    navigator.clipboard.writeText(url);
    setCopiedLan(true);
    setTimeout(() => setCopiedLan(false), 2000);
  };

  const handleTestVoice = async () => {
    if (testingVoice) return;
    setTestingVoice(true);
    try {
      const testPhrase = language === 'ru' ? t.settings.general.voiceTestPhrase : 'Jarvis systems fully operational, sir.';
      await api.speak_text(testPhrase, {
        voice: ttsVoice,
        rate: ttsRate,
        playOnSpeaker: ttsPlayOnSpeaker,
        category: 'greeting',
      });
    } catch (err) {
      console.error('Voice test failed:', err);
    } finally {
      setTestingVoice(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);
    if (newPassword.trim().length < 4) {
      setPasswordStatus({ type: 'error', text: t.settings.general.passwordMinLength });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', text: t.settings.general.passwordMismatch });
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await api.change_password(currentPassword, newPassword.trim());
      if (res.success) {
        setPasswordStatus({ type: 'success', text: t.settings.general.passwordSuccess });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordStatus({ type: 'error', text: res.error || t.settings.general.passwordError });
      }
    } catch (err: any) {
      setPasswordStatus({ type: 'error', text: `${t.common.error}: ${err.message || err}` });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const currentThemeId = activeTheme === 'light' ? 'light' : 'graphite';

  return (
    <div className="w-full space-y-6 pb-10 font-sans text-[var(--theme-text)]">
      {/* 1. Standard Top Header */}
      <SettingsHeader
        title={t.settings.general.title}
        subtitle={t.settings.general.subtitle}
        icon={<Sliders size={18} />}
      />

      {/* 2. Sub-Navigation Tabs Bar (Segmented Pills) */}
      <div className="flex items-center gap-2 border-b border-[var(--theme-border)] pb-3">
        <button
          type="button"
          onClick={() => setActiveSubtab('interface')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
            activeSubtab === 'interface'
              ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] border-[var(--theme-border)] shadow-xs ring-1 ring-[var(--theme-accent)]/30 font-bold'
              : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
          }`}
        >
          <Palette size={14} className={activeSubtab === 'interface' ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-text-muted)]'} />
          <span>{t.settings.general.subtabInterface}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubtab('voice')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
            activeSubtab === 'voice'
              ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] border-[var(--theme-border)] shadow-xs ring-1 ring-[var(--theme-accent)]/30 font-bold'
              : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
          }`}
        >
          <Mic size={14} className={activeSubtab === 'voice' ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-text-muted)]'} />
          <span>{t.settings.general.subtabVoice}</span>
          {ttsVoiceEnabled && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubtab('security')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
            activeSubtab === 'security'
              ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] border-[var(--theme-border)] shadow-xs ring-1 ring-[var(--theme-accent)]/30 font-bold'
              : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
          }`}
        >
          <ShieldCheck size={14} className={activeSubtab === 'security' ? 'text-[var(--theme-accent)]' : 'text-[var(--theme-text-muted)]'} />
          <span>{t.settings.general.subtabSecurity}</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* SUBTAB 1: THEME & INTERFACE                                           */}
      {/* ===================================================================== */}
      {activeSubtab === 'interface' && (
        <div className="space-y-6">
          {/* Theme & Language Switcher */}
          <SettingsSection
            title={t.settings.general.themeTitle}
            description={t.settings.general.themeDesc}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Theme Switcher */}
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

              {/* Language Switcher */}
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

          {/* Behavior & Interface Preferences */}
          <SettingsSection
            title={t.settings.general.behaviorTitle}
            description={t.settings.general.subtitle}
          >
            <Card variant="default" className="p-0 overflow-hidden divide-y divide-[var(--theme-border)] rounded-2xl">
              {/* Row 1: Reasoning */}
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

              {/* Row 2: AutoSave */}
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

              {/* Row 3: Sound */}
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

              {/* Row 4: Compact View */}
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

          {/* Memory Hub & Skills Link */}
          {onOpenMemorySkills && (
            <SettingsSection
              title={t.nav.memorySkills}
            >
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
      )}

      {/* ===================================================================== */}
      {/* SUBTAB 2: VOICE & COMPANION                                           */}
      {/* ===================================================================== */}
      {activeSubtab === 'voice' && (
        <div className="space-y-6">
          <SettingsSection
            title={t.settings.general.jarvisVoiceTitle}
            description="Синтез речи через Microsoft Edge-TTS, голосовая активация и проактивные интеркомы"
          >
            <Card variant="default" className="p-0 overflow-hidden divide-y divide-[var(--theme-border)] rounded-2xl">
              {/* Row 1: Edge-TTS Voice Intercom */}
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 min-w-0 pr-4">
                    <div className="text-xs font-bold text-[var(--theme-text)]">
                      {t.settings.general.edgeTtsTitle}
                    </div>
                    <div className="text-[11.5px] text-[var(--theme-text-muted)] leading-relaxed">
                      {t.settings.general.edgeTtsDesc}
                    </div>
                  </div>
                  <Toggle
                    checked={Boolean(ttsVoiceEnabled)}
                    onChange={() => setTtsVoiceEnabled && setTtsVoiceEnabled(!ttsVoiceEnabled)}
                    size="sm"
                  />
                </div>

                {ttsVoiceEnabled && (
                  <div className="space-y-4 pt-3 border-t border-[var(--theme-border)] animate-fadeIn">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-end">
                      <Select
                        label={t.settings.general.voiceLabel}
                        value={ttsVoice}
                        onChange={(e) => setTtsVoice && setTtsVoice(e.target.value)}
                        options={[
                          { value: 'ru-RU-SvetlanaNeural', label: 'Svetlana', sublabel: 'RU, Female' },
                          { value: 'ru-RU-DmitryNeural', label: 'Dmitry', sublabel: 'RU, Male' },
                          { value: 'en-US-GuyNeural', label: 'Guy', sublabel: 'EN, Male' },
                          { value: 'en-US-JennyNeural', label: 'Jenny', sublabel: 'EN, Female' },
                        ]}
                      />

                      <Select
                        label={t.settings.general.voiceRateLabel}
                        value={ttsRate}
                        onChange={(e) => setTtsRate && setTtsRate(e.target.value)}
                        options={[
                          { value: '+0%', label: 'Standard (+0%)' },
                          { value: '+15%', label: 'Fast (+15%)' },
                          { value: '+20%', label: 'Optimal (+20%)' },
                          { value: '+30%', label: 'Ultra (+30%)' },
                        ]}
                      />

                      <Button
                        variant="secondary"
                        size="md"
                        onClick={handleTestVoice}
                        loading={testingVoice}
                        icon={<Volume2 size={14} />}
                        className="w-full"
                      >
                        {t.settings.general.testVoiceBtn}
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <Toggle
                        checked={Boolean(ttsPlayOnSpeaker)}
                        onChange={(val) => setTtsPlayOnSpeaker && setTtsPlayOnSpeaker(val)}
                        label={t.settings.general.playSpeakerLabel}
                        size="sm"
                      />

                      <Toggle
                        checked={Boolean(ttsPlayInBrowser)}
                        onChange={(val) => setTtsPlayInBrowser && setTtsPlayInBrowser(val)}
                        label={t.settings.general.playBrowserLabel}
                        size="sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Row 2: Sparks Autonomous Companion */}
              <div className="flex items-center justify-between p-4 sm:px-5">
                <div className="space-y-0.5 min-w-0 pr-4">
                  <div className="text-xs font-semibold text-[var(--theme-text)] flex items-center gap-1.5">
                    <Zap size={13} className="text-amber-500" />
                    <span>{t.settings.general.sparksTitle}</span>
                  </div>
                  <div className="text-[11.5px] text-[var(--theme-text-muted)] leading-relaxed">
                    {t.settings.general.sparksDesc}
                  </div>
                </div>
                <Toggle
                  checked={Boolean(proactiveCompanionEnabled)}
                  onChange={() =>
                    setProactiveCompanionEnabled && setProactiveCompanionEnabled(!proactiveCompanionEnabled)
                  }
                  size="sm"
                />
              </div>

              {/* Row 3: Wake-Word Detection */}
              <div className="flex items-center justify-between p-4 sm:px-5">
                <div className="space-y-0.5 min-w-0 pr-4">
                  <div className="text-xs font-semibold text-[var(--theme-text)] flex items-center gap-1.5">
                    <Mic size={13} className="text-emerald-500" />
                    <span>{t.settings.general.wakeWordLabel}</span>
                  </div>
                  <div className="text-[11.5px] text-[var(--theme-text-muted)] leading-relaxed">
                    Бесконтактная активация интеркома голосом через локальную нейросеть распознавания
                  </div>
                </div>
                <Toggle
                  checked={Boolean(wakeWordEnabled)}
                  onChange={(val) => setWakeWordEnabled && setWakeWordEnabled(val)}
                  size="sm"
                />
              </div>
            </Card>
          </SettingsSection>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUBTAB 3: SECURITY & NETWORK                                          */}
      {/* ===================================================================== */}
      {activeSubtab === 'security' && (
        <div className="space-y-6">
          {/* LAN & Wi-Fi Network Sharing */}
          <SettingsSection
            title={t.nav.lanTitle}
            description="Безопасный доступ к веб-интерфейсу 0xAgent с мобильных устройств и других ПК в локальной сети"
          >
            <Card variant="default" className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl">
              <div className="space-y-1 min-w-0 pr-3">
                <div className="text-xs font-bold text-[var(--theme-text)]">
                  {t.settings.general.lanSharingTitle}
                </div>
                <div className="text-[11.5px] text-[var(--theme-text-muted)] leading-relaxed">
                  {t.settings.general.lanSharingDesc}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {lanIp ? (
                  <>
                    <div className="px-3.5 py-1.5 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] font-mono text-xs font-bold text-[var(--theme-text)] select-all">
                      https://{lanIp}:3001
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCopyLan}
                      icon={copiedLan ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    >
                      {copiedLan ? t.settings.general.lanCopied : t.common.copy}
                    </Button>
                    <a
                      href={`https://${lanIp}:3001`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-semibold text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-colors"
                    >
                      <span>{t.settings.general.lanOpen}</span>
                      <ExternalLink size={12} />
                    </a>
                  </>
                ) : (
                  <span className="text-xs text-[var(--theme-text-muted)] font-mono">127.0.0.1:3001</span>
                )}
              </div>
            </Card>
          </SettingsSection>

          {/* Master Password & Session Security */}
          <SettingsSection
            title={t.settings.general.masterPasswordTitle}
            description="Криптографическая защита сессий через PBKDF2 (100 000 итераций SHA-256 с солью)"
          >
            <Card variant="default" className="p-6 space-y-5 rounded-2xl">
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <Input
                    label={t.settings.general.currentPassword}
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />

                  <Input
                    label={t.settings.general.newPassword}
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />

                  <Input
                    label={t.settings.general.confirmPassword}
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>

                {passwordStatus && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 animate-fadeIn ${
                      passwordStatus.type === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                    }`}
                  >
                    {passwordStatus.type === 'success' ? <Check size={14} /> : <KeyRound size={14} />}
                    <span>{passwordStatus.text}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    loading={isChangingPassword}
                    disabled={isChangingPassword || !currentPassword || !newPassword}
                  >
                    {t.settings.general.updatePasswordBtn}
                  </Button>

                  <Button
                    variant="danger"
                    size="sm"
                    type="button"
                    onClick={async () => {
                      try {
                        await api.logout();
                        window.location.reload();
                      } catch (e) {
                        console.error('Logout error:', e);
                      }
                    }}
                    icon={<LogOut size={13} />}
                  >
                    {t.settings.general.logoutLabel}
                  </Button>
                </div>
              </form>
            </Card>
          </SettingsSection>
        </div>
      )}
    </div>
  );
});
