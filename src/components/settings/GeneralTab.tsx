import React, { useState, useEffect, useCallback } from 'react';
import { Sliders, Palette, Mic, ShieldCheck } from 'lucide-react';
import { AppTheme } from '../../types';
import * as api from '../../services/api';
import { useI18n } from '../../i18n';
import { SettingsHeader } from './common';
import { InterfaceSection } from './general/InterfaceSection';
import { VoiceSection } from './general/VoiceSection';
import { SecuritySection } from './general/SecuritySection';

interface GeneralTabProps {
  onLanguageSelect?: (lang: 'en' | 'ru') => void;
  onOpenMemorySkills?: () => void;
  activeTheme?: string;
  onSelectTheme?: (theme: AppTheme) => void;
  apiUrl: string;
  setApiUrl: (val: string) => void;
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
  const { t, language } = useI18n();

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
        <InterfaceSection
          currentThemeId={currentThemeId}
          onSelectTheme={onSelectTheme}
          onLanguageSelect={onLanguageSelect}
          reasoningEnabled={reasoningEnabled}
          setReasoningEnabled={setReasoningEnabled}
          autoSaveHistory={autoSaveHistory}
          setAutoSaveHistory={setAutoSaveHistory}
          soundNotifications={soundNotifications}
          setSoundNotifications={setSoundNotifications}
          compactChat={compactChat}
          setCompactChat={setCompactChat}
          onOpenMemorySkills={onOpenMemorySkills}
        />
      )}

      {/* ===================================================================== */}
      {/* SUBTAB 2: VOICE & COMPANION                                           */}
      {/* ===================================================================== */}
      {activeSubtab === 'voice' && (
        <VoiceSection
          ttsVoiceEnabled={ttsVoiceEnabled}
          setTtsVoiceEnabled={setTtsVoiceEnabled}
          ttsVoice={ttsVoice}
          setTtsVoice={setTtsVoice}
          ttsRate={ttsRate}
          setTtsRate={setTtsRate}
          ttsPlayOnSpeaker={ttsPlayOnSpeaker}
          setTtsPlayOnSpeaker={setTtsPlayOnSpeaker}
          ttsPlayInBrowser={ttsPlayInBrowser}
          setTtsPlayInBrowser={setTtsPlayInBrowser}
          testingVoice={testingVoice}
          handleTestVoice={handleTestVoice}
          proactiveCompanionEnabled={proactiveCompanionEnabled}
          setProactiveCompanionEnabled={setProactiveCompanionEnabled}
          wakeWordEnabled={wakeWordEnabled}
          setWakeWordEnabled={setWakeWordEnabled}
        />
      )}

      {/* ===================================================================== */}
      {/* SUBTAB 3: SECURITY & NETWORK                                          */}
      {/* ===================================================================== */}
      {activeSubtab === 'security' && (
        <SecuritySection
          lanIp={lanIp}
          copiedLan={copiedLan}
          handleCopyLan={handleCopyLan}
          currentPassword={currentPassword}
          setCurrentPassword={setCurrentPassword}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          isChangingPassword={isChangingPassword}
          passwordStatus={passwordStatus}
          handleChangePassword={handleChangePassword}
        />
      )}
    </div>
  );
});
