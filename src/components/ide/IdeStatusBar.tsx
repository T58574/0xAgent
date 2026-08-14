import React from 'react';
import {
  GitBranch,
  Folder,
  Terminal,
  Zap,
} from 'lucide-react';
import { LiveTelemetry } from '../../types';
import { getWorkspaceBaseName } from '../../utils/helpers';

interface IdeStatusBarProps {
  workspaceDir?: string | null;
  selectedFileName?: string | null;
  agentStatus: 'idle' | 'thinking' | 'waiting_approval' | 'executing_tool';
  liveTelemetry?: LiveTelemetry | null;
  isServerOffline?: boolean;
  onToggleLogs?: () => void;
}

export const IdeStatusBar: React.FC<IdeStatusBarProps> = ({
  workspaceDir,
  selectedFileName,
  agentStatus,
  liveTelemetry,
  isServerOffline = false,
  onToggleLogs,
}) => {

  const getAgentStatusBadge = () => {
    switch (agentStatus) {
      case 'thinking':
        return (
          <span className="flex items-center gap-1 text-[var(--theme-accent)] font-bold animate-pulse">
            <span className="text-xs">›</span>
            <span>[THINKING]</span>
          </span>
        );
      case 'executing_tool':
        return (
          <span className="flex items-center gap-1 text-amber-400 font-bold animate-pulse">
            <span className="text-xs">›</span>
            <span>[EXEC TOOLS]</span>
          </span>
        );
      case 'waiting_approval':
        return (
          <span className="flex items-center gap-1 text-red-400 font-bold animate-pulse">
            <span className="text-xs">!</span>
            <span>[CONFIRM]</span>
          </span>
        );
      case 'idle':
      default:
        return (
          <span className="flex items-center gap-1 text-[var(--theme-accent)]/90 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-accent)] inline-block" />
            <span>IDLE</span>
          </span>
        );
    }
  };

  return (
    <footer className="w-full h-6 bg-[var(--theme-panel)]/95 border-t border-[var(--theme-border)] px-3 flex items-center justify-between text-[11px] font-mono text-[var(--theme-text-muted)] select-none z-30 shrink-0 backdrop-blur-md">
      
      {/* LEFT: WORKSPACE, BRANCH & FILE INFO */}
      <div className="flex items-center gap-3 overflow-hidden">
        {/* Workspace Folder */}
        <div className="flex items-center gap-1.5 text-[var(--theme-text)] truncate max-w-[160px]" title={workspaceDir || 'Воркспейс не выбран'}>
          <Folder size={11} className="text-[var(--theme-accent)] shrink-0" />
          <span className="truncate">{getWorkspaceBaseName(workspaceDir)}</span>
        </div>

        {/* Git Branch */}
        <div className="hidden sm:flex items-center gap-1 text-[var(--theme-text-muted)]">
          <GitBranch size={11} className="text-[var(--theme-accent)]" />
          <span>main</span>
        </div>

        {/* Selected File Stats */}
        {selectedFileName && (
          <div className="hidden md:flex items-center gap-2 text-[var(--theme-text-muted)] border-l border-[var(--theme-border)] pl-2">
            <span className="text-[var(--theme-text)] font-semibold truncate max-w-[140px]">
              {selectedFileName}
            </span>
            <span className="opacity-40">|</span>
            <span>UTF-8</span>
            <span className="opacity-40">|</span>
            <span>Spaces: 2</span>
          </div>
        )}
      </div>

      {/* CENTER: LIVE AGENT STATUS & TELEMETRY */}
      <div className="flex items-center gap-2.5 px-2">
        {getAgentStatusBadge()}

        {liveTelemetry && (
          <div className="hidden lg:flex items-center gap-2 text-[10px] text-[var(--theme-text-muted)]">
            {liveTelemetry.tokensPerSec !== undefined && liveTelemetry.tokensPerSec > 0 && (
              <span className="text-[var(--theme-accent)] font-bold flex items-center gap-0.5">
                <Zap size={10} />
                <span>{liveTelemetry.tokensPerSec} t/s</span>
              </span>
            )}
            {liveTelemetry.contextUsed !== undefined && (
              <span className="text-[var(--theme-text)] font-medium">
                {liveTelemetry.contextUsed.toLocaleString()} tok
              </span>
            )}
          </div>
        )}
      </div>

      {/* RIGHT: SERVER STATUS & LOGS */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bento-card text-[10px]" title={isServerOffline ? 'LLM Сервер офлайн' : 'LLM Сервер готов'}>
          <span className={`w-1.5 h-1.5 rounded-full ${isServerOffline ? 'bg-rose-500' : 'bg-[var(--theme-accent)]'}`} />
          <span className="text-[var(--theme-text-muted)]">{isServerOffline ? 'Offline' : 'Ready'}</span>
        </div>

        {onToggleLogs && (
          <button
            type="button"
            onClick={onToggleLogs}
            className="px-2 py-0.5 rounded bento-card hover:bg-white/10 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors cursor-pointer flex items-center gap-1 text-[10px]"
            title="Открыть консоль логов"
          >
            <Terminal size={11} className="text-[var(--theme-accent)]" />
            <span>Логи</span>
          </button>
        )}
      </div>

    </footer>
  );
};
