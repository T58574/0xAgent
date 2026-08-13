import React from 'react';
import { LiveTelemetry } from '../../types';
import { MaterialIcon } from '../common/MaterialIcon';

interface ChatTelemetryBarProps {
  liveTelemetry: LiveTelemetry | null;
  planningMode: boolean;
  onTogglePlanningMode?: () => void;
}

export const ChatTelemetryBar: React.FC<ChatTelemetryBarProps> = ({
  liveTelemetry,
  planningMode,
  onTogglePlanningMode,
}) => {
  return (
    <div className="px-3 py-1.5 glass-panel border-b border-theme-border flex flex-wrap items-center justify-between text-xs text-theme-text font-mono shrink-0">
      <div className="flex items-center gap-3.5 flex-wrap">
        {liveTelemetry ? (
          <>
            {/* Speed t/s */}
            <div className="flex items-center gap-1 text-emerald-400 font-semibold" title="Скорость генерации (токенов в секунду)">
              <MaterialIcon name="bolt" size={14} />
              <span>{(liveTelemetry.tokensPerSec ?? 0).toFixed(1)} t/s</span>
            </div>

            {/* Token count */}
            <div className="flex items-center gap-1 text-theme-accent" title="Сгенерировано токенов">
              <MaterialIcon name="memory" size={14} />
              <span>{liveTelemetry.tokenCount ?? 0} tok</span>
            </div>

            {/* Context Window */}
            {liveTelemetry.contextUsed !== undefined && (
              <div className="flex items-center gap-1 text-theme-muted" title="Использование контекстного окна">
                <MaterialIcon name="psychology" size={14} />
                <span>
                  Context: {liveTelemetry.contextUsed.toLocaleString()}{liveTelemetry.contextMax ? ` / ${liveTelemetry.contextMax.toLocaleString()}` : ''}
                </span>
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
  );
};
