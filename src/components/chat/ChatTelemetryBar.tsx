import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LiveTelemetry, ChatSession, AppConfig, QuotaStatus } from '../../types';
import { MaterialIcon } from '../common/MaterialIcon';
import { purge_vram, reset_quota } from '../../services/api';

interface ChatTelemetryBarProps {
  liveTelemetry: LiveTelemetry | null;
  currentSession?: ChatSession | null;
  config?: AppConfig | null;
  quotaStatus?: QuotaStatus | null;
  isGenerating?: boolean;
  elapsedSeconds?: number;
  onOpenCustomizations?: () => void;
}

export const ChatTelemetryBar: React.FC<ChatTelemetryBarProps> = ({
  liveTelemetry,
  currentSession,
  config,
  quotaStatus,
  isGenerating = false,
  elapsedSeconds: externalElapsedSeconds,
  onOpenCustomizations,
}) => {
  const [purging, setPurging] = useState(false);
  const [resettingQuota, setResettingQuota] = useState(false);
  const [internalSeconds, setInternalSeconds] = useState(0);
  const timerStartRef = useRef<number | null>(null);

  // Live stopwatch timer during active generation
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

  const handleResetQuota = async () => {
    setResettingQuota(true);
    try {
      await reset_quota();
    } catch {}
    finally {
      setResettingQuota(false);
    }
  };

  // 1. Live Countdown for Real 429 Quota Exhaustion
  const [resetCountdown, setResetCountdown] = useState<string>('');
  const activeQuota = liveTelemetry?.quotaStatus || quotaStatus;

  useEffect(() => {
    if (!activeQuota?.exhausted) {
      setResetCountdown('');
      return;
    }

    if (!activeQuota.resetAt) {
      setResetCountdown(activeQuota.resetText || '60s');
      return;
    }

    const updateCountdown = () => {
      const diffMs = (activeQuota.resetAt || 0) - Date.now();
      if (diffMs <= 0) {
        setResetCountdown('00:00 (Ready)');
      } else {
        const totalSec = Math.ceil(diffMs / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        const pad = (n: number) => String(n).padStart(2, '0');
        setResetCountdown(h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [activeQuota?.exhausted, activeQuota?.resetAt, activeQuota?.resetText]);

  // 2. Genuine session token tracking from active stream or latest message
  const messages = currentSession?.messages || [];
  const lastAssistantMsg = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && messages[i].metrics) {
        return messages[i];
      }
    }
    return null;
  }, [messages]);

  const dialogueTokens = useMemo(() => {
    if (messages.length === 0) return 0;
    let totalChars = 0;
    messages.forEach((m) => {
      totalChars += (m.content || '').length;
      if (m.tool_calls) {
        m.tool_calls.forEach((tc) => {
          totalChars += typeof tc.arguments === 'string' ? tc.arguments.length : JSON.stringify(tc.arguments || {}).length;
          totalChars += (tc.output || tc.result || '').length;
        });
      }
    });
    return Math.max(1, Math.round(totalChars / 3.5));
  }, [messages]);

  const sessionMetrics = lastAssistantMsg?.metrics;

  const usedTokens =
    (liveTelemetry && typeof liveTelemetry.contextUsed === 'number' && liveTelemetry.contextUsed > 0)
      ? liveTelemetry.contextUsed
      : (sessionMetrics && typeof sessionMetrics.contextUsed === 'number' && sessionMetrics.contextUsed > 0)
      ? sessionMetrics.contextUsed
      : (sessionMetrics && typeof sessionMetrics.totalTokens === 'number' && sessionMetrics.totalTokens > 0)
      ? sessionMetrics.totalTokens
      : dialogueTokens;

  const maxTokens =
    liveTelemetry?.contextMax ||
    sessionMetrics?.contextMax ||
    config?.local_server?.ctx_size ||
    config?.max_tokens ||
    32768;

  const tokensPerSec = liveTelemetry?.tokensPerSec ?? sessionMetrics?.tokensPerSec;
  const tokenCount = liveTelemetry?.tokenCount ?? sessionMetrics?.tokenCount ?? sessionMetrics?.completionTokens;
  const rawModelName = liveTelemetry?.modelName || sessionMetrics?.modelName || config?.model_name || '0xAgent';
  const cleanModelName = rawModelName.replace(/^local:/, '').replace(/\.gguf$/i, '');

  const isSlow =
    tokensPerSec !== undefined &&
    tokensPerSec > 0 &&
    tokensPerSec < 8.0 &&
    (tokenCount ?? 0) > 20;

  const contextPct = maxTokens > 0 ? Math.min(100, Math.max(0, Math.round((usedTokens / maxTokens) * 100))) : 0;

  return (
    <div className="px-3 py-1.5 glass-panel border-b border-theme-border flex flex-wrap items-center justify-between text-xs text-theme-text font-mono shrink-0 select-none">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Active Model Name Badge */}
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--theme-card-bg)] border border-[var(--theme-border)] text-[11px] font-semibold text-[var(--theme-text)] cursor-default"
          title={`Активная модель: ${rawModelName}`}
        >
          <MaterialIcon name="smart_toy" size={13} className="text-[var(--theme-accent)]" />
          <span className="truncate max-w-[140px] sm:max-w-[180px]">{cleanModelName}</span>
        </div>

        {/* Live streaming stopwatch timer in agy CLI aesthetic */}
        {(isGenerating || displaySeconds > 0) && (
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] font-mono font-bold transition-all ${
              isGenerating
                ? 'bg-[var(--theme-accent)]/15 border-[var(--theme-accent)]/30 text-[var(--theme-accent)] animate-pulse'
                : 'bg-white/5 border-theme-border text-theme-muted'
            }`}
            title="Время выполнения стрима (agy CLI stopwatch)"
          >
            <MaterialIcon name="schedule" size={13} className={isGenerating ? 'animate-spin' : ''} />
            <span>{displaySeconds.toFixed(1)}s</span>
          </div>
        )}

        {/* Real 429 Quota Exhaustion Banner with live countdown */}
        {activeQuota?.exhausted && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 text-[11px] font-bold animate-pulse"
            title={`Лимит квоты исчерпан (429). ${activeQuota.reason || ''}`}
          >
            <MaterialIcon name="hourglass_empty" size={13} className="text-rose-400" />
            <span>[429 QUOTA EXHAUSTED]</span>
            {resetCountdown && (
              <span className="text-amber-300 font-mono tracking-wider ml-1">
                Resets: {resetCountdown}
              </span>
            )}
            <button
              type="button"
              onClick={handleResetQuota}
              disabled={resettingQuota}
              className="ml-1 px-1.5 py-0.2 rounded bg-rose-500/20 hover:bg-rose-500/30 text-[10px] text-white border border-rose-500/30 cursor-pointer disabled:opacity-50"
              title="Сбросить статус исчерпания квоты"
            >
              {resettingQuota ? '...' : 'Reset'}
            </button>
          </div>
        )}

        {/* Speed t/s */}
        {tokensPerSec !== undefined && tokensPerSec > 0 && (
          <div
            className="flex items-center gap-1 text-emerald-400 font-semibold"
            title={isGenerating ? 'Текущая скорость стриминга' : 'Скорость последней генерации'}
          >
            <MaterialIcon name="bolt" size={14} />
            <span>{tokensPerSec.toFixed(1)} t/s</span>
          </div>
        )}

        {/* Performance Slowdown Warning */}
        {isSlow && (
          <div
            className="flex items-center gap-1 text-amber-400 font-bold px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/30 text-[10px]"
            title="Зафиксировано замедление генерации (<8 t/s). Рекомендуется очистить VRAM."
          >
            <MaterialIcon name="warning" size={12} />
            <span>SLOW (VRAM)</span>
          </div>
        )}

        {/* Token Count */}
        {tokenCount !== undefined && tokenCount > 0 && (
          <div className="flex items-center gap-1 text-theme-accent" title="Сгенерировано токенов">
            <MaterialIcon name="memory" size={14} />
            <span>{tokenCount.toLocaleString()} tok</span>
          </div>
        )}

        {/* Context Window & 10-Segment Unicode Indicator */}
        <button
          type="button"
          onClick={onOpenCustomizations}
          className="flex items-center gap-2 text-theme-muted hover:text-theme-text transition-colors cursor-pointer"
          title="Использование контекста и 10-сегментная квота agy. Нажмите для подробного отчёта."
        >
          <div className="flex items-center gap-1">
            <MaterialIcon name="psychology" size={14} />
            <span>
              Context: {usedTokens.toLocaleString()} / {maxTokens.toLocaleString()}
            </span>
          </div>
          <span
            className={`font-mono text-[10px] font-bold tracking-tight select-none ${
              contextPct > 85 ? 'text-rose-400' : contextPct > 65 ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            {contextPct}%
          </span>
        </button>

        {/* TTFT (Time-to-first-token) */}
        {liveTelemetry?.ttftMs !== undefined && liveTelemetry.ttftMs > 0 && (
          <div className="flex items-center gap-1 text-amber-400" title="Время до первого токена (TTFT)">
            <MaterialIcon name="timer" size={14} />
            <span>TTFT: {liveTelemetry.ttftMs}ms</span>
          </div>
        )}

        {/* VRAM MB */}
        {liveTelemetry?.vramUsedMB !== undefined && liveTelemetry.vramUsedMB > 0 && (
          <div className="flex items-center gap-1 text-purple-400" title="Занято VRAM">
            <MaterialIcon name="developer_board" size={14} />
            <span>VRAM: {liveTelemetry.vramUsedMB} MB{liveTelemetry.vramTotalMB ? ` / ${liveTelemetry.vramTotalMB} MB` : ''}</span>
          </div>
        )}

        {/* Cache Status */}
        {liveTelemetry?.promptCacheHit !== undefined && (
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
      </div>

      <div className="flex items-center gap-2 mt-1 sm:mt-0">
        <button
          type="button"
          onClick={handlePurgeVram}
          disabled={purging}
          className="px-2 py-0.5 rounded border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
          title="Очистить видеопамять GPU и освободить кэш"
        >
          <MaterialIcon name="cleaning_services" size={13} className={purging ? 'animate-spin' : ''} />
          <span>{purging ? 'Purging...' : 'Purge VRAM'}</span>
        </button>
      </div>
    </div>
  );
};
