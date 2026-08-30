import React from 'react';
import {
  Sliders,
  Shield,
  Volume2,
  Save,
  LayoutGrid,
  Globe,
  Key,
  LogOut,
  Sparkles,
  CheckCircle2,
  Wifi,
  Copy,
  Check,
  Brain,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import * as api from '../../services/api';
import { useI18n } from '../../i18n';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Toggle } from '../ui/Toggle';
import { Card } from '../ui/Card';
import { SettingsHeader, SettingsSection, SettingToggleCard } from './common';

interface GeneralTabProps {
  onLanguageSelect?: (lang: 'en' | 'ru') => void;
  onOpenMemorySkills?: () => void;
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

export const GeneralTab: React.FC<GeneralTabProps> = React.memo(({
  onLanguageSelect,
  onOpenMemorySkills,
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
  const [testingVoice, setTestingVoice] = React.useState(false);

  // LAN Sharing state
  const [lanUrls, setLanUrls] = React.useState<string[]>([]);
  const [lanLoading, setLanLoading] = React.useState(false);
  const [copiedUrl, setCopiedUrl] = React.useState<string | null>(null);

  const fetchLanInfo = React.useCallback(async () => {
    setLanLoading(true);
    try {
      const info = await api.get_lan_info();
      setLanUrls(info.urls || []);
    } catch (err) {
      console.error('Failed to load LAN info:', err);
    } finally {
      setLanLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchLanInfo();
  }, [fetchLanInfo]);

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const handleLogout = async () => {
    await api.logout();
    window.location.reload();
  };

  const handleTestVoice = async () => {
    setTestingVoice(true);
    try {
      await api.speak_text('Jarvis systems fully operational, sir.', {
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

  return (
    <div className="w-full space-y-6 font-sans text-[var(--theme-text)]">
      {/* 1. Standard Top Header */}
      <SettingsHeader
        title={t.settings.general.title}
        subtitle={t.settings.general.subtitle}
        icon={<Sliders size={18} />}
      />

      {/* 2. UI Language Selector */}
      <SettingsSection
        title={t.settings.general.languageTitle}
        badge="UI Language"
        description={t.settings.general.languageDesc}
      >
        <Card variant="default" className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setLanguage('en');
                onLanguageSelect?.('en');
              }}
              className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer select-none ${
                language === 'en'
                  ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]/10 text-[var(--theme-text)] shadow-sm ring-1 ring-[var(--theme-accent)]/30'
                  : 'border-[var(--theme-border)] bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-lg bg-[var(--theme-card-bg)] border border-[var(--theme-border)]">
                  [EN]
                </span>
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
              className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer select-none ${
                language === 'ru'
                  ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]/10 text-[var(--theme-text)] shadow-sm ring-1 ring-[var(--theme-accent)]/30'
                  : 'border-[var(--theme-border)] bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-lg bg-[var(--theme-card-bg)] border border-[var(--theme-border)]">
                  [RU]
                </span>
                <span>{t.settings.general.langRu}</span>
              </div>
              {language === 'ru' && <CheckCircle2 size={16} className="text-[var(--theme-accent)]" />}
            </button>
          </div>
        </Card>
      </SettingsSection>

      {/* 3. LAN & Local Network Sharing */}
      <SettingsSection
        title={t.nav.lanTitle}
        badge="LAN & Wi-Fi"
        description={t.nav.lanDesc}
      >
        <Card variant="default" className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi size={16} className="text-[var(--theme-accent)]" />
              <span className="text-xs font-semibold text-[var(--theme-text)]">
                {t.nav.lanShare}
              </span>
            </div>
            <button
              type="button"
              onClick={fetchLanInfo}
              className="p-1.5 rounded-lg text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-colors cursor-pointer"
              title="Refresh network interfaces"
            >
              <RefreshCw size={13} className={lanLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {lanLoading ? (
            <div className="flex items-center justify-center gap-2 py-3 text-xs text-[var(--theme-text-muted)]">
              <RefreshCw size={13} className="animate-spin" />
              <span>{t.common.loading}...</span>
            </div>
          ) : lanUrls.length === 0 ? (
            <div className="text-xs text-[var(--theme-text-muted)] py-2 text-center">
              {t.nav.lanEmpty}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {lanUrls.map((url, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] hover:border-[var(--theme-accent)] transition-colors"
                >
                  <span className="font-mono text-xs text-[var(--theme-text)] truncate select-all font-semibold mr-2">
                    {url}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyUrl(url)}
                    className="p-1.5 rounded-lg text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-colors cursor-pointer shrink-0"
                    title={t.nav.lanCopy}
                  >
                    {copiedUrl === url ? (
                      <Check size={13} className="text-emerald-500" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </SettingsSection>

      {/* 4. Memory Engine & Skills Hub */}
      {onOpenMemorySkills && (
        <SettingsSection
          title={t.nav.memorySkills}
          badge="Memory Engine v1.0"
          description="Долговременная память фактов пользователя, кастомные навыки AGY Skills и правила поведения."
        >
          <Card variant="default">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border border-[var(--theme-accent)]/20">
                  <Brain size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--theme-text)]">
                    {t.nav.memorySkills} & AGY Skills
                  </h4>
                  <p className="text-[11px] text-[var(--theme-text-muted)]">
                    Просмотр и редактирование воспоминаний, правил SOUL/USER и дерева навыков.
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={onOpenMemorySkills}
                icon={<ExternalLink size={13} />}
                className="shrink-0"
              >
                Открыть хаб навыков
              </Button>
            </div>
          </Card>
        </SettingsSection>
      )}

      {/* 5. Connection & API Keys */}
      <SettingsSection
        title={t.settings.general.connectionTitle}
        badge="Cloud & Local Endpoints"
      >
        <Card variant="default">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <Input
              label={t.settings.general.apiUrl}
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://127.0.0.1:11434/v1"
              prefixIcon={<Globe size={13} />}
              mono
            />

            <Input
              label={t.settings.general.geminiApiKey}
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey && setGeminiApiKey(e.target.value)}
              placeholder="AIzaSy..."
              prefixIcon={<Key size={13} />}
              mono
            />

            <Input
              label={t.settings.general.groqApiKey}
              type="password"
              value={groqApiKey}
              onChange={(e) => setGroqApiKey(e.target.value)}
              placeholder="gsk_..."
              prefixIcon={<Key size={13} />}
              mono
            />
          </div>
        </Card>
      </SettingsSection>

      {/* 4. UI & Behavior Toggles */}
      <SettingsSection
        title={t.settings.general.behaviorTitle}
        badge="Preferences"
      >
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
      </SettingsSection>

      {/* 5. Jarvis Voice Intercom & Proactive Companion */}
      <SettingsSection
        title={t.settings.general.jarvisVoiceTitle}
        badge="Push-Driven Engine"
      >
        <Card variant="default" className="space-y-4">
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
              onToggle={() =>
                setProactiveCompanionEnabled && setProactiveCompanionEnabled(!proactiveCompanionEnabled)
              }
              statusOnText={t.settings.general.statusOn}
              statusOffText={t.settings.general.statusOff}
            />
          </div>

          {/* Voice Parameters */}
          {ttsVoiceEnabled && (
            <div className="space-y-4 pt-2 border-t border-[var(--theme-border)]">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[var(--theme-border)]">
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

                <Toggle
                  checked={Boolean(wakeWordEnabled)}
                  onChange={(val) => setWakeWordEnabled && setWakeWordEnabled(val)}
                  label={t.settings.general.wakeWordLabel}
                  size="sm"
                  className="sm:col-span-2"
                />
              </div>
            </div>
          )}
        </Card>
      </SettingsSection>

      {/* 6. Active Session & Logout */}
      <SettingsSection title={t.settings.general.securityTitle}>
        <Card variant="default" className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--theme-text)]">
              <Shield size={14} className="text-[var(--theme-text-muted)]" />
              <span>{t.settings.general.securityTitle}</span>
            </div>
            <p className="text-xs text-[var(--theme-text-muted)]">
              {t.settings.security.logoutDesc || 'Управление сессией и паролем вынесено во вкладку Безопасность'}
            </p>
          </div>

          <Button
            variant="danger"
            size="sm"
            onClick={handleLogout}
            icon={<LogOut size={13} />}
          >
            {t.settings.general.logoutBtn}
          </Button>
        </Card>
      </SettingsSection>
    </div>
  );
});
