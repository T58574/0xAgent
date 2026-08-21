import React from 'react';
import { LiveTelemetry } from '../../types';
import { MaterialIcon } from '../common/MaterialIcon';
import { useI18n } from '../../i18n';

interface TelemetryHUDProps {
  liveTelemetry?: LiveTelemetry | null;
  agentStatus: 'idle' | 'thinking' | 'waiting_approval' | 'executing_tool';
  thinkingSeconds: number;
  asciiFrame: string;
  showThinkingBanner?: boolean;
  onOpenCustomizations?: () => void;
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({
  liveTelemetry,
  agentStatus,
  thinkingSeconds,
  asciiFrame,
  showThinkingBanner = false,
  onOpenCustomizations,
}) => {
  const { t } = useI18n();

  return (
    <>
      {/* Live Thinking ASCII HUD banner */}
      {showThinkingBanner && (
        <div className="flex justify-start max-w-3xl mx-auto w-full my-3">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bento-card border border-[var(--theme-border)] text-xs text-[var(--theme-text)] animate-fadeIn shadow-sm font-mono">
            <span className="text-[var(--theme-accent)] font-bold text-sm tracking-wider select-none">
              {asciiFrame}
            </span>
            <span className="font-medium text-xs text-[var(--theme-text)]">
              {t.chat.agentThinking}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--theme-text-muted)] opacity-80">
              <MaterialIcon name="schedule" size={11} />
              <span>{thinkingSeconds.toFixed(1)}s</span>
            </span>
            {liveTelemetry?.tokensPerSec !== undefined && liveTelemetry.tokensPerSec > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] text-[var(--theme-accent)] font-semibold pl-1 border-l border-[var(--theme-border)]">
                <MaterialIcon name="bolt" size={11} />
                <span>{liveTelemetry.tokensPerSec.toFixed(1)} t/s</span>
              </span>
            )}
            {liveTelemetry?.tokenCount !== undefined && liveTelemetry.tokenCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] text-[var(--theme-text-muted)]">
                <MaterialIcon name="memory" size={11} />
                <span>{liveTelemetry.tokenCount} tok</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Live Telemetry Card during Generation */}
      {liveTelemetry && agentStatus !== 'idle' && (
        <div className="flex justify-start max-w-3xl mx-auto w-full my-2">
          <div className="inline-flex items-center gap-3 px-3 py-1 rounded-full bento-card border border-[var(--theme-border)] text-[11px] font-mono text-[var(--theme-text-muted)] shadow-sm">
            {liveTelemetry.tokensPerSec !== undefined && (
              <span className="flex items-center gap-1 text-[var(--theme-accent)] font-semibold">
                <MaterialIcon name="bolt" size={12} />
                <span>{liveTelemetry.tokensPerSec.toFixed(1)} t/s</span>
              </span>
            )}
            {liveTelemetry.tokenCount !== undefined && (
              <span className="flex items-center gap-1 text-[var(--theme-text)]">
                <MaterialIcon name="memory" size={12} className="text-[var(--theme-text-muted)]" />
                <span>{liveTelemetry.tokenCount} токенов</span>
              </span>
            )}
            {liveTelemetry.contextUsed !== undefined && (
              <button
                type="button"
                onClick={onOpenCustomizations}
                className="flex items-center gap-1 hidden sm:flex text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors cursor-pointer"
                title="Нажмите, чтобы открыть детальный анализ токенов и кастомизаций"
              >
                <MaterialIcon name="storage" size={12} />
                <span>
                  {liveTelemetry.contextUsed.toLocaleString()}
                  {liveTelemetry.contextMax ? ` / ${liveTelemetry.contextMax.toLocaleString()}` : ''}
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};
