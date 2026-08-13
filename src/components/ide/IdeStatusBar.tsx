import React from 'react';
import {
  GitBranch,
  Folder,
  Cpu,
  Terminal,
  Zap,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Code2,
} from 'lucide-react';
import { AppConfig, LiveTelemetry } from '../../types';
import { getWorkspaceBaseName } from '../../utils/helpers';

interface IdeStatusBarProps {
  workspaceDir?: string | null;
  selectedFileName?: string | null;
  agentStatus: 'idle' | 'thinking' | 'waiting_approval' | 'executing_tool';
  liveTelemetry?: LiveTelemetry | null;
  config?: AppConfig | null;
  isServerOffline?: boolean;
  onToggleLogs?: () => void;
  chatMode?: 'agent' | 'simple';
  onToggleChatMode?: () => void;
}

export const IdeStatusBar: React.FC<IdeStatusBarProps> = ({
  workspaceDir,
  selectedFileName,
  agentStatus,
  liveTelemetry,
  config,
  isServerOffline = false,
  onToggleLogs,
  chatMode = 'agent',
  onToggleChatMode,
}) => {
  const activeModelId = config?.model_name || 'gemini-3.6-flash';
  const isLocal = activeModelId.startsWith('local:') || activeModelId.endsWith('.gguf');

  // Agent status ASCII Badge
  const getAgentStatusBadge = () => {
    switch (agentStatus) {
      case 'thinking':
        return (
          <span className="flex items-center gap-1 text-sky-400 font-bold animate-pulse">
            <span>⚡</span>
            <span>[THINKING]</span>
          </span>
        );
      case 'executing_tool':
        return (
          <span className="flex items-center gap-1 text-amber-400 font-bold animate-pulse">
            <span>⚙️</span>
            <span>[EXEC TOOLS]</span>
          </span>
        );
      case 'waiting_approval':
        return (
          <span className="flex items-center gap-1 text-rose-400 font-bold animate-pulse">
            <span>✋</span>
            <span>[CONFIRM]</span>
          </span>
        );
      case 'idle':
      default:
        return (
          <span className="flex items-center gap-1 text-emerald-400/80 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            <span>IDLE</span>
          </span>
        );
    }
  };

  return (
    <footer className="w-full h-6 bg-slate-950 border-t border-white/10 px-2.5 flex items-center justify-between text-[11px] font-mono text-slate-400 select-none z-30 shrink-0 backdrop-blur-md">
      
      {/* LEFT: WORKSPACE, BRANCH & FILE INFO */}
      <div className="flex items-center gap-3 overflow-hidden">
        {/* Workspace Folder */}
        <div className="flex items-center gap-1.5 text-slate-300 truncate max-w-[160px]" title={workspaceDir || 'Воркспейс не выбран'}>
          <Folder size={11} className="text-emerald-400 shrink-0" />
          <span className="truncate">{getWorkspaceBaseName(workspaceDir)}</span>
        </div>

        {/* Git Branch Dummy/Mock */}
        <div className="hidden sm:flex items-center gap-1 text-slate-400">
          <GitBranch size={11} className="text-sky-400" />
          <span>main</span>
        </div>

        {/* Selected File Stats */}
        {selectedFileName && (
          <div className="hidden md:flex items-center gap-2 text-slate-400 border-l border-white/10 pl-2">
            <span className="text-slate-200 font-semibold truncate max-w-[140px]">
              {selectedFileName}
            </span>
            <span className="text-slate-600">|</span>
            <span>UTF-8</span>
            <span className="text-slate-600">|</span>
            <span>Spaces: 2</span>
          </div>
        )}
      </div>

      {/* CENTER: LIVE AGENT ASCII STATUS & TELEMETRY */}
      <div className="flex items-center gap-2.5 px-2">
        {getAgentStatusBadge()}

        {liveTelemetry && (
          <div className="hidden lg:flex items-center gap-2 text-[10px] text-slate-400">
            {liveTelemetry.tokensPerSec !== undefined && liveTelemetry.tokensPerSec > 0 && (
              <span className="text-emerald-300 font-bold flex items-center gap-0.5">
                <Zap size={10} />
                <span>{liveTelemetry.tokensPerSec} t/s</span>
              </span>
            )}
            {liveTelemetry.contextUsed !== undefined && (
              <span className="text-sky-300 font-medium">
                {liveTelemetry.contextUsed.toLocaleString()} tok
              </span>
            )}
          </div>
        )}
      </div>

      {/* RIGHT: MODE SWITCHER, MODEL & LOGS */}
      <div className="flex items-center gap-2.5">
        
        {/* Chat Mode Toggle Pill (IDE Agent vs Simple Chat) */}
        {onToggleChatMode && (
          <button
            type="button"
            onClick={onToggleChatMode}
            className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold flex items-center gap-1 transition-all cursor-pointer ${
              chatMode === 'agent'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
            }`}
            title={chatMode === 'agent' ? 'Переключить в режим диалога с Личностями' : 'Переключить в автономный режим IDE Агента'}
          >
            {chatMode === 'agent' ? <Code2 size={10} /> : <MessageSquare size={10} />}
            <span>{chatMode === 'agent' ? 'IDE Agent' : 'Simple Chat'}</span>
          </button>
        )}

        {/* Active Model Identifier */}
        <div className="hidden sm:flex items-center gap-1 text-slate-300" title={`Активная модель: ${activeModelId}`}>
          <Cpu size={11} className={isLocal ? 'text-amber-400' : 'text-purple-400'} />
          <span className="truncate max-w-[120px]">{activeModelId}</span>
        </div>

        {/* Server Status Icon */}
        <div className="flex items-center gap-1" title={isServerOffline ? 'Локальный сервер llama.cpp офлайн' : 'Локальный сервер онлайн'}>
          {isServerOffline ? (
            <AlertCircle size={11} className="text-rose-400" />
          ) : (
            <CheckCircle2 size={11} className="text-emerald-400" />
          )}
        </div>

        {/* Console Logs Toggle */}
        {onToggleLogs && (
          <button
            type="button"
            onClick={onToggleLogs}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
            title="Открыть консоль логов"
          >
            <Terminal size={11} />
          </button>
        )}
      </div>

    </footer>
  );
};
