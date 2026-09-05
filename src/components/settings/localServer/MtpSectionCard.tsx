import React from 'react';
import { Sparkles, Zap } from 'lucide-react';
import { GgufMetadata } from '../../../types';
import { useI18n } from '../../../i18n';
import { Toggle } from '../../ui/Toggle';
import { Card } from '../../ui/Card';
import { InfoTooltip } from './atoms';

interface MtpSectionCardProps {
  isMtpEnabled: boolean;
  onToggleMtp: () => void;
  modelMeta?: GgufMetadata | null;
}

export const MtpSectionCard: React.FC<MtpSectionCardProps> = ({
  isMtpEnabled,
  onToggleMtp,
  modelMeta,
}) => {
  const { t } = useI18n();

  return (
    <Card variant="recessed" className="space-y-3 rounded-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-[var(--theme-accent)]" />
            <span className="text-xs font-bold text-[var(--theme-text)]">
              {t.settings.localServer.params.mtpTitle}
            </span>
            <InfoTooltip
              title="Hardware MTP"
              text="Multi-Token Prediction accelerates token generation in 1 GPU step."
              benefit="Hardware multi-token prediction"
            />
          </div>
          <p className="text-[11px] text-[var(--theme-text-muted)]">
            {t.settings.localServer.params.mtpDesc}
          </p>
        </div>

        <Toggle checked={isMtpEnabled} onChange={onToggleMtp} size="sm" />
      </div>

      {isMtpEnabled && (
        <div className="pt-2 border-t border-[var(--theme-border)]">
          {modelMeta?.supportsFastMtp ? (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                <Zap size={14} className="animate-pulse text-emerald-500" />
                <span>{t.settings.localServer.params.mtpNativeDraft}</span>
              </div>
              <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed">
                {t.settings.localServer.params.mtpNativeDraftDesc}
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                <Zap size={14} className="text-emerald-500" />
                <span>{t.settings.localServer.params.mtpActive}</span>
              </div>
              <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed">
                {t.settings.localServer.params.mtpActiveDesc}
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
