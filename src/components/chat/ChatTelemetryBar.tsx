import React, { useState, useEffect, useRef } from 'react';
import { LiveTelemetry } from '../../types';
import { MaterialIcon } from '../common/MaterialIcon';
import { purge_vram } from '../../services/api';

interface ChatTelemetryBarProps {
  liveTelemetry: LiveTelemetry | null;
  planningMode: boolean;
  onTogglePlanningMode?: () => void;
  isGenerating?: boolean;
  elapsedSeconds?: number;
}

export const ChatTelemetryBar: React.FC<ChatTelemetryBarProps> = ({
  liveTelemetry,
  planningMode,
  onTogglePlanningMode,
  isGenerating = false,
  elapsedSeconds: externalElapsedSeconds,
}) => {
  const [purging, setPurging] = useState(false);
  const [internalSeconds, setInternalSeconds] = useState(0);
  const timerStartRef = useRef<number | null>(null);

  // Live stopwatch timer during generation
  useEffect(() => {
    if (isGenerating) {
      if (timerStartRef.current === null) {
        timerStartRef.current = Date.now();
      }
      const interval = setInterval(() => {
        if (timerStartRef.current !== null) {
          setInternalSeconds((Date.now() - timerStartRef.current) / 1000);
        }
      }, 100);
      return () => clearInterval(interval);
    } else {
      timerStartRef.current = null;
    }
  }, [isGenerating]);

  const displaySeconds =
    externalElapsedSeconds !== undefined
      ? externalElapsedSeconds
      : internalSeconds;

  const handlePurgeVram = async () => {
    setPurging(true);
    try {
      await purge_vram();
    } catch {}
    finally {
      setPurging(false);
    }
  };

  const isSlow = liveTelemetry?.tokensPerSec !== undefined && liveTelemetry.tokensPerSec > 0 && liveTelemetry.tokensPerSec < 8.0 && (liveTelemetry.tokenCount ?? 0) > 20;

  // Calculate context fill percentage and 10-segment Unicode indicators
  const contextPct =
    liveTelemetry?.contextUsed !== undefined && liveTelemetry?.contextMax && liveTelemetry.contextMax > 0
      ? Math.min(100, Math.max(0, Math.round((liveTelemetry.contextUsed / liveTelemetry.contextMax) * 100)))
      : null;

  const filledSegments = contextPct !== null ? Math.min(10, Math.max(0, Math.round(contextPct / 10))) : 0;
  const emptySegments = Math.max(0, 10 - filledSegments);
  const quotaGauge = contextPct !== null ? `[${'●'.repeat(filledSegments)}${'○'.repeat(emptySegments)}] ${contextPct}%` : null;

  return (
    <div className="px-3 py-1.5 glass-panel border-b border-theme-border flex flex-wrap items-center justify-between text-xs text-theme-text font-mono shrink-0">
      <div className="flex items-center gap-3.5 flex-wrap">
        {/* Live streaming stopwatch timer in agy CLI aesthetic */}
        {(isGenerating || displaySeconds > 0) && (
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
              isGenerating
                ? 'bg-[var(--theme-accent)]/15 border-[var(--theme-accent)]/30 text-[var(--theme-accent)] animate-pulse'
                : 'bg-white/5 border-theme-border text-theme-muted'
            }`}
            title="Время выполнения / генерации стрима (agy CLI stopwatch)"
          >
            <MaterialIcon name="schedule" size={13} className={isGenerating ? 'animate-spin' : ''} />
            <span>{displaySeconds.toFixed(1)}s</span>
          </div>
        )}

        {liveTelemetry ? (
          <>
            {/* Speed t/s */}
            <div className="flex items-center gap-1 text-emerald-400 font-semibold" title="Скорость генерации (токенов в секунду)">
              <MaterialIcon name="bolt" size={14} />
              <span>{(liveTelemetry.tokensPerSec ?? 0).toFixed(1)} t/s</span>
            </div>

            {/* Performance Slowdown Warning */}
            {isSlow && (
              <div
                className="flex items-center gap-1 text-amber-400 font-bold px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/30 text-[10px]"
                title="Зафиксировано замедление генерации (<8 t/s). Рекомендуется очистить VRAM или сжать контекст."
              >
                <MaterialIcon name="warning" size={12} />
                <span>SLOW (VRAM)</span>
              </div>
            )}

            {/* Token count */}
            <div className="flex items-center gap-1 text-theme-accent" title="Сгенерировано токенов">
              <MaterialIcon name="memory" size={14} />
              <span>{liveTelemetry.tokenCount ?? 0} tok</span>
            </div>

            {/* Context Window & 10-segment Unicode quota gauge */}
            {liveTelemetry.contextUsed !== undefined && (
              <div className="flex items-center gap-2 text-theme-muted" title="Использование контекстного окна и 10-сегментная квота agy">
                <div className="flex items-center gap-1">
                  <MaterialIcon name="psychology" size={14} />
                  <span>
                    Context: {liveTelemetry.contextUsed.toLocaleString()}
                    {liveTelemetry.contextMax ? ` / ${liveTelemetry.contextMax.toLocaleString()}` : ''}
                  </span>
                </div>
                {quotaGauge && (
                  <span
                    className={`font-mono text-[10px] font-bold tracking-tight select-none ${
                      contextPct! > 85 ? 'text-rose-400' : contextPct! > 65 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {quotaGauge}
                  </span>
                )}
              </div>
            )}

            {/* TTFT (Time-to-first-token) */}
            {liveTelemetry.ttftMs !== undefined && liveTelemetry.ttftMs > 0 && (
              <div className="flex items-center gap-1 text-amber-400" title="Время до первого токена (TTFT)">
                <MaterialIcon name="timer" size={14} />
                <span>TTFT: {liveTelemetry.ttftMs}ms</span>
              </div>
            )}

            {/* VRAM MB */}
            {liveTelemetry.vramUsedMB !== undefined && liveTelemetry.vramUsedMB > 0 && (
              <div className="flex items-center gap-1 text-purple-400" title="Занято VRAM">
                <MaterialIcon name="developer_board" size={14} />
                <span>VRAM: {liveTelemetry.vramUsedMB} MB{liveTelemetry.vramTotalMB ? ` / ${liveTelemetry.vramTotalMB} MB` : ''}</span>
              </div>
            )}

            {/* Cache Status */}
            {liveTelemetry.promptCacheHit !== undefined && (
              <div
                className={`flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                  liveTelemetry.promptCacheHit
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : 'bg-white/5 text-theme-muted border-white/10'
                }`}
                title="Повторное использование кэша промпта llama.cpp"
              >
                <span>Cache {liveTelemetry.promptCacheHit ? 'HIT' : 'MISS'}</span>
              </div>
            )}
          </>
        ) : (
          <span className="text-theme-muted text-[11px]">Телеметрия готова к приему данных...</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handlePurgeVram}
          disabled={purging}
          className="px-2 py-0.5 rounded border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
          title="Очистить видеопамять GPU и остановить процессы llama-server"
        >
          <MaterialIcon name="cleaning_services" size={13} className={purging ? 'animate-spin' : ''} />
          <span>{purging ? 'Purging...' : 'Purge VRAM'}</span>
        </button>

        {onTogglePlanningMode && (
          <button
            type="button"
            onClick={onTogglePlanningMode}
            className={`px-2 py-0.5 rounded border text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
              planningMode
                ? 'bg-[var(--theme-accent)]/20 border-[var(--theme-accent)]/40 text-theme-accent'
                : 'bg-white/5 border-theme-border text-theme-muted hover:text-theme-text'
            }`}
            title="Переключить режим планирования"
          >
            <MaterialIcon name="psychology" size={14} />
            <span>Планирование {planningMode ? 'ON' : 'OFF'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
