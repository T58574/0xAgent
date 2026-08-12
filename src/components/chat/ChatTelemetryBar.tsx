import React from 'react';
import { LiveTelemetry } from '../../types';
import { Zap, Cpu, Compass } from 'lucide-react';

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
    <div className="px-4 py-2 bg-slate-900/60 border-b border-white/10 flex items-center justify-between text-xs text-slate-300">
      <div className="flex items-center gap-4">
        {liveTelemetry && (
          <>
            <div className="flex items-center gap-1.5 text-emerald-400 font-mono">
              <Zap size={13} />
              <span>{(liveTelemetry.tokensPerSec ?? 0).toFixed(1)} t/s</span>
            </div>
            <div className="flex items-center gap-1.5 text-sky-400 font-mono">
              <Cpu size={13} />
              <span>{liveTelemetry.tokenCount ?? 0} токенов</span>
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={onTogglePlanningMode}
        className={`px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition-all ${
          planningMode
            ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
            : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
        }`}
      >
        <Compass size={13} />
        <span>Планирование {planningMode ? 'ВКЛ' : 'ВЫКЛ'}</span>
      </button>
    </div>
  );
};
