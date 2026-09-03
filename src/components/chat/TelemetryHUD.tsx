import React, { useState, useEffect } from 'react';
import { LiveTelemetry, QuotaStatus } from '../../types';
import { MaterialIcon } from '../common/MaterialIcon';
import { useI18n } from '../../i18n';

const ASCII_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

interface TelemetryHUDProps {
  liveTelemetry?: LiveTelemetry | null;
  quotaStatus?: QuotaStatus | null;
  agentStatus: 'idle' | 'thinking' | 'waiting_approval' | 'executing_tool';
  thinkingSeconds?: number;
  asciiFrame?: string;
  showThinkingBanner?: boolean;
  onOpenCustomizations?: () => void;
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({
  liveTelemetry,
  quotaStatus,
  agentStatus,
  thinkingSeconds: externalThinkingSeconds,
  asciiFrame: externalAsciiFrame,
  showThinkingBanner = false,
  onOpenCustomizations,
}) => {
  const { t } = useI18n();
  const [internalFrame, setInternalFrame] = useState(0);
  const [internalSeconds, setInternalSeconds] = useState(0);

  const isGenerating = agentStatus === 'thinking' || agentStatus === 'executing_tool';

  useEffect(() => {
    if (!isGenerating) {
      setInternalSeconds(0);
      return;
    }
    const frameInterval = setInterval(() => {
      setInternalFrame((prev) => (prev + 1) % ASCII_FRAMES.length);
    }, 75);
    const startTime = Date.now();
    const secInterval = setInterval(() => {
      setInternalSeconds((Date.now() - startTime) / 1000);
    }, 100);

    return () => {
      clearInterval(frameInterval);
      clearInterval(secInterval);
    };
  }, [isGenerating]);

  const asciiFrame = externalAsciiFrame || ASCII_FRAMES[internalFrame];
  const thinkingSeconds = externalThinkingSeconds !== undefined ? externalThinkingSeconds : internalSeconds;

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

      {/* Quota Exhaustion Alert during Generation/Thinking */}
      {quotaStatus?.exhausted && (
        <div className="flex justify-start max-w-3xl mx-auto w-full my-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/40 text-[11px] font-mono text-rose-300 shadow-sm animate-pulse">
            <MaterialIcon name="hourglass_empty" size={12} className="text-rose-400" />
            <span>[429 QUOTA EXHAUSTED]</span>
            {quotaStatus.resetText && (
              <span className="text-amber-300 font-mono ml-1">Resets: {quotaStatus.resetText}</span>
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
            {liveTelemetry.tokensPerSec !== undefined && liveTelemetry.tokensPerSec > 0 && liveTelemetry.tokensPerSec < 8.0 && (liveTelemetry.tokenCount ?? 0) > 20 && (
              <span className="flex items-center gap-1 text-amber-400 font-bold px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/30 text-[10px]" title="Зафиксировано замедление генерации (<8 t/s). Возможно переполнение VRAM.">
                <MaterialIcon name="warning" size={11} />
                <span>SLOW</span>
              </span>
            )}
            {liveTelemetry.tokenCount !== undefined && (
              <span className="flex items-center gap-1 text-[var(--theme-text)]">
                <MaterialIcon name="memory" size={12} className="text-[var(--theme-text-muted)]" />
                <span>{liveTelemetry.tokenCount} tok</span>
              </span>
            )}
            {liveTelemetry.contextUsed !== undefined && (() => {
              const ctxMax = liveTelemetry.contextMax || 16384;
              const pct = ctxMax > 0 ? Math.min(100, Math.max(0, Math.round((liveTelemetry.contextUsed / ctxMax) * 100))) : 0;
              const filled = pct > 0 ? Math.max(1, Math.min(10, Math.round(pct / 10))) : 0;
              const empty = 10 - filled;
              const gaugeStr = `[${'●'.repeat(filled)}${'○'.repeat(empty)}] ${pct}%`;
              return (
                <button
                  type="button"
                  onClick={onOpenCustomizations}
                  className="flex items-center gap-1.5 hidden sm:flex text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors cursor-pointer"
                  title="Нажмите, чтобы открыть детальный анализ токенов и кастомизаций"
                >
                  <MaterialIcon name="storage" size={12} />
                  <span>
                    {liveTelemetry.contextUsed.toLocaleString()}
                    {liveTelemetry.contextMax ? ` / ${liveTelemetry.contextMax.toLocaleString()}` : ''}
                  </span>
                  <span
                    className={`font-mono text-[10px] font-bold tracking-tight select-none ${
                      pct > 85 ? 'text-rose-400' : pct > 65 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {gaugeStr}
                  </span>
                </button>
              );
            })()}
          </div>
        </div>
      )}
    </>
  );
};
