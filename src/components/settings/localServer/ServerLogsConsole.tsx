import React from 'react';
import { Terminal, Check, Copy, FileText } from 'lucide-react';

interface ServerLogsConsoleProps {
  serverLogs: string[];
  logFilePath: string;
  serverLogsAutoScroll: boolean;
  setServerLogsAutoScroll: (val: boolean) => void;
  isCopiedLogs: boolean;
  onCopyLogs: () => void;
  onDownloadLogs: () => void;
  onClearLogs: () => void;
  logsContainerRef: React.RefObject<HTMLDivElement | null>;
  logsEndRef: React.RefObject<HTMLDivElement | null>;
}

export const ServerLogsConsole: React.FC<ServerLogsConsoleProps> = ({
  serverLogs,
  logFilePath,
  serverLogsAutoScroll,
  setServerLogsAutoScroll,
  isCopiedLogs,
  onCopyLogs,
  onDownloadLogs,
  onClearLogs,
  logsContainerRef,
  logsEndRef,
}) => {
  return (
    <div className="glass-panel border border-[var(--theme-border)] rounded-xl overflow-hidden flex flex-col h-[650px] max-h-[calc(100vh-140px)] shadow-2xl">
      {/* Terminal Header Bar */}
      <div className="bg-slate-900/90 px-3.5 py-2.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-slate-100">Логи Сервера (llama-server.log)</span>
          {logFilePath && (
            <span className="text-[10px] text-slate-400 font-mono hidden xl:inline" title={logFilePath}>
              (~/.0xagent/logs)
            </span>
          )}
        </div>

        {/* Console Action Buttons */}
        <div className="flex items-center gap-2 text-[11px]">
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white select-none">
            <input
              type="checkbox"
              checked={serverLogsAutoScroll}
              onChange={(e) => setServerLogsAutoScroll(e.target.checked)}
              className="rounded bg-slate-950 border-white/20 text-emerald-500 focus:ring-0"
            />
            <span>Auto-scroll</span>
          </label>

          <button
            type="button"
            onClick={onCopyLogs}
            className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white flex items-center gap-1 transition-all cursor-pointer"
            title="Копировать все логи"
          >
            {isCopiedLogs ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span>{isCopiedLogs ? 'Скопировано!' : 'Копия'}</span>
          </button>

          <button
            type="button"
            onClick={onDownloadLogs}
            className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white flex items-center gap-1 transition-all cursor-pointer"
            title="Скачать файл логов"
          >
            <FileText size={12} className="text-sky-400" />
            <span>Файл</span>
          </button>

          <button
            type="button"
            onClick={onClearLogs}
            className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-medium cursor-pointer transition-all"
            title="Очистить экран логов"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      <div ref={logsContainerRef} className="flex-1 p-3.5 font-mono text-[11px] bg-slate-950/95 text-emerald-400 overflow-y-auto space-y-1.5 select-text scrollbar-thin rounded-b-xl">
        {serverLogs.length > 0 ? (
          serverLogs.map((log, index) => {
            const isError = log.includes('[ERROR]') || log.includes('error') || log.includes('FAILED');
            const isCmd = log.includes('[CMD]');
            const isSystem = log.includes('[SYSTEM]') || log.includes('[WATCHDOG');
            return (
              <div
                key={index}
                className={`break-all leading-relaxed ${
                  isError
                    ? 'text-rose-400 font-bold bg-rose-950/30 p-1 rounded border border-rose-500/20'
                    : isCmd
                    ? 'text-sky-300 font-bold'
                    : isSystem
                    ? 'text-amber-300'
                    : 'text-emerald-400'
                }`}
              >
                {log}
              </div>
            );
          })
        ) : (
          <div className="text-slate-500 italic p-4 text-center">
            Логи сервера будут автоматически сохранены и отображены в этом окне при запуске llama-server.exe.
          </div>
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};
