import React, { useState } from 'react';
import { Sliders, Shield, Volume2, Save, LayoutGrid, Globe, Key, KeyRound, LogOut, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import * as api from '../../services/api';
import { useI18n } from '../../i18n';

interface SettingToggleCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  active: boolean;
  onToggle: () => void;
  statusOnText: string;
  statusOffText: string;
}

const SettingToggleCard: React.FC<SettingToggleCardProps> = ({
  icon,
  title,
  desc,
  active,
  onToggle,
  statusOnText,
  statusOffText,
}) => (
  <div
    onClick={onToggle}
    className={`p-4 rounded-2xl bento-card flex items-center justify-between cursor-pointer transition-all border ${
      active
        ? 'border-[var(--theme-accent)] bg-[var(--theme-card-bg)] shadow-sm'
        : 'border-[var(--theme-border)] bg-[var(--theme-input-bg)] hover:border-[var(--theme-text-muted)]'
    }`}
  >
    <div className="flex items-center gap-3.5 min-w-0 pr-2">
      <div
        className={`p-2.5 rounded-xl shrink-0 transition-colors ${
          active
            ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] shadow-sm'
            : 'bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)]'
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[var(--theme-text)] truncate">{title}</span>
          <span
            className={`text-[9px] font-mono px-2 py-0.5 rounded-full transition-colors ${
              active
                ? 'bg-[var(--theme-accent)]/15 text-[var(--theme-text)] font-bold border border-[var(--theme-accent)]/30'
                : 'bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)] border border-[var(--theme-border)]'
            }`}
          >
            {active ? statusOnText : statusOffText}
          </span>
        </div>
        <div className="text-[11px] text-[var(--theme-text-muted)] leading-tight mt-1">{desc}</div>
      </div>
    </div>
    <div
      className={`w-9 h-5 rounded-full p-0.5 flex items-center transition-colors shrink-0 ${
        active ? 'bg-[var(--theme-accent)]' : 'bg-zinc-300 dark:bg-zinc-700'
      }`}
    >
      <div
        className={`w-4 h-4 rounded-full transition-transform ${
          active ? 'translate-x-4 bg-[var(--theme-accent-text)] shadow-sm' : 'translate-x-0 bg-white'
        }`}
      />
    </div>
  </div>
);

interface GeneralTabProps {
  onLanguageSelect?: (lang: 'en' | 'ru') => void;
  apiUrl: string;
  setApiUrl: (val: string) => void;
  groqApiKey: string;
  setGroqApiKey: (val: string) => void;
  geminiApiKey?: string;
  setGeminiApiKey?: (val: string) => void;
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

export const GeneralTab: React.FC<GeneralTabProps> = ({
  onLanguageSelect,
  apiUrl,
  setApiUrl,
  groqApiKey,
  setGroqApiKey,
  geminiApiKey = '',
  setGeminiApiKey,
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
  const { language, setLanguage, t } = useI18n();

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (!currentPassword) {
      setStatusMsg({ type: 'error', text: t.settings.general.enterCurrentPassword });
      return;
    }
    if (newPassword.trim().length < 4) {
      setStatusMsg({ type: 'error', text: t.settings.general.passwordMinLength });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatusMsg({ type: 'error', text: t.settings.general.passwordMismatch });
      return;
    }

    setIsSubmittingPassword(true);
    try {
      const res = await api.change_password(currentPassword, newPassword.trim());
      if (res.success) {
        setStatusMsg({ type: 'success', text: t.settings.general.passwordSuccess });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setStatusMsg({ type: 'error', text: res.error || t.settings.general.passwordError });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `${t.common.error}: ${err.message || err}` });
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    window.location.reload();
  };

  return (
    <div className="space-y-4 font-sans text-[var(--theme-text)] max-w-4xl pb-6">
      <div>
        <h3 className="text-sm font-bold text-[var(--theme-text)] flex items-center gap-2">
          <Sliders size={15} className="text-[var(--theme-text-muted)]" />
          <span>{t.settings.general.title}</span>
        </h3>
        <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">
          {t.settings.general.subtitle}
        </p>
      </div>

      {/* 0. Interface Language Selector */}
      <div className="p-4 rounded-2xl bento-card space-y-3 border border-[var(--theme-border)]">
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--theme-text)]">
            <Globe size={14} className="text-[var(--theme-text-muted)]" />
            <span>{t.settings.general.languageTitle}</span>
          </div>
          <span className="text-[10px] font-mono text-[var(--theme-text-muted)]">
            :: UI Language
          </span>
        </div>
        <p className="text-xs text-[var(--theme-text-muted)]">
          {t.settings.general.languageDesc}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              setLanguage('en');
              onLanguageSelect?.('en');
            }}
            className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
              language === 'en'
                ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]/10 text-[var(--theme-text)] shadow-sm'
                : 'border-[var(--theme-border)] bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-[var(--theme-border-subtle)] border border-[var(--theme-border)]">[EN]</span>
              <span>{t.settings.general.langEn}</span>
            </div>
            {language === 'en' && <CheckCircle2 size={16} className="text-[var(--theme-accent)]" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setLanguage('ru');
              onLanguageSelect?.('ru');
            }}
            className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
              language === 'ru'
                ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]/10 text-[var(--theme-text)] shadow-sm'
                : 'border-[var(--theme-border)] bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-[var(--theme-border-subtle)] border border-[var(--theme-border)]">[RU]</span>
              <span>{t.settings.general.langRu}</span>
            </div>
            {language === 'ru' && <CheckCircle2 size={16} className="text-[var(--theme-accent)]" />}
          </button>
        </div>
      </div>

      {/* 1. Connection Card */}
      <div className="p-4 rounded-2xl bento-card space-y-3.5 border border-[var(--theme-border)]">
        <div className="text-xs font-bold text-[var(--theme-text)] flex items-center gap-1.5 border-b border-[var(--theme-border)] pb-2.5">
          <Globe size={14} className="text-[var(--theme-text-muted)]" />
          <span>{t.settings.general.connectionTitle}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* API Endpoint URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--theme-text-muted)] flex items-center gap-1">
              <Globe size={12} />
              <span>{t.settings.general.apiUrl}</span>
            </label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://127.0.0.1:11434/v1"
              className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
            />
          </div>

          {/* Google AI Studio (Gemini) API Key */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--theme-text-muted)] flex items-center gap-1">
              <Key size={12} />
              <span>{t.settings.general.geminiApiKey}</span>
            </label>
            <input
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey && setGeminiApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
            />
          </div>

          {/* Groq API Key */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--theme-text-muted)] flex items-center gap-1">
              <Key size={12} />
              <span>{t.settings.general.groqApiKey}</span>
            </label>
            <input
              type="password"
              value={groqApiKey}
              onChange={(e) => setGroqApiKey(e.target.value)}
              placeholder="gsk_..."
              className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      {/* 2. UI & Behavior Toggles */}
      <div className="p-4 rounded-2xl bento-card space-y-3.5 border border-[var(--theme-border)]">
        <div className="text-xs font-bold text-[var(--theme-text)] flex items-center justify-between border-b border-[var(--theme-border)] pb-2.5">
          <div className="flex items-center gap-1.5">
            <Sliders size={14} className="text-[var(--theme-text-muted)]" />
            <span>{t.settings.general.behaviorTitle}</span>
          </div>
          <span className="text-[10px] font-mono text-[var(--theme-text-muted)]">
            :: Preferences
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SettingToggleCard
            icon={<Shield size={16} />}
            title={t.settings.general.reasoningTitle}
            desc={t.settings.general.reasoningDesc}
            active={reasoningEnabled}
            onToggle={() => setReasoningEnabled(!reasoningEnabled)}
            statusOnText={t.settings.general.statusOn}
            statusOffText={t.settings.general.statusOff}
          />

          <SettingToggleCard
            icon={<Save size={16} />}
            title={t.settings.general.autoSaveTitle}
            desc={t.settings.general.autoSaveDesc}
            active={autoSaveHistory}
            onToggle={() => setAutoSaveHistory(!autoSaveHistory)}
            statusOnText={t.settings.general.statusOn}
            statusOffText={t.settings.general.statusOff}
          />

          <SettingToggleCard
            icon={<Volume2 size={16} />}
            title={t.settings.general.soundTitle}
            desc={t.settings.general.soundDesc}
            active={soundNotifications}
            onToggle={() => setSoundNotifications(!soundNotifications)}
            statusOnText={t.settings.general.statusOn}
            statusOffText={t.settings.general.statusOff}
          />

          <SettingToggleCard
            icon={<LayoutGrid size={16} />}
            title={t.settings.general.compactTitle}
            desc={t.settings.general.compactDesc}
            active={compactChat}
            onToggle={() => setCompactChat(!compactChat)}
            statusOnText={t.settings.general.statusOn}
            statusOffText={t.settings.general.statusOff}
          />
        </div>
      </div>

      {/* 3. Jarvis Voice Intercom & Proactive Companion */}
      <div className="p-4 rounded-2xl bento-card space-y-4 border border-[var(--theme-border)]">
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--theme-text)]">
            <Volume2 size={14} className="text-[var(--theme-text-muted)]" />
            <span>{t.settings.general.jarvisVoiceTitle}</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)] border border-[var(--theme-border)]">
            :: Push-Driven Engine
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SettingToggleCard
            icon={<Volume2 size={16} />}
            title={t.settings.general.edgeTtsTitle}
            desc={t.settings.general.edgeTtsDesc}
            active={Boolean(ttsVoiceEnabled)}
            onToggle={() => setTtsVoiceEnabled && setTtsVoiceEnabled(!ttsVoiceEnabled)}
            statusOnText={t.settings.general.statusOn}
            statusOffText={t.settings.general.statusOff}
          />

          <SettingToggleCard
            icon={<Sparkles size={16} />}
            title={t.settings.general.sparksTitle}
            desc={t.settings.general.sparksDesc}
            active={Boolean(proactiveCompanionEnabled)}
            onToggle={() => setProactiveCompanionEnabled && setProactiveCompanionEnabled(!proactiveCompanionEnabled)}
            statusOnText={t.settings.general.statusOn}
            statusOffText={t.settings.general.statusOff}
          />
        </div>

        {/* Voice Parameters */}
        {ttsVoiceEnabled && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[var(--theme-border)]">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[var(--theme-text-muted)] block font-mono">
                  {t.settings.general.voiceLabel}
                </label>
                <select
                  value={ttsVoice}
                  onChange={(e) => setTtsVoice && setTtsVoice(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] focus:outline-none focus:border-[var(--theme-accent)] cursor-pointer transition-colors"
                >
                  <option value="ru-RU-SvetlanaNeural" className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">Svetlana (RU, Female)</option>
                  <option value="ru-RU-DmitryNeural" className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">Dmitry (RU, Male)</option>
                  <option value="en-US-GuyNeural" className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">Guy (EN, Male)</option>
                  <option value="en-US-JennyNeural" className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">Jenny (EN, Female)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[var(--theme-text-muted)] block font-mono">
                  {t.settings.general.voiceRateLabel}
                </label>
                <select
                  value={ttsRate}
                  onChange={(e) => setTtsRate && setTtsRate(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] focus:outline-none focus:border-[var(--theme-accent)] cursor-pointer transition-colors"
                >
                  <option value="+0%" className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">Standard (+0%)</option>
                  <option value="+15%" className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">Fast (+15%)</option>
                  <option value="+20%" className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">Optimal (+20%)</option>
                  <option value="+30%" className="bg-[var(--theme-panel-solid)] text-[var(--theme-text)]">Ultra (+30%)</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await api.speak_text('Jarvis systems fully operational, sir.', {
                        voice: ttsVoice,
                        rate: ttsRate,
                        playOnSpeaker: ttsPlayOnSpeaker,
                        category: 'greeting',
                      });
                    } catch (err: any) {
                      console.error('Voice test failed:', err);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[var(--theme-accent)] text-[var(--theme-accent-text)] font-semibold text-xs transition-all hover:opacity-90 shadow-sm cursor-pointer"
                >
                  <Volume2 size={14} />
                  <span>{t.settings.general.testVoiceBtn}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[var(--theme-border)]">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] select-none font-medium">
                <input
                  type="checkbox"
                  checked={ttsPlayOnSpeaker}
                  onChange={(e) => setTtsPlayOnSpeaker && setTtsPlayOnSpeaker(e.target.checked)}
                  className="rounded accent-[var(--theme-accent)] cursor-pointer"
                />
                <span>{t.settings.general.playSpeakerLabel}</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] select-none font-medium">
                <input
                  type="checkbox"
                  checked={ttsPlayInBrowser}
                  onChange={(e) => setTtsPlayInBrowser && setTtsPlayInBrowser(e.target.checked)}
                  className="rounded accent-[var(--theme-accent)] cursor-pointer"
                />
                <span>{t.settings.general.playBrowserLabel}</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] sm:col-span-2 select-none font-medium">
                <input
                  type="checkbox"
                  checked={wakeWordEnabled}
                  onChange={(e) => setWakeWordEnabled && setWakeWordEnabled(e.target.checked)}
                  className="rounded accent-[var(--theme-accent)] cursor-pointer"
                />
                <span>{t.settings.general.wakeWordLabel}</span>
              </label>
            </div>
          </>
        )}
      </div>

      {/* 4. Password & Session Security */}
      <div className="p-4 rounded-2xl bento-card space-y-3.5 border border-[var(--theme-border)]">
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--theme-text)]">
            <KeyRound size={14} className="text-[var(--theme-text-muted)]" />
            <span>{t.settings.general.securityTitle}</span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card-bg)] hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/30 text-xs text-[var(--theme-text-muted)] flex items-center gap-1.5 cursor-pointer transition-all font-medium"
            title={t.settings.security.logoutDesc}
          >
            <LogOut size={13} />
            <span>{t.settings.general.logoutBtn}</span>
          </button>
        </div>

        {statusMsg && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-300'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 size={15} className="shrink-0" />
            ) : (
              <AlertTriangle size={15} className="shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-3 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--theme-text-muted)]">{t.settings.general.currentPassword}</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--theme-text-muted)]">{t.settings.general.newPassword}</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--theme-text-muted)]">{t.settings.general.confirmPassword}</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
                required
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isSubmittingPassword}
              className="px-4 py-2 rounded-xl bg-[var(--theme-accent)] text-[var(--theme-accent-text)] font-semibold text-xs transition-all hover:opacity-90 shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSubmittingPassword ? t.settings.saving : t.settings.general.updatePasswordBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
