import React from 'react';
import { Volume2, Zap, Mic } from 'lucide-react';
import { useI18n } from '../../../i18n';
import { Button } from '../../ui/Button';
import { Select } from '../../ui/Select';
import { Toggle } from '../../ui/Toggle';
import { Card } from '../../ui/Card';
import { SettingsSection } from '../common';

export interface VoiceSectionProps {
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
  testingVoice: boolean;
  handleTestVoice: () => Promise<void>;
  proactiveCompanionEnabled?: boolean;
  setProactiveCompanionEnabled?: (val: boolean) => void;
  wakeWordEnabled?: boolean;
  setWakeWordEnabled?: (val: boolean) => void;
}

export const VoiceSection: React.FC<VoiceSectionProps> = ({
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
  testingVoice,
  handleTestVoice,
  proactiveCompanionEnabled = true,
  setProactiveCompanionEnabled,
  wakeWordEnabled = false,
  setWakeWordEnabled,
}) => {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <SettingsSection
        title={t.settings.general.jarvisVoiceTitle}
        description="Синтез речи через Microsoft Edge-TTS, голосовая активация и проактивные интеркомы"
      >
        <Card variant="default" className="p-0 overflow-hidden divide-y divide-[var(--theme-border)] rounded-2xl">
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
  );
};